// Keep the full-screen behavior and its keyboard escape consistent in both views.
export function bindOfficeExpansion({stage,button,onResize}){
  const active=()=>document.fullscreenElement===stage||document.webkitFullscreenElement===stage;
  function sync(){
    const fallback=stage.classList.contains('stage-expanded'),expanded=fallback||active();
    document.body.classList.toggle('stage-expanded',fallback);
    button.setAttribute('aria-pressed',String(expanded));
    button.setAttribute('aria-label',expanded?'Live 전체 화면 닫기':'Live 전체 화면으로 확대');
    button.title=button.getAttribute('aria-label');button.textContent=expanded?'⤢':'⛶';
    requestAnimationFrame(()=>onResize?.());
  }
  async function toggle(){
    if(stage.classList.contains('stage-expanded')){stage.classList.remove('stage-expanded');sync();button.focus();return;}
    if(active()){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);sync();return;}
    const request=stage.requestFullscreen||stage.webkitRequestFullscreen;
    if(request){try{await request.call(stage);}catch{stage.classList.add('stage-expanded');}}
    else stage.classList.add('stage-expanded');
    sync();
  }
  button.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&stage.classList.contains('stage-expanded')){stage.classList.remove('stage-expanded');sync();button.focus();}
  });
}
