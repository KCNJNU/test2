export type TaskAction='start'|'pause'|'resume'|'cancel';
export function allowedTaskActions(status:string,online:boolean):TaskAction[]{if(!online)return[];if(status==='DRAFT'||status==='SCHEDULED')return['start','cancel'];if(status==='RUNNING')return['pause','cancel'];if(status==='PAUSED')return['resume','cancel'];if(status==='BLOCKED')return['cancel'];return[];}
export function mayQueueOfflineControl(){return false;}
