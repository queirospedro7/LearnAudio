import {shortcutAction} from './shortcuts.js';
import {defaults,readingPause} from './pauses.js';
import {wordCount,formatDuration,documentEstimate,playbackEstimate} from './reading-duration.js';
import {StableFollower} from './stable-follow.js';
import {DocumentView} from './document-view.js';
import {enhanceSelect} from './select.js';
const $=id=>document.getElementById(id),audio=$('audio');
const pauseIds={paragraph:'pause',sentence:'sentencePause',list:'listPause',heading:'headingPause',beforeHeading:'beforeHeadingPause'};
let parts=[],index=0,run=0,playing=false,loading=false,timer=null,currentUrl=null,voice='',rate=1,voiceOptions=[],highlighted=-1;
const readingFollower=new StableFollower();let followingPart=-1;
const urls=new Map(),timings=new Map(),audioDurations=new Map();let followFrame=null,wordActive=null,sentenceActive=null;
const documentView=new DocumentView($('originalDocument'),$('documentViewStatus'));let documentReady=false,documentMode='text',sourceBlocks=null,sourceDocumentText='';
function setDocumentMode(mode){documentMode=mode;$('originalPanel').hidden=mode!=='document';$('editorPanel').hidden=mode==='document';$('viewOriginal').setAttribute('aria-pressed',String(mode==='document'));$('viewText').setAttribute('aria-pressed',String(mode==='text'));}
$('viewOriginal').onclick=()=>setDocumentMode('document');$('viewText').onclick=()=>setDocumentMode('text');
const voicePicker=enhanceSelect($('voice'),{search:true});
function message(text){$('message').textContent=text;}
async function api(url,options){const res=await fetch(url,options);if(!res.ok){let data;try{data=await res.json();}catch{}throw Error(data?.error||'Não foi possível concluir o pedido. Tenta novamente.');}return res;}
let maxUploadBytes=25*1024*1024;
try{const config=await(await api('/api/config')).json();maxUploadBytes=config.maxUploadBytes||maxUploadBytes;if(config.cloud){document.querySelector('#drop>span:last-child').textContent='PDF, Word, TXT ou Markdown · até 4 MB';$('privacy').textContent='Versão online. O texto é enviado ao serviço de voz para gerar áudio.';}}catch{}
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const number=(value,digits=1)=>Number(value).toLocaleString('pt-PT',{minimumFractionDigits:digits,maximumFractionDigits:digits});
function selected(){return voiceOptions.find(v=>v.id===$('voice').value);}
function syncButtons(){const ready=Boolean(selected()?.available);$('preview').disabled=!ready||loading;$('read').disabled=!ready||loading||!$('text').value.trim();$('previous').disabled=loading||index===0;$('next').disabled=loading||index>=parts.length-1;$('export').disabled=!currentUrl;}
function count(){const words=wordCount($('text').value);$('count').textContent=words.toLocaleString('pt-PT')+' palavras';updateDocumentEstimate();syncButtons();}
function stop(){readingFollower.reset();followingPart=-1;documentView.clearHighlights();cancelAnimationFrame(followFrame);wordActive=null;sentenceActive=null;timings.clear();audioDurations.clear();run++;playing=false;loading=false;clearTimeout(timer);audio.pause();audio.removeAttribute('src');audio.load();$('player').hidden=true;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();currentUrl=null;syncButtons();}
$('text').addEventListener('input',()=>{stop();documentReady=false;sourceBlocks=null;sourceDocumentText='';documentView.clearHighlights();$('documentViewStatus').textContent='Texto alterado. Reimporta o ficheiro para sincronizar com o original.';count();try{localStorage.setItem('audio-draft',$('text').value);}catch{}});
try{$('text').value=localStorage.getItem('audio-draft')||'';}catch{}
async function importFile(file){if(!file)return;stop();if(file.size>maxUploadBytes)return message('O ficheiro não pode ter mais de '+Math.round(maxUploadBytes/1024/1024)+' MB.');message('A importar o documento…');const form=new FormData();form.append('file',file);try{const data=await(await api('/api/import',{method:'POST',body:form})).json();$('text').value=data.text;sourceBlocks=data.structure||null;sourceDocumentText=data.text;$('filename').textContent=data.name;documentReady=false;const original=/\.(pdf|docx)$/i.test(file.name);$('documentTabs').hidden=!original;if(original){setDocumentMode('document');try{await documentView.open(file,data.previewHtml);documentReady=true;}catch{message('O documento foi importado, mas a vista original n\u00e3o abriu. Usa a vista Texto.');}}else{await documentView.clear();setDocumentMode('text');}count();try{localStorage.setItem('audio-draft',data.text);}catch{}message('Documento importado. Confirma o texto antes de ouvir.');}catch(e){message(e.message);}$('file').value='';}
for(const [id,prefix] of [['markTitle','# '],['markSubtitle','## '],['markList','- ']])$(id).onclick=()=>{const editor=$('text');const start=editor.value.lastIndexOf('\n',Math.max(0,editor.selectionStart-1))+1;let end=editor.value.indexOf('\n',editor.selectionEnd);if(end<0)end=editor.value.length;const original=editor.value.slice(start,end);const changed=original.split('\n').map(line=>line.trim()?prefix+line.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+)/,''):'').join('\n');editor.setRangeText(changed,start,end,'select');editor.dispatchEvent(new Event('input'));editor.focus();};
$('importButton').onclick=()=>$('file').click();$('file').onchange=e=>importFile(e.target.files[0]);
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over');};$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');importFile(e.dataTransfer.files[0]);};
$('rate').oninput=()=>{rate=Number($('rate').value);audio.playbackRate=rate;$('expandedRate').value=String(rate);updatePlaybackEstimate();$('rateValue').textContent=number($('rate').value,2)+'×';count();};$('pause').oninput=()=>{$('pauseValue').textContent=number(Number($('pause').value)/1000)+' s';updateDocumentEstimate();updatePlaybackEstimate();};
function update(){highlightReading();$('progress').textContent=`Excerto ${index+1} de ${parts.length}`;$('current').textContent=parts[index]?.text||'';$('status').textContent=loading?'A preparar a voz…':playing?'A ler · '+(voiceOptions.find(v=>v.id===voice)?.name||''):'Leitura em pausa';$('toggle').textContent=playing?'Pausar':'Continuar';syncButtons();updatePlaybackEstimate();}
const pendingAudio=new Map();
async function getAudio(i,token){const key=token+':'+i;if(pendingAudio.has(key))return pendingAudio.get(key);const job=fetchAudio(i,token);pendingAudio.set(key,job);try{return await job;}finally{pendingAudio.delete(key);}}
async function fetchAudio(i,token){
 if(urls.has(i))return urls.get(i);
 const options=json({text:parts[i].speechText||parts[i].text,voice,rate:1});options.headers.Accept='application/json';
 const data=await(await api('/api/speech',options)).json();if(token!==run)return null;
 const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:data.mime});
 timings.set(i,data.words||[]);const url=URL.createObjectURL(blob);urls.set(i,url);return url;
}

