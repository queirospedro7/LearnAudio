import {MsEdgeTTS} from 'msedge-tts';
import {standardVoices} from './voices.js';
export function europeanEdgeVoices(rows){
 const found=new Map();for(const v of rows){if(v.Locale!=='pt-PT'||!/^pt-PT-[A-Za-z0-9:_-]+$/.test(v.ShortName||''))continue;
 found.set(v.ShortName,{id:v.ShortName,name:v.ShortName.replace(/^pt-PT-/,'').replace(/Neural$/,''),gender:v.Gender==='Female'?'Feminina':v.Gender==='Male'?'Masculina':'Voz online',provider:'edge',european:true,available:true,verified:true});}return [...found.values()];
}
let snapshot=null,expires=0,inFlight=null;
export async function edgeCatalogue(){
 if(snapshot&&Date.now()<expires)return snapshot;if(inFlight)return inFlight;
 inFlight=(async()=>{const tts=new MsEdgeTTS();let timer;
 try{const rows=await Promise.race([tts.getVoices(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000);})]);const voices=europeanEdgeVoices(rows);if(!voices.length)throw Error('empty');snapshot=voices;expires=Date.now()+3600000;}
 catch{snapshot=snapshot||standardVoices.map(v=>({...v,available:true,european:true,verified:false}));expires=Date.now()+60000;}
 finally{clearTimeout(timer);tts.close();inFlight=null;}return snapshot;})();return inFlight;
}
