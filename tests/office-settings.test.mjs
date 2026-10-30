import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {createSettingsStore} from '../server-settings.mjs';
import {DEFAULT_PREFERENCES,validatePreferences} from '../public/office-preferences.js';
const root=fileURLToPath(new URL('../',import.meta.url));
async function directory(t){const dir=await mkdtemp(path.join(tmpdir(),'office-settings-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('settings validate every accepted field without accepting unknown or malformed data',()=>{
  assert.deepEqual(validatePreferences({ownerName:'  Test CEO  ',visitorDueDate:'2032-02-29'}),{ownerName:'Test CEO',visitorDueDate:'2032-02-29'});
  for(const value of [null,[],{ownerName:4},{ownerName:'a'.repeat(41)},{motion:1},{visitorEnabled:'true'},{latitude:91},{longitude:181},{visitorDueDate:'2031-02-29'},{visitorDueDate:'2031-04-31'},{visitorDueDate:'not-a-date'},{visitorDueDate:'2200-01-01'},{path:'../secret'},JSON.parse('{"__proto__":{}}')])assert.equal(validatePreferences(value),null,JSON.stringify(value));
  assert.deepEqual(validatePreferences({latitude:null,longitude:0,visitorDueDate:''}),{latitude:null,longitude:0,visitorDueDate:''});
});

test('project file survives restart, merges concurrent updates and excludes invalid writes',async t=>{
  const dir=await directory(t),filename=path.join(dir,'data/settings.json'),store=createSettingsStore(filename);
  assert.deepEqual(await store.read(),{settings:{...DEFAULT_PREFERENCES},configuredKeys:[]});
  await Promise.all([store.update({ownerName:'Test CEO'}),store.update({secretaryName:'Test Secretary'}),store.update({visitorName:'Test Visitor',visitorDueDate:'2031-03-15',visitorEnabled:true})]);
  const saved=JSON.parse(await readFile(filename,'utf8'));
  assert.equal(saved.ownerName,'Test CEO');assert.equal(saved.secretaryName,'Test Secretary');assert.equal(saved.visitorDueDate,'2031-03-15');
  assert.deepEqual((await createSettingsStore(filename).read()).settings,saved);
  if(process.platform!=='win32')assert.equal((await stat(filename)).mode&0o777,0o600);
  await assert.rejects(store.update({visitorDueDate:'2031-02-30'}),{status:400});
  assert.deepEqual(JSON.parse(await readFile(filename,'utf8')),saved);
  assert.deepEqual(await readdir(path.dirname(filename)),['settings.json']);
  await store.update({ownerTitle:'Director'});assert.equal((await store.read()).settings.ownerTitle,'Director');
});

test('a broken existing file is preserved and reports failure instead of resetting personal data',async t=>{
  const dir=await directory(t),filename=path.join(dir,'settings.json');await writeFile(filename,'broken json');
  const store=createSettingsStore(filename);await assert.rejects(store.read());await assert.rejects(store.update({ownerName:'test'}));
  assert.equal(await readFile(filename,'utf8'),'broken json');
});

async function startServer(t,dir){
  const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const {port}=listener.address();await new Promise(resolve=>listener.close(resolve));
  const child=spawn(process.execPath,['server.mjs'],{cwd:dir,env:{...process.env,PORT:String(port),CODEX_HOME:path.join(dir,'empty-codex')},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
  const base=`http://127.0.0.1:${port}`;
  for(let attempt=0;attempt<100;attempt++){
    if(child.exitCode!==null)throw new Error(output);
    try{const response=await fetch(`${base}/api/settings`);if(response.ok)return base;}catch{}
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  throw new Error(`Server did not start: ${output}`);
}

test('release excludes local inputs and ships a working settings API with private file isolation',async t=>{
  const dir=await directory(t);
  for(const name of ['public','package.json','build-release.mjs','server.mjs','server-settings.mjs','server-records.mjs','server-database.mjs','README.md','Start My AI Office.command','Start My AI Office.bat'])await cp(path.join(root,name),path.join(dir,name),{recursive:true});
  await mkdir(path.join(dir,'runtime/node'),{recursive:true});await writeFile(path.join(dir,'runtime/node/fixture.txt'),'test runtime');
  await mkdir(path.join(dir,'data'));await writeFile(path.join(dir,'data/settings.json'),JSON.stringify({ownerName:'PRIVATE_RELEASE_SENTINEL'}));
  await writeFile(path.join(dir,'.env'),'PRIVATE_ENV_SENTINEL');
  const build=spawnSync(process.execPath,['build-release.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const archives=(await readdir(path.join(dir,'dist'))).filter(name=>name.endsWith('.zip'));assert.equal(archives.length,1);
  const archive=path.join(dir,'dist',archives[0]),listing=spawnSync('unzip',['-Z1',archive],{encoding:'utf8'});assert.equal(listing.status,0);
  assert.doesNotMatch(listing.stdout,/\/data\/|\.env|settings\.json|office\.sqlite/);assert.match(listing.stdout,/server-settings\.mjs/);
  const extract=path.join(dir,'extracted');await mkdir(extract);assert.equal(spawnSync('unzip',['-q',archive,'-d',extract]).status,0);
  const shipped=path.join(extract,archives[0].slice(0,-4)),base=await startServer(t,shipped);
  let data=await (await fetch(`${base}/api/settings`)).json();assert.equal(data.settings.ownerName,'');assert.equal(data.settings.visitorEnabled,false);assert.equal(data.settings.visitorDueDate,'');
  const patch=body=>fetch(`${base}/api/settings`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let response=await patch({ownerName:'Release Test CEO',secretaryName:'Release Test Secretary',visitorEnabled:true,visitorDueDate:'2031-03-15'});assert.equal(response.status,200);
  data=await response.json();assert.equal(data.settings.ownerName,'Release Test CEO');
  assert.equal((await patch({visitorDueDate:'2031-02-30'})).status,400);
  assert.equal((await fetch(`${base}/api/settings`,{method:'PATCH',headers:{'content-type':'application/json',origin:'https://example.invalid'},body:'{}'})).status,403);
  assert.equal((await fetch(`${base}/api/settings`,{method:'PATCH',body:'{}'})).status,415);
  assert.equal((await fetch(`${base}/api/settings`,{method:'POST'})).status,405);
  assert.equal((await fetch(`${base}/data/settings.json`)).status,404);
  assert.equal((await fetch(`${base}/../data/settings.json`)).status,404);
  const disk=JSON.parse(await readFile(path.join(shipped,'data/settings.json'),'utf8'));assert.equal(disk.ownerName,'Release Test CEO');assert.equal(disk.visitorDueDate,'2031-03-15');
  assert.equal((await (await fetch(`${base}/api/settings`)).json()).settings.secretaryName,'Release Test Secretary');
  const html=await (await fetch(`${base}/shared-office.html`)).text();assert.match(html,/id="open-settings"/);
  // Exercise browser preference migration against the shipped HTTP API.
  const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
  const legacy=new Map([['my-ai-office-preferences',JSON.stringify({ownerName:'Migrated CEO',secretaryName:'Migrated Secretary',visitorName:'Old Visitor',ownerTitle:123,unknown:'discard'})]]);
  globalThis.localStorage={getItem:key=>legacy.get(key)||null,removeItem:key=>legacy.delete(key)};
  t.after(()=>{if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;});
  t.mock.method(globalThis,'fetch',(url,options)=>originalFetch(new URL(url,base),options));
  const {loadPreferences}=await import('../public/office-settings.js');
  await writeFile(path.join(shipped,'data/settings.json'),JSON.stringify({visitorName:'Project Visitor'}));
  const migrated=await loadPreferences();assert.equal(migrated.ownerName,'Migrated CEO');assert.equal(migrated.secretaryName,'Migrated Secretary');assert.equal(migrated.visitorName,'Project Visitor');assert.equal(migrated.ownerTitle,'CEO');assert.equal(legacy.size,0);
  assert.equal(JSON.parse(await readFile(path.join(shipped,'data/settings.json'),'utf8')).ownerName,'Migrated CEO');
  await writeFile(path.join(shipped,'data/settings.json'),'{}');
  legacy.set('my-ai-office-preferences',JSON.stringify({ownerName:'Keep on failure'}));
  t.mock.method(globalThis,'fetch',(url,options)=>options?.method==='PATCH'?Promise.reject(new Error('offline')):originalFetch(new URL(url,base),options));
  await assert.rejects(loadPreferences(),/저장하지 못했어요/);assert.equal(legacy.size,1);

});
