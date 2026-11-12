import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access,rename,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'data','voices');
const piperDir=path.join(base,'piper');
const piperExe=path.join(piperDir,'piper','piper.exe');
const model=path.join(piperDir,'tugao.onnx');
const kokoroDir=path.join(base,'kokoro');
const portableDir=path.join(kokoroDir,'python');
let python=path.join(kokoroDir,'venv','Scripts','python.exe');
export const localDefinitions=[{id:'local:piper-tugao',name:'Tug\u00e3o',gender:'Voz local',provider:'piper',license:'MIT / dataset CC0',source:'https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_PT/tug%C3%A3o/medium/MODEL_CARD'},{id:'local:kokoro-tuga',name:'Tuga (Kokoro)',gender:'Voz local',provider:'kokoro',license:'Apache-2.0',source:'https://huggingface.co/logus2k/kokoro_tts_eu_pt'}];
const jobs=new Map();
const exists=async file=>{try{await access(file);return true;}catch{return false;}};
if(!(await exists(python))&&await exists(path.join(portableDir,'python.exe')))python=path.join(portableDir,'python.exe');
export function runProcess(command,args,{input='',cwd=root,timeout=180000,env={}}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:{...process.env,...env},windowsHide:true,stdio:['pipe','pipe','pipe']});let log='';let settled=false;
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){error.details=log;reject(error);}else resolve(log);};
  const timer=setTimeout(()=>{child.kill();finish(Error('A opera\u00e7\u00e3o demorou demasiado. Tenta novamente.'));},timeout);
  child.on('error',()=>finish(Error('N\u00e3o foi poss\u00edvel abrir o motor de voz.')));
  child.stdout.on('data',d=>{log=(log+d.toString()).slice(-12000);});child.stderr.on('data',d=>{log=(log+d.toString()).slice(-12000);});
  child.on('close',code=>finish(code===0?null:Error('O motor de voz terminou com erro. Consulta data/voices/install.log.')));
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
async function download(url,file,maxBytes){
 const res=await fetch(url,{signal:AbortSignal.timeout(600000)});if(!res.ok||!res.body)throw Error('N\u00e3o foi poss\u00edvel descarregar os ficheiros da voz.');
 if(Number(res.headers.get('content-length'))>maxBytes)throw Error('O ficheiro excede o tamanho esperado.');
 let bytes=0;const part=file+'.part';
 try{await pipeline(Readable.fromWeb(res.body),new Transform({transform(chunk,encoding,cb){bytes+=chunk.length;cb(bytes>maxBytes?Error('Ficheiro demasiado grande.'):null,chunk);}}),createWriteStream(part));await rename(part,file);}catch(e){await rm(part,{force:true});throw e;}
}
export async function localCatalogue(){return Promise.all(localDefinitions.map(async v=>{const job=jobs.get(v.provider);const marker=await exists(path.join(base,v.provider,'ready.json'));const files=v.provider==='piper'?await exists(piperExe)&&await exists(model)&&await exists(model+'.json'):await exists(python)&&await exists(path.join(kokoroDir,'model','tuga_kokoro.pth'))&&await exists(path.join(kokoroDir,'model','tuga_voicepack.pt'));const ready=marker&&files;return {...v,available:ready,european:true,installed:ready,state:job?.state||(ready?'ready':'missing'),message:job?.message||''};}));}
export function validWav(buffer){return buffer.length>44&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WAVE';}
export async function localSynthesize(id,text,rate,out){
 if(id==='local:piper-tugao')await runProcess(piperExe,['--model',model,'--config',model+'.json','--output_file',out,'--length_scale',String(1/rate)],{input:text+'\n',cwd:path.dirname(piperExe)});
 else if(id==='local:kokoro-tuga')await runProcess(python,['-X','utf8',path.join(root,'scripts','kokoro.py')],{input:JSON.stringify({text,out,cache:kokoroDir}),timeout:300000,env:{PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
 else throw Error('Voz local desconhecida.');
 const audio=await readFile(out);if(!validWav(audio))throw Error('O motor n\u00e3o gerou um ficheiro WAV v\u00e1lido.');return audio;
}
async function installPiper(){
 if(process.platform!=='win32'||process.arch!=='x64')throw Error('O instalador Piper inclu\u00eddo requer Windows de 64 bits.');
 await mkdir(piperDir,{recursive:true});
 jobs.set('piper',{state:'installing',message:'A descarregar o motor Piper e o modelo Tug\u00e3o\u2026'});
 const archive=path.join(piperDir,'piper.zip');
 await download('https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',archive,150*1024*1024);
 // Paths are fixed workspace paths passed as arguments, never shell-built from user input.
 await runProcess('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:AUDIO_ARCHIVE -DestinationPath $env:AUDIO_DESTINATION -Force'],{env:{AUDIO_ARCHIVE:archive,AUDIO_DESTINATION:piperDir}});
 const url='https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_PT/tug%C3%A3o/medium/pt_PT-tug%C3%A3o-medium.onnx';
 await download(url,model,150*1024*1024);await download(url+'.json',model+'.json',2*1024*1024);
 await download('https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_PT/tug%C3%A3o/medium/MODEL_CARD',path.join(piperDir,'MODEL_CARD'),100000);
 await localSynthesize('local:piper-tugao','Ol\u00e1. Esta \u00e9 uma voz de Portugal.',1,path.join(piperDir,'test.wav'));
}
async function installKokoro(){
 await mkdir(kokoroDir,{recursive:true});
 let reusable=false;if(await exists(python)){try{await runProcess(python,['-X','utf8','-c','import tts_eu_pt, torch, soundfile'],{timeout:90000});reusable=true;}catch{}}
 if(!reusable){
 let runtime;
 for(const [cmd,args] of [['py',['-3.12']],['py',['-3.11']],['python',[]],['python3',[]]]){try{await runProcess(cmd,[...args,'-c','import sys; assert (3,10) <= sys.version_info[:2] <= (3,12)'],{timeout:15000});runtime={cmd,args};break;}catch{}}
 if(!runtime){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('A prepara\u00e7\u00e3o autom\u00e1tica de Python requer Windows x64.');
  jobs.set('kokoro',{state:'installing',message:'A preparar Python privado da aplica\u00e7\u00e3o\u2026'});await mkdir(portableDir,{recursive:true});
  const archive=path.join(kokoroDir,'python.zip');await download('https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip',archive,30*1024*1024);
  await runProcess('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:AUDIO_ARCHIVE -DestinationPath $env:AUDIO_DESTINATION -Force'],{env:{AUDIO_ARCHIVE:archive,AUDIO_DESTINATION:portableDir}});
  await writeFile(path.join(portableDir,'python312._pth'),'python312.zip\n.\nLib/site-packages\nimport site\n');await mkdir(path.join(portableDir,'Lib','site-packages'),{recursive:true});python=path.join(portableDir,'python.exe');
  const pipScript=path.join(kokoroDir,'get-pip.py');await download('https://bootstrap.pypa.io/get-pip.py',pipScript,5*1024*1024);await runProcess(python,['-X','utf8',pipScript,'--disable-pip-version-check'],{timeout:300000});
 }
 jobs.set('kokoro',{state:'installing',message:'A instalar as depend\u00eancias locais. Pode demorar v\u00e1rios minutos\u2026'});
 if(runtime)await runProcess(runtime.cmd,[...runtime.args,'-m','venv',path.join(kokoroDir,'venv')],{timeout:120000});
 try{const log=await runProcess(python,['-X','utf8','-m','pip','install','--disable-pip-version-check','tts_eu_pt==0.1.1'],{timeout:1200000});await writeFile(path.join(base,'install.log'),log);}catch(e){const error=Error('N\u00e3o foi poss\u00edvel instalar Kokoro. Verifica a Internet, o Python e o espa\u00e7o livre.');error.details=e.details;throw error;}
 }
 jobs.set('kokoro',{state:'installing',message:'A descarregar o modelo e testar a voz Tuga\u2026'});
 const weights=path.join(kokoroDir,'model');await mkdir(weights,{recursive:true});
 for(const name of ['tuga_kokoro.pth','tuga_voicepack.pt'])if(!(await exists(path.join(weights,name))))await download('https://huggingface.co/logus2k/kokoro_tts_eu_pt/resolve/main/'+name,path.join(weights,name),name.endsWith('.pth')?400*1024*1024:2*1024*1024);
 await localSynthesize('local:kokoro-tuga','Ol\u00e1. Esta \u00e9 uma voz de Portugal.',1,path.join(kokoroDir,'test.wav'));
}
export function startInstall(provider){
 if(!['piper','kokoro'].includes(provider))throw Error('Motor desconhecido.');
 if([...jobs.values()].some(j=>j.state==='installing'))return false;
 jobs.set(provider,{state:'installing',message:'A preparar a instala\u00e7\u00e3o\u2026'});
 (async()=>{try{await mkdir(base,{recursive:true});await (provider==='piper'?installPiper():installKokoro());await writeFile(path.join(base,provider,'ready.json'),JSON.stringify({testedAt:new Date().toISOString()}));jobs.set(provider,{state:'ready',message:'Voz instalada e teste de gera\u00e7\u00e3o conclu\u00eddo.'});}catch(e){await mkdir(base,{recursive:true});await writeFile(path.join(base,'install.log'),String(e.stack||e)+'\n\n'+(e.details||''));jobs.set(provider,{state:'error',message:(e.details||'').includes('UnicodeDecodeError')?'Falha de codifica\u00e7\u00e3o no motor. Reinicia com a vers\u00e3o atualizada.':e.message.includes('fetch')?'Sem liga\u00e7\u00e3o ao servidor de downloads. Verifica a Internet e tenta novamente.':e.message});}})();
 return true;
}

export async function ensureDefaultVoices(){for(const provider of ['piper','kokoro']){const current=(await localCatalogue()).find(v=>v.provider===provider);if(current?.available)continue;console.log('A preparar voz incluída: '+provider);if(!startInstall(provider))continue;while(jobs.get(provider)?.state==='installing')await new Promise(resolve=>setTimeout(resolve,1000));const result=jobs.get(provider);console.log(provider+': '+result.message);}}
