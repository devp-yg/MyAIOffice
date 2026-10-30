import {staffAppearance,colorHex} from './staff-appearance.js';
// Vector portraits for the team list; the office itself is rendered in 3D.
const ellipse = (x,y,rx,ry,fill) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
function outfitSvg(look){
 const accent=colorHex(look.accent),top=colorHex(look.top),dark=colorHex(look.bottom);
 let detail='';
 if(look.style==='hoodie')detail=`<path d="M26 59q14 12 28 0M36 62v12m8-12v12" fill="none" stroke="${accent}" stroke-width="2"/><rect x="29" y="76" width="22" height="7" rx="3" fill="${accent}"/>`;
 if(look.style==='blazer'||look.style==='vest')detail=`<path d="m30 58 10 5 10-5-10 25Z" fill="${accent}"/><path d="m29 58 11 17-6-4-6-7m23-6L40 75l6-4 6-7" fill="${top}" stroke="${dark}" stroke-width="1"/>`;
 if(look.style==='sweater')detail=`<path d="M31 58q9 7 18 0m-21 23h24m-20-3v6m5-6v6m6-6v6m5-6v6" fill="none" stroke="${accent}" stroke-width="2"/>`;
 if(look.style==='cardigan')detail=`<path d="M40 59v26" stroke="${accent}" stroke-width="4"/><g fill="${dark}"><circle cx="40" cy="66" r="1.2"/><circle cx="40" cy="73" r="1.2"/><circle cx="40" cy="80" r="1.2"/></g>`;
 if(look.style==='polo')detail=`<path d="m30 58 10 4-5 7Zm20 0-10 4 5 7Z" fill="${accent}"/><path d="M40 63v11" stroke="${accent}" stroke-width="2"/>`;
 if(look.style==='rugby')detail=`<path d="M23 69h34m-33 11h32" stroke="${accent}" stroke-width="5"/><path d="m31 58 9 4 9-4" fill="none" stroke="${accent}" stroke-width="3"/>`;
 if(look.style==='overshirt')detail=`<path d="M40 58v27" stroke="${accent}" stroke-width="2"/><path d="M27 67h9v8h-9Zm17 0h9v8h-9Z" fill="${accent}" stroke="${dark}"/>`;
 if(look.pattern==='stripes')detail+=`<path d="M23 68h34m-34 5h34m-33 5h32" stroke="${accent}" stroke-width="1.5"/>`;
 if(look.pattern==='chest-band')detail+=`<path d="M23 73h34" stroke="${accent}" stroke-width="4"/>`;
 if(look.pattern==='piping')detail+=`<path d="M25 63v18m30-18v18" stroke="${accent}" stroke-width="2"/>`;
 return detail;
}
export function characterSvg(room='studio',options={}){
const look=staffAppearance(options.index),coat=colorHex(look.top),shade=colorHex(look.accent),hair=colorHex(look.hair),skin=colorHex(look.skin),bottom=colorHex(look.bottom),shoes=colorHex(look.shoes),hairStyle=look.hairStyle;
const hairShape=hairStyle==='swept'?`<path d="M14 39V32q0-17 26-17t26 17v8l-7-11q-11 7-25-1L21 39l-1-8Z" fill="${hair}"/><path d="M27 24q18-13 32 4L39 39Z" fill="${hair}"/>`:hairStyle==='bob'?`<path d="M14 40V31q0-17 26-17t26 17v21q-8 10-14 1l-2-15q-10 5-23-1L21 54q-6 7-7-2Z" fill="${hair}"/>`:hairStyle==='ponytail'?`<path d="M14 39V31q0-17 26-17t26 17v8l-7-10q-12 7-25-1L21 39l-1-7Z" fill="${hair}"/><path d="M59 30q13 6 8 23l-6 8-5-2 4-13-5-8Z" fill="${hair}"/><circle cx="58" cy="37" r="3" fill="#e4c36f"/>`:hairStyle==='curls'?`<g fill="${hair}">${Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return `<circle cx="${40+Math.cos(a)*19}" cy="${28+Math.sin(a)*10}" r="7"/>`;}).join('')}</g><path d="M14 39V31q0-17 26-17t26 17v8l-8-9q-12 7-25-1L21 39l-1-7Z" fill="${hair}"/>`:hairStyle==='long'?`<path d="M14 40V31q0-17 26-17t26 17v34q-7 7-13 0l-2-24q-12 5-24-1l-2 25q-7 7-12 0Z" fill="${hair}"/>`:hairStyle==='bun'?`<path d="M14 40V31q0-17 26-17t26 17v8l-7-10q-12 7-25-1L21 39l-1-7Z" fill="${hair}"/><circle cx="40" cy="11" r="8" fill="${hair}"/><circle cx="40" cy="10" r="2.5" fill="#e4c36f"/>`:`<path d="M14 39V32q0-17 26-17t26 17v8l-7-11q-11 7-25-1L21 39l-1-8Z" fill="${hair}"/>`;
const idle=options.idle, error=options.error;
const eyeOffset=(look.eyeSpacing-.115)*70;
const eyes=(idle?'<path d="M27 43q4-4 8 0m10 0q4-4 8 0" stroke="#5c5243" stroke-width="2.4" fill="none"/>':'<g class="blink"><ellipse cx="31" cy="42" rx="2.6" ry="3.5" fill="#514d40"/><ellipse cx="49" cy="42" rx="2.6" ry="3.5" fill="#514d40"/><circle cx="32" cy="41" r=".7" fill="#fff"/><circle cx="50" cy="41" r=".7" fill="#fff"/></g>').replaceAll('cx="31"',`cx="${31-eyeOffset}"`).replaceAll('cx="49"',`cx="${49+eyeOffset}"`).replaceAll('cx="32"',`cx="${32-eyeOffset}"`).replaceAll('cx="50"',`cx="${50+eyeOffset}"`);
let prop='';
if(idle){prop='<g><rect x="30" y="65" width="22" height="16" rx="5" fill="#fff7e4"/><path d="M52 68q10-1 7 7h-7" fill="none" stroke="#fff7e4" stroke-width="3"/><path class="steam" d="M36 59q-4-4 0-7m9 7q-4-4 0-7" fill="none" stroke="#d0c3a4" stroke-width="1.5"/></g>';}
else if(room==='library'){prop='<path d="m22 64 18 3 18-3v19l-18 4-18-4Z" fill="#fff9e5" stroke="#c7b07f" stroke-width="1"/><path d="M40 67v20m-13-18 9 2m8 0 9-2m-26 6 9 2m8 0 9-2" stroke="#c9b795" stroke-width="1"/>';}
else if(room==='meeting'){prop='<rect x="26" y="62" width="29" height="23" rx="3" fill="#fbf6e5"/><rect x="34" y="60" width="13" height="5" rx="2" fill="#c8b894"/><path d="M32 71h17m-17 5h13m-13 5h16" stroke="#b7b399" stroke-width="1.5"/>';}
else if(room==='research'){prop='<circle cx="49" cy="67" r="9" fill="#c1e0cd" fill-opacity=".8" stroke="#5c8170" stroke-width="3"/><path d="m43 74-8 10" stroke="#6e8d75" stroke-width="5" stroke-linecap="round"/>';}
else {prop=`<rect x="21" y="65" width="38" height="22" rx="4" fill="${shade}"/><path d="M18 86h44" stroke="#dce1ca" stroke-width="3" stroke-linecap="round"/><path d="m35 73-4 3 4 3m10-6 4 3-4 3" stroke="#edf1d8" stroke-width="1.5" fill="none"/>`;}
const glasses=options.accessory==='glasses'?'<g fill="none" stroke="#766383" stroke-width="1.7"><rect x="24" y="36" width="15" height="12" rx="5"/><rect x="42" y="36" width="15" height="12" rx="5"/><path d="M39 40h3"/></g>':'';
const accessories={
 beanie:'<path d="M15 28q0-23 25-23t25 23Z" fill="#73874f"/><rect x="15" y="23" width="50" height="8" rx="3" fill="#b3c18e"/><circle cx="40" cy="5" r="5" fill="#c7d0a9"/>',
 cap:'<path d="M15 27q0-20 25-20t25 20Z" fill="#cba551"/><path d="M32 26h37q9 7-3 8H32Z" fill="#b48e42"/>',
 headphones:`<path d="M12 39V27q3-17 28-17t28 17v12" fill="none" stroke="${shade}" stroke-width="5"/><rect x="9" y="33" width="9" height="17" rx="4" fill="${shade}"/><rect x="62" y="33" width="9" height="17" rx="4" fill="${shade}"/>`,
 scarf:'<path d="M22 59q18 8 36 0v9q-18 6-36 0Z" fill="#539181"/><rect x="46" y="64" width="9" height="18" rx="2" fill="#72a895"/>',
 bowtie:'<path d="m30 61 10 5 10-5v13l-10-5-10 5Z" fill="#436a87"/>',
 freckles:'<g fill="#b58d65"><circle cx="24" cy="44" r="1"/><circle cx="27" cy="47" r="1"/><circle cx="21" cy="47" r="1"/><circle cx="56" cy="44" r="1"/><circle cx="53" cy="47" r="1"/><circle cx="59" cy="47" r="1"/></g>'
}[options.accessory]||'';
return `<svg class="chibi" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ellipse(40,94,24,5,'#354b3520')}<rect class="foot left" x="25" y="81" width="12" height="12" rx="5" fill="${shoes}"/><rect class="foot right" x="44" y="81" width="12" height="12" rx="5" fill="${shoes}"/><g class="breathing"><path d="M26 79v10h11V79m7 0v10h11V79" fill="${bottom}"/><rect x="22" y="57" width="36" height="29" rx="13" fill="${coat}"/>${outfitSvg(look)}<rect x="33" y="53" width="14" height="12" rx="5" fill="${skin}"/><g transform="translate(40 40) scale(${look.faceWidth} ${look.faceHeight}) translate(-40 -40)">${ellipse(14,43,4,7,skin)}${ellipse(66,43,4,7,skin)}<rect x="15" y="19" width="50" height="43" rx="21" fill="${skin}"/>${hairShape}${eyes}${ellipse(23,47,4.2,2.5,'#edb5a4')}${ellipse(57,47,4.2,2.5,'#edb5a4')}<path d="${error?'M36 52q4-4 8 0':'M36 50q4 5 8 0'}" stroke="#a37f62" stroke-width="1.5" fill="none" stroke-linecap="round"/>${glasses}${accessories}</g><ellipse class="working-hand" cx="22" cy="71" rx="7" ry="9" fill="${skin}"/><ellipse class="working-hand" cx="58" cy="71" rx="7" ry="9" fill="${skin}"/>${prop}${error?'<path d="M66 31q-9 9-2 11 8 0 2-11" fill="#9ac9d9"/>':''}</g></svg>`;
}
