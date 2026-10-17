const {_electron}=require(process.env.SPROUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const workspace=path.resolve('../..'),data=process.env.SPROUT_SMOKE_DATA_DIR||path.join(workspace,'work/smoke-devices-v041');
 // Fake hardware, real Chromium enumeration/getUserMedia and production handlers.
 // Deliberately do NOT use --use-fake-ui-for-media-stream or override permissions.
 const app=await _electron.launch({executablePath:process.env.SPROUT_EXECUTABLE||require('electron'),args:[...(process.env.SPROUT_EXECUTABLE?[]:['.']),'--no-sandbox','--use-fake-device-for-media-stream=device-count=3'],env:{...process.env,SPROUT_TEST_MODE:'1',SPROUT_DATA_DIR:data},timeout:30000});
 const errors=[];let page;
 try{
  page=await app.firstWindow();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'Bring a little character.'}).waitFor();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  const config=await page.evaluate(()=>window.desktop.config());if(config.serverWarning)await page.getByRole('button',{name:'Dismiss error'}).click();
  const camera=page.getByRole('combobox',{name:'Video input',exact:true}),mic=page.getByRole('combobox',{name:'Audio input',exact:true});
  await page.waitForFunction(()=>document.querySelector('select').options.length===4);
  const native=await page.evaluate(async()=> (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'||d.kind==='audioinput').map(d=>({kind:d.kind,id:d.deviceId,label:d.label})));
  const cameras=native.filter(d=>d.kind==='videoinput'),microphones=native.filter(d=>d.kind==='audioinput');
  assert.equal(cameras.length,3);assert(cameras.every(d=>d.id&&d.label));assert(microphones.every(d=>d.id&&d.label));
  assert.equal(await page.getByRole('switch',{name:'Microphone assist',exact:true}).getAttribute('aria-checked'),'false');
  assert.equal(await page.locator('video').evaluate(v=>v.srcObject),null);
  await page.evaluate(()=>{
   const media=navigator.mediaDevices,gum=media.getUserMedia.bind(media),enumerate=media.enumerateDevices.bind(media);window.__deviceRequests=[];
   media.getUserMedia=async constraints=>{const stream=await gum(constraints);window.__deviceRequests.push({constraints,tracks:stream.getTracks().map(t=>({kind:t.kind,label:t.label,id:t.getSettings().deviceId}))});return stream;};
   media.enumerateDevices=async()=>{if(window.__failEnumeration)throw new DOMException('fixture','NotAllowedError');return (await enumerate()).filter(d=>d.deviceId!==window.__hiddenDevice);};
  });
  const chosenCamera=cameras[2],chosenMic=microphones.find(d=>!['default','communications'].includes(d.id));assert(chosenMic);
  await camera.selectOption(chosenCamera.id);await mic.selectOption(chosenMic.id);
  assert.equal(await page.evaluate(()=>window.__deviceRequests.length),0);
  await page.getByRole('button',{name:'Start camera',exact:true}).click();await page.getByRole('button',{name:'Pause tracking',exact:true}).waitFor();
  assert.equal(await page.locator('video').evaluate(v=>v.srcObject.getVideoTracks()[0].getSettings().deviceId),chosenCamera.id);
  await page.getByRole('switch',{name:'Microphone assist',exact:true}).click();await page.waitForFunction(()=>window.__deviceRequests.some(r=>r.tracks.some(t=>t.kind==='audio')));
  const captures=await page.evaluate(()=>window.__deviceRequests);
  assert.equal(captures[0].constraints.video.deviceId.exact,chosenCamera.id);assert.equal(captures[0].tracks[0].id,chosenCamera.id);
  assert.equal(captures[1].constraints.audio.deviceId.exact,chosenMic.id);assert.equal(captures[1].tracks[0].id,chosenMic.id);
  await page.getByRole('switch',{name:'Microphone assist',exact:true}).click();await page.getByRole('button',{name:'Pause tracking',exact:true}).click();
  const calls=await page.evaluate(()=>window.__deviceRequests.length);
  await page.getByRole('button',{name:'Refresh devices',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-label="Refresh devices"]').disabled);
  assert.equal(await page.evaluate(()=>window.__deviceRequests.length),calls);
  // Real enumeration remains in place; only failure/removal events are injected.
  await page.evaluate(()=>{window.__failEnumeration=true;});await page.getByRole('button',{name:'Refresh devices',exact:true}).click();await page.getByText('Could not read camera/microphone devices.',{exact:false}).waitFor();
  await page.evaluate(()=>{window.__failEnumeration=false;});await page.getByRole('button',{name:'Refresh devices',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('Could not read camera/microphone devices.'));
  await page.evaluate(id=>{window.__hiddenDevice=id;navigator.mediaDevices.dispatchEvent(new Event('devicechange'));},chosenCamera.id);
  await camera.getByRole('option',{name:'Selected camera disconnected',exact:true}).waitFor({state:'attached'});
  assert.equal(await camera.inputValue(),chosenCamera.id);
  await page.evaluate(()=>{window.__hiddenDevice='';navigator.mediaDevices.dispatchEvent(new Event('devicechange'));});await page.waitForFunction(()=>document.querySelector('select').options.length===4);
  await page.screenshot({path:path.join(workspace,'outputs/Sprout-device-selection.png')});
  const next=app.waitForEvent('window');await app.evaluate(async({BrowserWindow},url)=>{const w=new BrowserWindow({width:800,height:600,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await w.loadURL(url);w.show();},config.outputUrl);
  const overlay=await next;
  const denied=await overlay.evaluate(async()=>{
   const devices=await navigator.mediaDevices.enumerateDevices();let error='';try{const stream=await navigator.mediaDevices.getUserMedia({video:true});stream.getTracks().forEach(t=>t.stop());}catch(e){error=e.name;}
   return {error,exposed:devices.filter(d=>d.deviceId||d.label).length};
  });assert.equal(denied.error,'NotAllowedError');assert.equal(denied.exposed,0);await overlay.close();
  assert.deepEqual(errors,[]);
  const result={passed:true,version:require('../package.json').version,nativeCameras:cameras.map(d=>d.label),nativeMicrophones:microphones.map(d=>d.label),checks:['Three native Chromium cameras enumerate with real labels and IDs before capture','Nondefault camera and microphone are selectable before activation and use exact requested IDs','Refresh does not start capture; enumeration failure recovers','Hotplug preserves disconnected selection instead of silently choosing default','OBS page cannot enumerate named devices or capture media'],pageErrors:errors};
  await fs.writeFile(path.join(workspace,'outputs/Sprout-devices-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }catch(e){await page?.screenshot({path:path.join(workspace,'outputs/Sprout-devices-debug.png')}).catch(()=>{});throw e;}
 finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
