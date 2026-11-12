import {DOMParser} from './xml.js';
import {normalize} from './text.js';
export function wordBlocks(html){
 const doc=new DOMParser({errorHandler:()=>{}}).parseFromString('<body>'+html+'</body>','text/html');const out=[];
 const inline=node=>node.nodeType===3?node.data:node.nodeType!==1?'':node.tagName.toLowerCase()==='br'?'\n':Array.from(node.childNodes).map(inline).join('');
 function walk(node,depth=0,ordinal=null){
  if(node.nodeType!==1)return;const tag=node.tagName.toLowerCase();
  if(/^h[1-6]$/.test(tag)){out.push({kind:'heading',level:Number(tag[1]),text:normalize(inline(node))});return;}
  if(tag==='p'){const text=normalize(inline(node));if(text)out.push({kind:'paragraph',text});return;}
  if(tag==='li'){const nested=Array.from(node.childNodes).filter(n=>n.nodeType===1&&['ul','ol'].includes(n.tagName.toLowerCase()));const text=normalize(Array.from(node.childNodes).filter(n=>!nested.includes(n)).map(inline).join(' '));if(text)out.push({kind:'list',depth,ordered:ordinal!==null,text:(ordinal!==null?ordinal+'. ':'')+text});for(const child of nested)walk(child,depth+1);return;}
  if(tag==='tr'){const cells=Array.from(node.childNodes).filter(n=>n.nodeType===1&&['td','th'].includes(n.tagName.toLowerCase())).map(n=>normalize(inline(n)));if(cells.length)out.push({kind:'table',text:cells.join('; ')});return;}
  let number=Number(node.getAttribute('start')||1)-1;for(const child of Array.from(node.childNodes))walk(child,depth,tag==='ol'&&child.nodeType===1&&child.tagName.toLowerCase()==='li'?++number:null);
 }
 walk(doc.documentElement);return out.filter(b=>b.text);
}
export function sourceText(source){return normalize(source.map(b=>b.kind==='heading'?'#'.repeat(b.level||1)+' '+b.text:b.kind==='list'&&!b.ordered?'- '+b.text:b.text).join('\n\n'));}
export function validatedBlocks(source,text){
 if(!Array.isArray(source)||source.length>40000)return null;
 if(source.some(b=>!b||!['heading','paragraph','list','table'].includes(b.kind)||typeof b.text!=='string'||b.text.length>400000||b.level!==undefined&&(!Number.isInteger(b.level)||b.level<1||b.level>6)||b.depth!==undefined&&(!Number.isInteger(b.depth)||b.depth<0||b.depth>32)))return null;
 if(source.reduce((sum,b)=>sum+b.text.length,0)>400000)return null;
 if(source.some(b=>b.pdfSource&&(!Number.isInteger(b.pdfSource.page)||b.pdfSource.page<1||!Array.isArray(b.pdfSource.items)||b.pdfSource.items.length>100000||b.pdfSource.items.some(id=>!Number.isInteger(id)||id<0||id>1000000))))return null;
 return sourceText(source)===normalize(text)?source:null;
}
