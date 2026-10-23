import * as THREE from './vendor/three/three.module.js';

const SVG_NS='http://www.w3.org/2000/svg';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

// Use apparent head size, with hysteresis so zooming near the boundary does
// not repeatedly expand and collapse idle labels. Work is never abbreviated;
// hover only highlights, while selection deliberately opens the full bubble.
export function labelDetail({working,selected,headPixels,previous='compact'}){
  if(working||selected)return 'full';
  return headPixels>=(previous==='full'?28:32)?'full':'compact';
}

export function labelConnector(anchor,box){
  const x=clamp(anchor.x,box.x,box.x+box.w),y=clamp(anchor.y,box.y,box.y+box.h);
  return {x,y,endX:anchor.x,endY:anchor.y};
}

export function followLabelAnchor(anchor,size,viewport,previousBox,previousAnchor){
  const maxX=Math.max(8,viewport.width-size.w-8),maxY=Math.max(8,viewport.height-size.h-8);
  return {x:clamp(anchor.x+previousBox.x-previousAnchor.x,8,maxX),y:clamp(anchor.y+previousBox.y-previousAnchor.y,8,maxY),...size};
}

export function projectHead(model,camera,width,height){
  model.head.updateWorldMatrix(true,false);
  const point=model.head.localToWorld(new THREE.Vector3(0,.44,0)).project(camera);
  const scale=model.head.getWorldScale(new THREE.Vector3());
  return {
    anchor:{x:(point.x+1)*width/2,y:(1-point.y)*height/2},
    visible:point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1,
    headPixels:.7*Math.max(scale.x,scale.y,scale.z)*height/(camera.top-camera.bottom),
  };
}

export function placeLabel(anchor,size,viewport,placed=[],previous=-1){
  const {w,h}=size,padding=8;
  const maxX=Math.max(padding,viewport.width-w-padding),maxY=Math.max(padding,viewport.height-h-padding);
  // Search only in the immediate neighbourhood, never across the whole office.
  const candidates=[[0,-12],[-36,-12],[36,-12],[-72,-12],[72,-12],[0,-44],[-48,-44],[48,-44],
    [-w/2-12,h/2],[w/2+12,h/2],[0,h+12]];
  let best;
  candidates.forEach(([dx,dy],index)=>{
    const box={x:clamp(anchor.x-w/2+dx,padding,maxX),y:clamp(anchor.y-h+dy,padding,maxY),w,h};
    const connector=labelConnector(anchor,box),distance=Math.hypot(connector.x-anchor.x,connector.y-anchor.y);
    let overlap=0;
    for(const other of placed){
      const iw=Math.max(0,Math.min(box.x+w,other.x+other.w)-Math.max(box.x,other.x));
      const ih=Math.max(0,Math.min(box.y+h,other.y+other.h)-Math.max(box.y,other.y));
      overlap+=iw*ih/Math.max(1,Math.min(w*h,other.w*other.h));
    }
    const score=overlap*300+distance+Math.hypot(dx,dy+12)*.18+(previous>=0&&index!==previous?12:0);
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
  add(label,{model,working,selected=()=>false,visible=()=>true,summary=()=> '☾ 휴식'}){
    const group=document.createElementNS(SVG_NS,'g'),line=document.createElementNS(SVG_NS,'path'),dot=document.createElementNS(SVG_NS,'circle');
    dot.setAttribute('r','2.5');group.append(line,dot);this.svg.append(group);
    const brief=document.createElement('span');brief.className='study-agent-summary';label.append(brief);
    if(!label.style.getPropertyValue('--project'))label.style.setProperty('--project','#789063');
    label.classList.add('anchored');
    const entry={label,model,working,selected,visible,summary,group,line,dot,brief,detail:'compact',previous:-1,box:null,anchor:null,size:null,viewport:null,hover:false,focus:false};
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
    entry.group.remove();entry.brief.remove();this.entries.delete(label);
  }
  update(camera,width,height,showLabels){
    const items=[];
    for(const entry of this.entries.values()){
      const {label}=entry,model=entry.model();
      label.hidden=!showLabels||!entry.visible()||!model?.root.visible;
      entry.group.style.display='none';if(label.hidden)continue;
      // Updating parents first includes seats, body animation, scale and the
      // executive suite's parent transform before the renderer runs.
      const {anchor,visible,headPixels}=projectHead(model,camera,width,height);
      label.hidden=!visible;
      if(label.hidden)continue;
      const selected=entry.selected(),engaged=entry.hover||entry.focus,isWorking=entry.working();
      entry.detail=labelDetail({working:isWorking,selected,headPixels,previous:entry.detail});
      label.dataset.detail=entry.detail;label.dataset.working=String(isWorking);
      label.classList.toggle('engaged',engaged);
      const brief=entry.summary();if(entry.brief.textContent!==brief)entry.brief.textContent=brief;
      label.style.maxWidth=`${Math.max(1,Math.min(entry.detail==='compact'?150:isWorking?220:170,width-16))}px`;
      label.style.maxHeight=`${Math.max(1,height-16)}px`;
      items.push({entry,anchor,priority:selected?3:isWorking?1:0,viewport:{width,height}});
    }
    // Read sizes together after updating presentation, avoiding a write/read
    // layout flush for every character.
    for(const item of items)item.size={w:item.entry.label.offsetWidth,h:item.entry.label.offsetHeight};
    const stable=[],moving=[];
    for(const item of items){
      const {entry,anchor,size,viewport}=item;
      const canKeep=entry.box&&entry.size?.w===size.w&&entry.size?.h===size.h&&entry.viewport?.width===width&&entry.viewport?.height===height;
      (canKeep?stable:moving).push(item);
    }
    // Preserve each bubble's screen offset from its owner. Camera movement
    // carries labels along without repacking neighbours.
    const placed=stable.map(item=>item.entry.box);
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
    for(const {entry,anchor,priority}of stable){
      const box=followLabelAnchor(anchor,entry.size,{width,height},entry.box,entry.anchor),connector=labelConnector(anchor,box);
      entry.box=box;entry.anchor=anchor;entry.label.style.left=`${box.x}px`;entry.label.style.top=`${box.y}px`;
      entry.group.style.display='';entry.group.style.setProperty('--project',entry.label.style.getPropertyValue('--project')||'#789063');
      entry.group.classList.toggle('highlighted',priority>=2);
      entry.line.setAttribute('d',`M ${connector.x} ${connector.y} L ${connector.endX} ${connector.endY}`);
      entry.dot.setAttribute('cx',anchor.x);entry.dot.setAttribute('cy',anchor.y);
    }
  }
  destroy(){for(const label of this.entries.keys())this.remove(label);this.svg.remove();}
}
