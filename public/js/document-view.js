import {StableFollower} from './stable-follow.js';
export function normalizedText(value){return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
export function pdfRenderSize(pageWidth,availableWidth,pixelRatio=1,pageHeight=pageWidth,zoom=1){
 const width=Math.max(1,availableWidth-30)*zoom,scale=width/pageWidth,height=pageHeight*scale;
 // Bound backing storage for unusually large pages while retaining HiDPI detail.
 const ratio=Math.min(Math.max(1,pixelRatio),3,Math.sqrt(16000000/(width*height)),8192/width,8192/height);
 return {width,height,scale,ratio,pixelWidth:Math.ceil(width*ratio),pixelHeight:Math.ceil(height*ratio)};
}
export class DocumentView {
 constructor(container,status){this.follower=new StableFollower();this.forceFollow=false;this.container=container;this.status=status;this.generation=0;this.document=null;this.nodes=[];this.map=[];this.text='';this.matches=[];this.lastScrolled=null;this.pdfPages=[];this.zoom=1;container.addEventListener?.('click',event=>this.seekAt(event));if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>this.scheduleResize());this.resizeObserver.observe(container);window.addEventListener('resize',()=>this.scheduleResize());}}
 async clear(){this.generation++;clearTimeout(this.resizeTimer);this.pdfPages=[];if(this.pdf){await this.pdf.destroy();this.pdf=null;}this.clearHighlights();this.container.replaceChildren();this.document=null;this.wordFrame=null;this.text='';this.map=[];this.matches=[];}
 async open(file,html){await this.clear();const generation=this.generation;this.status.textContent='A abrir o documento\u2026';try{if(file.name.toLowerCase().endsWith('.pdf'))await this.openPdf(file,generation);else await this.openWord(file,html,generation);if(generation!==this.generation)return;this.index();this.scheduleResize();this.status.textContent=file.name.toLowerCase().endsWith('.pdf')?'PDF original / seleciona texto para consultar.':'Word com formata\u00e7\u00e3o / a pagina\u00e7\u00e3o e alguns estilos podem diferir do Microsoft Word.';}catch(e){this.status.textContent='N\u00e3o foi poss\u00edvel mostrar o documento. Podes usar a vista Texto.';throw e;}}
 async openPdf(file,generation){
  const pdfjs=await import('/vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;if(generation!==this.generation){await pdf.destroy();return;}this.pdf=pdf;this.document=document;
  for(let i=1;i<=pdf.numPages;i++){
   if(generation!==this.generation)return;const page=await pdf.getPage(i);const original=page.getViewport({scale:1});const size=pdfRenderSize(original.width,this.container.clientWidth,window.devicePixelRatio||1,original.height,this.zoom);const scale=size.scale;const viewport=page.getViewport({scale});
   const sheet=document.createElement('div');sheet.className='pdf-sheet';sheet.style.width=viewport.width+'px';sheet.style.height=viewport.height+'px';sheet.style.setProperty('--scale-factor',String(scale));sheet.style.setProperty('--total-scale-factor',String(scale));sheet.dataset.page=String(i);sheet.setAttribute('aria-label','P\u00e1gina '+i);
   const canvas=document.createElement('canvas');canvas.width=size.pixelWidth;canvas.height=size.pixelHeight;canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';canvas.setAttribute('aria-hidden','true');sheet.append(canvas);this.container.append(sheet);
   await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[size.ratio,0,0,size.ratio,0,0]}).promise;if(generation!==this.generation)return;
   const layer=document.createElement('div');layer.className='textLayer';sheet.append(layer);const content=await page.getTextContent();const textLayer=new pdfjs.TextLayer({textContentSource:content,container:layer,viewport});await textLayer.render();if(generation!==this.generation)return;this.pdfPages.push({page,original,sheet,canvas,textLayer,size});
   this.status.textContent=`A abrir p\u00e1gina ${i} de ${pdf.numPages}\u2026`;await new Promise(requestAnimationFrame);
  }
 }
 seekAt(event){
  if(!this.pdfPages.length||!this.matches.length||this.document.getSelection()?.toString())return;
  const caret=this.document.caretPositionFromPoint?.(event.clientX,event.clientY);
  const range=caret?null:this.document.caretRangeFromPoint?.(event.clientX,event.clientY);
  const node=caret?.offsetNode||range?.startContainer,offset=caret?.offset??range?.startOffset;
  if(!node||!node.parentElement?.closest('.textLayer'))return;
  const index=this.matches.findIndex(match=>match?.mapping?.some(m=>m.node===node&&offset>=m.start&&offset<m.end));
  if(index>=0)this.onSeek?.(index);
 }
 setZoom(value){
  if(!Number.isFinite(value))return this.zoom;
  this.zoom=Math.max(.5,Math.min(2,Math.round(value*100)/100));
  const article=this.wordFrame?.contentDocument?.getElementById('wordDocument');if(article)article.style.zoom=String(this.zoom);
  this.scheduleResize();return this.zoom;
 }
 scheduleResize(){clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>{this.refreshPdf().catch(()=>{this.status.textContent='Não foi possível atualizar a resolução do PDF. Volta a abrir o documento.';});},120);}
 async refreshPdf(){
  if(this.resizing){this.resizeAgain=true;return;}if(!this.pdfPages.length||!this.container.clientWidth)return;
  this.resizing=true;const generation=this.generation;
  try{
   const anchor=this.pdfPages.find(p=>p.sheet.offsetTop+p.sheet.offsetHeight>this.container.scrollTop)||this.pdfPages[0];
   const offset=(this.container.scrollTop-anchor.sheet.offsetTop)/Math.max(1,anchor.sheet.offsetHeight);
   const changes=[];
   for(const entry of this.pdfPages){
    const size=pdfRenderSize(entry.original.width,this.container.clientWidth,window.devicePixelRatio||1,entry.original.height,this.zoom);
    if(Math.abs(size.width-entry.size.width)<.5&&Math.abs(size.ratio-entry.size.ratio)<.01)continue;
    const viewport=entry.page.getViewport({scale:size.scale});entry.sheet.style.width=size.width+'px';entry.sheet.style.height=size.height+'px';
    entry.sheet.style.setProperty('--scale-factor',String(size.scale));entry.sheet.style.setProperty('--total-scale-factor',String(size.scale));
    entry.canvas.style.width=size.width+'px';entry.canvas.style.height=size.height+'px';entry.textLayer.update({viewport});changes.push({entry,size,viewport});
   }
   if(changes.length)this.container.scrollTop=anchor.sheet.offsetTop+offset*anchor.sheet.offsetHeight;
   for(const {entry,size,viewport} of changes){
    if(generation!==this.generation)return;
    const canvas=document.createElement('canvas');canvas.width=size.pixelWidth;canvas.height=size.pixelHeight;canvas.style.width=size.width+'px';canvas.style.height=size.height+'px';canvas.setAttribute('aria-hidden','true');
    await entry.page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[size.ratio,0,0,size.ratio,0,0]}).promise;
    if(generation!==this.generation)return;entry.canvas.replaceWith(canvas);entry.canvas=canvas;entry.size=size;
   }
  }finally{this.resizing=false;if(this.resizeAgain){this.resizeAgain=false;this.scheduleResize();}}
 }
 async openWord(file,html,generation){
  const frame=document.createElement('iframe');frame.className='word-frame';frame.title='Documento Word';frame.setAttribute('sandbox','allow-same-origin');this.container.append(frame);
  const css='body{margin:0;background:#e9ece5;font-family:Calibri,Arial,sans-serif;color:#222}article{margin:18px auto;background:white;padding:55px 50px;max-width:760px;min-height:900px;box-sizing:border-box;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:7px}img{max-width:100%}::highlight(document-sentence){background:#e4edba}::highlight(document-word){background:#34542a;color:#fff}';
  const ready=new Promise(resolve=>frame.onload=resolve);
  frame.srcdoc='<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data: blob:"><style>'+css+'body{background:var(--theme-soft,#f5f5f5);color:var(--theme-text,#242424)}article{background:var(--theme-paper,#fff)}td,th{border-color:var(--theme-line,#ddd)}::highlight(document-sentence){background:var(--theme-active,#e8e8e8)}::highlight(document-word){background:var(--theme-accent,#292929);color:var(--theme-onAccent,#fff)}</style></head><body><article id="wordDocument">'+(html||'')+'</article></body></html>';
  await ready;if(generation!==this.generation)return;this.document=frame.contentDocument;this.wordFrame=frame;this.document.addEventListener('keydown',event=>this.onKeyDown?.(event));frame.contentDocument.getElementById('wordDocument').style.zoom=String(this.zoom);window.AudioTheme?.syncWord(frame.contentDocument);
 }
 index(){
  const scope=this.wordFrame?.contentDocument?.getElementById('wordDocument')||this.container;const walker=this.document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);this.nodes=[];this.map=[];this.text='';let node;
  while((node=walker.nextNode())){if(node.parentElement?.closest('style,script,canvas'))continue;if(!this.wordFrame&&!node.parentElement?.closest('.textLayer'))continue;
   for(let offset=0;offset<node.data.length;){const point=node.data.codePointAt(offset),character=String.fromCodePoint(point),normal=normalizedText(character);for(const c of normal){this.text+=c;this.map.push({node,start:offset,end:offset+character.length});}offset+=character.length;}
  }
 }
 pdfMatch(part,cursor=0){
  const entry=this.pdfPages[part.pdfSource.page-1];if(!entry)return null;
  entry.itemMaps??=entry.textLayer.textDivs.map(div=>{
   const walker=this.document.createTreeWalker(div,4),mapping=[];let text='',node;
   while((node=walker.nextNode()))for(let offset=0;offset<node.data.length;){const character=String.fromCodePoint(node.data.codePointAt(offset)),normal=normalizedText(character);for(const c of normal){text+=c;mapping.push({node,start:offset,end:offset+character.length});}offset+=character.length;}
   return {text,mapping};
  });
  let text='',mapping=[];
  for(const id of part.pdfSource.items){const item=entry.itemMaps[id];if(item){text+=item.text;mapping.push(...item.mapping);}}
  let query=normalizedText(part.text),at=text.indexOf(query,cursor),skip=0;
  if(at<0&&part.kind==='list'){skip=/^\d+[.)]\s+/.exec(part.text)?.[0].length||0;query=normalizedText(part.text.slice(skip));at=text.indexOf(query,cursor);}
  if(at<0||!query)return null;
  return {start:0,end:query.length,skip,sourceEnd:at+query.length,mapping:mapping.slice(at,at+query.length)};
 }
 bind(parts){this.follower.reset();this.lastPart=null;let cursor=0;const pdfCursors=new Map();this.matches=parts.map(part=>{if(part.pdfSource&&this.pdfPages.length){const key=part.pdfSource.page+':'+part.pdfSource.items.join(',');const match=this.pdfMatch(part,pdfCursors.get(key)||0);if(match)pdfCursors.set(key,match.sourceEnd);return match;}let query=normalizedText(part.text),at=this.text.indexOf(query,cursor),skip=0;if(at<0&&part.kind==='list'){const prefix=/^\d+[.)]\s+/.exec(part.text)?.[0]||'';if(prefix){skip=prefix.length;query=normalizedText(part.text.slice(skip));at=this.text.indexOf(query,cursor);}}
   if(at<0||!query)return null;cursor=at+query.length;return {start:at,end:cursor,skip};});this.lastScrolled=null;}
 range(start,end,mapping=this.map){if(!mapping[start]||!mapping[end-1])return null;const range=this.document.createRange();range.setStart(mapping[start].node,mapping[start].start);range.setEnd(mapping[end-1].node,mapping[end-1].end);return range;}
 clearHighlights(){this.document?.defaultView?.CSS?.highlights?.delete('document-sentence');this.document?.defaultView?.CSS?.highlights?.delete('document-word');}
 follow(partIndex,part,word,sentence,autoScroll){
  if(!this.document)return;this.clearHighlights();const match=this.matches[partIndex];if(!match){this.status.textContent='Passagem sem correspond\u00eancia exata no documento. Consulta a frase em leitura.';return;}
  const make=span=>{
   if(!span)return [];
   const start=match.start+normalizedText(part.text.slice(match.skip,Math.max(match.skip,span.start))).length,end=Math.min(match.end,match.start+normalizedText(part.text.slice(match.skip,span.end)).length);
   if(!match.mapping)return [this.range(start,end)].filter(Boolean);
   const ranges=[];let offset=start;
   while(offset<end){let last=offset+1;while(last<end&&match.mapping[last].node===match.mapping[offset].node)last++;const range=this.range(offset,last,match.mapping);if(range)ranges.push(range);offset=last;}
   return ranges;
  };
  const sentenceRanges=make(sentence||{start:match.skip,end:part.text.length}),wordRanges=make(word),wordRange=wordRanges[0];const view=this.document.defaultView;
  if(view.CSS?.highlights&&view.Highlight){if(sentenceRanges.length)view.CSS.highlights.set('document-sentence',new view.Highlight(...sentenceRanges));if(wordRanges.length)view.CSS.highlights.set('document-word',new view.Highlight(...wordRanges));}
  const target=wordRange||sentenceRanges[0];if(autoScroll&&target){
   const rect=target.getClientRects()[0]||target.getBoundingClientRect(),viewport=this.wordFrame?{top:0,bottom:this.wordFrame.clientHeight,left:0,right:this.wordFrame.clientWidth}:this.container.getBoundingClientRect();
   const base=match.mapping?partIndex*100000:match.start;
   const position=word?base+word.start:this.lastPart===partIndex?Math.max(this.follower.position,base+(sentence?.start||0)):base+(sentence?.start||0);this.lastPart=partIndex;
   const delta=this.forceFollow||this.centeredFollow?(rect.top+rect.bottom-viewport.top-viewport.bottom)/2:this.follower.delta(rect,viewport,position,performance.now());
   const horizontal=Number.isFinite(viewport.right)?rect.left<viewport.left?rect.left-viewport.left-20:rect.right>viewport.right?rect.right-viewport.right+20:0:0;
   const now=performance.now(),canMove=this.forceFollow||now>=(this.nextScrollAt||0);this.forceFollow=false;if(canMove&&(Math.abs(delta)>2||horizontal)){this.nextScrollAt=now+420;const options={top:delta,left:horizontal,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'};if(this.wordFrame)view.scrollBy(options);else this.container.scrollBy(options);}
  }
  this.status.textContent=wordRange?'Palavra em leitura no documento': 'Passagem em leitura no documento';
 }
}
