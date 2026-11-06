import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionSummary} from '../server-records.mjs';
import {SharedOfficeOccupancy,sharedRoom} from '../public/shared-office-state.js';

const event=(type,fields)=>({type:'event_msg',payload:{type,...fields}});
const request=text=>({
  type:'response_item',
  payload:{type:'message',role:'user',content:[{type:'input_text',text}]},
});
const exec=cmd=>({
  type:'response_item',
  payload:{type:'function_call',name:'exec_command',arguments:JSON.stringify({cmd})},
});
const wrappedExec=input=>({type:'response_item',payload:{type:'custom_tool_call',name:'exec',input}});
const start=event('task_started');
const done=event('task_complete');

function summarize(records,previous){
  const mtime=Date.now();
  const lines=records.map((record,index)=>JSON.stringify({
    timestamp:new Date(mtime+index*10).toISOString(),...record,
  }));
  return sessionSummary(lines,{id:'test-chat',cwd:'/project'},{mtime},previous);
}

test('a review keeps its meeting seat while reading and running tests, then vacates it',()=>{
  const review=request('이 PR 코드 리뷰해 줘');
  const reading=summarize([start,review,exec('rg -n handler src')]);
  const testing=summarize([start,review,exec('npm test')]);
  const polling=summarize([start,review,exec('npm test'),{
    type:'response_item',payload:{type:'function_call',name:'write_stdin',arguments:'{}'},
  }]);
  const office=new SharedOfficeOccupancy();
  const seatOf=session=>office.update([session],[]).assignments[0].seat;

  assert.equal(reading.label,'파일과 자료 확인 중');
  assert.equal(testing.label,'테스트를 실행 중');
  assert.equal(seatOf(reading).room,'meeting');
  assert.equal(seatOf(testing).id,seatOf(reading).id);
  assert.equal(seatOf(polling).room,'meeting');
  assert.equal(seatOf(summarize([start,review,done])).room,'desk');
});

test('a review hands off to normal tool-based routing when code edits start',()=>{
  const before=[start,request('Review this change and fix any bugs.'),exec('git diff')];
  const edit=wrappedExec('text(await tools.apply_patch(patch));');
  assert.equal(sharedRoom(summarize(before)),'meeting');
  assert.equal(sharedRoom(summarize([...before,edit])),'studio');
  assert.equal(sharedRoom(summarize([...before,edit,exec('npm test')])),'server');
  assert.equal(sharedRoom(summarize([start,request('회의검토실 표시를 수정해 줘'),exec('rg 회의 public')])),'library');
});

test('plan requests and Plan mode reserve the room, and a later turn starts fresh',()=>{
  const plan=event('user_message',{message:'음... 대책을 세워봐'});
  const planned=summarize([start,plan]);
  assert.equal(planned.label,'계획을 정리 중');
  assert.equal(sharedRoom(planned),'meeting');
  assert.equal(sharedRoom(summarize([event('task_started',{collaboration_mode_kind:'plan'}),request('로그인 개선'),exec('rg login')])),'meeting');
  assert.equal(sharedRoom(summarize([start,request('버그를 고쳐 줘'),exec('rg login')],planned)),'library');
});

test('a long review survives a rolling log window and releases the room on cancellation',()=>{
  const reading=summarize([start,request('/review'),exec('rg handler')]);
  const testing=summarize([exec('npm test')],reading);
  assert.equal(sharedRoom(testing),'meeting');
  const cancelled=summarize([event('turn_aborted')],testing);
  assert.equal(sharedRoom(cancelled),'desk');
  assert.equal(cancelled.active,false);
  assert.equal(cancelled.aborted,true);
});
