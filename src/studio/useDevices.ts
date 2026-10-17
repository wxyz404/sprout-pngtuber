import { useCallback,useEffect,useRef,useState } from 'react';
import { inputDevices } from '../tracking/devices';

export function useDevices(cameraActive:boolean,micActive:boolean){
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(0);
  const refresh=useCallback(async()=>{
    const id=++request.current;setBusy(true);setError('');
    try{
      if(!navigator.mediaDevices?.enumerateDevices)throw new Error('Device discovery is unavailable.');
      const result=await navigator.mediaDevices.enumerateDevices();
      if(id!==request.current)return;
      setDevices(inputDevices(result));
      if(result.some(d=>(d.kind==='videoinput'||d.kind==='audioinput')&&(!d.deviceId||!d.label)))
        setError('Some inputs are hidden. Check Windows Settings → Privacy & security → Camera / Microphone and allow desktop app access, then refresh devices.');
    }catch{
      if(id===request.current)setError('Could not read camera/microphone devices. Check Windows privacy settings and connected devices, then refresh.');
    }finally{if(id===request.current)setBusy(false);}
  },[]);
  useEffect(()=>{
    void refresh();const changed=()=>{void refresh();};
    navigator.mediaDevices?.addEventListener('devicechange',changed);
    return()=>{request.current++;navigator.mediaDevices?.removeEventListener('devicechange',changed);};
  },[refresh,cameraActive,micActive]);
  return {devices,refresh,busy,error};
}
