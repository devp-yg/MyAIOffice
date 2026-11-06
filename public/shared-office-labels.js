import * as THREE from './vendor/three/three.module.js';

const SVG_NS='http://www.w3.org/2000/svg';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

// Use apparent head size, with hysteresis so zooming near the boundary does
// not repeatedly expand and collapse idle labels. Work is never abbreviated;
// hover only highlights, while selection deliberately opens the full bubble.
export function labelDetail({working,selected,alwaysFull,headPixels,previous='compact'}){
  if(working||selected||alwaysFull)return 'full';
  return headPixels>=(previous==='full'?28:32)?'full':'compact';
}

export function labelConnector(anchor,box){
  const x=clamp(anchor.x,box.x,box.x+box.w),y=clamp(anchor.y,box.y,box.y+box.h);
  return {x,y,endX:anchor.x,endY:anchor.y};
}

export function followLabelAnchor(anchor,size,viewport,previousBox,previousAnchor){
  const maxX=Math.max(8,viewport.width-size.w-8);
  const maxY=Math.max(8,viewport.height-size.h-8);
  return {
    x:clamp(anchor.x+previousBox.x-previousAnchor.x,8,maxX),
    y:clamp(anchor.y+previousBox.y-previousAnchor.y,8,maxY),
    ...size,
  };
}

export function projectHead(model,camera,width,height){
  model.head.updateWorldMatrix(true,false);
  const point=model.head.localToWorld(new THREE.Vector3(0,.44,0)).applyMatrix4(camera.matrixWorldInverse);
  const verticalSpan=camera.isPerspectiveCamera?-2*point.z/camera.projectionMatrix.elements[5]:camera.top-camera.bottom;
  point.applyMatrix4(camera.projectionMatrix);
  const scale=model.head.getWorldScale(new THREE.Vector3());
  return {
    anchor:{x:(point.x+1)*width/2,y:(1-point.y)*height/2},
    visible:point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1,
    headPixels:.7*Math.max(scale.x,scale.y,scale.z)*height/verticalSpan,
  };
}

export function placeLabel(anchor,size,viewport,placed=[],previous=-1){
  const {w,h}=size,padding=8,gap=16;
  const maxX=Math.max(padding,viewport.width-w-padding);
  const maxY=Math.max(padding,viewport.height-h-padding);
  // Prefer directly above. A nearby side or the space below can fit a tall
  // bubble near an edge or next to another character.
  const candidates=[
    [0,-h-gap],[0,-h-gap-42],[0,gap],
    [-w/2-gap,-h/2],[w/2+gap,-h/2],
    [-w*.35,-h-gap],[w*.35,-h-gap],
  ];
  let best;
  candidates.forEach(([dx,dy],index)=>{
    const box={x:clamp(anchor.x-w/2+dx,padding,maxX),y:clamp(anchor.y+dy,padding,maxY),w,h};
    const connector=labelConnector(anchor,box),distance=Math.hypot(connector.x-anchor.x,connector.y-anchor.y);
    let overlap=0;
    for(const other of placed){
      const iw=Math.max(0,Math.min(box.x+w,other.x+other.w)-Math.max(box.x,other.x));
      const ih=Math.max(0,Math.min(box.y+h,other.y+other.h)-Math.max(box.y,other.y));
      overlap+=iw*ih/Math.max(1,Math.min(w*h,other.w*other.h));
    }
    const score=overlap*300+distance+(index===0?0:8)+(previous>=0&&index!==previous?12:0);
    if(!best||score<best.score)best={box,index,score,connector};
  });
  return best;
}

