import {StaffIdentities} from './staff-identities.js';

// Both office views consume the same local snapshot and persisted staff identities.
export class OfficeLiveFeed {
  constructor({onSnapshot,onConnection,cachedRegistry={staff:{},floors:{}}}={}){this.onSnapshot=onSnapshot;this.onConnection=onConnection;this.registry=cachedRegistry;this.identities=new StaffIdentities(cachedRegistry.staff);this.stopped=false;this.pending=false;}
  async start(){
    this.onConnection?.('loading');
    try{
      const response=await fetch('/api/registry',{cache:'no-store'});if(!response.ok)throw Error('Registry unavailable');const registry=await response.json();
      if(registry.initialized)this.registry=registry;
      else{const migration=await fetch('/api/registry',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(this.registry)});if(!migration.ok)throw Error('Registry migration failed');}
      this.identities=new StaffIdentities(this.registry.staff);
    }catch(error){this.onConnection?.('offline',error);}
    await this.refresh();if(this.stopped)return;
    this.stream=new EventSource('/events');this.stream.addEventListener('office',event=>{try{this.accept(JSON.parse(event.data));}catch(error){this.onConnection?.('offline',error);}});
    this.stream.onerror=()=>this.onConnection?.('offline');
    this.poll=setInterval(()=>this.refresh(),12000);
  }
  accept(snapshot){
    if(this.stopped||!snapshot||snapshot.ready===false||!Array.isArray(snapshot.sessions))return;
    if(this.snapshot?.checkedAt&&snapshot.checkedAt<this.snapshot.checkedAt)return;
    if(snapshot.staff)this.identities.registry={...this.identities.registry,...snapshot.staff};
    const sessions=this.identities.assign(snapshot.sessions);
    this.identities.assign(snapshot.archives||[]);
    this.snapshot={...snapshot,sessions};this.onConnection?.('connected');this.onSnapshot?.(this.snapshot,this.registry);
  }
  async refresh(){
    if(this.pending||this.stopped)return;this.pending=true;
    try{const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw Error('Office unavailable');this.accept(await response.json());}catch(error){if(!this.stopped)this.onConnection?.('offline',error);}finally{this.pending=false;}
  }
  stop(){this.stopped=true;this.stream?.close();clearInterval(this.poll);}
}
