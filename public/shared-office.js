import {bindOfficeExpansion} from './office-frame.js';
import {DEFAULT_PREFERENCES} from './office-preferences.js';
import {loadPreferences,savePreferences,mountOfficeSettings} from './office-settings.js';
import {SharedOfficeScene} from './shared-office-scene.js?v=20261107-3';
import {SHARED_ROOMS,PREVIEW_PROJECTS,SCENARIOS} from './shared-office-layout.js?v=20261107-3';
import {SharedOfficeOccupancy,sharedProjects} from './shared-office-state.js';
import {OfficeLiveFeed} from './office-live-feed.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function stored(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
const query=new URLSearchParams(location.search);
let scene,feed,occupancy=new SharedOfficeOccupancy(),demo=false,scenario='full',project=query.get('project'),selectedSession=query.get('session'),selectedRoom=null,rosterFilter='all',projects=[],latest=null,registry={},connection='loading',signature='';
let showResting=stored('shared-office-show-resting',true),rememberedProject=project;
const announce=text=>{$('#study-announcement').textContent=text;};
const countText=(element,value,unit)=>{element.replaceChildren(document.createTextNode(String(value)));const small=document.createElement('small');small.textContent=unit;element.append(small);};
const roomName=key=>key==='executive'?'CEO 집무실':SHARED_ROOMS.find(r=>r.key===key)?.name||'업무 공간';
const inactiveStatus=session=>session.aborted?'작업 중단 · 휴식 중':session.finished?'작업 완료 · 휴식 중':'응답 대기 중';
const timeText=timestamp=>timestamp?new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(timestamp)):'—';
function towerUrl(key=project,id=selectedSession){const params=new URLSearchParams({view:'tower'});if(key)params.set('project',key);if(id)params.set('session',id);return '/?'+params;}
function detail(title,text){$('#study-detail strong').textContent=title;$('#study-detail p').textContent=text;}
function updateConnection(state){connection=state;$('#connection-status').className=`connection-status ${demo?'demo':state}`;$('#connection-status').textContent=demo?'DEMO':state==='connected'?'로컬 연결':state==='offline'?'연결 끊김':'연결 중';$('#stage-source>span').textContent=demo?'DEMO · 예시 직원':state==='connected'?'LIVE · Codex':state==='offline'?'연결 끊김 · 마지막 상태':'LIVE · 연결 중';}

for(const room of SHARED_ROOMS){
  const button=document.createElement('button');button.className='room-row';button.dataset.room=room.key;button.style.setProperty('--room',room.color);button.setAttribute('aria-pressed','false');
  const dot=document.createElement('i'),name=document.createElement('span'),count=document.createElement('span');name.textContent=room.name;button.append(dot,name,count);button.addEventListener('click',()=>chooseRoom(room.key));$('#room-list').append(button);
}
const executiveButton=document.createElement('button');executiveButton.className='room-row executive-row';executiveButton.dataset.room='executive';executiveButton.style.setProperty('--room','#b99d67');executiveButton.setAttribute('aria-pressed','false');
const executiveDot=document.createElement('i'),executiveName=document.createElement('span'),executiveNote=document.createElement('span');executiveName.textContent='CEO 집무실';executiveNote.textContent='전용 공간';executiveButton.append(executiveDot,executiveName,executiveNote);executiveButton.addEventListener('click',()=>chooseRoom('executive'));$('#room-list').append(executiveButton);
$$('[data-scenario]').forEach(button=>{const key=button.dataset.scenario,total=Object.values(SCENARIOS[key].counts).reduce((a,b)=>a+b,0);button.setAttribute('aria-label',`${total}명 · ${SCENARIOS[key].name}`);button.title=button.getAttribute('aria-label');});

