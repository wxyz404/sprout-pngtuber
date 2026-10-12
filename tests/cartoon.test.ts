import { expect,it } from 'vitest';
import { CartoonMotion,cartoonDemo } from '../src/shared/cartoon';
import { MotionEngine } from '../src/shared/engine';
import { squashAxes,bodyAnchor } from '../src/shared/render';
import { sampleProfile } from '../src/shared/sample';
import { animationSchema,cartoonSchema,IDLE,profileSchema,STILL_CARTOON,ZERO } from '../src/shared/types';

it('lags a turn, follows through its stop, and settles without changing the selected sprite state',()=>{
  const p=sampleProfile(),motion=new CartoonMotion();motion.step(IDLE,p.settings,16);
  const first=motion.step({...IDLE,yaw:40,roll:15},p.settings,16);
  expect(first.headX).toBeLessThan(0);expect(first.headRoll).toBeLessThan(0);
  let overshoot=false,last=first;
  for(let i=0;i<240;i++){
    last=motion.step({...IDLE,yaw:40,roll:15},p.settings,1000/60);
    if(last.headX>0)overshoot=true;
  }
  expect(overshoot).toBe(true);expect(Math.abs(last.headX)).toBeLessThan(.001);
  expect(Math.abs(last.accessoryRoll)).toBeLessThan(.001);
  const engine=new MotionEngine();p.settings.smoothing=0;p.settings.mirror=false;
  const state=engine.step({...ZERO,timestamp:100,status:'tracked',yaw:40,blinkLeft:1,blinkRight:1,mouth:.8,audioActive:false,micEnabled:false},p);
  expect(state.direction).toBe('right');expect(state.blinking).toBe(true);expect(state.talking).toBe(true);
  expect(animationSchema.parse(state)).toEqual(state);
});

it('gives speech, blinks and surprise distinct squash/stretch accents',()=>{
  const settings=sampleProfile().settings;
  const accent=(changes:Partial<typeof IDLE>)=>{const m=new CartoonMotion();m.step(IDLE,settings,16);return m.step({...IDLE,...changes,time:16},settings,16);};
  expect(accent({talking:true,mouth:.8}).squash).toBeGreaterThan(0);
  expect(accent({talking:true,mouth:.8}).hop).toBeLessThan(0);
  expect(accent({blinking:true}).squash).toBeGreaterThan(0);
  expect(accent({expression:'surprise',brow:.9,mouth:.8}).squash).toBeLessThan(0);
  expect(accent({expression:'surprise'}).pop).toBeGreaterThan(0);
  settings.bounce=false;const noBounce=new CartoonMotion();
  expect(noBounce.step({...IDLE,talking:true,mouth:.8},settings,16).hop).toBe(0);
});

it('is stable at different frame rates and does not apply impulses twice for the same timestamp',()=>{
  const settings=sampleProfile().settings;
  const at=(fps:number)=>{const m=new CartoonMotion();m.step(IDLE,settings,0);let last=STILL_CARTOON;for(let i=1;i<=fps;i++)last=m.step({...IDLE,yaw:35,roll:10,time:i*1000/fps},settings,1000/fps);return last;};
  const a=at(30),b=at(60),c=at(120);
  for(const key of Object.keys(a) as (keyof typeof a)[]){expect(Math.abs(a[key]-b[key])).toBeLessThan(.02);expect(Math.abs(b[key]-c[key])).toBeLessThan(.02);}
  const m=new CartoonMotion(),s={...IDLE,expression:'surprise' as const};m.step(IDLE,settings,16);
  const before=m.step(s,settings,16);expect(m.step(s,settings,0)).toEqual(before);
});

it('bounds all deformation through jitter, extreme inputs, long frame gaps and tracking loss',()=>{
  const p=sampleProfile();p.settings.smoothing=0;const engine=new MotionEngine();let last=IDLE;
  for(let i=1;i<=5000;i++){
    const demo=cartoonDemo(i*33);
    last=engine.step({...demo,yaw:i%2?90:-90,x:i%2?1:-1,timestamp:i*33,status:i%19?'tracked':'lost',micEnabled:false,audioActive:false},p);
    expect(()=>cartoonSchema.parse(last.cartoon)).not.toThrow();
  }
  for(let i=1;i<=240;i++)last=engine.step({...ZERO,timestamp:165000+i*16,status:'lost',micEnabled:false,audioActive:false},p);
  for(const value of Object.values(last.cartoon!))expect(Math.abs(value)).toBeLessThan(.001);
  const motion=new CartoonMotion();motion.step(IDLE,p.settings,16);
  expect(()=>cartoonSchema.parse(motion.step({...IDLE,yaw:90,roll:90},p.settings,30000))).not.toThrow();
});

it('restores classic motion at zero intensity or zero strength and resets between avatars',()=>{
  const p=sampleProfile(),motion=new CartoonMotion();motion.step({...IDLE,expression:'surprise'},p.settings,16);
  p.settings.cartoon=0;expect(motion.step({...IDLE,yaw:40},p.settings,16)).toEqual(STILL_CARTOON);
  p.settings.cartoon=1;p.settings.strength=0;expect(motion.step({...IDLE,talking:true},p.settings,16)).toEqual(STILL_CARTOON);
  p.settings.strength=1;motion.reset();expect(motion.step(IDLE,p.settings,16)).toEqual(STILL_CARTOON);
});

it('preserves drawn area under squash/stretch and anchors a positioned, scaled body at its feet',()=>{
  for(const value of [-.23,-.1,0,.1,.23]){const axes=squashAxes(value);expect(axes.x*axes.y).toBeCloseTo(1,12);expect(axes.x).toBeGreaterThan(0);expect(axes.y).toBeGreaterThan(0);}
  const p=sampleProfile(),body=p.layers[0];body.x=100;body.y=200;body.width=400;body.height=600;body.scale=.5;
  expect(bodyAnchor(p)).toEqual({x:200,y:494});body.visible=false;expect(bodyAnchor(p)).toEqual({x:512,y:960});
});

it('loads old profiles with cartoon defaults and saves intensity and accessory attachment independently',()=>{
  const legacy=JSON.parse(JSON.stringify(sampleProfile()));delete legacy.settings.cartoon;
  const upgraded=profileSchema.parse(legacy);expect(upgraded.settings.cartoon).toBe(.65);
  upgraded.layers[0].role='accessory';upgraded.layers[0].attachment='head';upgraded.settings.cartoon=.35;
  expect(profileSchema.parse(JSON.parse(JSON.stringify(upgraded)))).toEqual(upgraded);
  expect(()=>profileSchema.parse({...legacy,settings:{...legacy.settings,cartoon:Infinity}})).toThrow();
  expect(()=>animationSchema.parse({...IDLE,cartoon:{...STILL_CARTOON,headX:1000}})).toThrow();
});
