import { AnimationState, AvatarProfile, Layer, STILL_CARTOON } from './types';
import { choosePose, layerAsset } from './engine';
import { effectiveFacing } from './facing';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const radians=Math.PI/180;

/** Reciprocal axes preserve area and keep the chosen foot/pivot fixed. */
export function squashAxes(squash:number){const x=1+clamp(squash,-.23,.23);return {x,y:1/x};}
export function bodyAnchor(profile:AvatarProfile){
  const body=profile.layers.find(l=>l.role==='body'&&l.visible);
  return body?{x:body.x+body.width*body.scale*.5,y:body.y+body.height*body.scale*.98}:{x:512,y:960};
}
const pivot=(l:Layer)=>({x:l.x+l.width*l.scale*l.pivotX,y:l.y+l.height*l.scale*l.pivotY});
function around(ctx:CanvasRenderingContext2D,x:number,y:number,sx:number,sy:number,angle=0){
  ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.scale(sx,sy);ctx.translate(-x,-y);
}

export class AvatarRenderer {
  private images=new Map<string,HTMLImageElement>();private failed=new Set<string>();
  constructor(private canvas:HTMLCanvasElement,private url:(asset:string)=>string,private onError?:(asset:string)=>void){}
  preload(profile:AvatarProfile){const assets=new Set([...Object.values(profile.poses),...profile.layers.flatMap(l=>[l.asset,...Object.values(l.variants)]).filter(Boolean) as string[]]);for(const a of assets)this.image(a);}
  private image(asset:string){if(!this.images.has(asset)&&!this.failed.has(asset)){const img=new Image();img.onload=()=>{};img.onerror=()=>{this.failed.add(asset);this.onError?.(asset);};img.src=this.url(asset);this.images.set(asset,img);}const img=this.images.get(asset);return img?.complete&&img.naturalWidth&&!this.failed.has(asset)?img:undefined;}
  draw(profile:AvatarProfile,s:AnimationState,selected?:string){
    const c=this.canvas,ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);ctx.save();
    const scale=Math.min(c.width,c.height)/1024;
    ctx.translate((c.width-1024*scale)/2,(c.height-1024*scale)/2);ctx.scale(scale,scale);
    if(profile.settings.mirrorAvatar){ctx.translate(1024,0);ctx.scale(-1,1);}
    const strength=profile.settings.strength,mirror=profile.settings.mirror?-1:1;
    const amount=selected?0:clamp(profile.settings.cartoon*strength,0,1.25),toon=s.cartoon||STILL_CARTOON;
    const dx=(clamp(s.x*70+s.yaw*.65,-65,65)*strength*(1+amount*.15)+toon.headX*amount)*mirror;
    const dy=clamp(s.y*50+s.pitch*.5,-45,45)*strength*(1+amount*.12)+toon.headY*amount;
    const roll=(clamp(s.roll,-18,18)*strength*(1+amount*.18)+toon.headRoll*amount)*radians*mirror;
    const bounce=profile.settings.bounce&&s.talking?-Math.abs(Math.sin(s.time/105))*8*strength*(1-amount*.4):0;
    const axes=squashAxes(toon.squash*amount),head=profile.layers.find(l=>l.role==='head');
    if(profile.mode==='simple'){
      const asset=choosePose(profile,s),img=asset&&this.image(asset);
      if(img){
        ctx.translate(512+dx,512+dy+bounce+toon.hop*amount);ctx.rotate(roll*.6);
        const fit=Math.min(960/img.naturalWidth,960/img.naturalHeight),w=img.naturalWidth*fit,h=img.naturalHeight*fit;
        around(ctx,0,h*.5,axes.x,axes.y);
        ctx.drawImage(img,-w/2,-h/2,w,h);
      }
    } else {
      // Body deformation is inherited by the full rig so the neck stays attached.
      // Accessories can then follow the body or head, with their own pivot lag.
      if(amount){const anchor=bodyAnchor(profile);ctx.translate(0,toon.hop*amount);around(ctx,anchor.x,anchor.y,axes.x,axes.y,clamp(s.yaw*.025,-1.2,1.2)*amount*radians*mirror);}
      for(const l of [...profile.layers].sort((a,b)=>a.order-b.order)){
        if(!l.visible)continue;ctx.save();
        const moves=l.role!=='body'&&(l.role!=='accessory'||l.attachment==='head');
        if(moves){
          const p=pivot(head||l),pop=1+toon.pop*amount;
          ctx.translate(p.x+dx,p.y+dy+bounce);ctx.rotate(roll);ctx.scale(pop,pop);ctx.translate(-p.x,-p.y);
        }
        if(amount&&['eyes','brows','mouth'].includes(l.role)){
          ctx.translate(toon.featureX*amount*mirror,toon.featureY*amount);
          const p=pivot(l);
          if(l.role==='eyes')around(ctx,p.x,p.y,1+toon.blink*.035*amount,1-toon.blink*.12*amount);
          if(l.role==='mouth')around(ctx,p.x,p.y,1+s.smile*.045*amount,1+((s.talking?s.mouth*.1:0)+(s.expression==='surprise'?.06:0))*amount);
        }
        if(amount&&l.role==='accessory'){const p=pivot(l);around(ctx,p.x,p.y,1,1,toon.accessoryRoll*amount*radians*mirror);}
        const ly=l.y-(l.role==='brows'?s.brow*12*strength*(1+amount*.6):0);
        const asset=layerAsset(l,s,effectiveFacing(profile,s)),img=asset&&this.image(asset);
        if(img)ctx.drawImage(img,l.x,ly,l.width*l.scale,l.height*l.scale);
        if(selected===l.id)this.outline(ctx,{...l,y:ly});ctx.restore();
      }
    }
    ctx.restore();
  }
  private outline(ctx:CanvasRenderingContext2D,l:Layer){ctx.strokeStyle='#da785e';ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.strokeRect(l.x,l.y,l.width*l.scale,l.height*l.scale);ctx.setLineDash([]);const x=l.x+l.width*l.scale*l.pivotX,y=l.y+l.height*l.scale*l.pivotY;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#da785e';ctx.fill();}
}
