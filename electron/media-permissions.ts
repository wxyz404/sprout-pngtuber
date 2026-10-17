interface MediaFrame {requestingUrl?:string;isMainFrame:boolean;securityOrigin?:string}

function sameOrigin(value:string,studioURL:string){
  try{return new URL(value).origin===new URL(studioURL).origin;}catch{return false;}
}

/** Electron may serialize a security origin with a trailing slash. Compare URL
 * origins, but still require the exact authenticated studio main-frame URL. */
export function allowStudioMedia(permission:string,details:MediaFrame,studioURL:string,requestingOrigin?:string){
  if(permission!=='media'||!details.isMainFrame||details.requestingUrl!==studioURL)return false;
  if(requestingOrigin!==undefined&&!sameOrigin(requestingOrigin,studioURL))return false;
  if(details.securityOrigin!==undefined&&!sameOrigin(details.securityOrigin,studioURL))return false;
  return true;
}
