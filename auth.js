import {CONFIG} from './config.js';
export function configured(){return Boolean(CONFIG.supabaseUrl&&CONFIG.publishableKey);}
export function projectURL(){
 if(!configured())throw Error('Google sign-in setup is pending. Add your Supabase project URL and publishable key to config.js.');
 const u=new URL(CONFIG.supabaseUrl);
 if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.pathname!=='/'||u.search||u.hash)throw Error('Use the HTTPS Supabase project URL.');
 if(CONFIG.publishableKey.startsWith('sb_secret_'))throw Error('A secret key must never be used in this app. Use the publishable key.');
 return u.origin;
}
export const encode64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function pkce(){const verifier=encode64(crypto.getRandomValues(new Uint8Array(32)));const challenge=encode64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));return {verifier,challenge};}
export async function beginGoogle(redirect){const {verifier,challenge}=await pkce();const url=new URL(projectURL()+'/auth/v1/authorize');url.search=new URLSearchParams({provider:'google',redirect_to:redirect,code_challenge:challenge,code_challenge_method:'s256',prompt:'select_account'});return {url:url.href,verifier,redirect,createdAt:Date.now()};}
export function callbackCode(returned,flow){const u=new URL(returned),expected=new URL(flow.redirect);if(u.origin!==expected.origin||u.pathname!==expected.pathname||Date.now()-flow.createdAt>10*60*1000)throw Error('Invalid or expired sign-in callback');if(u.searchParams.get('error'))throw Error(u.searchParams.get('error_description')||'Google sign-in failed');const code=u.searchParams.get('code');if(!code)throw Error('No sign-in code received');return code;}
function sessionFields(data){if(!data.access_token||!data.refresh_token||!data.user?.id)throw Error('Invalid authentication response');return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in,user:{id:data.user.id,email:data.user.email}};}
export class Cloud {
 constructor(storage){this.storage=storage;this.refreshing=null;}
 async auth(path,body,access){const r=await fetch(projectURL()+'/auth/v1/'+path,{method:'POST',headers:{apikey:CONFIG.publishableKey,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.msg||data.error_description||data.message||'Authentication failed');return data;}
 async finish(returned,flow){const data=await this.auth('token?grant_type=pkce',{auth_code:callbackCode(returned,flow),code_verifier:flow.verifier});const session=sessionFields(data);await this.storage.set(session);return session;}
 async session(){let s=await this.storage.get();if(!s)throw Error('Sign in with Google first');if(s.expires_at*1000>Date.now()+60000)return s;if(this.refreshing)return this.refreshing;
 this.refreshing=(async()=>{const current=await this.storage.get();if(!current)throw Error('Sign in with Google first');if(current.expires_at*1000>Date.now()+60000)return current;const fresh=sessionFields(await this.auth('token?grant_type=refresh_token',{refresh_token:current.refresh_token}));if(fresh.user.id!==current.user.id)throw Error('Authentication identity changed');await this.storage.set(fresh);return fresh;})();try{return await this.refreshing;}finally{this.refreshing=null;}}
 async rpc(name,args={}){const s=await this.session();const r=await fetch(projectURL()+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:CONFIG.publishableKey,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});const data=await r.json().catch(()=>null);if(!r.ok)throw Error(data?.message||'Unable to contact your workspace');return data;}
 async logout(){const s=await this.storage.get();try{if(s)await this.auth('logout?scope=local',undefined,s.access_token);}finally{await this.storage.set(null);}}
}