async function play(i,token){
 if(token!==run||i<0||i>=parts.length)return;
 loading=true;audio.pause();audio.removeAttribute('src');audio.load();currentUrl=null;wordActive=null;sentenceActive=null;clearFollowHighlight();index=i;update();$('focusText').textContent=parts[i].text;$('followPrecision').textContent='A preparar o áudio…';
 try{const url=await getAudio(i,token);if(token!==run||!url)return;currentUrl=url;audio.src=url;audio.playbackRate=rate;loading=false;update();syncFollow();if(playing)await audio.play();if(i+1<parts.length)getAudio(i+1,token).catch(()=>{});}
 catch(e){if(token===run){loading=false;playing=false;update();message(e.name==='NotAllowedError'?'Carrega em Continuar para iniciar o áudio.':e.message);}}
}
async function begin(text){if(!selected()?.available)return message('Escolhe uma voz disponível.');stop();message('');const token=run;loading=true;syncButtons();try{const result=await(await api('/api/prepare',json({text,sourceBlocks:text===sourceDocumentText?sourceBlocks:null,sentenceChunks:true}))).json();if(token!==run)return;parts=result.segments;voice=$('voice').value;rate=Number($('rate').value);renderReading();if(documentReady&&text===$('text').value)documentView.bind(parts);else documentView.matches=[];playing=true;$('player').hidden=false;await play(0,token);}catch(e){if(token!==run)return;loading=false;message(e.message);syncButtons();}}
$('read').onclick=()=>begin($('text').value);$('preview').onclick=()=>begin('Há palavras que merecem ser ouvidas com tempo. Hoje, vamos ler com calma: respeitar as pausas, dar espaço às ideias e acompanhar cada frase. Parece-te bem?');
audio.onended=()=>{if(!playing)return;if(index+1>=parts.length){playing=false;update();$('status').textContent='Leitura concluída';return;}const token=run;timer=setTimeout(()=>play(index+1,token),readingPause(parts[index],parts[index+1],pauseOptions()));};
audio.onplay=()=>{if(loading)return;playing=true;update();followTick();};
audio.onpause=()=>{if(loading||!audio.paused||audio.ended||!audio.getAttribute('src'))return;playing=false;clearTimeout(timer);update();};
$('toggle').onclick=async()=>{clearTimeout(timer);if(playing){playing=false;audio.pause();update();}else{playing=true;update();try{if(audio.ended&&index+1<parts.length)await play(index+1,run);else if(audio.getAttribute('src'))await audio.play();else if(!loading)await play(index,run);}catch(e){playing=false;update();message('Não foi possível iniciar o áudio. Tenta novamente.');}}};
$('next').onclick=()=>{clearTimeout(timer);if(index+1<parts.length)play(index+1,++run);};$('previous').onclick=()=>{clearTimeout(timer);if(index>0)play(index-1,++run);};$('stop').onclick=stop;
$('clear').onclick=()=>{stop();$('text').value='';documentReady=false;documentView.clear();$('documentTabs').hidden=true;setDocumentMode('text');$('filename').textContent='Escreve ou cola o texto abaixo';try{localStorage.removeItem('audio-draft');}catch{}count();message('');};
$('export').onclick=()=>{if(!currentUrl)return;const a=document.createElement('a');a.href=currentUrl;a.download=`audio-excerto-${index+1}.${voiceOptions.find(v=>v.id===voice)?.provider==='edge'?'mp3':'wav'}`;a.click();};
audio.onerror=()=>{if(audio.getAttribute('src'))message('Não foi possível reproduzir este áudio. Tenta iniciar a leitura novamente.');};
function renderReading(){highlighted=-1;$('readingText').replaceChildren(...parts.map((part,i)=>{const p=document.createElement('button');p.type='button';p.className='reading-part reading-'+part.kind+(part.ordered?' reading-ordered':'');p.style.setProperty('--list-depth',String(part.depth||0));if(part.kind==='heading')p.dataset.level=String(part.level);renderPartText(p,part.text);p.setAttribute('aria-label','Ouvir excerto '+(i+1));p.onclick=()=>{clearTimeout(timer);playing=true;play(i,++run);};return p;}));}
function highlightReading(){if(highlighted===index)return;highlighted=index;[...$('readingText').children].forEach((p,i)=>{p.classList.toggle('active',i===index);if(i===index)p.setAttribute('aria-current','true');else p.removeAttribute('aria-current');});}
$('showReading').onchange=()=>{$('readingPanel').hidden=!$('showReading').checked;highlighted=-1;highlightReading();};
$('autoScroll').onchange=()=>{highlighted=-1;highlightReading();syncFollow();};
function voiceInfo(){const current=selected();$('voiceInfo').textContent='Português de Portugal';$('privacy').textContent=current?.provider==='edge'?'Voz online. O texto é enviado à Microsoft para gerar o áudio.':'Voz incluída. A leitura fica neste computador.';$('export').textContent=current?.provider==='edge'?'Guardar excerto MP3':'Guardar excerto WAV';syncButtons();}
function filterVoices(){
 let old=$('voice').value;try{if(!old)old=localStorage.getItem('audio-voice')||'';}catch{}
 const visible=[...voiceOptions].sort((a,b)=>Number(a.provider==='edge')-Number(b.provider==='edge')); 
 $('voice').replaceChildren(...visible.map(v=>{const o=document.createElement('option');o.value=v.id;o.disabled=!v.available;o.textContent=v.name+(v.provider==='edge'?' · Online':!v.available?' · Indisponível':'');return o;}));
 if(!visible.length){const o=document.createElement('option');o.value='';o.textContent='Sem vozes disponíveis';o.disabled=true;$('voice').append(o);}
 if(visible.some(v=>v.id===old&&v.available))$('voice').value=old;else $('voice').value=visible.find(v=>v.available)?.id||'';voicePicker.refresh();voiceInfo();
}
async function loadVoices(){voiceOptions=await(await api('/api/voices')).json();filterVoices();}
$('voice').onchange=()=>{stop();try{localStorage.setItem('audio-voice',$('voice').value);}catch{}voiceInfo();};
count();
try{await loadVoices();}catch(e){message('Não foi possível ligar à aplicação. Abre o start.bat e atualiza esta página.');}

