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
const MEETING_LABELS={review:'검토 중',plan:'계획을 정리 중'};
const NEW_TASK={room:'desk',label:'새 작업을 시작했어요',icon:'✦'};
const IDLE={room:'desk',label:'세션이 대기 중이에요',icon:'◷'};

function requestIntent(value){
  const text=messageText(value).normalize('NFC')
    .replace(/\x60{3}[\s\S]*?(?:\x60{3}|$)|\x60[^\x60\n]*\x60|^\s*>[^\n]*/gm,' ')
    .trim().slice(0,1200);
  const koreanReview=/(?:검토|리뷰|점검)\s*(?:해|하(?:고|자|되)|부터|만(?=\s|$)|좀|부탁|[.!?…]*$)/;
  const englishReview=/\b(?:do|perform|run|request)\s+(?:a\s+)?code review\b|(?:^|[.!?]\s+)(?:please\s+)?\/?review\b|\b(?:can|could|would) you (?:please )?review\b/i;
  const koreanPlan=/(?:계획|대책|대응책|로드맵|방안)(?:을|를)?\s*(?:세워|짜|수립|정리|작성|마련|만들|만(?=\s|$)|부터)/;
  const englishPlan=/\b(?:make|draft|write|outline|propose|prepare|come up with)\s+(?:(?:a|an|the|your|implementation|step-by-step)\s+)*(?:plan|roadmap|strategy|approach)\b|^(?:please\s+)?plan\s+(?:how|the|an?|this|out)\b/i;
  if(koreanReview.test(text)||englishReview.test(text))return 'review';
  if(koreanPlan.test(text)||englishPlan.test(text))return 'plan';
  return null;
}

function meetingActivity(intent){
  return {room:'meeting',label:MEETING_LABELS[intent],icon:'▤'};
}

