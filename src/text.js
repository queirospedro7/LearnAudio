export function normalize(text){return text.normalize('NFC').replace(/\r\n?/g,'\n').replace(/\u00ad\n?/g,'').replace(/([\p{L}])-\n(?=[\p{Ll}])/gu,'$1').replace(/[\t\u00a0 ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
function shortHeading(line){
 const words=line.split(/\s+/);if(line.length>110||words.length>14||/[.;,]$/.test(line))return false;
 const letters=line.replace(/[^\p{L}]/gu,'');
 return letters.length>2&&letters===letters.toUpperCase()||/^\d+(?:\.\d+)+\.?\s+\p{Lu}/u.test(line)||/^(?:Cap\u00edtulo|Parte|Sec\u00e7\u00e3o|Unidade)\s+[\dIVX]+\b/iu.test(line);
}
// Keep numbered bullet labels as spoken numbers, without reading the bullet glyph.
export function listItem(line){
 const numberedBullet=/^(\d+)\s*[\u2022\u00b7\u25cf\u25e6\u2023\u2043]\s*(\S.*)$/u.exec(line);
 if(numberedBullet)return {text:numberedBullet[1]+'. '+numberedBullet[2],ordered:true};
 const ordered=/^((?:\d+|[a-zA-Z])[.)]|\(\d+\)|\([a-zA-Z]\))\s+(\S.*)$/u.exec(line);
 if(ordered)return {text:ordered[1]+' '+ordered[2],ordered:true};
 const bullet=/^[-+*\u0007?\u2022\u00b7\u25cf\u25cb\u25e6\u25aa\u25ab\u2023\u2043\u2013\u2014]\s*(\S.*)$/u.exec(line);
 return bullet?{text:bullet[1],ordered:false}:null;
}
export function blocks(text){
 const lines=normalize(text).split('\n'),result=[];let paragraph=[];
 const flush=()=>{if(paragraph.length){result.push({kind:'paragraph',text:paragraph.join(' ')});paragraph=[];}};
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line){flush();continue;}
  if(/^(```|~~~)/.test(line)){flush();continue;}
  const explicit=/^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(line);
  if(explicit){flush();result.push({kind:'heading',level:Math.min(3,explicit[1].length),text:explicit[2]});continue;}
  if(i+1<lines.length&&/^(?:={3,}|-{3,})$/.test(lines[i+1].trim())){flush();result.push({kind:'heading',level:lines[++i].trim()[0]==='='?1:2,text:line});continue;}
  if(/^(?:[-*_]\s*){3,}$/.test(line)){flush();continue;}
  const list=listItem(line);
  if(list){flush();result.push({kind:'list',text:list.text,ordered:list.ordered,depth:Math.min(12,Math.floor(lines[i].match(/^\s*/)[0].length/2))});continue;}
  const numberedTitle=/^\d+(?:\.\d+)*[.)]?\s+(.+)$/.exec(line);
  if(shortHeading(line)&&(!/^\d/.test(line)||numberedTitle)){flush();result.push({kind:'heading',level:1,text:line});continue;}
  // Infer only short isolated lines or a short title followed by an explanatory sentence.
  const short=line.length<=95&&line.split(/\s+/).length<=10&&!/[<>=]/.test(line)&&!/[.,;:!?]$/.test(line)&&/^\p{Lu}/u.test(line);
  const previousBlank=i===0||!lines[i-1].trim(),next=lines[i+1]?.trim();
  const nextBlank=!next;
  const nextExplains=next&&/^\p{Lu}/u.test(next)&&next.split(/\s+/).length>=9&&/[.!?:]$/.test(next);
  if(short&&previousBlank&&(nextBlank||nextExplains||listItem(next))){flush();result.push({kind:'heading',level:2,text:line});continue;}
  const last=result.at(-1);
  if(!paragraph.length&&last?.kind==='list'&&i>0&&lines[i-1].trim()&&(/^\s{2,}\S/.test(lines[i])||!/[.!?;:]$/.test(last.text))){last.text+=' '+line;continue;}
  paragraph.push(line);
 }
 flush();return result;
}
function splitLong(text){
 const result=[];let chunk='';
 for(const {segment} of new Intl.Segmenter('pt-PT',{granularity:'sentence'}).segment(text)){
  const sentence=segment.trim();if(chunk.length+sentence.length+1>1100&&chunk){result.push(chunk);chunk='';}
  if(sentence.length>1500){for(const word of sentence.split(/\s+/)){if(chunk.length+word.length+1>1100&&chunk){result.push(chunk);chunk='';}if(word.length>1500){if(chunk){result.push(chunk);chunk='';}for(let i=0;i<word.length;i+=1100)result.push(word.slice(i,i+1100));}else chunk+=(chunk?' ':'')+word;}}
  else chunk+=(chunk?' ':'')+sentence;
 }
 if(chunk)result.push(chunk);return result;
}
export function segments(text){
 return segmentsFromBlocks(blocks(text));
}
export function segmentsFromBlocks(source){
 return source.flatMap((block,blockIndex)=>{
  const chunks=splitLong(block.text);
  return chunks.map((text,i)=>({text,speechText:/[.!?:;\u2026]$/.test(text)?text:text+'.',kind:block.kind,level:block.level||0,depth:block.depth||0,ordered:Boolean(block.ordered),blockIndex,...(block.pdfSource?{pdfSource:block.pdfSource}:{}),pauseBefore:block.kind==='heading'?700:0,pause:i<chunks.length-1?180:block.kind==='heading'?1100:block.kind==='list'?400:650,boundary:i<chunks.length-1?'continuation':block.kind}));
 });
}
export function pauseBetween(current,next,paragraphPause=650){return Math.max(current.boundary==='paragraph'?paragraphPause:current.pause,next?.pauseBefore||0);}
export function escapeXml(s){return s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}

export function readingSentences(text){
 const raw=[...new Intl.Segmenter('pt-PT',{granularity:'sentence'}).segment(text)].map(s=>s.segment.trim()).filter(Boolean),out=[];
 for(let i=0;i<raw.length;i++){let sentence=raw[i];while(i+1<raw.length&&(/(?:\b(?:Sr|Sra|Srta|Dr|Dra|Prof|Profa|Eng|Arq|Exmo|Exma|Av|Rua|art|arts|p\u00e1g|p\u00e1gs|vol|n|etc)|\b[A-Z])\.$/iu.test(sentence)||/^\s*(?:\d+|[a-zA-Z])[.)]$/.test(sentence))){sentence+=' '+raw[++i];}out.push(sentence);}return out;
}