function renderProjects(){
  const search=$('#project-search').value.trim().normalize('NFC').toLocaleLowerCase(),list=$('#project-list');list.replaceChildren();
  for(const p of projects.filter(p=>`${p.name} ${p.code}`.normalize('NFC').toLocaleLowerCase().includes(search))){
    const button=document.createElement('button');button.className='project-pill';button.dataset.project=p.key;button.style.setProperty('--project',p.color);button.classList.toggle('selected',project===p.key);button.setAttribute('aria-pressed',String(project===p.key));button.title=`${p.name} · ${p.active||0}명 작업 중`;
    const dot=document.createElement('i'),name=document.createElement('span');name.textContent=p.name;button.append(dot,name);button.addEventListener('click',()=>chooseProject(project===p.key?null:p.key));list.append(button);
  }
  $('#project-empty').hidden=Boolean(list.children.length);$('#all-projects').setAttribute('aria-pressed',String(!project));
}
function renderCounts(){
  countText($('#staff-total'),demo?scene.actors.length:(latest?.sessions||[]).filter(s=>s.active).length,'명');countText($('#project-total'),projects.length,'개');
  const b=scene.layout.bounds,width=Math.round(b.maxX-b.minX),depth=Math.round((b.maxZ-b.minZ)*10)/10;
  $('#space-size').replaceChildren(document.createTextNode(`${width} × ${depth}`));const m=document.createElement('small');m.textContent='m';$('#space-size').append(m);
  for(const room of SHARED_ROOMS)$(`[data-room="${room.key}"]>span:last-child`).textContent=`${scene.actors.filter(a=>a.seat.room===room.key&&(!project||a.project.key===project)).length}명`;
  const shown=scene.actors.filter(a=>!project||a.project.key===project),waiting=shown.filter(a=>a.session&&!a.session.active&&!a.session.finished).length,resting=shown.filter(a=>a.session&&!a.session.active&&a.session.finished).length;
  $('#stage-population').textContent=scene.parkingView?'지하 1층 · 주차장':demo?`${shown.length}명 예시 배치`:`화면 ${shown.length}명 · 응답 대기 ${waiting}명 · 휴식 ${resting}명`;
  $('#live-summary').textContent=`전체 ${(latest?.sessions||[]).filter(s=>s.active).length}명 작업 중 · 화면에 ${scene.actors.length}명`;
  $('#last-updated').textContent=latest?`${timeText(latest.checkedAt)} 확인 · ${connection==='offline'?'마지막 수신 상태':'이 PC의 Codex 기록'}`:'연결을 기다리는 중';
  $('#tower-link').href=demo?'/?view=tower':towerUrl();
}
function refreshDetail(){
  if(scene.parkingView){$('#session-detail').hidden=true;detail('B1 · 주차장 엘리베이터','공원 쪽 외벽 승강장에서 엘리베이터를 타고 1층 오피스로 바로 올라갈 수 있습니다.');return;}
  if(!demo&&!latest){detail('실제 작업을 불러오는 중입니다','Codex의 프로젝트와 직원 정보를 연결하고 있어요.');return;}
  if(scene.selectedOwner){$('#session-detail').hidden=true;detail(`${scene.executive.ownerName} · ${scene.executive.ownerTitle}`,scene.executive.patrol.text);return;}
  if(selectedSession){
    const actor=scene.actors.find(a=>a.id===selectedSession),session=demo?actor?.session:latest?.sessions.find(s=>s.id===selectedSession);
    if(actor||session){
      const name=session?.identity?.name||actor?.name,p=projects.find(p=>p.key===(session?.projectKey||actor?.project.key));
      detail(`${name} · ${p?.name||session?.project||actor.project.name}`,session?(session.active?session.label:inactiveStatus(session)):`${roomName(actor.seat.room)}에서 함께 일하고 있습니다.`);
      $('#session-detail').hidden=demo;$('#session-detail strong').textContent=`${name} · ${p?.name||session?.project}`;
      $('#session-detail p').textContent=session?`${session.hasParent?'서브에이전트':'일반 채팅'} · ${session.active?session.label:inactiveStatus(session)} · 마지막 활동 ${timeText(session.updatedAt)}${session.error?' · 도구 결과 확인 필요':''}`:'';
      $('#session-tower-link').href=towerUrl(session?.projectKey,selectedSession);return;
    }
    selectedSession=null;
  }
  $('#session-detail').hidden=true;
  if(selectedRoom==='executive'){detail('CEO 집무실 · 전용 공간','타워형의 집무실·비서실·접견실·이사회실·서재·프라이빗 라운지·기밀문서실을 같은 크기로 옮겼습니다.');return;}
  if(selectedRoom){const actors=scene.actors.filter(a=>a.seat.room===selectedRoom&&a.model.root.visible);detail(`${roomName(selectedRoom)} · ${actors.length}명`,selectedRoom==='meeting'?'검토, 계획 정리, 서브에이전트 협업을 위한 공간입니다. 같은 프로젝트끼리 테이블을 배정합니다.':'같은 종류의 업무를 하는 여러 프로젝트가 공간을 함께 사용합니다.');}
  else if(project){const p=projects.find(p=>p.key===project);detail(p?.name||'프로젝트',`${scene.actors.filter(a=>a.model.root.visible).length}명의 직원 위치를 보여줍니다. 프로젝트별 전체 최근 작업은 아래 목록에서 확인하세요.`);}
  else if(!demo&&!(latest?.sessions||[]).some(s=>s.active))detail('지금은 작업 중인 직원이 없어요',showResting?'쉬는 직원들과 최근 작업을 살펴볼 수 있습니다.':'새 작업이 시작되면 해당 업무 구역에 직원이 나타납니다.');
  else detail('공용 통로와 앞마당 정원으로 연결된 오피스','휴식 정원 앞 외벽 엘리베이터로 지하 주차장과 바로 연결됩니다. 고양이 말풍선을 누르면 정원을 고양이 눈높이로 둘러볼 수 있어요.');
}
function renderRoster(){
  $('#live-roster').hidden=demo;if(demo)return;
  const all=(latest?.sessions||[]).filter(s=>!project||s.projectKey===project),sessions=all.filter(s=>rosterFilter==='all'||(rosterFilter==='active'?s.active:!s.active)).sort((a,b)=>Number(b.active)-Number(a.active)||b.updatedAt-a.updatedAt);
  $('#roster-summary').textContent=`최근 ${all.length}개 채팅 · 공용층에 ${scene.actors.filter(a=>!project||a.project.key===project).length}명 표시`;
  const list=$('#session-list');list.replaceChildren();
  for(const session of sessions){
    const p=projects.find(p=>p.key===session.projectKey),button=document.createElement('button');button.className='session-card';button.dataset.session=session.id;button.classList.toggle('selected',selectedSession===session.id);button.setAttribute('aria-pressed',String(selectedSession===session.id));
    const dot=document.createElement('i'),copy=document.createElement('span'),name=document.createElement('strong'),task=document.createElement('small'),status=document.createElement('span');dot.style.background=p?.color||'#91a678';name.textContent=`${session.identity?.name||'Codex'} · ${p?.name||session.project}`;task.textContent=session.active?session.label:`${inactiveStatus(session)} · 마지막 활동 ${timeText(session.updatedAt)}`;status.textContent=session.error?'확인':session.active?'작업 중':session.aborted?'중단':session.finished?'완료':'응답 대기';status.className=session.error?'error':session.active?'active':'idle';copy.append(name,task);button.append(dot,copy,status);button.addEventListener('click',()=>chooseActor(session.id));list.append(button);
  }
  if(!sessions.length){const empty=document.createElement('p');empty.className='roster-empty';empty.textContent=latest?'이 조건에 맞는 최근 작업이 없어요.':'실제 작업을 불러오는 중입니다.';list.append(empty);}
}
function markRoom(key){const overviewSelected=!key&&!selectedSession&&!scene.selectedOwner&&!scene.catView&&!scene.parkingView;$('#overview').classList.toggle('selected',overviewSelected);$('#overview').setAttribute('aria-pressed',String(overviewSelected));$$('.room-row').forEach(b=>{const selected=b.dataset.room===key;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});}
function updateCatView(name){
  const exit=$('#exit-cat-view'),label=$('#cat-view-name');
  $('.study-stage').classList.toggle('cat-view',Boolean(name));
  const restoreFocus=!name&&document.activeElement===exit;
  exit.hidden=label.hidden=!name;
  label.textContent=name?`${name} 시점 · Esc로 돌아가기`:'';
  if(name){
    selectedRoom=selectedSession=null;
    exit.focus({preventScroll:true});
  }else if(restoreFocus)$('#study-canvas canvas').focus({preventScroll:true});
  markRoom(selectedRoom);refreshDetail();renderRoster();renderCounts();
  announce(name?`${name} 시점으로 전환했습니다`:'지도 시점으로 돌아왔습니다');
}
function updateFloorView(parking){
  $('.study-stage').classList.toggle('parking-view',parking);
  for(const button of $$('[data-floor-view]')){
    const selected=(button.dataset.floorView==='parking')===parking;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  markRoom(parking?null:selectedRoom);refreshDetail();renderCounts();
  announce(parking?'지하 1층 주차장으로 전환했습니다.':'1층 공용 오피스로 돌아왔습니다.');
}
function overview(){scene.setParkingView(false);selectedRoom=null;selectedSession=null;scene.resetView();markRoom(null);refreshDetail();renderRoster();renderCounts();}
function chooseRoom(key){scene.setParkingView(false);selectedRoom=key;selectedSession=null;scene.selectRoom(key);markRoom(key);refreshDetail();renderRoster();renderCounts();announce(`${roomName(key)} 확대`);}
function chooseActor(id){scene.setParkingView(false);selectedRoom=null;selectedSession=id;scene.selectActor(scene.actors.some(a=>a.id===id)?id:null);markRoom(null);refreshDetail();renderRoster();renderCounts();}
function chooseOwner(){scene.setParkingView(false);selectedRoom=null;selectedSession=null;scene.selectOwner();markRoom(null);refreshDetail();renderRoster();renderCounts();if(scene.selectedOwner)announce('CEO 확대');}
function chooseProject(key){project=key;selectedSession=null;selectedRoom=null;scene.selectActor(null);scene.setProject(key);markRoom(null);renderProjects();renderCounts();refreshDetail();renderRoster();}
function applyLive(){
  projects=sharedProjects(latest||{sessions:[],projects:[]},registry.floors||{});if(latest&&project&&!projects.some(p=>p.key===project))project=null;
  const population=occupancy.update(latest?.sessions||[],projects,showResting);scene.setLiveData(population);scene.setProject(project);
  renderProjects();renderCounts();refreshDetail();renderRoster();
  if(!scene.parkingView&&selectedSession&&scene.actors.some(a=>a.id===selectedSession)&&!scene.selectedId)scene.selectActor(selectedSession);
}
function changeScenario(key){scenario=key;scene.project=project;scene.setScenario(key);$$('[data-scenario]').forEach(b=>{const selected=b.dataset.scenario===key;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});$('#scenario-description').textContent=`${SCENARIOS[key].name} · 예시 직원 ${scene.actors.length}명입니다.`;overview();}
function toggleDemo(){
  demo=!demo;selectedRoom=null;selectedSession=null;scene.stopWalk();$('#project-search').value='';$('#demo-controls').hidden=!demo;$('#live-info').hidden=demo;$('#live-roster').hidden=demo;$('#source-switch').textContent=demo?'실제 작업으로':'둘러보기';$('#source-switch').setAttribute('aria-pressed',String(demo));$('#staff-total-label').textContent=demo?'예시 직원':'작업 중';$('#source-note-title').textContent=demo?'예시 데이터 · DEMO':'로컬 Codex 연결';$('#source-note').textContent=demo?'공간을 살펴보기 위한 예시 직원과 프로젝트입니다.':'업무가 바뀌면 직원이 다음 공간으로 이동합니다.';
  if(demo){rememberedProject=project;project=null;projects=PREVIEW_PROJECTS;changeScenario(scenario);}
  else{project=rememberedProject;occupancy=new SharedOfficeOccupancy();applyLive();overview();feed.refresh();}
  $('#walk-preview').setAttribute('aria-pressed',String(!demo&&scene.showPaths!==false));$('#walk-preview').lastChild.textContent=demo?' 직원 동선 보기':' 이동 경로';updateConnection(connection);renderProjects();renderCounts();
}

let preferences={...DEFAULT_PREFERENCES,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches},settingsLoadError='';
try{Object.assign(preferences,await loadPreferences());}catch(error){Object.assign(preferences,error.preferences||{});settingsLoadError=error.message;}
let locationStatus='';
function renderLocation(){
  const detail=$('#location-detail');
  const saved=Number.isFinite(preferences.latitude)&&Number.isFinite(preferences.longitude);
  detail.textContent=locationStatus||(saved?'저장된 위치를 기준으로 해와 달을 계산합니다.':'위치가 없으면 기기의 시간대를 바탕으로 하늘을 표시합니다.');
}
function requestLocation(manual=false){
  if(!navigator.geolocation){
    locationStatus='이 브라우저에서는 현재 위치를 사용할 수 없어요.';
    renderLocation();
    return;
  }
  if(manual){locationStatus='현재 위치를 확인하는 중…';renderLocation();}
  navigator.geolocation.getCurrentPosition(async ({coords:{latitude,longitude}})=>{
    try{
      if(latitude!==preferences.latitude||longitude!==preferences.longitude)applyPreferences(await savePreferences({latitude,longitude}));
      locationStatus='현재 위치를 기준으로 해와 달을 계산합니다.';
    }catch(error){
      scene?.setLocation(latitude,longitude);
      locationStatus='현재 위치를 적용했어요. '+error.message;
    }
    renderLocation();
  },()=>{
    if(manual){
      locationStatus='현재 위치를 가져올 수 없어요. 브라우저에서 위치 권한을 확인해 주세요.';
      renderLocation();
    }
  },{maximumAge:manual?0:300000,timeout:12000});
}
function applyPreferences(next){
  preferences={...next};document.body.classList.toggle('large-text',preferences.largeText);
  scene?.setPreferences(preferences);$('#motion-toggle').setAttribute('aria-pressed',String(preferences.motion));
  renderLocation();
  if(scene)refreshDetail();
}
const officeSettings=mountOfficeSettings({getPreferences:()=>preferences,onApply:applyPreferences,onLocation:()=>requestLocation(true),showEvening:false,loadError:settingsLoadError});
$('#open-settings').addEventListener('click',()=>officeSettings.open());
try{
  scene=new SharedOfficeScene($('#study-canvas'),{
    onRoom:chooseRoom,onActor:chooseActor,onOwner:chooseOwner,onCatView:updateCatView,onFloor:updateFloorView,onOwnerStatus:()=>{if(scene?.selectedOwner)refreshDetail();},preferences,
    onView:({zoom,elevation,parking})=>{$('#zoom-label').textContent=`${Math.round(zoom*100)}%`;$$('[data-angle]').forEach(b=>{const selected=Math.abs(Number(parking?(b.dataset.parkingAngle||b.dataset.angle):b.dataset.angle)-elevation)<4;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});},
    onWalkEnd:()=>{if(demo){$('#walk-preview').setAttribute('aria-pressed','false');$('#walk-preview').lastChild.textContent=' 직원 동선 보기';}},
  });
  applyPreferences(preferences);
  requestLocation();
  $('#motion-toggle').setAttribute('aria-pressed',String(scene.motion));$('#show-resting').checked=showResting;
  applyLive();
  feed=new OfficeLiveFeed({cachedRegistry:{staff:stored('office-staff-registry'),floors:stored('office-floor-registry')},onConnection:updateConnection,onSnapshot:(snapshot,nextRegistry)=>{
    latest=snapshot;registry=nextRegistry;
    const nextSignature=JSON.stringify({sessions:snapshot.sessions,projects:snapshot.projects});
    if(!demo&&nextSignature!==signature){signature=nextSignature;applyLive();}else if(!demo)renderCounts();
  }});
  feed.start();
  $('#overview').addEventListener('click',overview);$('#reset-view').addEventListener('click',()=>scene.parkingView?scene.resetView():overview());$('#all-projects').addEventListener('click',()=>chooseProject(null));$('#source-switch').addEventListener('click',toggleDemo);$('#refresh-live').addEventListener('click',()=>feed.refresh());
  $('#exit-cat-view').addEventListener('click',()=>scene.leaveCatView());
  $('.study-stage').addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!scene.catView)return;
    event.preventDefault();
    event.stopPropagation();
    scene.leaveCatView();
  });
  $('#project-search').addEventListener('input',renderProjects);
  $('#show-resting').addEventListener('change',()=>{showResting=$('#show-resting').checked;try{localStorage.setItem('shared-office-show-resting',JSON.stringify(showResting));}catch{}applyLive();});
  $$('[data-scenario]').forEach(b=>b.addEventListener('click',()=>changeScenario(b.dataset.scenario)));
  $$('[data-floor-view]').forEach(b=>b.addEventListener('click',()=>scene.setParkingView(b.dataset.floorView==='parking')));
  $$('[data-angle]').forEach(b=>b.addEventListener('click',()=>scene.setElevation(scene.parkingView?(b.dataset.parkingAngle||b.dataset.angle):b.dataset.angle)));
  $$('[data-roster]').forEach(b=>b.addEventListener('click',()=>{rosterFilter=b.dataset.roster;$$('[data-roster]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderRoster();}));
  $('#close-session').addEventListener('click',()=>{selectedSession=null;scene.selectActor(null);refreshDetail();renderRoster();renderCounts();});
  $('#zoom-in').addEventListener('click',()=>scene.setZoom(scene.zoom*1.2));$('#zoom-out').addEventListener('click',()=>scene.setZoom(scene.zoom/1.2));
  $('#labels-toggle').addEventListener('click',()=>{scene.showLabels=!scene.showLabels;$('#labels-toggle').setAttribute('aria-pressed',String(scene.showLabels));scene.updateLabels();});
  $('#motion-toggle').addEventListener('click',async()=>{try{applyPreferences(await savePreferences({motion:!scene.motion}));}catch(error){announce(error.message);officeSettings.showError(error);}});
  bindOfficeExpansion({stage:$('.study-stage'),button:$('#stage-expand'),onResize:()=>scene?.resize()});
  $('#walk-preview').addEventListener('click',()=>{if(!demo){scene.showPaths=scene.showPaths===false;scene.routeSignature='force';$('#walk-preview').setAttribute('aria-pressed',String(scene.showPaths));}else if(!scene.walkActor&&scene.startWalk()){$('#walk-preview').setAttribute('aria-pressed','true');$('#walk-preview').lastChild.textContent=' 정원을 돌아오는 중';}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)feed.refresh();});
  addEventListener('pagehide',event=>{if(!event.persisted){feed.stop();scene.destroy();}});
}catch(error){
  console.error('Shared office could not start',error);feed?.stop();scene?.destroy();$('#study-canvas').innerHTML='<div class="scene-error"><strong>3D 오피스를 열 수 없어요.</strong><p>3D 공간을 준비하지 못했어요. 페이지를 새로고침해 주세요.</p></div>';$$('button').filter(b=>b.id!=='open-settings'&&!b.closest('#settings-dialog')).forEach(b=>b.disabled=true);
}
