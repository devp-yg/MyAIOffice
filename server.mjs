import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { summarizeLine, projectInfo, sessionSummary, digest } from './server-records.mjs';
import { openOfficeDatabase, validateRegistries } from './server-database.mjs';
import { StaffIdentities } from './public/staff-identities.js';

const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4173),host='127.0.0.1';
const officeDatabase=await openOfficeDatabase();
const staticRoot=path.join(root,'public'),codexHome=process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),sessionsRoot=path.join(path.resolve(codexHome),'sessions');
const mimeTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const sessionCache=new Map(),metadataCache=new Map(),directoryCache=new Map(),clients=new Set();
let savedProjectsCache={mtime:null,projects:[]};
let snapshotCache={sessions:[],projects:[],checkedAt:Date.now(),localOnly:true,provider:'Codex',connected:true,ready:false},scanInProgress=false,previousSignature='';
async function walkJsonl(dir,depth=0,files=[]){
  if(depth>7||files.length>=5000)return files;
  let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return files;}
  for(const entry of entries){if(files.length>=5000)break;const full=path.join(dir,entry.name);if(entry.isDirectory())await walkJsonl(full,depth+1,files);else if(entry.isFile()&&entry.name.startsWith('rollout-')&&entry.name.endsWith('.jsonl')){try{const stat=await fs.stat(full);files.push({full,mtime:stat.mtimeMs,size:stat.size});}catch{}}}
  return files;
}
async function readHeader(file){
  const handle=await fs.open(file.full,'r');
  try{let offset=0;const parts=[];while(offset<Math.min(file.size,1048576)){const buffer=Buffer.alloc(Math.min(8192,file.size-offset,1048576-offset));const {bytesRead}=await handle.read(buffer,0,buffer.length,offset);if(!bytesRead)break;const newline=buffer.indexOf(10);parts.push(buffer.subarray(0,newline<0?bytesRead:newline));offset+=bytesRead;if(newline>=0)break;}const event=summarizeLine(Buffer.concat(parts).toString('utf8'));return event?.kind==='meta'?event:{};}finally{await handle.close();}
}
async function readSession(file,previous){
  let handle;
  try{const meta=await readHeader(file);metadataCache.set(file.full,meta);handle=await fs.open(file.full,'r');const start=Math.max(0,file.size-262144),buffer=Buffer.alloc(file.size-start);await handle.read(buffer,0,buffer.length,start);return sessionSummary(buffer.toString('utf8').split('\n').filter(Boolean),meta,file,previous);}catch{return null;}finally{await handle?.close();}
}
// Desktop workspace registrations also include folders with no session yet.
async function savedProjects(){
  const filename=path.join(codexHome,'.codex-global-state.json');
  try{
    const stat=await fs.stat(filename);if(stat.mtimeMs===savedProjectsCache.mtime)return savedProjectsCache.projects;
    const data=JSON.parse(await fs.readFile(filename,'utf8')),projects=new Map();
    for(const item of Object.values(data['local-projects']||{})){
      if(!item||!Array.isArray(item.rootPaths))continue;
      for(const cwd of item.rootPaths){if(typeof cwd!=='string'||!path.isAbsolute(cwd))continue;const info=projectInfo(cwd);projects.set(info.key,{...info,name:item.rootPaths.length===1&&typeof item.name==='string'?item.name:info.name,cwd,count:0,lastActivityAt:0,createdAt:Number(item.createdAt)||0});}
    }
    for(const cwd of data['electron-saved-workspace-roots']||[]){if(typeof cwd!=='string'||!path.isAbsolute(cwd))continue;const info=projectInfo(cwd);if(!projects.has(info.key))projects.set(info.key,{...info,cwd,count:0,lastActivityAt:0,createdAt:0});}
    savedProjectsCache={mtime:stat.mtimeMs,projects:[...projects.values()]};return savedProjectsCache.projects;
  }catch{return savedProjectsCache.projects;}
}
async function projectExists(cwd){
  if(!cwd)return true;
  const previous=directoryCache.get(cwd),now=Date.now();if(previous&&now-previous.checked<4000)return previous.exists;
  let exists=false;try{exists=(await fs.stat(cwd)).isDirectory();}catch{}
  const misses=exists?0:(previous?.misses||0)+1;
  const effective=exists||Boolean(previous?.exists&&misses<2);
  directoryCache.set(cwd,{exists:effective,misses,checked:now});return effective;
}
async function refreshSnapshot(){
  if(scanInProgress)return;scanInProgress=true;
  try{
    const files=await walkJsonl(sessionsRoot);files.sort((a,b)=>b.mtime-a.mtime);
    const paths=new Set(files.map(file=>file.full));for(const filename of metadataCache.keys())if(!paths.has(filename))metadataCache.delete(filename);
    const recent=files.slice(0,192),recentPaths=new Set(recent.map(file=>file.full));
    for(const filename of sessionCache.keys())if(!recentPaths.has(filename))sessionCache.delete(filename);
    await Promise.all(recent.map(async file=>{const cached=sessionCache.get(file.full);if(cached?.mtime===file.mtime&&cached.size===file.size)return;const session=await readSession(file,cached?.session);if(session)sessionCache.set(file.full,{session,mtime:file.mtime,size:file.size});}));
    const missing=files.filter(file=>!metadataCache.has(file.full));
    for(let offset=0;offset<missing.length;offset+=24)await Promise.all(missing.slice(offset,offset+24).map(async file=>{try{metadataCache.set(file.full,await readHeader(file));}catch{}}));
    const projects=new Map();
    for(const file of files){const meta=metadataCache.get(file.full);if(!meta)continue;const info=projectInfo(meta.cwd);if(!projects.has(info.key))projects.set(info.key,{...info,cwd:meta.cwd,count:0,lastActivityAt:0});const project=projects.get(info.key);project.count++;project.lastActivityAt=Math.max(project.lastActivityAt,file.mtime);}
    for(const saved of await savedProjects()){if(projects.has(saved.key)){const project=projects.get(saved.key);project.name=saved.name;project.createdAt=saved.createdAt;}else projects.set(saved.key,saved);}
    const existing=await Promise.all([...projects.values()].map(async project=>({...project,exists:await projectExists(project.cwd)})));
    const projectKeys=new Set(existing.filter(project=>project.exists).map(project=>project.key));
    const sessions=recent.map(file=>sessionCache.get(file.full)?.session).filter(session=>session&&projectKeys.has(session.projectKey)).map(session=>({...session,active:!session.finished&&Date.now()-session.updatedAt<120000}));
    const manifest=existing.filter(project=>project.exists).map(({cwd,exists,...project})=>({...project,active:sessions.filter(session=>session.projectKey===project.key&&session.active).length,lastRequestAt:Math.max(0,...sessions.filter(session=>session.projectKey===project.key).map(session=>session.lastRequestAt||0))}));
    const projectNames=new Map(manifest.map(project=>[project.key,project.name]));
    const archives=files.map(file=>{
      const meta=metadataCache.get(file.full);if(!meta)return null;
      const project=projectInfo(meta.cwd);if(!projectKeys.has(project.key))return null;
      const recentSession=sessionCache.get(file.full)?.session;
      if(recentSession&&!recentSession.finished&&Date.now()-recentSession.updatedAt<120000)return null;
      return {id:digest(meta.id||file.full),projectKey:project.key,project:projectNames.get(project.key)||project.name,hasParent:Boolean(meta.parentId),updatedAt:file.mtime};
    }).filter(Boolean);
    const registry=officeDatabase.readRegistries();let staff;
    if(registry.initialized){
      const identities=new StaffIdentities(registry.staff);identities.assign(sessions);identities.assign(archives);staff=identities.registry;
      const added=Object.fromEntries(Object.entries(staff).filter(([id])=>!registry.staff[id]));
      if(Object.keys(added).length)officeDatabase.writeRegistries({staff:added,floors:{}});
    }
    snapshotCache={sessions,archives,projects:manifest,staff,checkedAt:Date.now(),localOnly:true,provider:'Codex',connected:true,ready:true};
  }finally{scanInProgress=false;}
}
function broadcast(){const signature=JSON.stringify({projects:snapshotCache.projects,sessions:snapshotCache.sessions,archives:snapshotCache.archives});if(signature===previousSignature)return;previousSignature=signature;for(const response of clients)response.write(`event: office\ndata: ${JSON.stringify(snapshotCache)}\n\n`);}
function sendJson(response,value){response.writeHead(200,{'content-type':mimeTypes['.json'],'cache-control':'no-store'});response.end(JSON.stringify(value));}
async function readJsonBody(request,limit=1024*1024){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Request body is too large'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}}
const server=createServer(async(request,response)=>{
  const url=new URL(request.url||'/',`http://${host}:${port}`);
  if(url.pathname==='/api/state')return sendJson(response,snapshotCache);
  if(url.pathname==='/api/registry'&&request.method==='GET')return sendJson(response,officeDatabase.readRegistries());
  if(url.pathname==='/api/registry'&&request.method==='PUT'){
    try{const registries=validateRegistries(await readJsonBody(request));if(!registries){response.writeHead(400).end('Invalid registry data');return;}officeDatabase.writeRegistries(registries);return sendJson(response,{ok:true});}
    catch(error){response.writeHead(error.status||500,{'content-type':'text/plain; charset=utf-8'}).end(error.status?error.message:'Unable to save app data');return;}
  }
  if(url.pathname==='/events'){response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache, no-transform',connection:'keep-alive','x-accel-buffering':'no'});response.write(`retry: 2000\n\nevent: office\ndata: ${JSON.stringify(snapshotCache)}\n\n`);clients.add(response);response.on('close',()=>clients.delete(response));return;}
  let requested;try{requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);}catch{response.writeHead(400).end('Bad request');return;}
  const filename=path.resolve(staticRoot,`.${requested}`);if(!filename.startsWith(staticRoot+path.sep)){response.writeHead(403).end('Forbidden');return;}
  try{const stat=await fs.stat(filename);if(!stat.isFile())throw Error('Not a file');response.writeHead(200,{'content-type':mimeTypes[path.extname(filename)]||'application/octet-stream','cache-control':'no-cache'});createReadStream(filename).pipe(response);}catch{response.writeHead(404,{'content-type':'text/plain; charset=utf-8'}).end('Not found');}
});
server.listen(port,host,()=>{console.log(`My AI Office is running at http://${host}:${port}`);console.log(`Watching Codex sessions at ${sessionsRoot}`);refreshSnapshot().then(broadcast).catch(()=>{});});
setInterval(()=>refreshSnapshot().then(broadcast).catch(()=>{}),1200).unref();
