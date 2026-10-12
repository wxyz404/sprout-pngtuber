import { AnimationState, AvatarProfile, CartoonState, IDLE, STILL_CARTOON } from './types';
const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));

/** Fixed substeps keep the damped springs stable through uneven webcam/render rates. */
class Spring {
  x=0; velocity=0;
  constructor(private frequency:number,private damping:number){}
  reset(x=0){this.x=x;this.velocity=0;}
  kick(velocity:number){this.velocity+=velocity;}
  step(target:number,seconds:number){
    const steps=Math.max(1,Math.ceil(seconds/(1/240))),dt=seconds/steps;
    for(let i=0;i<steps;i++){
      this.velocity+=(this.frequency*this.frequency*(target-this.x)-2*this.damping*this.frequency*this.velocity)*dt;
      this.x+=this.velocity*dt;
    }
    return this.x;
  }
}

/** Run once in the studio pipeline; broadcast the result, never simulate in OBS. */
export class CartoonMotion {
  private headX=new Spring(22,.62);private headY=new Spring(23,.65);private headRoll=new Spring(20,.58);
  private faceX=new Spring(17,.72);private faceY=new Spring(18,.75);private accessory=new Spring(13,.48);
  private body=new Spring(21,.55);private hop=new Spring(20,.65);private pop=new Spring(23,.62);private blink=new Spring(30,.8);
  private previous:AnimationState={...IDLE};private initialized=false;
  reset(){for(const spring of this.springs())spring.reset();this.previous={...IDLE};this.initialized=false;}
  private springs(){return [this.headX,this.headY,this.headRoll,this.faceX,this.faceY,this.accessory,this.body,this.hop,this.pop,this.blink];}
  step(s:AnimationState,settings:AvatarProfile['settings'],milliseconds:number):CartoonState {
    if(!settings.cartoon||!settings.strength){this.reset();return {...STILL_CARTOON};}
    const dt=clamp(milliseconds,0,100)/1000;
    const x=clamp(s.x*70+s.yaw*.65,-65,65),y=clamp(s.y*50+s.pitch*.5,-45,45),roll=clamp(s.roll,-18,18);
    // Begin attached to the current pose, rather than flying in from the origin.
    if(!this.initialized){this.headX.reset(x);this.faceX.reset(x);this.headY.reset(y);this.faceY.reset(y);this.headRoll.reset(roll);this.accessory.reset(roll);this.initialized=true;}
    if(dt>0){
      if(s.blinking&&!this.previous.blinking)this.body.kick(.8);
      if(s.talking&&!this.previous.talking&&settings.bounce){this.body.kick(1.8);this.hop.kick(-90);}
      if(s.expression!==this.previous.expression){
        this.body.kick(s.expression==='surprise'?-2.5:s.expression==='smile'?1.3:.6);
        this.pop.kick(s.expression==='neutral'?-.4:.6);
      }
    }
    const speech=settings.bounce&&s.talking?s.mouth:0;
    const pulse=Math.sin(s.time/110)*speech;
    const hx=this.headX.step(x,dt),hy=this.headY.step(y,dt),hr=this.headRoll.step(roll,dt);
    const result:CartoonState={
      squash:clamp(this.body.step((s.expression==='surprise'?-.045:s.expression==='smile'?.018:0)+pulse*.035,dt),-.18,.18),
      hop:clamp(this.hop.step(-Math.abs(pulse)*5,dt),-16,16),
      headX:clamp(hx-x,-18,18),headY:clamp(hy-y,-16,16),headRoll:clamp(hr-roll,-6,6),
      featureX:clamp(this.faceX.step(x,dt)-hx,-6,6),featureY:clamp(this.faceY.step(y,dt)-hy,-6,6),
      accessoryRoll:clamp(this.accessory.step(roll,dt)-hr-this.headX.velocity*.018,-12,12),
      pop:clamp(this.pop.step(s.expression==='surprise'?.035:s.expression==='smile'?.012:0,dt),-.04,.08),
      blink:clamp(this.blink.step(s.blinking?1:0,dt),0,1),
    };
    this.previous={...s};return result;
  }
}

/** A repeating preview exercises turns, starts/stops, speech and expression accents. */
export function cartoonDemo(time:number):AnimationState {
  const t=(time%8000)/1000,yaw=Math.sin(t*Math.PI/2)*32;
  const talking=t>2&&t<4,expression=t>5&&t<6?'surprise':t>4&&t<5?'smile':'neutral';
  const blinking=t>.8&&t<.95||t>4.6&&t<4.75;
  return {...IDLE,time,tracked:true,yaw,pitch:Math.sin(t*Math.PI)*10,roll:Math.sin(t*Math.PI/2)*8,
    direction:yaw>15?'right':yaw< -15?'left':'center',talking,mouth:talking?.55+.25*Math.sin(t*18):expression==='surprise'?.65:0,
    expression,smile:expression==='smile'?.8:0,brow:expression==='surprise'?.8:0,blinking,blinkLeft:blinking?1:0,blinkRight:blinking?1:0};
}
