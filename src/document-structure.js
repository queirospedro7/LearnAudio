import {DOMParser} from './xml.js';
import {normalize} from './text.js';
export function wordHtmlToText(html){
 const doc=new DOMParser({errorHandler:()=>{}}).parseFromString('<body>'+html+'</body>','text/html');const output=[];
 function text(node){if(node.nodeType===3)return node.data;if(node.nodeType!==1)return '';if(node.tagName.toLowerCase()==='br')return '\n';return [...Array.from(node.childNodes)].map(text).join('');}
 function visit(node,ordered=false){
  if(node.nodeType!==1)return;const tag=node.tagName.toLowerCase();
  if(/^h[1-6]$/.test(tag)){output.push('#'.repeat(Number(tag[1]))+' '+normalize(text(node)));return;}
  if(tag==='li'){const direct=Array.from(node.childNodes).filter(n=>n.nodeType!==1||!['ul','ol'].includes(n.tagName.toLowerCase())).map(text).join('');output.push((ordered?ordered+'. ':'- ')+normalize(direct));for(const child of Array.from(node.childNodes))if(child.nodeType===1&&['ul','ol'].includes(child.tagName.toLowerCase()))visit(child);return;}
  if(tag==='tr'){output.push(Array.from(node.childNodes).filter(n=>n.nodeType===1&&['td','th'].includes(n.tagName.toLowerCase())).map(n=>normalize(text(n))).join('; '));return;}
  if(tag==='p'){const value=normalize(text(node));if(value)output.push(value);return;}
  let ordinal=Number(node.getAttribute('start')||1)-1;for(const child of Array.from(node.childNodes))visit(child,tag==='ol'&&child.nodeType===1&&child.tagName.toLowerCase()==='li'?++ordinal:0);
 }
 visit(doc.documentElement);return output.join('\n\n');
}
export function safeWordHtml(html){
 const doc=new DOMParser({errorHandler:()=>{}}).parseFromString('<body>'+html+'</body>','text/html');
 const allowed=new Set(['p','h1','h2','h3','h4','h5','h6','strong','em','u','s','br','ul','ol','li','table','thead','tbody','tr','td','th','blockquote','sup','sub','img']);
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function visit(node){if(node.nodeType===3)return escape(node.data);if(node.nodeType!==1)return '';const tag=node.tagName.toLowerCase();if(['script','style','iframe','object'].includes(tag))return '';const inside=Array.from(node.childNodes).map(visit).join('');if(!allowed.has(tag))return inside;let attrs='';for(const attr of ['colspan','rowspan','start']){const v=node.getAttribute(attr);if(v&&/^\d{1,3}$/.test(v))attrs+=' '+attr+'="'+v+'"';}if(tag==='img'){const src=node.getAttribute('src')||'';return /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(src)?'<img src="'+escape(src)+'" alt="'+escape(node.getAttribute('alt')||'')+'">':'';}return '<'+tag+attrs+'>'+inside+(tag==='br'?'':'</'+tag+'>');}
 return Array.from(doc.documentElement.childNodes).map(visit).join('');
}
export {pdfLines,formatPdfPages,pdfBlocks} from './pdf-structure.js';
