import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {pdfLines,pdfBlocks,safeWordHtml} from './document-structure.js';
import {MsEdgeTTS,OUTPUT_FORMAT} from 'msedge-tts';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {wordBlocks,sourceText,validatedBlocks} from './semantic-word.js';
import {normalize,segments,segmentsFromBlocks,readingSentences,escapeXml} from './text.js';
import {wordTimings} from './speech-timing.js';
import {edgeCatalogue} from './voice-discovery.js';
import {localCatalogue,localSynthesize,startInstall,ensureDefaultVoices} from './local-voices.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cloud=Boolean(process.env.VERCEL);
const cache=cloud?path.join(os.tmpdir(),'audio-cache'):path.join(root,'data','audio');await mkdir(cache,{recursive:true});
const app=express();app.disable('x-powered-by');
const port=Number(process.env.PORT||3210);
app.use((req,res,next)=>{const origin=req.headers.origin;let sameOrigin=false;try{sameOrigin=new URL(origin).host===req.headers.host;}catch{}if(origin&&!sameOrigin)return res.status(403).json({error:'Origem não permitida.'});res.setHeader('X-Content-Type-Options','nosniff');next();});
app.use(express.json({limit:'4mb'}));
app.get('/api/config',(req,res)=>res.json({cloud,maxUploadBytes:(cloud?4:25)*1024*1024}));
const availableLocal=()=>cloud?Promise.resolve([]):localCatalogue();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:(cloud?4:25)*1024*1024,files:1}});
app.get('/api/voices',async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json([...(await edgeCatalogue()),...(await availableLocal())]);});
app.get('/api/local/status',async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json(await availableLocal());});
app.post('/api/local/install/:provider',(req,res)=>{if(cloud)return res.status(404).json({error:'As vozes locais estão disponíveis na aplicação para computador.'});try{const started=startInstall(req.params.provider);res.status(started?202:409).json(started?{ok:true}:{error:'Aguarda que a instala\u00e7\u00e3o em curso termine.'});}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/import',upload.single('file'),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({error:'Escolhe um ficheiro.'});
  const ext=path.extname(req.file.originalname).toLowerCase();let text='',previewHtml='',structure=null;
  if(ext==='.pdf'){const task=getDocument({data:new Uint8Array(req.file.buffer),isEvalSupported:false});try{const pdf=await task.promise;const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();const lines=pdfLines(content.items);lines.pageHeight=page.getViewport({scale:1}).height;pages.push(lines);page.cleanup();}structure=pdfBlocks(pages);text=sourceText(structure);}finally{await task.destroy();}}
  else if(ext==='.docx'){const html=await mammoth.convertToHtml({buffer:req.file.buffer},{styleMap:["p[style-name='Title'] => h1:fresh","p[style-name='Subtitle'] => h2:fresh","p[style-name='T\u00edtulo'] => h1:fresh","p[style-name='Subt\u00edtulo'] => h2:fresh"]});structure=wordBlocks(html.value);text=sourceText(structure);previewHtml=safeWordHtml(html.value);}
  else if(['.txt','.md'].includes(ext))text=new TextDecoder('utf-8',{fatal:true}).decode(req.file.buffer);
  else return res.status(400).json({error:'Usa PDF, DOCX, TXT ou Markdown.'});
  text=normalize(text);if(text.length<3)return res.status(422).json({error:'Não foi encontrado texto. PDFs digitalizados precisam de OCR antes de serem importados.'});
  if(text.length>400000)return res.status(413).json({error:'O documento excede 400 000 caracteres. Divide-o em partes.'});
  res.json({text,name:req.file.originalname,previewHtml,structure});
 }catch(e){res.status(422).json({error:'Não foi possível ler o ficheiro. Confirma que não está protegido e que os ficheiros de texto usam UTF-8.'});}
});
app.post('/api/prepare',(req,res)=>{const text=req.body.text;if(typeof text!=='string'||text.length>400000||!text.trim())return res.status(400).json({error:'Introduz texto, até 400 000 caracteres.'});const original=validatedBlocks(req.body.sourceBlocks,text);let prepared=original?segmentsFromBlocks(original):segments(text);if(req.body.sentenceChunks===true){prepared=prepared.flatMap(part=>{const sentences=readingSentences(part.text);return sentences.map((sentence,i)=>({...part,text:sentence,speechText:/[.!?:;\u2026]$/.test(sentence)?sentence:sentence+'.',pauseBefore:i===0?part.pauseBefore:0,pause:i===sentences.length-1?part.pause:100,boundary:i===sentences.length-1?part.boundary:'continuation'}));});}res.json({segments:prepared});});
let active=0;
app.post('/api/speech',async(req,res)=>{
 const {text,voice,rate=1}=req.body;
 const catalogue=[...(await edgeCatalogue()),...(await availableLocal())];
 const chosen=catalogue.find(v=>v.id===voice&&v.available);const local=chosen&&chosen.provider!=='edge';
 if(typeof text!=='string'||!text.trim()||text.length>1800||!chosen||typeof rate!=='number'||rate<0.6||rate>1.5)return res.status(400).json({error:'Texto ou opções de voz inválidos.'});
 const sendAudio=async(audio,mime,key)=>{res.setHeader('Cache-Control','private, no-store');if(req.headers.accept?.includes('application/json')){let words=[];try{words=JSON.parse(await readFile(path.join(cache,key+'.mp3.json'),'utf8')).words||[];}catch{}return res.json({audio:audio.toString('base64'),mime,words});}res.setHeader('X-Audio-Key',key);return res.type(mime).send(audio);};
 const key=createHash('sha256').update(JSON.stringify({text,voice,rate:chosen.provider==='kokoro'?1:rate,quality:5})).digest('hex');const file=path.join(cache,key+(local?'.wav':'.mp3'));const mime=local?'audio/wav':'audio/mpeg';
 try{const audio=await readFile(file);return await sendAudio(audio,mime,key);}catch{}
 if(active>=3)return res.status(429).json({error:'Aguarda um momento e tenta novamente.'});
 active++;const tts=new MsEdgeTTS({connectionTimeoutMs:15000,synthesisTimeoutMs:45000});
 try{
  if(local){const temporary=file+'.'+randomUUID()+'.tmp.wav';try{const audio=await localSynthesize(voice,text,rate,temporary);await rename(temporary,file);return await sendAudio(audio,mime,key);}finally{await rm(temporary,{force:true});}}
  await tts.setMetadata(voice,OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,{wordBoundaryEnabled:true});
  const {audioStream,metadataStream}=tts.toStream(escapeXml(text),{rate});const chunks=[],events=[];if(metadataStream){metadataStream.on('data',chunk=>{try{events.push(...JSON.parse(chunk.toString()).Metadata);}catch{}});metadataStream.on('error',()=>{});}
  for await(const chunk of audioStream)chunks.push(chunk);
  const audio=Buffer.concat(chunks);if(audio.length<100)throw Error('empty');
  await writeFile(file+'.json',JSON.stringify({words:wordTimings(text,events)}));await writeFile(file,audio);await sendAudio(audio,'audio/mpeg',key);
 }catch(e){console.error('Síntese:',e.message);res.status(502).json({error:local?'O motor local não conseguiu gerar o áudio. Verifica a instalação e tenta novamente. O texto continua disponível.':'O serviço de voz não respondeu. Verifica a Internet e tenta novamente. O texto continua disponível.'});}
 finally{active--;tts.close();}
});
app.get('/api/timing/:key',async(req,res)=>{if(!/^[a-f0-9]{64}$/.test(req.params.key))return res.status(400).json({error:'Identificador inv\u00e1lido.'});try{res.json(JSON.parse(await readFile(path.join(cache,req.params.key+'.mp3.json'),'utf8')));}catch{res.json({words:[]});}});
app.use('/vendor/pdfjs',express.static(path.join(root,'node_modules','pdfjs-dist','legacy','build')));
app.get('/vendor/pdf-viewer.css',(req,res)=>res.sendFile(path.join(root,'node_modules','pdfjs-dist','web','pdf_viewer.css')));
app.use(express.static(path.join(root,'public')));
app.use((err,req,res,next)=>res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'O ficheiro excede o limite de '+(cloud?4:25)+' MB.':'Pedido inválido.'}));
export default app;
if(!cloud)app.listen(port,'127.0.0.1',()=>{console.log(`Audio disponivel em http://127.0.0.1:${port}`);ensureDefaultVoices().catch(e=>console.error('Vozes locais:',e.message));});
