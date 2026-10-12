const {_electron}=require(process.env.SPROUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp');
const {buildSync}=require('esbuild');
const code=buildSync({stdin:{contents:"export {AvatarRenderer} from './src/shared/render';export {CartoonMotion,cartoonDemo} from './src/shared/cartoon';export {IDLE} from './src/shared/types';",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',globalName:'CartoonTest',write:false,preserveSymlinks:true}).outputFiles[0].text;
(async()=>{
  const workspace=path.resolve('../..'),data=process.env.SPROUT_SMOKE_DATA_DIR||path.join(workspace,'work/smoke-cartoon-v040');
  const launch=()=>_electron.launch({executablePath:process.env.SPROUT_EXECUTABLE||require('electron'),args:process.env.SPROUT_EXECUTABLE?['--no-sandbox']:['.','--no-sandbox'],env:{...process.env,SPROUT_TEST_MODE:'1',SPROUT_DATA_DIR:data},timeout:30000});
  let app=await launch(),page;const errors=[];
  try {
    page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.getByRole('heading',{name:'Bring a little character.'}).waitFor();
    const config=await page.evaluate(()=>window.desktop.config());if(config.serverWarning)await page.getByRole('button',{name:'Dismiss error'}).click();
    await page.getByRole('button',{name:'Motion',exact:true}).click();
    assert.equal(await page.getByRole('switch',{name:'Cartoon animation',exact:true}).getAttribute('aria-checked'),'true');
    await page.getByRole('slider',{name:/^Cartoon intensity/}).fill('0.8');
    await page.getByRole('button',{name:'Full animation',exact:true}).click();
    const before=await page.locator('.stage canvas').evaluate(c=>c.toDataURL());
    await page.waitForFunction(before=>document.querySelector('.stage canvas').toDataURL()!==before,before);
    await page.screenshot({path:path.join(workspace,'outputs/Sprout-cartoon-preview.png')});
    await page.getByRole('button',{name:'Return to live preview'}).click();
    await page.getByRole('button',{name:'Artwork & rig',exact:true}).click();
    await page.getByRole('button',{name:'Add layer',exact:true}).click();
    await page.getByRole('combobox',{name:'Accessory follows',exact:true}).selectOption('head');
    await page.getByRole('button',{name:'Save changes'}).click();await page.getByRole('button',{name:'Saved',exact:true}).waitFor();
    const saved=(await page.evaluate(()=>window.desktop.config())).active;assert.equal(saved.settings.cartoon,.8);assert.equal(saved.layers.at(-1).attachment,'head');

    const next=app.waitForEvent('window');await app.evaluate(async({BrowserWindow},url)=>{const w=new BrowserWindow({width:1024,height:1024,useContentSize:true,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});await w.loadURL(url);},config.outputUrl);
    const overlay=await next;overlay.on('pageerror',e=>errors.push(e.message));await overlay.setViewportSize({width:1024,height:1024});
    await app.evaluate(({BrowserWindow},source)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/index.html')).webContents.executeJavaScript(source+';window.__cartoonTest=CartoonTest;undefined;'),code);
    await page.evaluate(config=>{
      const c=document.createElement('canvas');c.width=c.height=1024;
      window.__reference=c;window.__referenceRenderer=new window.__cartoonTest.AvatarRenderer(c,a=>config.assetBase+a+'?token='+new URL(config.outputUrl).searchParams.get('token'));
    },config);
    // Freeze only output publication through the real IPC handler. Production code
    // remains unchanged; reference frames use the shared renderer and explicit state.
    await app.evaluate(({ipcMain})=>{const original=ipcMain.listeners('publish')[0];ipcMain.removeAllListeners('publish');ipcMain.on('publish',(event,state)=>original(event,globalThis.__cartoonFrozen||state));});
    const states=await page.evaluate(()=>{
      const motion=new window.__cartoonTest.CartoonMotion(),out=[];
      for(let i=0;i<160;i++){const state=window.__cartoonTest.cartoonDemo(i*50);state.cartoon=motion.step(state,{cartoon:.8,strength:1,bounce:true},50);if([8,18,45,63,88,105,121,140].includes(i))out.push(state);}
      return out;
    });
    for(const mode of ['simple','layered'])for(const attachment of mode==='layered'?['body','head']:['body'])for(const mirrorAvatar of [false,true]){
      const profile=structuredClone(saved);profile.mode=mode;profile.settings.mirror=false;profile.settings.mirrorAvatar=mirrorAvatar;
      Object.assign(profile.layers.at(-1),{asset:'sample/brows.png',width:1024,height:1024,scale:.35,x:440,y:140,attachment});
      await page.evaluate(p=>window.desktop.preview(p),profile);
      for(const state of states){
        await app.evaluate((_,s)=>{globalThis.__cartoonFrozen=s;},state);
        const reference=await page.evaluate(async({profile,state})=>{
          const renderer=window.__referenceRenderer;renderer.preload(profile);renderer.draw(profile,state);
          const images=[...renderer.images.values()];await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});})));
          renderer.draw(profile,state);
          return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',window.__reference.getContext('2d').getImageData(0,0,1024,1024).data))).join(',');
        },{profile,state});
        await overlay.waitForFunction(async expected=>{const c=document.querySelector('canvas');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,1024,1024).data))).join(',')===expected;},reference);
      }
    }
    assert.equal(await overlay.locator('video').count(),0);assert.equal(await overlay.evaluate(()=>document.querySelector('canvas').getContext('2d').getImageData(0,0,1,1).data[3]),0);
    // Export a deterministic classic/cartoon comparison from the same renderer.
    const frames=await page.evaluate(async saved=>{
      const api=window.__cartoonTest,canvas=document.createElement('canvas');canvas.width=640;canvas.height=356;const ctx=canvas.getContext('2d');
      const views=[0,.8].map(cartoon=>{const p=structuredClone(saved);p.layers=p.layers.filter(l=>l.id!=='New layer'&&l.role!=='accessory');p.settings.cartoon=cartoon;p.settings.mirror=false;p.settings.mirrorAvatar=false;return p;});
      const surfaces=views.map(()=>{const c=document.createElement('canvas');c.width=c.height=320;return c;});
      const renderers=surfaces.map(c=>new api.AvatarRenderer(c,window.__referenceRenderer.url));
      for(let i=0;i<2;i++){renderers[i].preload(views[i]);await Promise.all([...renderers[i].images.values()].map(img=>img.complete?Promise.resolve():new Promise(r=>img.addEventListener('load',r,{once:true}))));}
      const motion=new api.CartoonMotion(),frames=[];
      for(let i=0;i<120;i++){
        const s=api.cartoonDemo(i*8000/120);s.cartoon=motion.step(s,views[1].settings,8000/120);
        ctx.fillStyle='#eef3ed';ctx.fillRect(0,0,640,356);ctx.fillStyle='#314d40';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText('Classic',160,25);ctx.fillText('Cartoon 80%',480,25);
        renderers.forEach((renderer,j)=>{renderer.draw(views[j],s);ctx.drawImage(surfaces[j],j*320,36);});
        frames.push(canvas.toDataURL('image/png').split(',')[1]);
      }
      return frames;
    },saved);
    const pixels=await Promise.all(frames.map(frame=>sharp(Buffer.from(frame,'base64')).ensureAlpha().raw().toBuffer()));
    await sharp(Buffer.concat(pixels),{raw:{width:640,height:356*frames.length,channels:4,pageHeight:356}}).gif({delay:67,loop:0}).toFile(path.join(workspace,'outputs/Sprout-cartoon-comparison.gif'));
    await overlay.close();await app.close();app=await launch();page=await app.firstWindow();await page.getByRole('heading',{name:'Bring a little character.'}).waitFor();
    assert.deepEqual((await page.evaluate(()=>window.desktop.config())).active,saved);
    assert.deepEqual(errors,[]);
    const result={passed:true,version:require('../package.json').version,checks:['Cartoon controls and animated camera-free preview','Saved intensity and head/body accessory attachment survive restart','48 frozen frames match OBS pixel-for-pixel across both rig modes, attachment modes and avatar mirrors','Transparent output contains no webcam feed','Classic/cartoon comparison rendered from the shared renderer'],pageErrors:errors};
    await fs.writeFile(path.join(workspace,'outputs/Sprout-cartoon-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }catch(error){if(page)await page.screenshot({path:path.join(workspace,'outputs/Sprout-cartoon-debug.png')}).catch(()=>{});throw error;}
  finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
