import {DEFAULT_PREFERENCES} from './office-preferences.js';
import {loadPreferences,savePreferences,mountOfficeSettings} from './office-settings.js';
import { characterSvg } from './office-art.js';
import { OfficeScene } from './office-scene.js';
import { BuildingDirectory } from './office-building.js';
import { StaffIdentities, ownerPortrait } from './staff-identities.js';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const LAST_PROJECT_KEY='my-ai-office-last-project';
let requestedOfficeView=new URLSearchParams(location.search);
const officeViewHandoff=requestedOfficeView.has('project')||requestedOfficeView.get('view')==='tower';
function savedProjectKey(){try{return localStorage.getItem(LAST_PROJECT_KEY);}catch{return null;}}
const rooms = {
  library:{name:'자료실',purpose:'파일 읽기 · 내용 찾기',icon:'⌕',short:'자료 확인 중',empty:'읽을 자료를 기다리는 중'},
  studio:{name:'개발실',purpose:'코드 작성 · 파일 수정',icon:'⌘',short:'코드 수정 중',empty:'다음 아이디어를 기다리는 중'},
  server:{name:'서버실',purpose:'명령 실행 · 빌드 · Git',icon:'›_',short:'명령 실행 중',empty:'서버가 잠시 쉬고 있어요'},
  research:{name:'정보검색실',purpose:'웹 검색 · 브라우저 · 도구',icon:'◎',short:'정보 찾는 중',empty:'궁금한 일을 기다리는 중'},
  meeting:{name:'회의실',purpose:'계획 세우기 · 생각 정리',icon:'▤',short:'생각 정리 중',empty:'좋은 생각이 모이는 곳'},
  desk:{name:'대기실',purpose:'쉬어 가기 · 새 요청 기다리기',icon:'✳',short:'요청 살펴보는 중',empty:'친구들이 쉬어 가는 곳'},
  reception:{name:'접견실',purpose:'비서 확인 후 방문객 응대',icon:'◌',short:'접견 준비 중',empty:'방문객을 맞이하는 공간'},
};
const executiveRooms={
  studio:{name:'비서실',purpose:'방문 확인 · 일정·의전 지원',empty:'일정과 방문객을 확인하는 공간'},
  meeting:{name:'이사회실',purpose:'경영진 회의 · 주요 의사결정',empty:'14석 경영진 회의를 위한 공간'},
  library:{name:'서재 · 기록실',purpose:'경영 자료 · 중요 기록 열람',empty:'자료를 안전하게 보관하고 살펴보는 공간'},
  server:{name:'금고 · 기밀문서실',purpose:'출입 통제 · 중요 문서 보관',empty:'별도 출입 통제가 필요한 보관 공간'},
  reception:{name:'접견실',purpose:'비서 확인 후 방문객 응대',empty:'방문객을 맞이하는 공간'},
  desk:{name:'CEO 집무실',purpose:'집무 · 소규모 면담 · 독립 응접',empty:'CEO 전용 집무 공간'},
  research:{name:'프라이빗 라운지',purpose:'티룸 · 비공식 대화 · 휴식',empty:'CEO 전용 라운지'},
};
let saved={},settingsLoadError='';
try{saved=await loadPreferences();}catch(error){saved=error.preferences||{};settingsLoadError=error.message;}
const needsOfficeSetup=!String(saved.executiveSuiteName||'').trim()||!String(saved.ownerName||'').trim();
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const prefs={...DEFAULT_PREFERENCES,motion:!motionQuery.matches,...saved};
const state={sessions:[],archives:[],projects:[],projectKey:null,archiveView:false,selectedArchive:null,selectedRoom:null,selectedSession:null,teamFilter:'all',activityFilter:'all',demo:false,focused:false,connected:false,checkedAt:null,dataReady:false};
function stored(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
let directory=new BuildingDirectory(stored('office-floor-registry')),identities=new StaffIdentities(stored('office-staff-registry'));
let realFloorRegistry=directory.registry,realStaffRegistry=identities.registry,registryReady=false,registrySignature='',registryWriteQueue=Promise.resolve();
function registrySnapshot(){return {floors:directory.registry,staff:identities.registry};}
function saveRegistries(force=false){
  const registries={floors:{...directory.registry},staff:Object.fromEntries(Object.entries(identities.registry).map(([id,value])=>[id,{...value}]))};
  const signature=JSON.stringify(registries);
  if(!force&&signature===registrySignature)return registryWriteQueue;
  registrySignature=signature;
  registryWriteQueue=registryWriteQueue.catch(()=>{}).then(async()=>{
    const response=await fetch('/api/registry',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(registries)});
    if(!response.ok)throw new Error('Could not save office data');
  }).catch(error=>{
    if(registrySignature===signature)registrySignature='';
    throw error;
  });
  return registryWriteQueue;
}
async function loadRegistries(){
  try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    let response;
    try{response=await fetch('/api/registry',{cache:'no-store',signal:controller.signal});}
    finally{clearTimeout(timeout);}
    if(!response.ok)throw new Error('Could not load office data');
    const data=await response.json();
    if(data.initialized){directory=new BuildingDirectory(data.floors||{});identities=new StaffIdentities(data.staff||{});}
    realFloorRegistry=directory.registry;realStaffRegistry=identities.registry;
    registryReady=true;
    if(!data.initialized)await saveRegistries(true);
    else registrySignature=JSON.stringify(registrySnapshot());
  }catch(error){
    registryReady=true;registrySignature='';
    console.warn('Using browser-cached office data because SQLite could not be reached.',error);
  }
}
let officeScene=null,ownerStatus=null,buildingSignature='',viewerTrip=null,viewerFrame=0;
state.followOwner=true;state.activeFloorsOnly=false;state.calls=new Map();
const officeSettings=mountOfficeSettings({getPreferences:()=>prefs,onApply:next=>{Object.assign(prefs,next);applyPrefs();render();renderBuilding();},onLocation:()=>requestLocation(true),loadError:settingsLoadError});
$('#owner-portrait').innerHTML=ownerPortrait(prefs.ownerRank);
let realSnapshot={sessions:[]},lastSignature='',demoTimer=null,demoStart=0,resizeFrame;
let startupPoll=null,refreshPending=false;
const timeFormat=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
const dateFormat=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'});
$('#today-date').textContent=dateFormat.format(new Date());
$('#floor-plan').innerHTML=Object.entries(rooms).map(([key,room],index)=>`<button class="space-button ${key}" data-room="${key}" aria-pressed="false"><span class="space-title"><i></i><h3>${room.name}</h3><span class="room-population"></span></span><span class="room-purpose">${room.purpose}</span><span class="room-state"><span>${room.empty}</span></span></button>`).join('');
try {
  officeScene=new OfficeScene($('#scene-canvas'),{
    onSelectRoom:key=>selectRoom(key),
    onSelectSession:id=>selectSession(id),
    onStatusChange:()=>{updateRooms();renderTeam();updateMovementSummary();},
    onFloorArrival:key=>{if(state.followOwner&&state.projects.some(p=>p.key===key))showFloor(key);},
    onOwnerStatus:status=>{ownerStatus=status;renderBuilding();renderLift();},
    onOwnerSelect:()=>selectOwner(),
    onCameraChange:view=>{$('#camera-elevation').value=view.elevation;$('#camera-angle-value').textContent=`${view.elevation}°`;$$('[data-camera-angle]').forEach(button=>button.classList.toggle('selected',Math.abs(Number(button.dataset.cameraAngle)-view.elevation)<2));},
  });
} catch(error) {
  console.error('3D office initialization failed',error);
  $('#scene-canvas').innerHTML='<div class="scene-error"><strong>3D 사무실을 열 수 없어요.</strong><p>3D를 지원하는 브라우저에서 다시 열어 주세요.<br>아래에서 공간별 작업과 팀은 확인할 수 있어요.</p></div>';
}
$('#note-mascot').innerHTML=characterSvg('studio',{idle:true});
function applyPrefs(){
  document.body.classList.toggle('still',!prefs.motion);
  document.body.classList.toggle('large-text',prefs.largeText);
  document.body.classList.toggle('evening',prefs.evening);
  officeScene?.setLocation(prefs.latitude,prefs.longitude);renderLocation();
  applyOwnerIdentity();
  officeScene?.visitor.setProfile(prefs);
  officeScene?.setSecretaryIdentity(prefs.secretaryName);officeScene?.setMotion(prefs.motion);officeScene?.setEvening(prefs.evening);
}
function renderLocation(message=''){
  const hasLocation=Number.isFinite(prefs.latitude)&&Number.isFinite(prefs.longitude),timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'현지 시간';
  const coordinates=hasLocation?`${Math.abs(prefs.latitude).toFixed(2)}°${prefs.latitude<0?'S':'N'}, ${Math.abs(prefs.longitude).toFixed(2)}°${prefs.longitude<0?'W':'E'}`:'';
  const label=message||(hasLocation?`위치 · ${coordinates}`:'위치 확인 중');
  const indicator=$('#location-indicator');if(indicator){indicator.textContent=label;indicator.title=hasLocation?`현재 위치 ${coordinates} · ${timezone}`:label;}
  const detail=$('#location-detail');if(detail)detail.textContent=hasLocation?`${message?`${message} · `:''}현재 위치 ${coordinates} · ${timezone} 기준으로 계산합니다. 좌표는 프로젝트의 설정 파일에 저장하며, 500m 이상 이동하면 자동 갱신합니다.`:(message||'위치 권한을 허용하면 이 기기에서 좌표를 받아 저장합니다. 위치가 없으면 기본 시간대를 사용합니다.');
}
let locationWatchId=null;
function distanceBetweenKm(aLat,aLon,bLat,bLon){const radians=value=>value*Math.PI/180,dLat=radians(bLat-aLat),dLon=radians(bLon-aLon),a=Math.sin(dLat/2)**2+Math.cos(radians(aLat))*Math.cos(radians(bLat))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function acceptLocation(position,notify=false){
  const {latitude,longitude}=position.coords;
  if(Number.isFinite(prefs.latitude)&&Number.isFinite(prefs.longitude)&&distanceBetweenKm(prefs.latitude,prefs.longitude,latitude,longitude)<.5){renderLocation();return;}
  savePrefs({latitude,longitude}).then(saved=>{if(saved&&notify)announce('현재 위치를 저장했어요. 일출·일몰 시각을 다시 계산합니다.');});
}
function requestLocation(notify=false){
  if(!navigator.geolocation){renderLocation('이 브라우저는 위치 정보를 지원하지 않아요.');if(notify)announce('이 브라우저에서는 위치 정보를 사용할 수 없어요.');return;}
  if(!Number.isFinite(prefs.latitude))renderLocation('현재 위치를 확인하는 중');
  navigator.geolocation.getCurrentPosition(position=>{
    acceptLocation(position,notify);
    if(locationWatchId===null)locationWatchId=navigator.geolocation.watchPosition(update=>acceptLocation(update,false),()=>{}, {enableHighAccuracy:false,maximumAge:300000,timeout:20000});
  },error=>{
    const message=error.code===1?'위치 권한을 허용하면 실제 일출·일몰을 적용합니다.':error.code===2?'현재 위치를 확인할 수 없어요.':'위치 확인 시간이 초과됐어요.';
    renderLocation(Number.isFinite(prefs.latitude)?'저장된 위치 사용 중':message);
    if(notify)announce(message);
  },{enableHighAccuracy:false,maximumAge:Number.isFinite(prefs.latitude)?0:60000,timeout:15000});
}
function applyOwnerIdentity(){
  const name=String(prefs.ownerName||'회장님').trim()||'회장님';
  const title=String(prefs.ownerTitle||'CEO').trim()||'CEO';
  const rank=String(prefs.ownerRank||'').trim().replace(/^#/,'');
  const initials=Array.from(name.split(/\s+/).filter(Boolean).map(part=>Array.from(part)[0]).join('')).slice(0,2).join('').toUpperCase()||'CEO';
  const rankLabel=rank?` · 조직 서열 #${rank}`:'';
  $('#owner-name').textContent=name;$('#owner-title').textContent=`${title}${rankLabel}`;
  $('#owner-card').setAttribute('aria-label',`${name} 현재 위치 따라가기`);
  $('#owner-avatar').textContent=initials;$('#owner-avatar').title=`${name} · ${title}${rank?` · #${rank}`:''}`;
  $('#owner-portrait').innerHTML=ownerPortrait(rank);
  officeScene?.setOwnerIdentity({name,title,rank});
}
applyPrefs();
async function savePrefs(patch=prefs){try{const next=await savePreferences(patch);Object.assign(prefs,next);applyPrefs();queuePositions();return true;}catch(error){officeSettings.showError(error);announce(error.message);return false;}}
function relativeTime(timestamp){const seconds=Math.max(0,Math.floor((Date.now()-Number(timestamp))/1000));if(seconds<10)return '방금 전';if(seconds<60)return `${seconds}초 전`;if(seconds<3600)return `${Math.floor(seconds/60)}분 전`;if(seconds<86400)return `${Math.floor(seconds/3600)}시간 전`;return `${Math.floor(seconds/86400)}일 전`;}
function announce(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(announce.timer);announce.timer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function project(){return state.projects.find(item=>item.key===state.projectKey);}
function isExecutiveFloor(key=state.projectKey){const top=state.projects.reduce((highest,item)=>!highest||item.number>highest.number?item:highest,null);return Boolean(top&&top.key===key);}
function roomName(key){if(state.archiveView&&key==='library')return '기록 보관실';return (isExecutiveFloor()?executiveRooms[key]:rooms[key])?.name||rooms[key]?.name||key;}
function projectSessions(key=state.projectKey){return state.sessions.filter(item=>item.projectKey===key).sort((a,b)=>Number(b.active)-Number(a.active)||b.updatedAt-a.updatedAt);}
function visualRoom(session){const executive=isExecutiveFloor(session.projectKey),key=!session.active?'desk':session.room==='elevator'?(executive?'reception':'meeting'):rooms[session.room]?session.room:'desk';if(executive&&session.active&&key==='studio')return 'desk';return executive&&key==='desk'?'reception':key;}
function sessionName(session){return session.identity?.name||'Alex';}
function shortName(session){return sessionName(session);}
function paletteFor(session){if(session.identity?.palette)return session.identity.palette;if(session.palette)return session.palette;if(!session.hasParent)return 'studio';if(/plan/i.test(session.role||''))return 'meeting';if(/explore|research/i.test(session.role||''))return 'research';return ['library','server','research','meeting'][(session.id.charCodeAt(0)||0)%4];}
function filteredSessions(){return projectSessions().filter(item=>!state.selectedRoom||visualRoom(item)===state.selectedRoom);}
function setConnection(connected){state.connected=connected;$('#connection').classList.toggle('offline',!connected&&!state.demo);$('#connection-text').textContent=state.demo?'예시 사무실 둘러보는 중':connected?'이 PC의 Codex에 연결됨':'연결을 다시 확인하는 중';}
function renderProjects(){const query=$('#project-search').value.normalize('NFC').toLocaleLowerCase();const items=state.projects.filter(item=>item.name.normalize('NFC').toLocaleLowerCase().includes(query));$('#project-list').innerHTML=items.length?items.map(item=>`<button class="project-option" role="option" aria-selected="${item.key===state.projectKey}" data-project="${escapeHtml(item.key)}"><span>${item.number}F</span><strong>${escapeHtml(item.name)}</strong><small>${item.active?`● ${item.active}명 작업 중`:`${item.count}개 세션`}</small></button>`).join(''):'<div class="team-empty">프로젝트가 없어요.</div>';}
function renderHeader(){const item=project(),executive=isExecutiveFloor()&&!state.archiveView;$('#floor-number').textContent=state.archiveView?'B1':`${item?.number||'—'}F`;$('#office-heading').textContent=state.archiveView?'기록 문서 보관실':executive?prefs.executiveSuiteName:item?.name||'나의 작업 공간';$('#floor-picker').disabled=state.archiveView;$('#floor-picker').setAttribute('aria-label',state.archiveView?'기록 문서 보관실':'프로젝트 층 선택');$('#active-count').textContent=state.sessions.filter(item=>item.active).length;$('#project-count').textContent=state.projects.length;$('#agent-count').textContent=state.sessions.filter(item=>item.hasParent).length;$('#live-badge').innerHTML=state.demo?'<i></i> DEMO':'<i></i> LIVE';$('#live-badge').classList.toggle('demo',state.demo);$('#demo-toggle').setAttribute('aria-pressed',String(state.demo));$('#demo-toggle').querySelector('span').textContent=state.demo?'실제 세션으로':'둘러보기';$('#demo-toggle').title=state.demo?'실제 Codex 세션으로 돌아가기':'예시 캐릭터로 사무실 둘러보기';$('#office-hint').textContent=state.archiveView?'완료했거나 한동안 활동이 없는 채팅 기록을 모아 두었어요.':state.selectedRoom?`${roomName(state.selectedRoom)} · ${filteredSessions().length}개 세션을 보고 있어요.`:state.demo?'둘러보기의 캐릭터와 활동은 예시입니다. 버튼을 다시 누르면 실제 세션으로 돌아가요.':'방을 누르면 누가, 어떤 일을 하고 있는지 더 자세히 볼 수 있어요.';const keys=state.archiveView?['library']:executive?Object.keys(executiveRooms):Object.keys(rooms).filter(key=>key!=='reception'),details=state.archiveView?{library:{name:'기록 보관실',purpose:'완료된 채팅과 업무 기록',empty:'보관된 채팅 기록을 살펴보는 공간'}}:executive?executiveRooms:rooms;$('#floor-plan').classList.toggle('executive-plan',executive);$('#floor-plan').classList.toggle('archive-plan',state.archiveView);$('.scene-caption strong').textContent=state.archiveView?'RECORDS ROOM · B1':executive?prefs.executiveSuiteName.toLocaleUpperCase():'OUR LITTLE OFFICE';$('#floor-plan').innerHTML=keys.map(key=>{const room=details[key];return `<button class="space-button ${key}" data-room="${key}" aria-pressed="${state.selectedRoom===key}"><span class="space-title"><i></i><h3>${room.name}</h3><span class="room-population"></span></span><span class="room-purpose">${room.purpose}</span><span class="room-state"><span>${room.empty}</span></span></button>`;}).join('');$('#clear-room').hidden=!state.selectedRoom;$('#archive-panel-content').hidden=!state.archiveView;$('#people-panel').classList.toggle('archive-mode',state.archiveView);if(state.archiveView)renderArchives();updateTime();if(!$('#project-menu').hidden)renderProjects();}
function updateTime(){if(state.checkedAt)$('#updated-time').textContent=state.demo?'예시 데이터 · 실제 Codex 작업과 구분돼요':`${timeFormat.format(new Date(state.checkedAt))}에 확인 · 로컬 연결`;}
function mapSessions(key=state.projectKey){const sessions=projectSessions(key),executive=isExecutiveFloor(key),counts={};return sessions.filter(item=>{const room=visualRoom(item),capacity=room==='desk'?(executive?0:11):room==='reception'?(executive?4:0):3;if((counts[room]||0)>=capacity)return false;counts[room]=(counts[room]||0)+1;return true;}).slice(0,11);}
function updateRooms(){
  const list=state.archiveView?[]:mapSessions();
  for(const [key,room] of Object.entries(rooms)){
    const node=$(`.space-button[data-room="${key}"]`);
    if(!node)continue;
    const occupants=list.filter(session=>{const status=officeScene?.getStatus(session.id);return status?status.room===key&&!['walking','waiting'].includes(status.phase):visualRoom(session)===key;});
    const incoming=list.filter(session=>{const status=officeScene?.getStatus(session.id);return status?.phase==='walking'&&status.target===key;});
    const active=occupants.filter(session=>session.active&&officeScene?.getStatus(session.id)?.phase==='working');
    node.classList.toggle('occupied',active.length>0);node.classList.toggle('selected',state.selectedRoom===key);node.setAttribute('aria-pressed',String(state.selectedRoom===key));
    node.querySelector('.room-population').textContent=occupants.length?`${occupants.length}명`:'';
    const receiving=occupants.filter(session=>officeScene?.getStatus(session.id)?.phase==='receiving');
    const executive=isExecutiveFloor(),roomInfo=state.archiveView?{name:'기록 보관실',purpose:'완료된 채팅과 업무 기록',empty:'보관된 채팅 기록을 살펴보는 공간'}:executive?executiveRooms[key]:room;
    const executiveDesk=key==='desk'&&executive;
    const text=receiving.length?`${receiving.length}명이 CEO의 호출을 받는 중`:incoming.length?`${incoming.length}명이 걸어오는 중`:active.length?active[0].label:occupants.length?(executiveDesk?'집무실에서 쉬는 중':executive?`${roomInfo.name}에 머무는 중`:'대기실에서 쉬는 중'):executiveDesk?'CEO 전용 공간':roomInfo.empty;
    node.querySelector('.room-state').textContent=text;
    node.setAttribute('aria-label',`${roomName(key)}. ${roomInfo.purpose}. ${text}`);
  }
}
function updateSprites(){
  const viewParams=new URLSearchParams();if(!state.demo&&state.projectKey)viewParams.set('project',state.projectKey);if(!state.demo&&state.selectedSession)viewParams.set('session',state.selectedSession);const sharedStudyLink=$('.shared-study-link');if(sharedStudyLink)sharedStudyLink.href='/shared-office.html'+(viewParams.size?'?'+viewParams:'');
  officeScene?.setSessions(state.archiveView?[]:state.projects.flatMap(floor=>mapSessions(floor.key)).map(session=>({...session,palette:paletteFor(session),displayName:shortName(session)})),state.archiveView?null:state.projectKey,state.archiveView);
  officeScene?.setSelectedRoom(state.selectedRoom);officeScene?.setSelectedSession(state.selectedSession);
  updateMovementSummary();
}
function updateMovementSummary(){
  if(state.archiveView){$('#scene-movement').textContent=`${state.archives.length}개 보관 기록 · 서가와 문서함`;return;}
  const counts={walking:0,working:0,resting:0,receiving:0};
  for(const session of mapSessions()){const status=officeScene?.getStatus(session.id);if(status)counts[status.phase]=(counts[status.phase]||0)+1;}
  const extra=projectSessions().filter(s=>s.active&&!mapSessions().some(shown=>shown.id===s.id)).length;
  $('#scene-movement').textContent=`${isExecutiveFloor()?'CEO 전용 최상층 · ':''}호출 ${counts.receiving} · 이동 ${counts.walking} · 작업 ${counts.working} · 휴식 ${counts.resting}${extra?` · 추가 작업 ${extra}개는 팀 목록에서`:''}`;
}
function positionSprites(){officeScene?.resize();$('#layout-indicator').textContent='3D · 16:9 · 엘리베이터와 복도로 이동';}
function fitViewport(){
  document.body.classList.toggle('compact',innerHeight<960&&innerWidth>850);
  const stage=$('#office-stage');
  const boundary=$('.stage-boundary');
  if(boundary.clientWidth>780){
    const top=stage.getBoundingClientRect().top+scrollY;
    const bottom=$('.office-bottom').offsetHeight+$('.office-hint').offsetHeight+18;
    const height=Math.max(440,innerHeight-top-bottom);
    const width=Math.max(780,Math.floor(height*16/9));
    stage.style.maxWidth=`${width}px`;
  }else stage.style.maxWidth='';
  queuePositions();
}
function queuePositions(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(positionSprites);}
function memberMarkup(session){const room=visualRoom(session);const motion=officeScene?.getStatus(session.id);const moving=motion?.phase==='walking',receiving=motion?.phase==='receiving';const idleText=session.finished?'작업 완료 · 휴식 중':'응답 대기 중';const action=receiving?'☎ CEO의 원격 지시를 받는 중':moving?`${rooms[room].name}로 걸어가는 중`:`${rooms[room].name} · ${session.active?rooms[room].short:idleText}`;return `<button class="team-member ${state.selectedSession===session.id?'selected':''}" data-session="${escapeHtml(session.id)}" aria-label="${escapeHtml(sessionName(session))} 상세 보기"><span class="member-avatar">${characterSvg(room,{palette:paletteFor(session),idle:!session.active,error:session.error,accessory:session.identity?.accessory,index:session.identity?.index})}<i class="member-dot ${session.active?'':'idle'}"></i></span><span class="member-copy"><strong>${escapeHtml(sessionName(session))}${session.hasParent?' <span aria-label="서브에이전트">↗</span>':''}</strong><small>${action}</small></span><span class="member-tag ${session.error?'error':session.active?'':'idle'}">${receiving?'전화 수신':moving?'이동 중':session.error?'확인 중':session.active?'작업 중':session.finished?'완료':'응답 대기'}</span></button>`;}
function renderTeam(){const list=filteredSessions();const active=list.filter(session=>session.active);const display=state.teamFilter==='active'?active:list;$('#team-count').textContent=list.length;$('#tab-all-count').textContent=list.length;$('#tab-active-count').textContent=active.length;$('#team-list').innerHTML=display.length?display.map(memberMarkup).join(''):`<div class="team-empty">${characterSvg('studio',{idle:true})}<strong>${state.teamFilter==='active'?'지금은 쉬는 시간이에요':'아직 조용한 사무실이에요'}</strong><p>${state.teamFilter==='active'?'새 작업이 시작되면 여기에 나타나요.':'Codex가 작업을 시작하면 친구가 출근해요.'}</p></div>`;renderDetail();}
function renderDetail(){
  const session=state.sessions.find(item=>item.id===state.selectedSession),node=$('#selected-detail');node.hidden=!session;if(!session)return;
  const motion=officeScene?.getStatus(session.id);
  const action=motion?.phase==='receiving'?'☎ CEO의 원격 지시를 받는 중':motion?.phase==='walking'?`${rooms[motion.target].name}로 걸어가는 중`:session.active?session.label:session.finished?'작업 완료 · 휴식 중':'응답 대기 중';
  const location=motion?(motion.room?rooms[motion.room].name:'복도'):rooms[visualRoom(session)].name;
  node.innerHTML=`<div class="detail-heading">${escapeHtml(sessionName(session))}<button aria-label="상세 정보 닫기" id="close-detail">×</button></div><p class="detail-action">${escapeHtml(action)}</p><dl><dt>프로젝트</dt><dd>${escapeHtml(session.project)}</dd><dt>현재 위치</dt><dd>${location}</dd><dt>업무</dt><dd>${escapeHtml(session.label)}</dd><dt>마지막 활동</dt><dd>${relativeTime(session.updatedAt)}</dd><dt>역할</dt><dd>${escapeHtml(session.role||(session.hasParent?'서브에이전트':'메인 세션'))}</dd><dt>외형</dt><dd>${escapeHtml(session.identity?.detail||'')}</dd><dt>연결</dt><dd>채팅 #${session.identity?.chatNumber||1}${session.nickname?' · '+escapeHtml(session.nickname):''}</dd></dl>`;
}
function activityMarkup(session){return `<button class="activity-card" data-session="${escapeHtml(session.id)}"><span class="activity-icon">${escapeHtml(session.icon||rooms[visualRoom(session)].icon)}</span><div><strong>${escapeHtml(session.label)}</strong><small>${escapeHtml(sessionName(session))} · ${escapeHtml(session.project)}</small></div><time datetime="${new Date(session.updatedAt).toISOString()}">${relativeTime(session.updatedAt)}</time></button>`;}
function renderActivity(){const sessions=filteredSessions().sort((a,b)=>b.updatedAt-a.updatedAt);$('#activity-strip').innerHTML=sessions.length?sessions.slice(0,3).map(activityMarkup).join(''):'<div class="activity-empty">첫 번째 작은 발걸음을 기다리고 있어요. Codex에서 작업을 시작해 보세요.</div>';if($('#activity-dialog').open)renderLog();}
function renderLog(){const sessions=filteredSessions().filter(item=>state.activityFilter==='all'||(state.activityFilter==='active'?item.active:item.hasParent)).sort((a,b)=>b.updatedAt-a.updatedAt);$('#activity-dialog-subtitle').textContent=`${project()?.name||'나의 작업 공간'}${state.selectedRoom?` · ${rooms[state.selectedRoom].name}`:''} · 각 세션의 마지막 작업${state.demo?' · 예시 데이터':''}`;$('#activity-log').innerHTML=sessions.length?sessions.map(activityMarkup).join(''):'<div class="team-empty">이 조건에 맞는 활동이 없어요.</div>';}
function archiveName(item){return item.identity?.name||'Alex';}
function renderArchives(){
  const query=$('#archive-search').value.trim().normalize('NFC').toLocaleLowerCase();
  const matches=state.archives.filter(item=>`${item.project} ${archiveName(item)} ${item.identity?.chatNumber||''}`.normalize('NFC').toLocaleLowerCase().includes(query));
  $('#archive-total').textContent=`${state.archives.length}개`;
  $('#archive-list').innerHTML=matches.length?matches.slice(0,300).map(item=>`<button class="archive-card ${item.id===state.selectedArchive?'selected':''}" data-archive="${escapeHtml(item.id)}"><span class="archive-card-icon">${item.hasParent?'↗':'▤'}</span><span class="archive-card-copy"><strong>${escapeHtml(archiveName(item))} · 채팅 #${item.identity?.chatNumber||1}</strong><small>${escapeHtml(item.project)}${item.hasParent?' · 서브에이전트':''}</small></span><time datetime="${new Date(item.updatedAt).toISOString()}">${relativeTime(item.updatedAt)}</time></button>`).join(''):`<div class="archive-empty"><span>⌑</span><strong>${query?'검색 결과가 없어요':'아직 보관된 채팅이 없어요'}</strong><p>${query?'다른 채팅 이름이나 프로젝트로 찾아보세요':'작업을 마친 채팅이 생기면 이 층에 모아둘게요.'}</p></div>`;
  const selected=matches.find(item=>item.id===state.selectedArchive),detail=$('#archive-detail');
  detail.innerHTML=selected?`<span class="archive-detail-icon">${selected.hasParent?'↗':'▤'}</span><span class="overline">보관 기록</span><strong>${escapeHtml(archiveName(selected))} · 채팅 #${selected.identity?.chatNumber||1}</strong><dl><dt>프로젝트</dt><dd>${escapeHtml(selected.project)}</dd><dt>마지막 활동</dt><dd>${new Intl.DateTimeFormat('ko-KR',{dateStyle:'long',timeStyle:'short'}).format(new Date(selected.updatedAt))}</dd><dt>유형</dt><dd>${selected.hasParent?'서브에이전트 세션':'일반 채팅'}</dd><dt>상태</dt><dd>보관 중</dd></dl><p>개인정보 보호를 위해 대화 내용과 파일 경로는 표시하지 않아요.</p>`:`<span class="archive-detail-icon">▤</span><strong>기록 하나를 선택해 보세요</strong><p>프로젝트와 마지막 활동 시각을 확인할 수 있어요.</p>`;
}
function render(){renderBuilding();renderHeader();updateRooms();updateSprites();renderTeam();renderActivity();}
function applySnapshot(snapshot,force=false){
  state.checkedAt=snapshot.checkedAt||Date.now();state.dataReady=true;setConnection(true);
  const signature=JSON.stringify({sessions:snapshot.sessions,archives:snapshot.archives,projects:snapshot.projects});
  if(signature===lastSignature&&!force){updateTime();return;}lastSignature=signature;
  if(snapshot.staff)identities.registry={...identities.registry,...snapshot.staff};
  state.sessions=identities.assign((snapshot.sessions||[]).map((session,index)=>({...session,id:session.id||`${session.projectKey}-${index}`})));
  state.archives=identities.assign((snapshot.archives||[]).map(session=>({...session,active:false,project:session.project||snapshot.projects?.find(item=>item.key===session.projectKey)?.name||'알 수 없는 프로젝트'}))).sort((a,b)=>b.updatedAt-a.updatedAt);
  const projects=snapshot.projects||[...new Map(state.sessions.map(session=>[session.projectKey,{key:session.projectKey,name:session.project,count:state.sessions.filter(s=>s.projectKey===session.projectKey).length,lastActivityAt:session.updatedAt}])).values()];
  const commands=directory.reconcile(projects,state.sessions);
  state.projects=directory.floors;
  const initial=directory.initialFloor(state.sessions);
  if(!state.projects.some(item=>item.key===state.projectKey)){
    const remembered=savedProjectKey();
    if(remembered&&state.projects.some(item=>item.key===remembered)){state.projectKey=remembered;state.followOwner=false;}
    else state.projectKey=initial;
    state.selectedRoom=null;state.selectedSession=null;
  }
  officeScene?.setDirectory(state.projects,initial);
  if(requestedOfficeView?.get('project')&&state.projects.some(p=>p.key===requestedOfficeView.get('project'))){state.projectKey=requestedOfficeView.get('project');state.followOwner=false;const id=requestedOfficeView.get('session');if(id&&state.sessions.some(s=>s.id===id&&s.projectKey===state.projectKey))state.selectedSession=id;requestedOfficeView=null;}
  if(state.followOwner&&!ownerStatus&&officeScene?.owner.journey.floor)state.projectKey=officeScene.owner.journey.floor;
  for(const command of commands)state.calls.set(command.projectKey,{...command,until:Date.now()+4000});
  officeScene?.receiveCommands(commands);
  if(!state.demo&&registryReady){realFloorRegistry=directory.registry;realStaffRegistry=identities.registry;saveRegistries().catch(error=>console.warn('Could not save office data.',error));}
  render();
}
function renderBuilding(){
  const floors=state.projects,owner=ownerStatus,floor=floors.find(f=>f.key===owner?.floor),target=floors.find(f=>f.key===owner?.target),pending=floors.find(f=>f.key===owner?.pending);
  const executiveFloor=floors.reduce((top,item)=>!top||item.number>top.number?item:top,null);
  $('#building-floor-count').textContent=state.dataReady?`${floors.length+1}개 층`:'층 불러오는 중';
  $('#active-floor-count').textContent=floors.filter(f=>f.active).length;
  $('#owner-location').textContent=owner?.phase==='riding'?`${floor?.number||'—'}F → ${target?.number||'—'}F 이동 중`:floor?`${floor.number}F · ${floor.key===executiveFloor?.key?prefs.executiveSuiteName:floor.name}`:'입주할 프로젝트를 기다려요';
  $('#owner-status').textContent=(owner?.text||'모든 지시는 각 층에 원격으로 전달돼요.')+(pending?` · 다음 ${pending.number}F`:'');
  $('#follow-owner').setAttribute('aria-pressed',String(state.followOwner));$('#follow-owner b').textContent=state.followOwner?'ON':'OFF';
  const query=$('#floor-search').value.trim().normalize('NFC').toLocaleLowerCase();
  const visible=floors.filter(f=>(!state.activeFloorsOnly||f.active)&&((f.key===executiveFloor?.key?prefs.executiveSuiteName:f.name).normalize('NFC').toLocaleLowerCase().includes(query)||`${f.number}f`.includes(query)));
  const showArchive=state.dataReady&&!state.activeFloorsOnly&&(!query||'기록 보관 보관실 archive b1'.includes(query));
  const signature=JSON.stringify({floors:visible.map(f=>[f.key,f.number,f.name,f.active,f.count,(state.calls.get(f.key)?.until||0)>Date.now(),f.key===executiveFloor?.key]),suiteName:prefs.executiveSuiteName,selected:state.projectKey,archive:state.archiveView,showArchive,dataReady:state.dataReady,owner:owner?.floor,phase:owner?.phase,target:owner?.target});
  if(signature===buildingSignature)return;buildingSignature=signature;
  const list=$('#building-floors'),scroll=list.scrollTop,left=list.scrollLeft;
  list.innerHTML=visible.length?visible.map(f=>{
    const here=owner?.floor===f.key,incoming=owner?.target===f.key&&owner.floor!==f.key,calling=(state.calls.get(f.key)?.until||0)>Date.now();
    const isExecutiveFloor=f.key===executiveFloor?.key;
    const floorName=isExecutiveFloor?prefs.executiveSuiteName:f.name;
    return `<button class="building-floor ${isExecutiveFloor?'executive-floor':''} ${f.key===state.projectKey?'selected':''} ${f.active?'busy':''} ${calling?'calling':''}" data-floor="${escapeHtml(f.key)}" aria-current="${f.key===state.projectKey?'location':'false'}" aria-label="${f.number}층 ${escapeHtml(floorName)}${isExecutiveFloor?' · 회장 집무층':''}, ${f.active}명 작업 중${here?', CEO 현재 위치':''}" title="${escapeHtml(floorName)}${isExecutiveFloor?' · 회장 집무층':''}"><span class="floor-level">${f.number}F</span><span class="floor-project"><strong>${escapeHtml(floorName)}</strong>${isExecutiveFloor?'<em class="executive-label">♛ 회장 집무층</em>':''}<small><span class="floor-windows"><i></i><i></i><i></i></span>${calling?'☎ 호출 수신':f.active?`<b>${f.active}명 작업 중</b>`:`${f.count||0}개 채팅 · 휴식`}</small></span><span class="floor-owner ${incoming?'travel':''}">${here?'♛':incoming?'↥':''}</span></button>`;
  }).join('')+(showArchive?`<button class="building-floor archive-floor ${state.archiveView?'selected':''}" data-archive-floor aria-current="${state.archiveView?'location':'false'}" aria-label="지하 1층 기록 문서 보관실, ${state.archives.length}개 보관 기록"><span class="floor-level">B1</span><span class="floor-project"><strong>기록 문서 보관실</strong><em class="archive-label">⌑ 채팅 기록</em><small><span class="floor-windows"><i></i><i></i><i></i></span>${state.archives.length}개 보관 기록</small></span><span class="floor-owner">⌑</span></button>`:''):(showArchive?`<button class="building-floor archive-floor ${state.archiveView?'selected':''}" data-archive-floor aria-current="${state.archiveView?'location':'false'}" aria-label="지하 1층 기록 문서 보관실, ${state.archives.length}개 보관 기록"><span class="floor-level">B1</span><span class="floor-project"><strong>기록 문서 보관실</strong><em class="archive-label">⌑ 채팅 기록</em><small><span class="floor-windows"><i></i><i></i><i></i></span>${state.archives.length}개 보관 기록</small></span><span class="floor-owner">⌑</span></button>`:state.dataReady?'<div class="team-empty">조건에 맞는 층이 없어요.</div>':'<div class="team-empty">Codex 프로젝트 층을 불러오는 중이에요.</div>');
  list.scrollTop=scroll;list.scrollLeft=left;
}
function renderLift(){
  const owner=ownerStatus,trip=viewerTrip;const riding=state.followOwner&&owner?.phase==='riding';
  $('#elevator-overlay').hidden=!trip&&!riding;$('#elevator-overlay').dataset.mode=trip?'viewer':'owner';if(trip)$('#elevator-overlay').style.setProperty('--door-open',Math.abs(trip.progress-.5)*2);
  if(!trip&&!riding)return;
  $('#lift-kind').textContent=trip?'BUILDING ELEVATOR':'CEO’S ELEVATOR';
  $('#lift-route').textContent=trip?`${trip.from||'—'}F → ${trip.to}F`:`${owner.number||'—'}F → ${owner.targetNumber||'—'}F`;
  $('#lift-message').textContent=trip?'선택한 프로젝트 층으로 이동하는 중':'CEO가 다음 프로젝트 층으로 이동하는 중';
  $('#lift-progress').style.width=`${Math.round((trip?.progress??owner?.progress??0)*100)}%`;
}
function showFloor(key){
  if(!state.projects.some(f=>f.key===key))return;
  state.archiveView=false;state.projectKey=key;if(!state.demo){try{localStorage.setItem(LAST_PROJECT_KEY,key);}catch{}}state.selectedRoom=null;state.selectedSession=null;render();
  const list=$('#building-floors'),button=list.querySelector('[aria-current="location"]');
  if(button){const b=button.getBoundingClientRect(),p=list.getBoundingClientRect();if(list.scrollHeight>list.clientHeight)list.scrollTop+=b.top-p.top-(list.clientHeight-b.height)/2;if(list.scrollWidth>list.clientWidth)list.scrollLeft+=b.left-p.left-(list.clientWidth-b.width)/2;}

}
function showArchive(){state.archiveView=true;state.selectedArchive=null;state.selectedRoom='library';state.selectedSession=null;state.followOwner=false;officeScene?.setOwnerSelected(false);const top=state.projects.reduce((highest,item)=>!highest||item.number>highest.number?item:highest,null);if(top)state.projectKey=top.key;render();const list=$('#building-floors'),button=list.querySelector('[data-archive-floor]');if(button){const b=button.getBoundingClientRect(),p=list.getBoundingClientRect();if(list.scrollHeight>list.clientHeight)list.scrollTop+=b.top-p.top-(list.clientHeight-b.height)/2;}}
function travelView(key){
  cancelAnimationFrame(viewerFrame);const destination=state.projects.find(f=>f.key===key);if(!destination||state.projectKey===key){viewerTrip=null;if(destination)showFloor(key);renderLift();return;}
  const start=performance.now(),duration=prefs.motion?1400:450;viewerTrip={from:project()?.number,to:destination.number,progress:0};let switched=false;
  function step(time){if(!viewerTrip)return;viewerTrip.progress=Math.min(1,(time-start)/duration);if(!switched&&viewerTrip.progress>=.5){showFloor(key);switched=true;}renderLift();if(viewerTrip.progress<1)viewerFrame=requestAnimationFrame(step);else{viewerTrip=null;renderLift();}}
  viewerFrame=requestAnimationFrame(step);
}
function followOwner(){state.followOwner=true;renderBuilding();const key=officeScene?.owner.journey.floor;if(key)travelView(key);}
function selectOwner(){const selected=!officeScene?.ownerSelected;state.selectedSession=null;state.selectedRoom=null;officeScene?.setSelectedRoom(null);officeScene?.setSelectedSession(null);officeScene?.setOwnerSelected(selected);if(selected)followOwner();else{state.followOwner=false;renderBuilding();}}
function acceptRealSnapshot(snapshot){
  if(!snapshot||!Array.isArray(snapshot.sessions)||snapshot.ready===false||(realSnapshot.checkedAt&&snapshot.checkedAt<realSnapshot.checkedAt))return;
  const hasData=Boolean(snapshot.projects?.length||snapshot.sessions.length||snapshot.archives?.length);
  if(!state.dataReady&&!hasData&&snapshot.ready!==true)return;
  realSnapshot=snapshot;
  if(hasData||snapshot.ready===true){state.dataReady=true;clearInterval(startupPoll);}
  if(!state.demo)applySnapshot(realSnapshot);
}
async function refresh(showProgress=true){if(refreshPending)return;refreshPending=true;const button=$('#refresh'),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);if(showProgress)button.classList.add('refreshing');try{const response=await fetch('/api/state',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Unavailable');acceptRealSnapshot(await response.json());if(!state.demo)setConnection(true);}catch{setConnection(false);if(!state.sessions.length)render();}finally{clearTimeout(timeout);refreshPending=false;if(showProgress)button.classList.remove('refreshing');}}
function selectRoom(key){state.selectedRoom=state.selectedRoom===key?null:key;state.selectedSession=null;render();}
function setMenu(open){$('#project-menu').hidden=!open;$('#floor-picker').setAttribute('aria-expanded',String(open));if(open){renderProjects();$('#project-search').focus();}else $('#project-search').value='';}
function setProject(key){state.archiveView=false;state.followOwner=false;officeScene?.setOwnerSelected(false);setMenu(false);renderBuilding();renderHeader();travelView(key);}
function selectSession(id){const session=state.sessions.find(item=>item.id===id);if(!session)return;state.selectedSession=state.selectedSession===id?null:id;renderTeam();updateSprites();}
function openDialog(selector){const dialog=$(selector);if(selector==='#activity-dialog')renderLog();dialog.showModal();}
function makeDemo(){
  const now=Date.now(),elapsed=(now-demoStart)/1000;
  const catalog=[{key:'demo-forest',name:'Little Forest Studio',start:0},{key:'demo-atlas',name:'Atlas Web',start:16},{key:'demo-orbit',name:'Orbit Mobile',start:32},...(elapsed>=40&&elapsed%160<110?[{key:'demo-cloud',name:'Cloud Lab · 새 입주',start:44}]:[])];
  const keys=['studio','research','server','library','meeting','desk'];
  const sessions=catalog.flatMap((floor,floorIndex)=>keys.map((original,index)=>{
    const first=2+floor.start+index*2,cycle=Math.floor(Math.max(0,elapsed-first)/68),phase=elapsed-first-cycle*68;
    const started=elapsed>=first,active=index<5&&started&&phase<45;
    const room=!active?'desk':phase<27?original:keys[(index+2)%5];
    const lastRequestAt=started?demoStart+(first+cycle*68)*1000:null;
    return {id:`${floor.key}-${index}`,projectKey:floor.key,project:floor.name,role:index?'서브에이전트':'메인 세션',hasParent:index>0,room,active,error:false,label:active?rooms[room].short:'대기실에서 쉬는 중',icon:rooms[room].icon,updatedAt:demoStart+10000-floorIndex*1000+Math.max(0,elapsed-first)*1000,lastRequestAt,requestId:started?`${floor.key}-${index}-${cycle}`:null,requestCount:started?cycle+1:0};
  }));
  return {checkedAt:now,projects:catalog.map((f,index)=>({...f,count:6,lastActivityAt:demoStart+index})),sessions};
}
function toggleDemo(){
  cancelAnimationFrame(viewerFrame);viewerTrip=null;renderLift();$('#floor-search').value='';state.activeFloorsOnly=false;$('#active-floors-only').setAttribute('aria-pressed','false');
  state.demo=!state.demo;lastSignature='';buildingSignature='';state.selectedRoom=null;state.selectedSession=null;state.selectedArchive=null;state.archiveView=false;state.projectKey=null;state.followOwner=true;state.calls.clear();ownerStatus=null;
  if(state.demo){realFloorRegistry=directory.registry;realStaffRegistry=identities.registry;directory=new BuildingDirectory({});identities=new StaffIdentities(Object.fromEntries(['demo-forest','demo-atlas','demo-orbit','demo-cloud'].flatMap((key,floor)=>Array.from({length:6},(_,i)=>[`${key}-${i}`,{index:floor*6+i}]))));}
  else{directory=new BuildingDirectory(realFloorRegistry);identities=new StaffIdentities(realStaffRegistry);}
  officeScene?.calls.clear();
  if(state.demo){demoStart=Date.now();applySnapshot(makeDemo());demoTimer=setInterval(()=>applySnapshot(makeDemo()),1000);announce('여러 층의 동시 호출과 CEO의 엘리베이터 이동을 보여드려요.');}
  else{clearInterval(demoTimer);applySnapshot(realSnapshot);refresh();announce('이 PC의 실제 Codex 세션으로 돌아왔어요.');}
}
$('#building-floors').addEventListener('click',event=>{if(event.target.closest('[data-archive-floor]')){showArchive();return;}const button=event.target.closest('[data-floor]');if(button)setProject(button.dataset.floor);});
$('#archive-search').addEventListener('input',renderArchives);
$('#archive-list').addEventListener('click',event=>{const button=event.target.closest('[data-archive]');if(button){state.selectedArchive=button.dataset.archive;renderArchives();}});
$('#floor-search').addEventListener('input',renderBuilding);
$('#active-floors-only').addEventListener('click',event=>{state.activeFloorsOnly=!state.activeFloorsOnly;event.currentTarget.setAttribute('aria-pressed',String(state.activeFloorsOnly));renderBuilding();});
$('#follow-owner').addEventListener('click',()=>{if(state.followOwner){state.followOwner=false;renderBuilding();}else followOwner();});
$('#owner-card').addEventListener('click',followOwner);
$('#camera-elevation').addEventListener('input',event=>officeScene?.setElevation(event.target.value));
$$('[data-camera-angle]').forEach(button=>button.addEventListener('click',()=>officeScene?.setElevation(button.dataset.cameraAngle)));
$('#floor-picker').addEventListener('click',()=>setMenu($('#project-menu').hidden));$('#project-search').addEventListener('input',renderProjects);$('#project-list').addEventListener('click',event=>{const button=event.target.closest('[data-project]');if(button)setProject(button.dataset.project);});$('#floor-plan').addEventListener('click',event=>{const room=event.target.closest('[data-room]');if(room)selectRoom(room.dataset.room);});
$('#clear-room').addEventListener('click',()=>{state.selectedRoom=null;state.selectedSession=null;render();});$('#refresh').addEventListener('click',refresh);$('#demo-toggle').addEventListener('click',toggleDemo);$('#expand').addEventListener('click',()=>{state.focused=!state.focused;$('#workspace-layout').classList.toggle('focused',state.focused);document.body.classList.toggle('office-focus',state.focused);$('#expand').setAttribute('aria-pressed',String(state.focused));$('#expand').setAttribute('aria-label',state.focused?'기본 배치로 돌아가기':'업무 공간 크게 보기');$('#expand').title=state.focused?'기본 배치로 돌아가기':'업무 공간 크게 보기';fitViewport();});
$$('[data-team]').forEach(button=>button.addEventListener('click',()=>{state.teamFilter=button.dataset.team;$$('[data-team]').forEach(tab=>tab.setAttribute('aria-selected',String(tab===button)));$('#team-list').setAttribute('aria-labelledby',button.id);renderTeam();}));
for(const list of ['#team-list','#activity-strip','#activity-log'])$(list).addEventListener('click',event=>{const button=event.target.closest('[data-session]');if(!button)return;selectSession(button.dataset.session);if(list==='#activity-log'){$('#activity-dialog').close();$('#selected-detail').scrollIntoView({behavior:prefs.motion?'smooth':'instant',block:'nearest'});}});
$('#selected-detail').addEventListener('click',event=>{if(event.target.closest('#close-detail')){state.selectedSession=null;renderDetail();updateSprites();}});
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.view==='settings')officeSettings.open();else if(button.dataset.view==='activity')openDialog('#activity-dialog');else{$('#office').scrollIntoView({behavior:prefs.motion?'smooth':'instant',block:'start'});}}));$('#activity-open').addEventListener('click',()=>openDialog('#activity-dialog'));
$$('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));$$('dialog').filter(dialog=>dialog.id!=='settings-dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){if(dialog.id==='office-setup-dialog')return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();}}));
$$('[data-activity]').forEach(button=>button.addEventListener('click',()=>{state.activityFilter=button.dataset.activity;$$('[data-activity]').forEach(item=>item.classList.toggle('selected',item===button));renderLog();}));
$('#office-setup-form').addEventListener('submit',async event=>{event.preventDefault();const suiteName=$('#setup-suite-name').value.trim(),ownerName=$('#setup-owner-name').value.trim();if(!suiteName||!ownerName)return;const button=event.submitter;button.disabled=true;try{if(!await savePrefs({executiveSuiteName:suiteName,ownerName}))return;$('#office-setup-dialog').close();render();renderBuilding();requestLocation(false);}finally{button.disabled=false;}});
$('#office-setup-dialog').addEventListener('cancel',event=>event.preventDefault());
document.addEventListener('click',event=>{if(!event.target.closest('.floor-picker-wrap'))setMenu(false);});document.addEventListener('keydown',event=>{if(event.key==='Escape'){setMenu(false);if(state.focused){state.focused=false;$('#workspace-layout').classList.remove('focused');document.body.classList.remove('office-focus');$('#expand').setAttribute('aria-pressed','false');$('#expand').setAttribute('aria-label','업무 공간 크게 보기');$('#expand').title='업무 공간 크게 보기';fitViewport();}}});
$('#scene-zoom-in').addEventListener('click',()=>officeScene?.setZoom(officeScene.zoom*1.15));
$('#scene-zoom-out').addEventListener('click',()=>officeScene?.setZoom(officeScene.zoom/1.15));
$('#scene-reset').addEventListener('click',()=>officeScene?.resetView());
$('#scene-path').addEventListener('click',()=>{if(!officeScene)return;officeScene.setPaths(!officeScene.paths);$('#scene-path').setAttribute('aria-pressed',String(officeScene.paths));});
new ResizeObserver(queuePositions).observe($('#office-stage'));
new ResizeObserver(fitViewport).observe($('.stage-boundary'));
window.addEventListener('resize',fitViewport);
render();
if(needsOfficeSetup&&!officeViewHandoff){$('#setup-suite-name').value=prefs.executiveSuiteName;$('#setup-owner-name').value=prefs.ownerName;$('#office-setup-dialog').showModal();$('#setup-owner-name').focus();}else if(!needsOfficeSetup)requestLocation(false);
async function startOffice(){
  $('#demo-toggle').disabled=true;
  startupPoll=setInterval(()=>{if(state.dataReady){clearInterval(startupPoll);return;}if(!state.demo)refresh(false);},2000);
  const registryLoad=loadRegistries();
  await refresh();
  await registryLoad;
  if(state.dataReady&&!state.demo)applySnapshot(realSnapshot,true);
  $('#demo-toggle').disabled=false;
  const stream=new EventSource('/events');stream.addEventListener('office',event=>{try{acceptRealSnapshot(JSON.parse(event.data));}catch{/* Wait for the next complete event. */}});stream.onerror=()=>{if(!state.demo)setConnection(false);};
}
startOffice();
setInterval(()=>{if(!document.hidden){renderActivity();renderDetail();}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.demo)refresh(false);});
window.addEventListener('pageshow',()=>{if(!state.demo)refresh(false);});
setInterval(()=>{if(!document.hidden&&!state.demo)refresh(false);},12000);

setInterval(()=>{if(!document.hidden)renderBuilding();},1000);