export function projectInfo(cwd){
  const windows=typeof cwd==='string'&&(/^[a-z]:[\\/]/i.test(cwd)||cwd.startsWith('\\\\'));
  const normalized=cwd?(windows?path.win32.normalize(cwd).toLowerCase():path.normalize(cwd)):'default-workspace';
  return {key:digest(normalized),name:cwd?(windows?path.win32.basename(path.win32.normalize(cwd)):path.basename(path.normalize(cwd))):'내 작업 공간'};
}
export function classify(name='',input={}){
  const tool=name.toLowerCase(),hint=String(input.file_path||input.path||input.command||input.cmd||input.code||input.query||input.task||'').toLowerCase();
  if(/spawn_agent|send_input|wait_agent|followup_task/.test(tool))return{room:'elevator',label:'서브에이전트와 협업 중',icon:'↗'};
  const editsFile=/apply_patch|edit|write/.test(tool)&&!tool.endsWith('write_stdin');
  if(editsFile||/\btools\.apply_patch\s*\(|\b(?:writefile|write_text)\s*\(|\bcat\s*>{1,2}|\bsed\s+-i\b/.test(hint))return{room:'studio',label:'코드와 파일 수정 중',icon:'✎'};
  if(/cua|web|browser|search|fetch|mcp/.test(tool)||/tools\.web__run|\.playwright\./.test(hint))return{room:'research',label:'정보 검색과 도구 사용 중',icon:'◎'};
  if(/read|glob|grep/.test(tool)||/\b(cat|sed|rg|grep|find)\b/.test(hint))return{room:'library',label:'파일과 자료 확인 중',icon:'⌕'};
  if(/plan|think/.test(tool))return{room:'meeting',label:'계획을 정리 중',icon:'▤'};
  if(/(^|[._])exec$|exec_command|write_stdin|shell|terminal|command/.test(tool)){
    const runsTests=/\b(?:npm|pnpm|yarn|bun)(?:\s+run)?\s+test\b|\bnode\s+--test\b|\b(?:pytest|cargo\s+test|go\s+test)\b/.test(hint);
    return {room:'server',label:runsTests?'테스트를 실행 중':'명령을 실행 중',icon:'⌘'};
  }
  return{room:'desk',label:'요청을 살펴보는 중',icon:'✦'};
}
export function summarizeLine(line){
  let row;try{row=typeof line==='string'?JSON.parse(line):line;}catch{return null;}
  const payload=row.payload||{};
  if(row.type==='session_meta'){const meta=payload.meta||payload;return{kind:'meta',cwd:meta.cwd,id:meta.id||meta.session_id,parentId:meta.parent_thread_id||null,nickname:meta.agent_nickname||null,role:meta.agent_role||null};}
  const time=Number.isFinite(Date.parse(row.timestamp))?Date.parse(row.timestamp):null;
  if((row.type==='event_msg'&&payload.type==='user_message')||(row.type==='response_item'&&payload.type==='message'&&payload.role==='user')){
    return {kind:'request',time,requestAt:time,meetingIntent:requestIntent(payload.message??payload.content)};
  }
  if(row.type==='response_item'&&payload.type==='message'&&payload.role==='assistant'&&['commentary','final','final_answer'].includes(payload.channel||payload.phase))return{kind:'codex_message',message:shortMessage(messageText(payload.content)),time};
  if(row.type==='response_item'&&['function_call','custom_tool_call'].includes(payload.type)){
    let input={};const raw=payload.arguments??payload.input;try{input=typeof raw==='string'?JSON.parse(raw):raw||{};}catch{input={command:raw||''};}
    return{...classify(payload.name,input),kind:'activity',time};
  }
  if(row.type==='response_item'&&payload.type==='function_call_output'){const output=String(payload.output||'');if(/error|failed|exception/i.test(output)&&output.length<300)return{room:'desk',label:'도구 실행 결과를 확인 중',icon:'!',error:true,kind:'activity',time};}
  if(row.type==='event_msg'){
    if(['task_started','turn_started'].includes(payload.type)){
      const meetingIntent=payload.collaboration_mode_kind==='plan'?'plan':null;
      return {...(meetingIntent?meetingActivity(meetingIntent):NEW_TASK),kind:'activity',time,turnStarted:true,meetingIntent};
    }
    if(['task_complete','turn_complete'].includes(payload.type))return{room:'desk',label:'작업 결과를 정리했어요',icon:'✓',finished:true,kind:'activity',time};
    if(payload.type==='turn_aborted')return{room:'desk',label:'작업이 중단됐어요',icon:'◷',finished:true,aborted:true,kind:'activity',time};
    if(payload.type==='agent_message')return{room:'meeting',label:'결과를 정리 중',icon:'▤',kind:'activity',time};
  }
  return null;
}
export function sessionSummary(lines,meta,file,previous){
  const summaries=lines.map(summarizeLine).filter(Boolean);
  const codexNote=summaries.map(event=>event.kind==='codex_message'?event.message:null).filter(Boolean).at(-1)||previous?.codexNote||null;
  // Preserve the intent when a long turn pushes its request out of the rolling log window.
  let meetingIntent=previous?.meetingIntent||null;
  let last=previous||IDLE;
  for(const event of summaries){
    if(event.kind==='request'){
      if(event.meetingIntent){
        meetingIntent=event.meetingIntent;
        last=meetingActivity(meetingIntent);
      }else if(last.finished){
        meetingIntent=null;
        last=NEW_TASK;
      }
    }else if(event.kind==='activity'){
      if(event.turnStarted||event.finished||event.room==='studio')meetingIntent=event.meetingIntent||null;
      last=event;
    }
  }
  const requestTimes=summaries.filter(event=>event.kind==='request').map(event=>event.requestAt).filter(Boolean).sort((a,b)=>a-b).filter((time,index,list)=>index===0||time-list[index-1]>1000);
  const lastRequestAt=Math.max(previous?.lastRequestAt||0,...requestTimes)||null;
  const extra=requestTimes.filter(time=>time>(previous?.lastRequestAt||0)+500).length;
  const project=projectInfo(meta.cwd),id=digest(meta.id||file.full);
  return {
    id,hasParent:Boolean(meta.parentId),nickname:meta.nickname||null,role:meta.role||null,
    project:project.name,projectKey:project.key,
    room:meetingIntent?'meeting':last.room,meetingIntent,label:last.label,codexNote,icon:last.icon,
    error:Boolean(last.error),updatedAt:file.mtime,finished:Boolean(last.finished),aborted:Boolean(last.aborted),
    active:!last.finished&&Date.now()-file.mtime<120000,lastRequestAt,
    requestId:lastRequestAt?digest(`${id}:${lastRequestAt}`):null,requestCount:(previous?.requestCount||0)+extra,
  };
}
