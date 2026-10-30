// Shared by the 3D offices and roster portraits. Identity, never room or list order,
// determines a worker's wardrobe. Mixed-radix digits keep combinations distinct.
const TOPS=[0x557a95,0xc77d67,0x7a9566,0xa285b5,0xd5aa57,0x528f89,0x954f65,0xddd6c6,0x424f68,0xb78d73,0x789fb2,0x9aab7b,0xb36845,0x72618c,0x537460,0xd49ba5,0x897965,0x4b818f];
const BOTTOMS=[0x34465e,0xd3c3a1,0x554d49,0x727e60,0x9b9388,0x463e59,0x536e78,0xb5aa94,0x7c5653,0x3c5548,0x746951,0x9b9fa9];
const ACCENTS=[0xf1e8d3,0xe5b85e,0xacc8c2,0xd89d91,0x44566d,0xb4a0c9,0xa9b985,0xd9c6ab,0x71a4bb,0x8d5a64];
const HAIR=[0x352c29,0x71503a,0xa4774d,0x4b4542,0x927b63,0x3d302c,0x955942,0xc3b6a1,0x62534b,0xb18d55];
const SKIN=[0xf0c3a4,0xe4ad8d,0xc98d6c,0xa96f55,0x80513f,0xd5a27d];
const STYLES=['hoodie','blazer','sweater','cardigan','polo','vest','rugby','overshirt'];
const PATTERNS=['plain','stripes','chest-band','piping'];
const STYLE_NAMES=['후드티','재킷','니트','카디건','폴로 셔츠','조끼','럭비 셔츠','오버셔츠'];
function mix(value){value=Math.imul(value^(value>>>16),0x45d9f3b);value=Math.imul(value^(value>>>16),0x45d9f3b);return (value^(value>>>16))>>>0;}
export const colorHex=color=>'#'+color.toString(16).padStart(6,'0');
export function staffAppearance(value=0){
  const index=Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
  let digits=index;
  const style=digits%STYLES.length;digits=Math.floor(digits/STYLES.length);
  const top=(digits+style*7)%TOPS.length;digits=Math.floor(digits/TOPS.length);
  const bottom=(digits+top*5+style*3)%BOTTOMS.length;digits=Math.floor(digits/BOTTOMS.length);
  const pattern=(digits+top+style)%PATTERNS.length;digits=Math.floor(digits/PATTERNS.length);
  const accent=(digits+bottom+style)%ACCENTS.length;digits=Math.floor(digits/ACCENTS.length);
  // Allocate facial features independently, without hash collisions between staff.
  let features=index;
  const hair=features%HAIR.length;features=Math.floor(features/HAIR.length);
  const skin=(features+hair*5)%SKIN.length;features=Math.floor(features/SKIN.length);
  const faceWidth=(features+hair*5+skin*3)%13;features=Math.floor(features/13);
  const faceHeight=(features+faceWidth*7+hair*3)%13;features=Math.floor(features/13);
  const eyeSpacing=(features+faceHeight+skin)%7;
  const seed=mix(index+1),feminine=index%5===2;
  const hairStyle=feminine?((seed>>>3)%2?'ponytail':'bob'):['short','curls','long','bun','swept'][(seed>>>3)%5];
  return {
    // Further generations vary the top instead of wrapping the wardrobe cycle.
    top:(TOPS[top]+Math.imul(digits,0x5b9e37))&0xffffff,bottom:BOTTOMS[bottom],accent:ACCENTS[accent],
    shoes:[0x473f39,0xeee6d4,0x394454,0x78583f,0x66576b,0x485b49][(seed>>>8)%6],
    style:STYLES[style],pattern:PATTERNS[pattern],detail:STYLE_NAMES[style],
    hair:HAIR[hair],skin:SKIN[skin],hairStyle,
    height:.94+((seed>>>10)%14)*.01,width:.94+((seed>>>14)%13)*.01,
    faceWidth:.94+faceWidth*.01,faceHeight:.94+faceHeight*.01,
    eyeSpacing:.104+eyeSpacing*.004,
  };
}
