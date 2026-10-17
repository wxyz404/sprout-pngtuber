/** Empty IDs are permission-hidden placeholders, not selectable devices. Keep
 * separate devices even when drivers give them identical display names. */
export function inputDevices(devices:MediaDeviceInfo[]):MediaDeviceInfo[]{
  const seen=new Set<string>();
  return devices.filter(device=>{
    if(!['videoinput','audioinput'].includes(device.kind)||!device.deviceId)return false;
    const key=device.kind+':'+device.deviceId;if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
