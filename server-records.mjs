import { createHash } from 'node:crypto';
import path from 'node:path';
export const digest=value=>createHash('sha1').update(String(value)).digest('hex').slice(0,16);
function messageText(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(messageText).filter(Boolean).join(' ');
  if(value&&typeof value==='object')return typeof value.text==='string'?value.text:messageText(value.content??'');
  return '';
}
function shortMessage(value){
  const cleaned=String(value||'').replace(/\s+/g,' ').trim();
  if(!cleaned)return null;
  const firstSentence=cleaned.match(/^.{1,120}?(?:[.!?。！？](?=\s|$)|$)/u)?.[0]||cleaned;
  const chars=Array.from(firstSentence.trim());
  return chars.length>72?`${chars.slice(0,71).join('')}…`:chars.join('');
}
export function projectInfo(cwd){
  const windows=typeof cwd==='string'&&(/^[a-z]:[\\/]/i.test(cwd)||cwd.startsWith('\\\\'));
  const normalized=cwd?(windows?path.win32.normalize(cwd).toLowerCase():path.normalize(cwd)):'default-workspace';
  return {key:digest(normalized),name:cwd?(windows?path.win32.basename(path.win32.normalize(cwd)):path.basename(path.normalize(cwd))):'내 작업 공간'};
}
export function classify(name='',input={}){
  const tool=name.toLowerCase(),hint=String(input.file_path||input.path||input.command||input.cmd||input.code||input.query||input.task||'').toLowerCase();
  if(/spawn_agent|send_input|wait_agent/.test(tool))return{room:'elevator',label:'서브에이전트와 협업 중',icon:'↗'};
  if(/apply_patch|edit|write/.test(tool)||/tools\.apply_patch|writefile|write_text|cat\s*>{1,2}/.test(hint))return{room:'studio',label:'코드와 파일 수정 중',icon:'✎'};
  if(/cua|web|browser|search|fetch|mcp/.test(tool)||/tools\.web__run|\.playwright\./.test(hint))return{room:'research',label:'정보 검색과 도구 사용 중',icon:'◎'};
  if(/read|glob|grep/.test(tool)||/\b(cat|sed|rg|grep|find)\b/.test(hint))return{room:'library',label:'파일과 자료 확인 중',icon:'⌕'};
  if(/plan|think/.test(tool))return{room:'meeting',label:'계획을 정리 중',icon:'▤'};
  if(/(^|[._])exec$|exec_command|shell|terminal|command/.test(tool))return{room:'server',label:'명령을 실행 중',icon:'⌘'};
  return{room:'desk',label:'요청을 살펴보는 중',icon:'✦'};
}
export function summarizeLine(line){
  let row;try{row=typeof line==='string'?JSON.parse(line):line;}catch{return null;}
  const payload=row.payload||{};
  if(row.type==='session_meta'){const meta=payload.meta||payload;return{kind:'meta',cwd:meta.cwd,id:meta.id||meta.session_id,parentId:meta.parent_thread_id||null,nickname:meta.agent_nickname||null,role:meta.agent_role||null};}
  const time=Number.isFinite(Date.parse(row.timestamp))?Date.parse(row.timestamp):null;
  if((row.type==='event_msg'&&payload.type==='user_message')||(row.type==='response_item'&&payload.type==='message'&&payload.role==='user'))return{kind:'request',time,requestAt:time};
  if(row.type==='response_item'&&payload.type==='message'&&payload.role==='assistant'&&['commentary','final','final_answer'].includes(payload.channel||payload.phase))return{kind:'codex_message',message:shortMessage(messageText(payload.content)),time};
  if(row.type==='response_item'&&['function_call','custom_tool_call'].includes(payload.type)){
    let input={};const raw=payload.arguments??payload.input;try{input=typeof raw==='string'?JSON.parse(raw):raw||{};}catch{input={command:raw||''};}
    return{...classify(payload.name,input),kind:'activity',time};
  }
  if(row.type==='response_item'&&payload.type==='function_call_output'){const output=String(payload.output||'');if(/error|failed|exception/i.test(output)&&output.length<300)return{room:'desk',label:'도구 실행 결과를 확인 중',icon:'!',error:true,kind:'activity',time};}
  if(row.type==='event_msg'){
    if(['task_started','turn_started'].includes(payload.type))return{room:'desk',label:'새 작업을 시작했어요',icon:'✦',kind:'activity',time};
    if(['task_complete','turn_complete'].includes(payload.type))return{room:'desk',label:'작업 결과를 정리했어요',icon:'✓',finished:true,kind:'activity',time};
    if(payload.type==='agent_message')return{room:'meeting',label:'결과를 정리 중',icon:'▤',kind:'activity',time};
  }
  return null;
}
export function sessionSummary(lines,meta,file,previous){
  const summaries=lines.map(summarizeLine).filter(Boolean);
  const events=summaries.filter(event=>event.kind==='activity');
  const codexNote=summaries.map(event=>event.kind==='codex_message'?event.message:null).filter(Boolean).at(-1)||previous?.codexNote||null;
  const last=events.at(-1)||{room:'desk',label:'세션이 대기 중이에요',icon:'◷'};
  const requestTimes=summaries.filter(event=>event.kind==='request').map(event=>event.requestAt).filter(Boolean).sort((a,b)=>a-b).filter((time,index,list)=>index===0||time-list[index-1]>1000);
  const lastRequestAt=Math.max(previous?.lastRequestAt||0,...requestTimes)||null;
  const extra=requestTimes.filter(time=>time>(previous?.lastRequestAt||0)+500).length;
  const project=projectInfo(meta.cwd),id=digest(meta.id||file.full);
  return{id,hasParent:Boolean(meta.parentId),nickname:meta.nickname||null,role:meta.role||null,project:project.name,projectKey:project.key,room:last.room,label:last.label,codexNote,icon:last.icon,error:Boolean(last.error),updatedAt:file.mtime,finished:Boolean(last.finished),active:!last.finished&&Date.now()-file.mtime<120000,lastRequestAt,requestId:lastRequestAt?digest(`${id}:${lastRequestAt}`):null,requestCount:(previous?.requestCount||0)+extra};
}
