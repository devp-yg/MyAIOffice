// A project keeps the same visual identity wherever its staff appear.
export function projectHue(key){
 let hash=2166136261;
 for(const char of String(key||'unassigned')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return (hash>>>0)%360;
}
