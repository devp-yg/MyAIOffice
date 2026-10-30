import {staffAppearance} from './staff-appearance.js';
const FIRST_NAMES=['Alex','Riley','Noah','Ethan','Luca','Kai','Finn','Felix','Owen','Theo','Jamie','Avery','Morgan','Logan','Quinn','Sasha','Elliot','Robin','Jules','Remy','Casey','Blake','Taylor','Drew','Hayden','Parker','Devon','Rowan','Sage','Cameron','Jordan','Reese','Arlo','Asher','August','Bailey','Beck','Bennett','Bowie','Callum','Charlie','Cody','Dakota','Ellis','Emery','Emerson','Frankie','Gale','Harper','Indigo','Jesse','Kit','Lane','Marley','Micah','Milo','Nico','Oakley','Orion','Phoenix','River','Rory','Skyler','Sonny','Spencer','Stevie','Toby','Wren','Yael','Zion','Amari','Bellamy','Cedar','Darcy','Eden','Hollis','Kendall','Lennox','Noel','Peyton','Shiloh','Tatum','Winter','Ari','Cleo','Darien','Zane','Gray','Ira','Lee','Max','Nikita','Remi','Sam','Shawn','Terry','Val','Jaden','Soren','Zuri'];
const LAST_NAMES=['Brooks','Walker','Reed','Hayes','Bennett','Carter','Ellis','Gray'];
const LOOKS=[
  {palette:'studio',accessory:'beanie',detail:'올리브 비니',idle:'game'},
  {palette:'server',accessory:'headphones',detail:'파란 헤드폰',idle:'stretch'},
  {palette:'meeting',accessory:'glasses',detail:'동그란 안경',idle:'read'},
  {palette:'library',accessory:'cap',detail:'꿀빛 볼캡',idle:'nap'},
  {palette:'research',accessory:'scarf',detail:'민트 스카프',idle:'relax'},
  {palette:'desk',accessory:'freckles',detail:'작은 주근깨',idle:'lie'},
  {palette:'server',accessory:'bowtie',detail:'남색 보타이',idle:'read'},
  {palette:'meeting',accessory:'headphones',detail:'라벤더 헤드폰',idle:'game'},
];
function hash(text){let value=2166136261;for(const char of String(text)){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;}
export class StaffIdentities {
  constructor(registry={}){this.registry={...registry};}
  assign(sessions){
    const used=new Set(Object.values(this.registry).map(item=>item.index));
    for(const session of [...sessions].sort((a,b)=>a.id.localeCompare(b.id))){
      if(this.registry[session.id])continue;
      let index=hash(session.id)%FIRST_NAMES.length;while(used.has(index))index++;
      used.add(index);this.registry[session.id]={index};
    }
    return sessions.map(session=>({...session,identity:this.profile(session.id)}));
  }
  profile(id){const index=this.registry[id]?.index??hash(id)%FIRST_NAMES.length;const generation=Math.floor(index/FIRST_NAMES.length);const family=generation===0?'':` ${LAST_NAMES[(generation-1)%LAST_NAMES.length]}${generation>LAST_NAMES.length?' '+Math.ceil((generation-LAST_NAMES.length)/LAST_NAMES.length):''}`;return {name:FIRST_NAMES[index%FIRST_NAMES.length]+family,index,chatNumber:index+1,...LOOKS[index%LOOKS.length],detail:`${staffAppearance(index).detail} · ${LOOKS[index%LOOKS.length].detail}`};}
}
export function ownerPortrait(rank='1'){const badge=String(rank??'').trim().replace(/^#/,'').replace(/[&<>"']/g,'');return `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="40" cy="94" rx="23" ry="4" fill="#51482920"/><rect x="25" y="80" width="12" height="13" rx="5" fill="#33434c"/><rect x="44" y="80" width="12" height="13" rx="5" fill="#33434c"/><rect x="21" y="58" width="38" height="29" rx="12" fill="#354f5b"/><path d="m30 59 10 7 10-7-10 25Z" fill="#faf1d6"/><path d="m38 66 4 0 3 13-5 6-5-6Z" fill="#c9a74d"/><rect x="14" y="21" width="52" height="43" rx="20" fill="#503f36"/><rect x="18" y="28" width="44" height="32" rx="15" fill="#fff0d2"/><path d="m20 31 8-10 29 4-9 11-5-9-8 9-1-9-8 9Z" fill="#503f36"/><ellipse cx="31" cy="43" rx="2.4" ry="3" fill="#42433a"/><ellipse cx="49" cy="43" rx="2.4" ry="3" fill="#42433a"/><path d="M36 51q4 4 8 0" stroke="#a47c56" stroke-width="1.6" fill="none"/><path d="m23 20-3-14 12 7 8-11 8 11 12-7-3 14Z" fill="#d1b45f"/><rect x="22" y="18" width="36" height="5" rx="2" fill="#b69a47"/><circle cx="40" cy="17" r="3" fill="#f7edbb"/><circle cx="53" cy="71" r="6" fill="#d8bf70"/><text x="53" y="74" fill="#6f5925" text-anchor="middle" font-size="8" font-family="sans-serif" font-weight="700">${badge}</text></svg>`;}
