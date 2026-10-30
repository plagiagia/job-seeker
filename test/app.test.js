import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('application lifecycle, validation, profile, and restart persistence', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'jarvis-test-'));
 let child,base;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,AI_API_KEY:''},stdio:['ignore','pipe','pipe']});let output='';await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{output+=b;const match=output.match(/port (\d+)/);if(match){base=`http://127.0.0.1:${match[1]}`;resolve();}});child.once('exit',code=>reject(Error(`Server exited: ${code}`)));child.once('error',reject);});}
 async function stop(){const ended=once(child,'exit');child.kill();await ended;}
 async function api(p,method='GET',body,headers={}){const r=await fetch(base+'/api/'+p,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 try {
 await start();
 assert.equal((await fetch(base)).status,200);
 assert.match(await (await fetch(base+'/app.js')).text(),/Mission control/);
 let result=await api('state');assert.deepEqual(result.data.applications,[]);assert.equal(result.data.aiConfigured,false);assert.match(result.data.settings.prompt,/English/);
 assert.equal((await api('applications','POST',{company:'Acme',title:'Engineer',posting:''})).status,400);
 result=await api('applications','POST',{company:'Acme',title:'Engineer',posting:'Build thoughtful software.',url:'https://example.com/job'});assert.equal(result.status,201);const id=result.data.id;
 assert.equal((await api(`applications/${id}/generate`,'POST',{})).status,422);
 const profile={name:'Alex',cv:'Engineer with five years building web tools.',coverLetter:'Hello team',prompt:'Always English. Preserve facts.'};assert.deepEqual((await api('settings','PUT',profile)).data,profile);
 result=await api(`applications/${id}`,'PATCH',{status:'interview',notes:'Interview next Tuesday',cv:'Reviewed CV',coverLetter:'Reviewed letter'});assert.equal(result.data.history.length,2);assert.equal(result.data.status,'interview');
 assert.equal((await api(`applications/${id}`,'PATCH',{status:'invalid'})).status,400);
 assert.equal((await api(`applications/${id}`,'PATCH',{status:'offer'},{Origin:'https://untrusted.example'})).status,403);
 await stop();await start();result=await api('state');assert.equal(result.data.settings.cv,profile.cv);assert.equal(result.data.applications[0].notes,'Interview next Tuesday');assert.equal(result.data.applications[0].cv,'Reviewed CV');
 assert.equal((await api(`applications/${id}`,'PATCH',{status:'rejected'})).data.history.length,3);
 assert.equal((await api(`applications/${id}`,'DELETE')).status,200);assert.equal((await api('state')).data.applications.length,0);
 assert.equal((await api(`applications/${id}`,'PATCH',{notes:'gone'})).status,404);
 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});

test('AI response is validated and generated documents persist without losing concurrent notes', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'jarvis-ai-test-'));
 const mock=`globalThis.fetch = async (url, options) => {
 if (url !== 'https://api.openai.com/v1/chat/completions') throw Error('Unexpected provider URL');
 const body = JSON.parse(options.body);
 if (!body.messages[0].content.includes('English')) throw Error('English instruction missing');
 if (options.headers.Authorization !== 'Bearer test-only-placeholder') throw Error('Missing server authentication');
 const input=JSON.parse(body.messages[1].content);
 await new Promise(r=>setTimeout(r,100));
 if(input.jobPosting==='provider error') return new Response('{}',{status:429});
 const content=input.jobPosting==='invalid response'?'{}':JSON.stringify({summary:'A relevant engineering role.',cv:'Truthful tailored CV in English.',coverLetter:'Dear hiring team,',gaps:['No evidence of Kubernetes experience.']});
 return Response.json({choices:[{message:{content}}]});
 };`;
 const child=spawn(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(mock).toString('base64'),'server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,AI_API_KEY:'test-only-placeholder'},stdio:['ignore','pipe','pipe']});
 try {
 const base=await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',b=>{output+=b;const m=output.match(/port (\d+)/);if(m)resolve(`http://127.0.0.1:${m[1]}`);});child.once('exit',c=>reject(Error('Server exited: '+c)));child.once('error',reject);});
 async function api(p,method='GET',body){const r=await fetch(base+'/api/'+p,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 const job=await api('applications','POST',{company:'Acme',title:'Engineer',posting:'Build web apps'});const id=job.data.id;
 assert.equal((await api(`applications/${id}/generate`,'POST',{})).status,422);
 await api('settings','PUT',{name:'Alex',cv:'Original truthful CV',coverLetter:'',prompt:'Keep it concise. English.'});
 const pending=api(`applications/${id}/generate`,'POST',{});
 await new Promise(r=>setTimeout(r,30));
 assert.equal((await api(`applications/${id}/generate`,'POST',{})).status,409);
 await api(`applications/${id}`,'PATCH',{notes:'Keep this note',status:'interview'});
 const generated=await pending;assert.equal(generated.status,200);assert.equal(generated.data.notes,'Keep this note');assert.equal(generated.data.status,'interview');assert.equal(generated.data.cv,'Truthful tailored CV in English.');assert.equal(generated.data.gaps.length,1);
 const saved=(await api('state')).data;assert.ok(saved.applications[0].generatedAt);assert.equal(saved.aiConfigured,true);assert.equal(JSON.stringify(saved).includes('test-only-placeholder'),false);
 for(const [posting,status] of [['invalid response',500],['provider error',502]]){const a=await api('applications','POST',{company:'Acme',title:'Engineer',posting});assert.equal((await api(`applications/${a.data.id}/generate`,'POST',{})).status,status);}
 }finally{if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}await rm(dir,{recursive:true,force:true});}
});
