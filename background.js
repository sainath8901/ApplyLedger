import {clean,safeURL,newJob,appendStatus} from './core.js';
import {Cloud,beginGoogle,configured} from './auth.js';
const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const cloud=new Cloud({get:async()=>{await ready;return (await chrome.storage.local.get('googleSession')).googleSession;},set:async s=>{await ready;if(s)await chrome.storage.local.set({googleSession:s});else await chrome.storage.local.remove('googleSession');}});
const empty=()=>({deviceId:crypto.randomUUID(),profiles:[],jobs:[],imports:{}});
let queue=Promise.resolve();
async function handle(m,sender){
 await ready;
 const db=(await chrome.storage.local.get('dbV2')).dbV2||empty();
 const s=(await chrome.storage.local.get('googleSession')).googleSession;
 const user=db.profiles.find(p=>p.id===s?.user.id);
 const trusted=sender.url?.startsWith(chrome.runtime.getURL(''));
 const save=()=>chrome.storage.local.set({dbV2:db});
 if(!trusted){
  if(m.type!=='capture'||!user||!sender.tab||!/^https?:/.test(sender.url||''))throw Error('Not authorized');
  const url=safeURL(sender.url), key=`${sender.tab.id}:${new URL(url).origin}`;
  const pending=(await chrome.storage.session.get('pending')).pending||{};
  if(m.stage==='attempt'){
   let job=db.jobs.find(j=>j.profileId===user.id&&j.url===url&&(['Saved','In progress'].includes(j.history.at(-1).status)||Date.now()-Date.parse(j.createdAt)<120000));
   if(job&&['Saved','In progress'].includes(job.history.at(-1).status)){job.source='auto';appendStatus(job,'Needs confirmation','Submission attempt detected; recorded details are now locked');}
   if(!job){job=newJob({...m.data,url},user.id,'auto');db.jobs.push(job);}
   pending[key]={id:job.id,profileId:user.id,at:Date.now()};await chrome.storage.session.set({pending});await save();
  }else if(m.stage==='confirmed'){
   const p=pending[key],job=db.jobs.find(j=>j.id===p?.id&&j.profileId===user.id);
   if(job&&p.profileId===user.id&&Date.now()-p.at<1800000&&job.history.at(-1).status==='Needs confirmation'){appendStatus(job,'Submitted','Submission success message detected');delete pending[key];await chrome.storage.session.set({pending});await save();}
  }
  return {ok:true};
 }
 if(m.type==='state')return {configured:configured(),redirect:chrome.identity.getRedirectURL('google'),deviceId:db.deviceId,profiles:user?[user]:[],user:user||null,jobs:user?db.jobs.filter(j=>j.profileId===user.id):[],imports:{}};
 if(m.type==='googleLogin'){
  const flow=await beginGoogle(chrome.identity.getRedirectURL('google'));
  const returned=await chrome.identity.launchWebAuthFlow({url:flow.url,interactive:true});
  if(!returned)throw Error('Sign-in was cancelled');
  await cloud.finish(returned,flow);
  try{const profile=await cloud.rpc('ledger_me');const i=db.profiles.findIndex(p=>p.id===profile.id);if(i<0)db.profiles.push(profile);else db.profiles[i]=profile;await save();await chrome.storage.session.remove('pending');return profile;}catch(e){await chrome.storage.local.remove('googleSession');throw e;}
 }
 if(m.type==='logout'){try{await cloud.logout();}catch{}finally{await chrome.storage.session.remove('pending');await chrome.action.setBadgeText({text:''});}return {ok:true};}
 if(!user)throw Error('Sign in with Google first');
 if(m.type==='refreshProfile'){const p=await cloud.rpc('ledger_me');db.profiles=db.profiles.map(x=>x.id===p.id?p:x);await save();return p;}
 if(m.type==='syncInfo')return (await chrome.storage.local.get('syncInfoV2')).syncInfoV2?.[user.id]||{message:'Sync will start shortly'};
 if(m.type==='syncNow')return {ok:true};
 if(m.type==='savePage'){const j=newJob(m.data,user.id,'auto');j.history=[{status:'Saved',at:j.createdAt,note:'Job saved from the current page'}];db.jobs.push(j);await save();return {ok:true};}
 if(m.type==='add'){db.jobs.push(newJob(m.data,user.id,'manual'));await save();return {ok:true};}
 if(m.type==='status'||m.type==='edit'){
  const j=db.jobs.find(j=>j.id===m.id);if(!j||j.profileId!==user.id)throw Error('Only the owner can change this record');
  if(m.type==='edit'){if(j.source==='auto')throw Error('Automatically recorded details are locked');j.title=clean(m.data.title)||j.title;j.company=clean(m.data.company)||j.company;j.url=safeURL(m.data.url);}
  else appendStatus(j,m.status,m.note);await save();return {ok:true};
 }
 if(m.type==='export')return {format:'applyledger-1',deviceId:db.deviceId,exportedAt:new Date().toISOString(),profiles:[{id:user.id,name:user.name,role:'member'}],jobs:db.jobs.filter(j=>j.profileId===user.id)};
 const rpcMap={requestAdmin:'ledger_request_admin',myRequests:'ledger_my_requests',adminData:'ledger_admin_data',inbox:'ledger_inbox',decideAdmin:'ledger_decide_admin',setAdmin:'ledger_set_admin',readNotice:'ledger_read_notice'};
 if(rpcMap[m.type])return cloud.rpc(rpcMap[m.type],m.args||{});
 throw Error('Unknown action');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{const task=queue.then(()=>handle(m,sender));queue=task.catch(()=>{});task.then(data=>{reply({data});if(['add','savePage','edit','status','capture','googleLogin','syncNow'].includes(m.type))scheduleSync();},e=>reply({error:e.message}));return true;});
