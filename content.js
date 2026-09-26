(()=>{
 if(globalThis.__applyLedger)return;globalThis.__applyLedger=true;
 const send=(stage,data)=>chrome.runtime.sendMessage({type:'capture',stage,data}).catch(()=>{});
 function details(){let posting;for(const el of document.querySelectorAll('script[type="application/ld+json"]')){try{const raw=JSON.parse(el.textContent);const list=Array.isArray(raw)?raw:[raw,...(raw['@graph']||[])];posting=list.find(x=>x['@type']==='JobPosting');if(posting)break;}catch{}}
 return {title:posting?.title||document.querySelector('h1')?.innerText||document.title,company:posting?.hiringOrganization?.name||location.hostname};}
 let last=0;
 function attempt(el){const label=(el?.innerText||el?.value||'').trim();const context=(document.title+' '+location.pathname+' '+document.querySelector('h1')?.innerText).toLowerCase();if(!/job|career|application|apply|position|recruit/.test(context)||!/^(submit( application)?|send application|apply( now)?|complete application)$/i.test(label))return;if(Date.now()-last<4000)return;last=Date.now();send('attempt',details());}
 document.addEventListener('submit',e=>attempt(e.submitter),true);
 document.addEventListener('click',e=>{const el=e.target.closest('button,input[type=submit],[role=button]');if(el)attempt(el);},true);
 let timer;
 function check(){const text=document.body?.innerText||'';if(/application (has been |was )?(successfully )?(submitted|received)|thank you for applying|thanks for applying/i.test(text))send('confirmed',{});}
 const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(check,1200);});observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});check();
})();
