import { app,BrowserWindow,ipcMain,dialog,nativeImage,clipboard,session } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ProfileStore } from './store';
import { startOutputServer } from './server';
import { profileSchema } from '../src/shared/types';
import { allowStudioMedia } from './media-permissions';
// Keep the original storage and single-instance identity across the Sprout rename.
const dataDirectory=process.env.SPROUT_DATA_DIR||process.env.LUMA_DATA_DIR;
app.setPath('userData',dataDirectory?path.resolve(dataDirectory):path.join(app.getPath('appData'),'luma-pngtuber'));
const testMode=process.env.SPROUT_TEST_MODE||process.env.LUMA_TEST_MODE;
if(testMode){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-background-timer-throttling');app.commandLine.appendSwitch('disable-renderer-backgrounding');}
if(!app.requestSingleInstanceLock())app.quit();
let win:BrowserWindow|undefined;
app.on('second-instance',()=>{win?.show();win?.focus();});
app.whenReady().then(async()=>{
  const dist=path.join(app.getAppPath(),'dist');const store=new ProfileStore(app.getPath('userData'),dist);await store.init();
  const prefs=await store.preferences();const token=typeof prefs.token==='string'&&/^[a-f0-9]{64}$/.test(prefs.token)?prefs.token:randomBytes(32).toString('hex');const studioToken=randomBytes(32).toString('hex');
  let profiles=await store.list();if(!profiles.length)profiles=[await store.create('Sprout')];let active=profiles.find(p=>p.id===prefs.active)||profiles[0];
  const output=await startOutputServer(dist,store,token,studioToken,active,prefs.port||18743);await store.setPreferences({token,active:active.id,port:output.port});
  const studioURL=`${output.url}/index.html?studio=${studioToken}`;
  function authorized(e:Electron.IpcMainEvent|Electron.IpcMainInvokeEvent){if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||e.senderFrame.url!==studioURL)throw new Error('Untrusted application frame.');}
  let queue=Promise.resolve();const serial=<T>(job:()=>Promise<T>):Promise<T>=>{const result=queue.then(job);queue=result.then(()=>{},()=>{});return result;};
  ipcMain.handle('config',async e=>{authorized(e);return {outputUrl:`${output.url}/overlay.html?token=${token}`,assetBase:`${output.url}/avatar/`,profiles:await store.list(),active,storage:store.root,serverWarning:output.warning};});
  ipcMain.handle('save',async(e,p)=>{authorized(e);return serial(async()=>{active=await store.save(p);output.setProfile(active);await store.setPreferences({token,active:active.id,port:output.port});});});
  ipcMain.handle('preview',async(e,p)=>{authorized(e);active=profileSchema.parse(p);output.setProfile(active);});
  ipcMain.handle('activate',async(e,id)=>{authorized(e);return serial(async()=>{active=await store.load(id);output.setProfile(active);await store.setPreferences({token,active:active.id,port:output.port});return active;});});
  ipcMain.handle('create',async(e,name)=>{authorized(e);if(typeof name!=='string')throw new Error('Invalid name');return serial(async()=>{active=await store.create(name);output.setProfile(active);await store.setPreferences({token,active:active.id,port:output.port});return active;});});
  ipcMain.handle('import',async e=>{authorized(e);const result=await dialog.showOpenDialog(win!,{title:'Import PNG artwork',filters:[{name:'PNG artwork',extensions:['png']}],properties:['openFile']});if(result.canceled)return null;const stat=await fs.stat(result.filePaths[0]);if(stat.size>20*1024*1024)throw new Error('Choose a PNG smaller than 20 MB.');const bytes=await fs.readFile(result.filePaths[0]);const image=nativeImage.createFromBuffer(bytes),size=image.getSize();if(image.isEmpty()||size.width>4096||size.height>4096)throw new Error('PNG must be readable and no larger than 4096 × 4096.');return {...size,asset:await store.importBytes(bytes)};});
  ipcMain.handle('copy',(e,text)=>{authorized(e);if(typeof text==='string'&&text.length<4096)clipboard.writeText(text);});
  ipcMain.on('publish',(e,s)=>{try{authorized(e);output.publish(s);}catch{/* Reject invalid renderer messages. */}});
  session.defaultSession.setPermissionRequestHandler((web,permission,callback,details)=>{callback(web===win?.webContents&&allowStudioMedia(permission,details,studioURL));});
  session.defaultSession.setPermissionCheckHandler((web,permission,origin,details)=>web===win?.webContents&&allowStudioMedia(permission,details,studioURL,origin));
  win=new BrowserWindow({width:1440,height:940,minWidth:1100,minHeight:760,backgroundColor:'#f7f5ef',title:'Sprout · Avatar studio',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==studioURL)e.preventDefault();});
  if(testMode){win.webContents.on('render-process-gone',(_e,details)=>console.error('Renderer exited:',details));win.webContents.on('did-fail-load',(_e,code,description)=>console.error('Navigation failed:',code,description));}
  win.once('ready-to-show',()=>{if(!testMode)win?.show();});await win.loadURL(studioURL);
  app.on('before-quit',()=>{void output.close();});
}).catch(async e=>{dialog.showErrorBox('Sprout could not start',`${e.message}\nCheck that your profile folder is writable, then restart.`);app.quit();});
app.on('window-all-closed',()=>app.quit());
