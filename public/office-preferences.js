// Public defaults contain no user profile or pregnancy information.
export const DEFAULT_PREFERENCES=Object.freeze({
  executiveSuiteName:'EXECUTIVE SUITE',ownerName:'',ownerTitle:'CEO',ownerRank:'1',secretaryName:'',
  visitorEnabled:false,visitorName:'',visitorRole:'',visitorBaby:'',visitorDueDate:'',
  motion:true,largeText:true,evening:false,latitude:null,longitude:null,
});
const lengths={executiveSuiteName:40,ownerName:40,ownerTitle:30,ownerRank:12,secretaryName:40,visitorName:40,visitorRole:40,visitorBaby:40};
export function validDueDate(value){
  if(value==='')return true;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return value>='1900-01-01'&&value<='2199-12-31'&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function validatePreferences(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const result={};
  for(const [key,item] of Object.entries(value)){
    if(!Object.hasOwn(DEFAULT_PREFERENCES,key))return null;
    if(Object.hasOwn(lengths,key)){
      if(typeof item!=='string'||item.trim().length>lengths[key])return null;
      result[key]=item.trim();
    }else if(key==='visitorDueDate'){
      if(!validDueDate(item))return null;result[key]=item;
    }else if(key==='latitude'||key==='longitude'){
      if(item!==null&&(!Number.isFinite(item)||Math.abs(item)>(key==='latitude'?90:180)))return null;result[key]=item;
    }else{if(typeof item!=='boolean')return null;result[key]=item;}
  }
  return result;
}