// Sync and local mutations share the queue to avoid stale writes and refresh-token races.
function scheduleSync(){queue=queue.then(sync).catch(()=>{});}
async function sync(){
 await ready;const {dbV2:db,googleSession:s}=await chrome.storage.local.get(['dbV2','googleSession']);if(!db||!s)return;
 const p=db.profiles.find(p=>p.id===s.user.id);if(!p)return;let info;
 try{
  const payload={format:'applyledger-1',deviceId:db.deviceId,exportedAt:new Date().toISOString(),profiles:[{id:p.id,name:p.name,role:'member'}],jobs:db.jobs.filter(j=>j.profileId===p.id)};
  const signature=JSON.stringify(payload.jobs);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature))),b=>b.toString(16).padStart(2,'0')).join('');
  const synced=(await chrome.storage.local.get('syncedDigest')).syncedDigest||{};
  if(synced[p.id]!==digest){const r=await cloud.rpc('ledger_sync',{p_payload:payload});info={message:'Synced to your workspace',lastSync:r.syncedAt};synced[p.id]=digest;await chrome.storage.local.set({syncedDigest:synced});}else info={message:'All local changes are synced'};
  // Roles are checked server-side on every RPC; this refresh only updates UI state.
  const fresh=await cloud.rpc('ledger_me');db.profiles=db.profiles.map(x=>x.id===fresh.id?fresh:x);await chrome.storage.local.set({dbV2:db});
  if(fresh.role==='owner')await notifyOwner();
 }catch(e){info={message:'Sync pending: '+e.message};}
 const all=(await chrome.storage.local.get('syncInfoV2')).syncInfoV2||{};all[p.id]={...all[p.id],...info};await chrome.storage.local.set({syncInfoV2:all});
}
async function notifyOwner(){
 const inbox=await cloud.rpc('ledger_inbox');const seen=(await chrome.storage.local.get('notifiedIds')).notifiedIds||[];
 const unread=inbox.notices.filter(n=>!n.read_at);const pending=unread.filter(n=>!seen.includes(n.id));
 await chrome.action.setBadgeText({text:unread.length?String(unread.length):''});
 if(pending.length&&await chrome.permissions.contains({permissions:['notifications']})){
  await chrome.notifications.create('ledger-owner-inbox',{type:'basic',iconUrl:'icon128.png',title:'ApplyLedger · Workspace activity',message:pending.length===1?pending[0].message:`${pending.length} new sign-ups or admin requests. Open your inbox to review.`,priority:1});
  await chrome.storage.local.set({notifiedIds:[...new Set([...seen,...pending.map(n=>n.id)])].slice(-500)});
 }
}
let notificationListenerAttached=false;
function attachNotificationListener(){
 if(notificationListenerAttached||!chrome.notifications?.onClicked)return;
 chrome.notifications.onClicked.addListener(id=>{if(id==='ledger-owner-inbox')chrome.tabs.create({url:chrome.runtime.getURL('admin.html')});});
 notificationListenerAttached=true;
}
attachNotificationListener();
chrome.permissions?.onAdded?.addListener(attachNotificationListener);
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='sync')scheduleSync();});
chrome.runtime.onStartup.addListener(()=>{chrome.alarms.create('sync',{periodInMinutes:1});scheduleSync();});
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('sync',{periodInMinutes:1}));
