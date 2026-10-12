import { z } from 'zod';
export const LAYER_POSITION_MIN = -1024, LAYER_POSITION_MAX = 2048;
const bounded = (min:number,max:number) => z.number().finite().min(min).max(max);
export const assetSchema = z.string().regex(/^(?:assets\/[a-f0-9]{64}|sample\/[a-z0-9-]+)\.png$/);
export const layerSchema = z.object({id:z.string().max(80),name:z.string().max(80),role:z.enum(['body','head','eyes','brows','mouth','accessory']),attachment:z.enum(['body','head']).optional(),asset:assetSchema.optional(),variants:z.record(z.string().max(40),assetSchema),x:bounded(LAYER_POSITION_MIN,LAYER_POSITION_MAX),y:bounded(LAYER_POSITION_MIN,LAYER_POSITION_MAX),width:bounded(1,4096),height:bounded(1,4096),scale:bounded(.1,4),pivotX:bounded(0,1),pivotY:bounded(0,1),order:bounded(-100,100),visible:z.boolean()});
export const signalsSchema = z.object({yaw:bounded(-180,180),pitch:bounded(-180,180),roll:bounded(-180,180),x:bounded(-1,1),y:bounded(-1,1),blinkLeft:bounded(0,1),blinkRight:bounded(0,1),mouth:bounded(0,1),smile:bounded(0,1),brow:bounded(0,1)});
export type Signals = z.infer<typeof signalsSchema>;
export const profileSchema = z.object({version:z.literal(1),id:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),name:z.string().min(1).max(80),mode:z.enum(['simple','layered']),poses:z.record(z.string().max(80),assetSchema),layers:z.array(layerSchema).max(50),settings:z.object({sensitivity:bounded(.5,2),smoothing:bounded(0,300),strength:bounded(0,2),cartoon:bounded(0,1).default(.65),directionalStates:z.boolean().default(true),bounce:z.boolean(),mirror:z.boolean(),mirrorAvatar:z.boolean().default(false),micThreshold:bounded(.005,.2)}),calibration:z.object({neutral:signalsSchema,completed:z.boolean()})});
export type AvatarProfile = z.infer<typeof profileSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type TrackingFrame = Signals & {timestamp:number;status:'tracked'|'lost'|'paused';audioActive:boolean;micEnabled:boolean};
export const cartoonSchema = z.object({squash:bounded(-.18,.18),hop:bounded(-16,16),headX:bounded(-18,18),headY:bounded(-16,16),headRoll:bounded(-6,6),featureX:bounded(-6,6),featureY:bounded(-6,6),accessoryRoll:bounded(-12,12),pop:bounded(-.04,.08),blink:bounded(0,1)});
export type CartoonState = z.infer<typeof cartoonSchema>;
export const STILL_CARTOON:CartoonState={squash:0,hop:0,headX:0,headY:0,headRoll:0,featureX:0,featureY:0,accessoryRoll:0,pop:0,blink:0};
export type AnimationState = Signals & {direction:'left'|'center'|'right';talking:boolean;blinking:boolean;expression:'neutral'|'smile'|'surprise';tracked:boolean;time:number;cartoon?:CartoonState};
export const animationSchema = signalsSchema.extend({direction:z.enum(['left','center','right']),talking:z.boolean(),blinking:z.boolean(),expression:z.enum(['neutral','smile','surprise']),tracked:z.boolean(),time:z.number().finite().nonnegative(),cartoon:cartoonSchema.optional()});
export interface OutputPacket {profile:AvatarProfile;state:AnimationState}
export const ZERO:Signals={yaw:0,pitch:0,roll:0,x:0,y:0,blinkLeft:0,blinkRight:0,mouth:0,smile:0,brow:0};
export const IDLE:AnimationState={...ZERO,direction:'center',talking:false,blinking:false,expression:'neutral',tracked:false,time:0};
export interface AppConfig {outputUrl:string;assetBase:string;profiles:AvatarProfile[];active:AvatarProfile;storage:string;serverWarning?:string}
export interface DesktopBridge {config():Promise<AppConfig>;save(profile:AvatarProfile):Promise<void>;activate(id:string):Promise<AvatarProfile>;create(name:string):Promise<AvatarProfile>;importPNG():Promise<{asset:string;width:number;height:number}|null>;publish(state:AnimationState):void;preview(profile:AvatarProfile):Promise<void>;copy(text:string):Promise<void>}
declare global {interface Window {desktop?:DesktopBridge}}
