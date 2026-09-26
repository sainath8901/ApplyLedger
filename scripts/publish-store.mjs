import {readFile} from 'node:fs/promises';
const required=['CWS_CLIENT_ID','CWS_CLIENT_SECRET','CWS_REFRESH_TOKEN','CWS_PUBLISHER_ID','CWS_EXTENSION_ID'];
for(const key of required)if(!process.env[key])throw Error('Missing '+key);
const env=process.env;
for(const key of ['CWS_PUBLISHER_ID','CWS_EXTENSION_ID'])if(!/^[a-zA-Z0-9_-]+$/.test(env[key]))throw Error('Invalid '+key);
async function response(r,label){const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(label+' failed (HTTP '+r.status+'). Check the Web Store dashboard; credentials are not logged.');return data;}
const token=await response(await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.CWS_CLIENT_ID,client_secret:env.CWS_CLIENT_SECRET,refresh_token:env.CWS_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(30000)}),'Authentication');
if(!token.access_token)throw Error('No access token returned');
const headers={Authorization:'Bearer '+token.access_token};
const item=`publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_EXTENSION_ID}`;
const base='https://chromewebstore.googleapis.com';
let uploaded=await response(await fetch(`${base}/upload/v2/${item}:upload`,{method:'POST',headers:{...headers,'Content-Type':'application/zip'},body:await readFile(new URL('../release/ApplyLedger-store.zip',import.meta.url)),signal:AbortSignal.timeout(120000)}),'Upload');
for(let i=0;uploaded.uploadState==='IN_PROGRESS'&&i<24;i++){
 await new Promise(r=>setTimeout(r,5000));
 const status=await response(await fetch(`${base}/v2/${item}:fetchStatus`,{headers,signal:AbortSignal.timeout(30000)}),'Upload status');
 uploaded={uploadState:status.lastAsyncUploadState};
}
if(uploaded.uploadState!=='SUCCEEDED')throw Error('Upload did not complete successfully. Inspect the store dashboard before retrying.');
await response(await fetch(`${base}/v2/${item}:publish`,{method:'POST',headers,signal:AbortSignal.timeout(30000)}),'Publish submission');
console.log('Release submitted to Chrome Web Store. Approval and user rollout are not immediate.');