export class SharedOfficeLabels {
  constructor(layer){
    this.layer=layer;this.entries=new Map();
    this.svg=document.createElementNS(SVG_NS,'svg');this.svg.classList.add('study-label-connectors');
    this.svg.setAttribute('aria-hidden','true');layer.prepend(this.svg);
  }
  add(label,{model,name,working,showMetadata=()=>true,alwaysFull=false,selected=()=>false,visible=()=>true,summary=()=> '☾ 휴식'}){
    const group=document.createElementNS(SVG_NS,'g'),line=document.createElementNS(SVG_NS,'path'),dot=document.createElementNS(SVG_NS,'circle');
    dot.setAttribute('r','2.5');group.append(line,dot);this.svg.append(group);
    const brief=document.createElement('span');brief.className='study-agent-summary';label.append(brief);
    const interactive=label.tagName==='BUTTON';
    const nameplate=document.createElement(interactive?'button':'span');
    nameplate.className='study-nameplate';
    nameplate.hidden=true;
    if(interactive){
      nameplate.type='button';
      nameplate.addEventListener('click',()=>label.click());
      label.tabIndex=-1;
    }
    this.layer.append(nameplate);
    if(!label.style.getPropertyValue('--project'))label.style.setProperty('--project','#789063');
    label.classList.add('anchored');
    const entry={label,model,name,nameplate,interactive,working,showMetadata,alwaysFull,selected,visible,summary,group,line,dot,brief,detail:'compact',previous:-1,box:null,anchor:null,size:null,viewport:null,hover:false,focus:false};
    entry.enter=()=>{entry.hover=true;};entry.leave=()=>{entry.hover=false;};
    entry.focusIn=()=>{entry.focus=true;};entry.focusOut=()=>{entry.focus=false;};
    label.addEventListener('pointerenter',entry.enter);label.addEventListener('pointerleave',entry.leave);
    label.addEventListener('focusin',entry.focusIn);label.addEventListener('focusout',entry.focusOut);
    this.entries.set(label,entry);
  }
  remove(label){
    const entry=this.entries.get(label);if(!entry)return;
    label.removeEventListener('pointerenter',entry.enter);label.removeEventListener('pointerleave',entry.leave);
    label.removeEventListener('focusin',entry.focusIn);label.removeEventListener('focusout',entry.focusOut);
    entry.group.remove();entry.brief.remove();entry.nameplate.remove();this.entries.delete(label);
  }
  update(camera,width,height,showLabels){
    const items=[],nameplates=[],worldPoint=new THREE.Vector3();
    for(const entry of this.entries.values()){
      const {label,nameplate}=entry,model=entry.model();
      label.hidden=!showLabels||!entry.visible()||!model?.root.visible;
      entry.group.style.display='none';
      if(label.hidden){nameplate.hidden=true;continue;}
      const selected=entry.selected(),isWorking=entry.working();
      const feet=model.root.getWorldPosition(worldPoint).project(camera);
      nameplate.hidden=Math.abs(feet.x)>1||Math.abs(feet.y)>1||Math.abs(feet.z)>1;
      if(!nameplate.hidden){
        const name=entry.name();
        if(nameplate.textContent!==name)nameplate.textContent=name;
        nameplate.classList.toggle('selected',selected);
        if(entry.interactive){
          const description=label.getAttribute('aria-label')||name;
          if(nameplate.getAttribute('aria-label')!==description)nameplate.setAttribute('aria-label',description);
        }
        nameplates.push({nameplate,x:(feet.x+1)*width/2,y:(1-feet.y)*height/2+5});
      }
      // Updating parents first includes seats, body animation, scale and the
      // executive suite's parent transform before the renderer runs.
      const {anchor,visible,headPixels}=projectHead(model,camera,width,height);
      label.hidden=!visible;
      if(label.hidden)continue;
      const engaged=entry.hover||entry.focus;
      entry.detail=labelDetail({working:isWorking,selected,alwaysFull:entry.alwaysFull,headPixels,previous:entry.detail});
      label.dataset.detail=entry.detail;label.dataset.working=String(isWorking);
      label.dataset.metadata=String(entry.showMetadata());
      label.classList.toggle('engaged',engaged);
      const brief=entry.summary();if(entry.brief.textContent!==brief)entry.brief.textContent=brief;
      label.style.maxWidth=`${Math.max(1,Math.min(entry.detail==='compact'?175:isWorking||selected?260:220,width-16))}px`;
      label.style.maxHeight=`${Math.max(1,height-16)}px`;
      items.push({entry,anchor,priority:selected?3:isWorking?1:0,viewport:{width,height}});
    }
    // Read sizes together after updating presentation, avoiding a write/read
    // layout flush for every character.
    for(const item of items)item.size={w:item.entry.label.offsetWidth,h:item.entry.label.offsetHeight};
    for(const item of nameplates){
      item.w=item.nameplate.offsetWidth;
      item.h=item.nameplate.offsetHeight;
      item.x=clamp(item.x-item.w/2,2,Math.max(2,width-item.w-2));
      item.y=Math.min(item.y,Math.max(0,height-item.h-2));
    }
    for(const {nameplate,x,y} of nameplates){
      nameplate.style.left=`${x}px`;
      nameplate.style.top=`${y}px`;
    }
    const stable=[],moving=[];
    for(const item of items){
      const {entry,anchor,size,viewport}=item;
      const canKeep=entry.box&&entry.size?.w===size.w&&entry.size?.h===size.h&&entry.viewport?.width===width&&entry.viewport?.height===height;
      (canKeep?stable:moving).push(item);
    }
    // Preserve each bubble's screen offset from its owner. Camera movement
    // carries labels along without repacking neighbours.
    for(const item of stable){
      const {entry,anchor,viewport}=item;
      item.box=followLabelAnchor(anchor,entry.size,viewport,entry.box,entry.anchor);
    }
    const placed=[...nameplates,...stable.map(item=>item.box)];
    moving.sort((a,b)=>b.priority-a.priority);
    for(const item of moving){
      const {entry,anchor,size,priority,viewport}=item;
      const result=placeLabel(anchor,size,viewport,placed,entry.previous),{box,connector}=result;
      entry.previous=result.index;entry.box=box;entry.size=size;entry.anchor=anchor;entry.viewport=viewport;placed.push(box);
      entry.label.style.left=`${box.x}px`;entry.label.style.top=`${box.y}px`;
      entry.group.style.display='';entry.group.style.setProperty('--project',entry.label.style.getPropertyValue('--project')||'#789063');
      entry.group.classList.toggle('highlighted',priority>=2);
      entry.line.setAttribute('d',`M ${connector.x} ${connector.y} L ${connector.endX} ${connector.endY}`);
      entry.dot.setAttribute('cx',anchor.x);entry.dot.setAttribute('cy',anchor.y);
      if(priority>=2)this.svg.append(entry.group);
    }
    for(const {entry,anchor,priority,box}of stable){
      const connector=labelConnector(anchor,box);
      entry.label.style.left=`${box.x}px`;entry.label.style.top=`${box.y}px`;
      entry.group.style.display='';entry.group.style.setProperty('--project',entry.label.style.getPropertyValue('--project')||'#789063');
      entry.group.classList.toggle('highlighted',priority>=2);
      entry.line.setAttribute('d',`M ${connector.x} ${connector.y} L ${connector.endX} ${connector.endY}`);
      entry.dot.setAttribute('cx',anchor.x);entry.dot.setAttribute('cy',anchor.y);
    }
  }
  destroy(){for(const label of this.entries.keys())this.remove(label);this.svg.remove();}
}
