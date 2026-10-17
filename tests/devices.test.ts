import { expect,it } from 'vitest';
import { allowStudioMedia } from '../electron/media-permissions';
import { inputDevices } from '../src/tracking/devices';
const studio='http://127.0.0.1:18743/index.html?studio=secret';
const frame={requestingUrl:studio,isMainFrame:true};

it('allows input enumeration for both Electron origin serializations',()=>{
  for(const origin of ['http://127.0.0.1:18743','http://127.0.0.1:18743/']){
    expect(allowStudioMedia('media',frame,studio,origin)).toBe(true);
    expect(allowStudioMedia('media',{...frame,securityOrigin:origin},studio,origin)).toBe(true);
  }
  expect(allowStudioMedia('media',frame,studio)).toBe(true);
});

it('rejects other origins, ports, frames, pages, tokens and non-media permissions',()=>{
  for(const origin of ['http://127.0.0.1:18744/','http://localhost:18743/','https://127.0.0.1:18743/','https://example.com','null','bad URL'])
    expect(allowStudioMedia('media',frame,studio,origin)).toBe(false);
  for(const requestingUrl of [undefined,'http://127.0.0.1:18743/overlay.html?token=secret',studio+'evil',studio.replace('secret','wrong')])
    expect(allowStudioMedia('media',{...frame,requestingUrl},studio)).toBe(false);
  expect(allowStudioMedia('media',{...frame,isMainFrame:false},studio)).toBe(false);
  expect(allowStudioMedia('media',{...frame,securityOrigin:'https://evil.test/'},studio)).toBe(false);
  for(const permission of ['speaker-selection','display-capture','notifications','camera'])expect(allowStudioMedia(permission,frame,studio)).toBe(false);
});

it('keeps all real input IDs, removes hidden placeholders and duplicate entries, and preserves same-name devices',()=>{
  const device=(kind:MediaDeviceKind,deviceId:string,label='')=>({kind,deviceId,label,groupId:'',toJSON(){return {};}});
  const inputs=[device('videoinput','card','Capture card'),device('videoinput','usb','Webcam'),device('videoinput','laptop','Webcam'),device('audioinput','default','Default mic'),device('audioinput','usbmic','USB mic')];
  expect(inputDevices([device('videoinput',''),device('audioinput',''),...inputs,inputs[1],device('audiooutput','speakers')])).toEqual(inputs);
});
