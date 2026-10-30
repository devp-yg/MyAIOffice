import {DEFAULT_PREFERENCES,validatePreferences} from './office-preferences.js';
const LEGACY_KEY='my-ai-office-preferences';
let writes=Promise.resolve();
const subscribers=new Set();
const channel=typeof window!=='undefined'&&typeof BroadcastChannel==='function'?new BroadcastChannel('my-ai-office-settings'):null;
channel?.addEventListener('message',()=>{readPreferences().then(value=>subscribers.forEach(fn=>fn(value))).catch(()=>{});});
async function readPreferences(){
  let response;
  try{response=await fetch('/api/settings',{cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw new Error('설정을 불러오지 못했어요. 서버 연결을 확인하고 다시 시도해 주세요.');}
  if(!response.ok)throw new Error('설정을 불러오지 못했어요. 서버 연결을 확인하고 다시 시도해 주세요.');
  return response.json();
}
export async function loadPreferences(){
  const data=await readPreferences();
  // Move old browser-only preferences into the project once, without replacing
  // values already configured in the project file. Clear the cache only on success.
  let legacy;try{legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');}catch{}
  if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)){
    const patch={};
    for(const key of Object.keys(DEFAULT_PREFERENCES)){
      if(!data.configuredKeys.includes(key)&&Object.hasOwn(legacy,key)&&validatePreferences({[key]:legacy[key]}))patch[key]=legacy[key];
    }
    if(Object.keys(patch).length){try{data.settings=await savePreferences(patch);}catch(error){error.preferences=data.settings;throw error;}}
    try{localStorage.removeItem(LEGACY_KEY);}catch{}
  }
  return data.settings;
}
export function savePreferences(patch){
  const operation=writes.catch(()=>{}).then(async()=>{
    let response;
    try{response=await fetch('/api/settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(10000)});}catch{throw new Error('설정을 저장하지 못했어요. 서버 연결을 확인하고 다시 시도해 주세요.');}
    if(!response.ok)throw new Error('설정을 저장하지 못했어요. 서버 연결과 입력값을 확인하고 다시 시도해 주세요.');
    const {settings}=await response.json();channel?.postMessage('saved');return settings;
  });
  writes=operation;return operation;
}
const fields=[
  ['executive-suite-name-setting','executiveSuiteName','회장실 이름',40,'EXECUTIVE SUITE'],
  ['owner-name-setting','ownerName','CEO 이름',40,'이름을 입력해 주세요'],
  ['owner-title-setting','ownerTitle','직급',30,'CEO'],
  ['owner-rank-setting','ownerRank','조직 서열',12,'1'],
  ['secretary-name-setting','secretaryName','비서 이름',40,'이름을 입력해 주세요'],
  ['visitor-name-setting','visitorName','임산부 이름',40,'이름을 입력해 주세요'],
  ['visitor-role-setting','visitorRole','관계 / 역할',40,'예: CEO 배우자'],
  ['visitor-baby-setting','visitorBaby','태명 / 아기 정보',40,'선택 입력'],
];
function input(key){const [id,,label,length,placeholder]=fields.find(field=>field[1]===key);return `<label>${label}<input id="${id}" name="${key}" type="text" maxlength="${length}" placeholder="${placeholder}"></label>`;}
export function mountOfficeSettings({getPreferences,onApply,onLocation,loadError=''}){
  let dialog=document.querySelector('#settings-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='settings-dialog';document.body.append(dialog);}
  dialog.className='office-settings-dialog';dialog.setAttribute('aria-labelledby','office-settings-title');
  dialog.innerHTML=`<form id="office-settings-form"><div class="office-settings-heading"><div><span>MY AI OFFICE</span><h2 id="office-settings-title">사무실 설정</h2></div><button type="button" class="settings-close" aria-label="설정 닫기">×</button></div><p class="office-settings-intro">CEO와 함께하는 사람들의 정보를 설정해 보세요.</p>
    <fieldset><legend>CEO · 회장실</legend><div class="office-settings-grid">${['executiveSuiteName','ownerName','ownerTitle','ownerRank'].map(input).join('')}</div></fieldset>
    <fieldset><legend>비서</legend>${input('secretaryName')}</fieldset>
    <fieldset><legend>임산부</legend><label class="office-settings-check"><input id="visitor-enabled-setting" name="visitorEnabled" type="checkbox">오피스에 임산부 캐릭터 표시</label><div class="office-settings-grid">${['visitorName','visitorRole','visitorBaby'].map(input).join('')}<label>출산 예정일<input id="visitor-due-date-setting" name="visitorDueDate" type="date" min="1900-01-01" max="2199-12-31"></label></div><p class="office-settings-note">출산 예정일을 입력하면 캐릭터의 임신 주수와 모습을 계산해 표시합니다.</p></fieldset>
    <fieldset><legend>화면</legend><label class="office-settings-check"><input id="motion-setting" name="motion" type="checkbox">캐릭터 움직임</label><label class="office-settings-check"><input id="text-setting" name="largeText" type="checkbox">더 큰 글자</label>${onLocation?'<label class="office-settings-check"><input id="theme-setting" name="evening" type="checkbox">조용한 저녁 테마</label>':''}</fieldset>
    ${onLocation?'<fieldset><legend>사무실 위치</legend><p id="location-detail" class="office-settings-note"></p><button id="location-update" class="settings-secondary" type="button">현재 위치 설정·갱신</button></fieldset>':''}
    <p class="office-settings-privacy">설정은 이 프로젝트의 <code>data/settings.json</code>에 저장됩니다. 사용자 입력 정보는 Git과 배포 ZIP에서 제외됩니다.</p><p id="settings-status" role="status" aria-live="polite"></p><div class="office-settings-footer"><button class="settings-secondary settings-cancel" type="button">닫기</button><button id="settings-save" class="settings-primary" type="submit">설정 저장</button></div></form>`;
  const form=dialog.querySelector('form'),status=dialog.querySelector('#settings-status'),submit=dialog.querySelector('#settings-save');
  let busy=false;
  function populate(prefs){for(const element of form.elements){if(!element.name)continue;if(element.type==='checkbox')element.checked=Boolean(prefs[element.name]);else element.value=prefs[element.name]??'';}}
  function showError(error){status.textContent=error.message||String(error);status.dataset.error='true';}
  function syncVisitor(){const enabled=form.elements.visitorEnabled.checked;for(const name of ['visitorName','visitorRole','visitorBaby','visitorDueDate'])form.elements[name].disabled=!enabled;}
  form.elements.visitorEnabled.addEventListener('change',syncVisitor);
  populate(getPreferences());syncVisitor();
  const close=()=>{if(!busy)dialog.close();};
  dialog.querySelector('.settings-close').addEventListener('click',close);dialog.querySelector('.settings-cancel').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)close();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const patch={};for(const element of form.elements){if(element.name)patch[element.name]=element.type==='checkbox'?element.checked:element.value;}
    busy=true;submit.disabled=true;status.dataset.error='false';status.textContent='설정을 저장하는 중…';
    try{const prefs=await savePreferences(patch);onApply(prefs);populate(prefs);syncVisitor();loadError='';status.textContent='설정을 저장했어요.';}
    catch(error){showError(error);}finally{busy=false;submit.disabled=false;}
  });
  dialog.querySelector('#location-update')?.addEventListener('click',()=>onLocation());
  subscribers.add(data=>{onApply(data.settings);if(!dialog.open){populate(data.settings);syncVisitor();}});
  // A tab restored from the back/forward cache also reads the current project file.
  addEventListener('pageshow',()=>{readPreferences().then(data=>onApply(data.settings)).catch(()=>{});});
  return {dialog,showError,open:async()=>{
    populate(getPreferences());syncVisitor();status.textContent=loadError||'설정을 불러오는 중…';status.dataset.error=String(Boolean(loadError));dialog.showModal();
    const fieldsets=[...form.querySelectorAll('fieldset')];fieldsets.forEach(fieldset=>fieldset.disabled=true);submit.disabled=true;
    try{const data=await readPreferences();onApply(data.settings);populate(data.settings);syncVisitor();loadError='';status.textContent='';}catch(error){showError(error);}finally{fieldsets.forEach(fieldset=>fieldset.disabled=false);submit.disabled=false;syncVisitor();}
  }};
}
