import {listItem, normalize} from './text.js';
import {sourceText} from './semantic-word.js';

// PDF drawing order is not reading order. Group baselines before sorting left to right.
export function pdfLines(items) {
  let textId = 0;
  const glyphs = items.flatMap(item => {
    if (typeof item.str !== 'string') return [];
    const id = textId++;
    if (!item.str.trim()) return [];
    const size = Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
    return [{text: item.str, x: item.transform[4], y: item.transform[5], size,
      endX: item.transform[4] + (item.width || 0), id, hasEOL: item.hasEOL}];
  }).sort((a,b) => b.y-a.y || a.x-b.x);
  const rows = [];
  for (const glyph of glyphs) {
    let row = rows.at(-1);
    if (!row || Math.abs(row.y-glyph.y) > Math.max(1.5, glyph.size*.22)) {
      row = {y:glyph.y, size:glyph.size, glyphs:[]}; rows.push(row);
    }
    row.glyphs.push(glyph); row.size=Math.max(row.size,glyph.size);
  }
  return rows.map(row => {
    const cells=[]; let previous;
    for (const g of row.glyphs.sort((a,b)=>a.x-b.x)) {
      const gap=previous ? g.x-previous.endX : 0;
      if (!previous || gap>row.size*1.3 || previous.hasEOL&&gap>row.size*.5) {
        cells.push({text:g.text,x:g.x,endX:g.endX,ids:[g.id]});
      } else {
        const cell=cells.at(-1);
        cell.text+=(gap>row.size*.12&&!/\s$/.test(cell.text)&&!/^\s/.test(g.text)?' ':'')+g.text;
        cell.endX=Math.max(cell.endX,g.endX); cell.ids.push(g.id);
      }
      previous=g;
    }
    return {text:cells.map(c=>c.text).join(' '),y:row.y,size:row.size,x:cells[0].x,
      endX:Math.max(...cells.map(c=>c.endX)),cells,ids:cells.flatMap(c=>c.ids)};
  });
}

function bodySize(pages) {
  const weights=new Map();
  for (const lines of pages) for (const l of lines) {
    const size=Math.round(l.size*2)/2;
    weights.set(size,(weights.get(size)||0)+l.text.length);
  }
  return [...weights].sort((a,b)=>b[1]-a[1])[0]?.[0]||10;
}

function cleanedPages(pages) {
  const ordered=pages.map(lines=>[...lines].sort((a,b)=>b.y-a.y||a.x-b.x));
  const key=text=>text.trim().replace(/(?:\s*[•·|–—-]\s*|\s+)\d+\s*$/u,'').trim();
  const repeated=new Map();
  ordered.forEach((lines,page)=>{
    const seen=new Set();
    for (const l of [lines[0],lines.at(-1)]) if(l) seen.add(key(l.text));
    for (const k of seen) repeated.set(k,(repeated.get(k)||0)+1);
  });
  return ordered.map((lines,page)=>lines.filter((l,i)=>{
    const height=pages[page].pageHeight;
    const edge=height ? l.y<height*.08||l.y>height*.95 : i===0||i===lines.length-1;
    if(!edge)return true;
    if(/^(?:Página\s+)?\d+(?:\s*(?:de|\/)\s*\d+)?$/iu.test(l.text.trim()))return false;
    return !(pages.length>=2&&(repeated.get(key(l.text))||0)>=Math.max(2,Math.ceil(pages.length*.6)));
  }));
}

