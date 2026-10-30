import {readFile,mkdir,open,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DEFAULT_PREFERENCES,validatePreferences} from './public/office-preferences.js';

export function createSettingsStore(filename){
  let queue=Promise.resolve();
  async function read(){
    let overrides={};
    try{
      overrides=validatePreferences(JSON.parse(await readFile(filename,'utf8')));
      if(!overrides)throw new Error('Invalid settings file');
    }catch(error){if(error.code!=='ENOENT')throw error;}
    return {settings:{...DEFAULT_PREFERENCES,...overrides},configuredKeys:Object.keys(overrides)};
  }
  return {
    read:()=>queue.then(read),
    update(value){
      const patch=validatePreferences(value);
      if(!patch)return Promise.reject(Object.assign(new Error('Invalid settings'),{status:400}));
      const operation=queue.then(async()=>{
        const current=await read(),settings={...current.settings,...patch};
        await mkdir(path.dirname(filename),{recursive:true,mode:0o700});
        const temporary=`${filename}.${randomUUID()}.tmp`;
        try{
          const handle=await open(temporary,'wx',0o600);
          try{await handle.writeFile(`${JSON.stringify(settings,null,2)}\n`,'utf8');await handle.sync();}finally{await handle.close();}
          await rename(temporary,filename);
        }finally{await rm(temporary,{force:true});}
        return {settings,configuredKeys:Object.keys(settings)};
      });
      queue=operation.catch(()=>{});
      return operation;
    },
  };
}
