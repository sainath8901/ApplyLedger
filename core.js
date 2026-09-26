export const statuses = ['Saved','In progress','Needs confirmation','Submitted','Applied','Reviewing','Screening','Interview','Offer','Accepted','Rejected','Withdrawn'];
export const clean = (s, n=300) => String(s ?? '').trim().slice(0,n);
export function safeURL(value) { try { const u=new URL(value); if(!['http:','https:'].includes(u.protocol))return ''; u.hash=''; for(const key of [...u.searchParams.keys()])if(!['jk','gh_jid','jobid','job_id','requisitionid','positionid','id'].includes(key.toLowerCase()))u.searchParams.delete(key); return u.href; } catch { return ''; } }
export function newJob(data, profileId, source, now=new Date().toISOString()) {
  const status=source==='auto'?'Needs confirmation':'Saved';
  return {id:crypto.randomUUID(),profileId,source,title:clean(data.title)||'Untitled role',company:clean(data.company)||'Unknown company',url:safeURL(data.url),createdAt:now,history:[{status,at:now,note:source==='auto'?'Submission attempt detected':'Manually recorded'}]};
}
export function appendStatus(job,status,note) { if(!statuses.includes(status))throw Error('Invalid status'); job.history.push({status,at:new Date().toISOString(),note:clean(note,1000)}); }
export function validateSnapshot(x) {
 if(x?.format!=='applyledger-1'||typeof x.deviceId!=='string'||!Array.isArray(x.profiles)||!Array.isArray(x.jobs)||x.jobs.length>100000)throw Error('Invalid export');
 const profiles=x.profiles.map(p=>({id:clean(p.id),name:clean(p.name),role:p.role==='admin'?'admin':'member'}));
 if(profiles.some(p=>!p.id||!p.name)||new Set(profiles.map(p=>p.id)).size!==profiles.length)throw Error('Invalid profiles');
 const jobs=x.jobs.map(j=>{if(!profiles.some(p=>p.id===j.profileId)||!j.id||!Array.isArray(j.history)||!j.history.length||j.history.length>1000||!Number.isFinite(Date.parse(j.createdAt)))throw Error('Invalid job'); return {id:clean(j.id),profileId:clean(j.profileId),source:j.source==='auto'?'auto':'manual',title:clean(j.title),company:clean(j.company),url:safeURL(j.url),createdAt:new Date(j.createdAt).toISOString(),history:j.history.map(h=>{if(!statuses.includes(h.status)||!Number.isFinite(Date.parse(h.at)))throw Error('Invalid history');return {status:h.status,at:new Date(h.at).toISOString(),note:clean(h.note,1000)};})};});
 if(new Set(jobs.map(j=>j.id)).size!==jobs.length)throw Error('Duplicate job IDs');
 return {format:x.format,deviceId:clean(x.deviceId),exportedAt:new Date(x.exportedAt).toISOString(),profiles,jobs};
}
export function appliedDate(j){return j.history.find(h=>['Submitted','Applied'].includes(h.status))?.at;}
export function periodStart(period, now=new Date()){const d=new Date(now); d.setHours(0,0,0,0);if(period==='week')d.setDate(d.getDate()-((d.getDay()+6)%7));if(period==='month')d.setDate(1);if(period==='year'){d.setMonth(0,1);}return d;}