function tableAt(lines,start,body) {
  const header=lines[start];
  if(!header.cells||header.cells.length<2||listItem(header.text))return null;
  const columns=header.cells.map(c=>c.x);
  // Numbered outline entries and ordinary prose never establish a table by themselves.
  const next=lines[start+1];
  if(!next||header.y-next.y>body*4||!next.cells||listItem(next.text))return null;
  const aligned=new Set();
  for(const row of lines.slice(start+1,start+4)){if(header.y-row.y>body*4||row.size>body*1.18||listItem(row.text))break;for(const cell of row.cells||[])columns.forEach((x,n)=>{if(Math.abs(x-cell.x)<body*.8)aligned.add(n);});}
  if(aligned.size<2)return null;
  const rows=[]; let current=null,previous=header,end=start;
  for(let i=start;i<lines.length;i++) {
    const line=lines[i];
    if(i>start&&(previous.y-line.y>body*3.2||line.size>body*1.18||listItem(line.text)))break;
    const assignments=(line.cells||[]).map(cell=>{
      const col=columns.findIndex((x,n)=>cell.x>=x-body*.8&&(n===columns.length-1||cell.x<columns[n+1]-body*.8));
      return {cell,col};
    });
    if(!assignments.length||assignments.some(({cell,col})=>col<0||col<columns.length-1&&cell.endX>columns[col+1]-body*.3))break;
    const completeLine=new Set(assignments.map(({col})=>col)).size===columns.length;
    const completeRow=current&&current.every(cell=>cell.text);
    if(!current||previous.y-line.y>body*1.65||completeLine&&completeRow){current=columns.map(()=>({text:'',ids:[]}));rows.push(current);}
    for(const {cell,col} of assignments){current[col].text+=(current[col].text?' ':'')+cell.text;current[col].ids.push(...cell.ids);}
    previous=line;end=i+1;
  }
  return rows.length>=2?{rows,end}:null;
}

export function pdfBlocks(pages) {
  const body=bodySize(pages),out=[];
  cleanedPages(pages).forEach((lines,page)=>{
    // Baseline distance can exceed the font size considerably in spacious PDFs.
    const gaps=lines.slice(1).flatMap((line,i)=>{
      const previous=lines[i],gap=previous.y-line.y;
      return Math.abs(line.size-previous.size)<body*.15&&line.size<body*1.18&&gap>=body*.8&&gap<=body*2.8?[gap]:[];
    }).sort((a,b)=>a-b);
    const lineGap=gaps.length?gaps[Math.floor((gaps.length-1)*.35)]:body*1.4;
    const wrapGap=Math.max(body*1.65,Math.min(body*2.8,lineGap*1.2));
    let paragraph=null,previous=null;
    const add=(block,ids=[])=>{const result={...block};if(ids.length)result.pdfSource={page:page+1,items:ids};out.push(result);return result;};
    for(let i=0;i<lines.length;i++) {
      const line=lines[i],text=normalize(line.text),item=listItem(text);
      const table=tableAt(lines,i,body);
      if(table){
        paragraph=null;
        // Each cell is a separate utterance: row order, then column order, with a pause.
        for(const row of table.rows)for(const cell of row)if(cell.text)add({kind:'table',text:normalize(cell.text)},cell.ids);
        previous=lines[table.end-1];i=table.end-1;continue;
      }
      if(item){paragraph=null;add({kind:'list',text:item.text,ordered:item.ordered,depth:0},line.ids);}
      else if(line.size>=body*1.18&&text.length<180){paragraph=null;add({kind:'heading',level:line.size>=body*1.5?1:2,text},line.ids);}
      else {
        const gap=previous?previous.y-line.y:Infinity;
        const last=out.at(-1);
        const wrappedList=!paragraph&&last?.kind==='list'&&last.pdfSource?.page===page+1&&previous&&gap<=wrapGap&&line.x>=previous.x-body*.3&&line.size<body*1.18;
        if((paragraph||wrappedList)&&gap<=wrapGap){const block=paragraph||last;block.text=normalize(block.text+'\n'+text).replace(/\n/g,' ');if(block.pdfSource)block.pdfSource.items.push(...(line.ids||[]));}
        else paragraph=add({kind:'paragraph',text},line.ids);
      }
      previous=line;
    }
  });
  return out;
}

export function formatPdfPages(pages) {
  return sourceText(pdfBlocks(pages));
}