let installTimer=null;
async function refreshLocal(){try{const local=await(await api('/api/local/status')).json();voiceOptions=voiceOptions.filter(v=>v.provider==='edge').concat(local);filterVoices();if(local.some(v=>!v.available&&v.state==='installing'))installTimer=setTimeout(refreshLocal,3000);}catch{}}
await refreshLocal();

function renderPartText(parent,text){for(const sentence of new Intl.Segmenter('pt-PT',{granularity:'sentence'}).segment(text)){const span=document.createElement('span');span.className='reading-sentence';span.dataset.start=sentence.index;span.dataset.end=sentence.index+sentence.segment.length;for(const token of new Intl.Segmenter('pt-PT',{granularity:'word'}).segment(sentence.segment)){const word=document.createElement('span');word.textContent=token.segment;word.dataset.start=sentence.index+token.index;word.dataset.end=sentence.index+token.index+token.segment.length;word.className=token.isWordLike?'reading-word':'reading-punctuation';span.append(word);}parent.append(span);}}
function clearFollowHighlight(){document.querySelectorAll('.word-current,.sentence-current').forEach(e=>e.classList.remove('word-current','sentence-current'));}
function syncFollow(){
 const row=$('readingText').children[index];if(!row||loading)return;
 const words=timings.get(index)||[],time=audio.currentTime;let event=null;
 for(const w of words){if(w.time>time)break;if(time<w.time+Math.max(w.duration,.08)+.08)event=w;else event=null;}
 let sentence=event?[...row.querySelectorAll('.reading-sentence')].find(s=>Number(s.dataset.start)<=event.start&&Number(s.dataset.end)>event.start):sentenceActive;
 const exact=words.length>0;
 const sentenceMode=voiceOptions.find(v=>v.id===voice)?.provider!=='edge';
 if(!sentence&&!exact&&sentenceMode)sentence=row.querySelector('.reading-sentence');
 if(sentence&&sentence!==sentenceActive){sentenceActive?.classList.remove('sentence-current');sentence.classList.add('sentence-current');sentenceActive=sentence;$('focusText').replaceChildren(...[...sentence.childNodes].map(n=>n.cloneNode(true)));$('focusText').scrollTop=0;}
 const word=event?[...row.querySelectorAll('.reading-word,.reading-punctuation')].find(w=>Number(w.dataset.start)<=event.start&&Number(w.dataset.end)>=event.end):null;
 if(word!==wordActive){wordActive?.classList.remove('word-current');word?.classList.add('word-current');wordActive=word;$('focusText').querySelectorAll('.word-current').forEach(n=>n.classList.remove('word-current'));if(event){const focusWord=[...$('focusText').querySelectorAll('[data-start]')].find(w=>Number(w.dataset.start)<=event.start&&Number(w.dataset.end)>=event.end);focusWord?.classList.add('word-current');}}
 const target=word||sentence||row;if($('autoScroll').checked&&$('showReading').checked){const targetBox=target.getBoundingClientRect(),rect=target===row?{top:targetBox.top,bottom:targetBox.top+28}:target.getClientRects()[0]||targetBox,box=$('readingText').getBoundingClientRect();const position=event?index*100000+event.start:followingPart!==index?index*100000:Math.max(readingFollower.position,index*100000);followingPart=index;const delta=readingFollower.delta(rect,box,position);if(delta)$('readingText').scrollBy({top:delta,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 const focusWord=$('focusText').querySelector('.word-current');if(focusWord){const box=$('focusText').getBoundingClientRect(),r=focusWord.getBoundingClientRect();if(r.bottom>box.bottom)$('focusText').scrollTop+=r.bottom-box.bottom+20;}
 if(documentReady&&documentMode==='document')documentView.follow(index,parts[index],event,sentence?{start:Number(sentence.dataset.start),end:Number(sentence.dataset.end)}:null,$('autoScroll').checked&&(!expanded||documentView.centeredFollow||documentView.forceFollow));
 $('followPrecision').textContent=exact?'Palavra sincronizada com o áudio':sentenceMode?'Frase em leitura':'Excerto em leitura / sem tempos de palavras';
 if(!sentence)$('focusText').textContent=parts[index]?.text||'';
}
function followTick(){cancelAnimationFrame(followFrame);syncFollow();if(!audio.paused&&!audio.ended)followFrame=requestAnimationFrame(followTick);}
audio.addEventListener('timeupdate',syncFollow);audio.addEventListener('seeked',()=>{wordActive=null;sentenceActive=null;clearFollowHighlight();syncFollow();});audio.addEventListener('pause',()=>cancelAnimationFrame(followFrame));
function focusEditorPassage(){
 const editor=$('text');let cursor=0,at=-1;
 for(let i=0;i<=index;i++){const found=editor.value.indexOf(parts[i].text,cursor);if(found>=0){at=found;cursor=found+parts[i].text.length;}else if(i===index)at=-1;}
 if(at<0)return;
 editor.focus();editor.setSelectionRange(at,at+parts[index].text.length);
 const styles=getComputedStyle(editor),mirror=document.createElement('div');
 for(const key of ['font','lineHeight','letterSpacing','padding','boxSizing','tabSize','wordBreak','overflowWrap'])mirror.style[key]=styles[key];
 Object.assign(mirror.style,{position:'fixed',visibility:'hidden',whiteSpace:'pre-wrap',width:editor.clientWidth+'px',height:'auto',overflowWrap:'break-word',inset:'0 auto auto 0'});
 mirror.textContent=editor.value.slice(0,at);const marker=document.createElement('span');marker.textContent=parts[index].text||' ';mirror.append(marker);document.body.append(mirror);
 editor.scrollTop=Math.max(0,marker.offsetTop-editor.clientHeight/2+parseFloat(styles.lineHeight)/2);mirror.remove();
}
function returnToReading(){
 if(!parts[index]||loading)return;
 readingFollower.reset();documentView.forceFollow=true;$('autoScroll').checked=true;$('showReading').checked=true;$('readingPanel').hidden=false;highlighted=-1;highlightReading();sentenceActive=null;
 if(documentReady){setDocumentMode('document');syncFollow();}
 else{syncFollow();if(expanded)focusEditorPassage();else $('readingText').children[index]?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
}
$('returnToReading').onclick=returnToReading;
$('recenterDocument').onclick=returnToReading;

function updateDocumentEstimate(){const seconds=documentEstimate($('text').value,Number($('rate').value),Number($('pause').value),$('text').value===sourceDocumentText?sourceBlocks:null,pauseOptions());const label=seconds?'Cerca de '+formatDuration(seconds):'Importa um documento';$('totalEstimate').textContent=label;$('estimate').textContent=seconds?'Leitura estimada: '+formatDuration(seconds):'Pronto para começar.';}
function updatePlaybackEstimate(){if($('player').hidden||!parts.length)return;const estimate=playbackEstimate(parts,index,loading?0:audio.currentTime,audioDurations,rate,audio.playbackRate,Number($('pause').value),'kokoro',pauseOptions());$('timeElapsed').textContent=formatDuration(estimate.elapsed);$('timeRemaining').textContent='Faltam cerca de '+formatDuration(estimate.remaining);$('timeTotal').textContent='Total estimado: '+formatDuration(estimate.total);$('readingProgress').value=estimate.percent;}
for(const event of ['timeupdate','ratechange','seeked'])audio.addEventListener(event,updatePlaybackEstimate);
audio.addEventListener('loadedmetadata',()=>{if(currentUrl&&audio.currentSrc===currentUrl&&Number.isFinite(audio.duration)){audioDurations.set(index,audio.duration);updatePlaybackEstimate();}});
let expanded=false,previousFocus=null;
function expandDocument(value){expanded=value;document.body.classList.toggle('document-expanded',value);for(const element of document.querySelectorAll('header,.intro,aside,footer,#player'))element.inert=value;$('expandDocument').setAttribute('aria-expanded',String(value));$('expandDocument').textContent=value?'Reduzir documento':'Expandir documento';$('expandedControls').hidden=!value;if(value){previousFocus=document.activeElement;$('expandDocument').focus();}else previousFocus?.focus();}
$('expandDocument').onclick=()=>expandDocument(!expanded);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded){e.preventDefault();expandDocument(false);}});
$('expandedRead').onclick=()=>{if($('player').hidden)$('read').click();else $('toggle').click();};$('expandedStop').onclick=()=>$('stop').click();
setInterval(()=>{if(!expanded)return;$('recenterDocument').disabled=loading||!parts[index]||$('player').hidden;$('expandedRead').disabled=loading||!selected()||!$('text').value.trim();$('expandedRead').textContent=$('player').hidden?'Ouvir documento':playing?'Pausar':'Continuar';$('expandedTime').textContent=$('player').hidden?$('totalEstimate').textContent:$('timeRemaining').textContent;},300);

function pauseOptions(){return Object.fromEntries(Object.entries(pauseIds).map(([key,id])=>[key,Number($(id).value)]));}

function refreshPauses(){for(const id of Object.values(pauseIds))$(id+'Value').textContent=number(Number($(id).value)/1000,2)+' s';updateDocumentEstimate();updatePlaybackEstimate();}
try{const saved=JSON.parse(localStorage.getItem('audio-pauses')||'{}');for(const [key,id] of Object.entries(pauseIds))if(Number.isFinite(saved[key]))$(id).value=saved[key];}catch{}
for(const id of Object.values(pauseIds))$(id).addEventListener('input',()=>{refreshPauses();try{localStorage.setItem('audio-pauses',JSON.stringify(pauseOptions()));}catch{}});
$('resetPauses').onclick=()=>{for(const [key,id] of Object.entries(pauseIds))$(id).value=defaults[key];refreshPauses();try{localStorage.removeItem('audio-pauses');}catch{}};
refreshPauses();

document.addEventListener('keydown',event=>{if(!expanded||event.key!=='Tab'||document.querySelector('dialog[open]'))return;const controls=[...document.querySelector('.document').querySelectorAll('button,input,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});

function setDocumentZoom(value){const zoom=documentView.setZoom(value);document.documentElement.style.setProperty('--document-zoom',String(zoom));for(const prefix of ['', 'normal']){const id=name=>prefix?prefix+name[0].toUpperCase()+name.slice(1):name;$(id('zoomReset')).textContent=Math.round(zoom*100)+'%';$(id('zoomOut')).disabled=zoom<=.5;$(id('zoomIn')).disabled=zoom>=2;}}
$('zoomOut').onclick=()=>setDocumentZoom(documentView.zoom-.25);
$('zoomIn').onclick=()=>setDocumentZoom(documentView.zoom+.25);
$('zoomReset').onclick=()=>setDocumentZoom(1);

let followScrollTimer=null;
function restoreReadingFocus(){clearTimeout(followScrollTimer);followScrollTimer=setTimeout(()=>{if($('autoScroll').checked&&!$('player').hidden&&!loading)syncFollow();},450);}
$('originalDocument').addEventListener('scroll',restoreReadingFocus,{passive:true});
window.addEventListener('resize',restoreReadingFocus);
setInterval(()=>{if($('autoScroll').checked&&!$('player').hidden&&!loading&&audio.paused)syncFollow();},600);

$('normalZoomOut').onclick=()=>setDocumentZoom(documentView.zoom-.25);
$('normalZoomIn').onclick=()=>setDocumentZoom(documentView.zoom+.25);
$('normalZoomReset').onclick=()=>setDocumentZoom(1);
for(let n=60;n<=150;n+=5){const option=document.createElement('option');option.value=String(n/100);option.textContent=number(n/100,2)+'×';$('expandedRate').append(option);}
$('expandedRate').value=$('rate').value;
$('expandedRate').onchange=()=>{$('rate').value=$('expandedRate').value;$('rate').dispatchEvent(new Event('input'));};
$('centerAutomatically').onclick=()=>{documentView.centeredFollow=!documentView.centeredFollow;$('centerAutomatically').setAttribute('aria-pressed',String(documentView.centeredFollow));if(documentView.centeredFollow)returnToReading();else{documentView.forceFollow=false;clearTimeout(followScrollTimer);$('originalDocument').scrollTo({top:$('originalDocument').scrollTop,left:$('originalDocument').scrollLeft,behavior:'instant'});}};
documentView.onSeek=i=>{if($('player').hidden||!parts[i])return;clearTimeout(timer);playing=true;documentView.forceFollow=true;play(i,++run);};

const pauseDialog=document.createElement('dialog');pauseDialog.className='preferences-dialog';pauseDialog.setAttribute('aria-labelledby','pauseDialogTitle');
pauseDialog.innerHTML='<form method="dialog" class="preferences-head"><div><h2 id="pauseDialogTitle">Pausas da leitura</h2><p>Ajusta o tempo entre cada passagem.</p></div><button aria-label="Fechar pausas">Fechar</button></form><div class="pause-dialog-fields"></div>';
const pauseFields=pauseDialog.querySelector('.pause-dialog-fields');
for(const id of Object.values(pauseIds)){
 const label=document.createElement('label');label.className='preference-row';
 const title=document.createElement('span');title.textContent=document.querySelector('label[for="'+id+'"]').textContent;
 const input=$(id).cloneNode();input.id='expanded-'+id;input.setAttribute('aria-label',title.textContent);
 const output=document.createElement('output');const sync=()=>{input.value=$(id).value;output.textContent=number(Number(input.value)/1000,2)+' s';};
 input.oninput=()=>{$(id).value=input.value;$(id).dispatchEvent(new Event('input'));};$(id).addEventListener('input',sync);sync();label.append(title,output,input);pauseFields.append(label);
}
const pauseNote=document.createElement('p');pauseNote.className='preferences-note';pauseNote.textContent='As alterações aplicam-se às próximas pausas, sem interromper a leitura.';pauseFields.append(pauseNote);
const reset=document.createElement('button');reset.type='button';reset.textContent='Repor pausas';reset.onclick=()=>{$('resetPauses').click();for(const id of Object.values(pauseIds))$(id).dispatchEvent(new Event('input'));};pauseFields.append(reset);
document.body.append(pauseDialog);
const pauseButton=document.createElement('button');pauseButton.type='button';pauseButton.textContent='Pausas';pauseButton.onclick=()=>pauseDialog.showModal();$('expandedControls').insertBefore(pauseButton,$('expandedTime'));

const expandedSpeedPicker=enhanceSelect($('expandedRate'));
$('rate').addEventListener('input',()=>expandedSpeedPicker.refresh());

// Keep media controls available when the page is in the background.
audio.preload='auto';
try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
if('mediaSession' in navigator){
 const handlers={play:()=>{if(!playing)$('toggle').click();},pause:()=>{if(playing)$('toggle').click();},previoustrack:()=>$('previous').click(),nexttrack:()=>$('next').click(),stop:()=>stop(),seekbackward:details=>{audio.currentTime=Math.max(0,audio.currentTime-(details.seekOffset||10));},seekforward:details=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+(details.seekOffset||10));}};
 for(const [action,handler] of Object.entries(handlers))try{navigator.mediaSession.setActionHandler(action,handler);}catch{}
 audio.addEventListener('play',()=>{navigator.mediaSession.playbackState='playing';if('MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:$('filename').textContent||'Documento',artist:'Audio',album:'Leitura ao teu ritmo'});});
 audio.addEventListener('pause',()=>{navigator.mediaSession.playbackState='paused';});audio.addEventListener('emptied',()=>{navigator.mediaSession.playbackState='none';});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncFollow();if(!audio.paused)followTick();}});

function handleReadingShortcut(event){
 const action=shortcutAction(event,{modal:Boolean(document.querySelector('dialog[open]'))});if(!action)return;
 const active=!$('player').hidden;
 if(['previous','next','recenter'].includes(action)&&(!active||loading))return;
 if(action==='toggle'&&(loading||(!active&&(!$('text').value.trim()||!selected()?.available))))return;
 if(action==='collapse'&&!expanded)return;
 event.preventDefault();
 if(action==='toggle'){if(active)$('toggle').click();else $('read').click();}
 else if(action==='previous'||action==='next')$(action).click();
 else if(action==='recenter')returnToReading();
 else if(action==='expand')expandDocument(!expanded);
 else if(action==='collapse')expandDocument(false);
 else if(action==='zoomIn')setDocumentZoom(documentView.zoom+.25);
 else if(action==='zoomOut')setDocumentZoom(documentView.zoom-.25);
 else if(action==='zoomReset')setDocumentZoom(1);
}
document.addEventListener('keydown',handleReadingShortcut);
documentView.onKeyDown=handleReadingShortcut;
for(const [id,key] of [['toggle','Space'],['previous','ArrowLeft'],['next','ArrowRight'],['returnToReading','R'],['recenterDocument','R'],['expandDocument','F']])$(id).setAttribute('aria-keyshortcuts',key);
