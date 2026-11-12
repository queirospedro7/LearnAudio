import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdfLines,pdfBlocks} from '../src/pdf-structure.js';
import {sourceText,validatedBlocks} from '../src/semantic-word.js';
import {segmentsFromBlocks} from '../src/text.js';
import {DocumentView,normalizedText} from '../public/js/document-view.js';

const item=(str,x,y,size=11,width=str.length*5)=>({str,transform:[size,0,0,size,x,y],width,hasEOL:true});
function page(items){const lines=pdfLines(items);lines.pageHeight=842;return lines;}

test('footer painted first is excluded while body and split numbered bullets keep visual order',()=>{
  const pages=Array.from({length:3},(_,p)=>page([
    item('Gestão de Projetos • '+(p+1),400,25,9),
    item('2',48,620),item('•',62,620),item('Scrum e papéis',75,620),
    item('Gestão de Projetos',48,780,24),
    item('O que vais estudar',48,680,16),
    item('1',48,640),item('•',62,640),item('O que é um projeto',75,640),
    item('Este parágrafo explica o trabalho com início e fim definidos.',48,730),
  ]));
  const source=pdfBlocks(pages),text=sourceText(source);
  assert.equal(source[0].text,'Gestão de Projetos');assert.ok(!text.includes('• 1'));
  assert.deepEqual(source.filter(b=>b.kind==='list').slice(0,2).map(b=>b.text),['1. O que é um projeto','2. Scrum e papéis']);
  assert.equal(validatedBlocks(source,text),source);
  assert.ok(segmentsFromBlocks(source).filter(p=>p.kind==='list').every(p=>p.boundary==='list'&&p.pdfSource));
});

test('reads tables by row and column, joining wrapped cells with vertically centred neighbours',()=>{
  const lines=page([
    item('Se o trabalho for',48,700),item('Estamos a falar de',240,700),
    item('Criar uma aplicação nova',48,674),item('Projeto',240,674),
    item('Prestar apoio diário aos',48,648),item('utilizadores',48,634),item('Operação',240,641),
    item('Desenvolver a Estufa robô',48,608),item('Projeto',240,608),
    item('Programa e portfólio',48,565,16),
  ]);
  // Deliberately reverse source drawing order.
  const source=pdfBlocks([lines]);
  assert.deepEqual(source.filter(b=>b.kind==='table').map(b=>b.text),[
    'Se o trabalho for','Estamos a falar de','Criar uma aplicação nova','Projeto',
    'Prestar apoio diário aos utilizadores','Operação','Desenvolver a Estufa robô','Projeto',
  ]);
  assert.equal(source.at(-1).text,'Programa e portfólio');
});

test('joins spacious visual lines into sentences while preserving paragraph and list boundaries',()=>{
  const source=pdfBlocks([page([
    item('Uma frase que ocupa mais',48,700),
    item('do que uma linha no documento.',48,676),
    item('Outra frase no mesmo parágrafo.',48,652),
    item('Um parágrafo separado.',48,610),
    item('1. Um item com uma frase que continua',48,566),
    item('na linha seguinte até terminar.',64,542),
    item('2. Outro item.',48,518),
  ])]);
  assert.deepEqual(source.map(b=>b.kind),['paragraph','paragraph','list','list']);
  assert.equal(source[0].text,'Uma frase que ocupa mais do que uma linha no documento. Outra frase no mesmo parágrafo.');
  assert.equal(source[2].text,'1. Um item com uma frase que continua na linha seguinte até terminar.');
  assert.equal(source[0].pdfSource.items.length,3);
  assert.equal(segmentsFromBlocks(source)[0].text,source[0].text);
});

test('keeps tightly spaced complete table rows separate',()=>{
  const source=pdfBlocks([page([
    item('Task',48,700),item('Type',240,700),
    item('Build',48,686),item('Project',240,686),
    item('Support',48,672),item('Operation',240,672),
  ])]);
  assert.deepEqual(source.map(b=>b.text),['Task','Type','Build','Project','Support','Operation']);
  assert.ok(source.every(b=>b.kind==='table'));
});

test('does not interpret a numbered outline or ordinary wrapped prose as a table',()=>{
  const source=pdfBlocks([page([
    item('1',48,700),item('•',64,700),item('O que é um projeto',80,700),
    item('2',48,680),item('•',64,680),item('Scrum',80,680),
    item('Este texto continua na linha seguinte',48,640),item('e pertence ao mesmo parágrafo.',48,626),
  ])]);
  assert.deepEqual(source.map(b=>b.kind),['list','list','paragraph']);
  assert.equal(source.at(-1).text,'Este texto continua na linha seguinte e pertence ao mesmo parágrafo.');
});

test('PDF matching uses source fragments rather than footer-first DOM order and handles repeated phrases',()=>{
  const viewer=new DocumentView({},{});
  const mapText=(text,id)=>{const node={data:text,id};return {text:normalizedText(text),mapping:[...text].flatMap((char,start)=>[...normalizedText(char)].map(()=>({node,start,end:start+char.length})))};};
  viewer.pdfPages=[{itemMaps:[mapText('Rodapé',0),mapText('Projeto. Projeto.',1),mapText('Célula esquerda',2),mapText('Célula direita',3)]}];
  const parts=[{text:'Projeto.',pdfSource:{page:1,items:[1]}},{text:'Projeto.',pdfSource:{page:1,items:[1]}},{text:'Célula esquerda',kind:'table',pdfSource:{page:1,items:[2]}},{text:'Célula direita',kind:'table',pdfSource:{page:1,items:[3]}}];
  viewer.bind(parts);assert.ok(viewer.matches.every(Boolean));
  assert.equal(viewer.matches[0].mapping[0].start,0);assert.equal(viewer.matches[1].mapping[0].start,9);
  assert.equal(viewer.matches[2].mapping[0].node.id,2);assert.equal(viewer.matches[3].mapping[0].node.id,3);
});

test('actual PDF.js extraction preserves visual order, table cells and exact source references',async()=>{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const draw=(text,x,y,size=11)=>`BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`;
  const streams=[1,2].map(n=>[
    draw('Study guide - '+n,400,25,9), // Footer is intentionally painted first.
    draw('Type',250,570),draw('Operation',250,537),draw('users',48,530),
    draw('Study guide',48,780,20),
    draw('A project has a beginning and an end. A project creates a specific result.',48,730),
    draw('Study topics',48,690,16),
    draw('1',48,660),draw('\\225',62,660),draw('Plan a project',75,660),
    draw('2',48,640),draw('\\225',62,640),draw('Review results',75,640),
    draw('Task',48,570),draw('Support daily',48,544),
    draw('Next chapter',48,480,16),
  ].join('\n'));
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  streams.forEach((stream,i)=>objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`));
  let pdf='%PDF-1.4\n';const offsets=[];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    `trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF`;
  const task=getDocument({data:new Uint8Array(Buffer.from(pdf)),isEvalSupported:false,useSystemFonts:true});
  try{
    const doc=await task.promise,pages=[],raw=[];
    for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),content=await p.getTextContent();raw.push(content.items.filter(i=>typeof i.str==='string'));pages.push(page(content.items));}
    const source=pdfBlocks(pages);
    assert.equal(source[0].text,'Study guide');assert.ok(!source.some(b=>/Study guide -/.test(b.text)));
    assert.deepEqual(source.filter(b=>b.kind==='list').slice(0,2).map(b=>b.text),['1. Plan a project','2. Review results']);
    assert.deepEqual(source.filter(b=>b.kind==='table').slice(0,4).map(b=>b.text),['Task','Type','Support daily users','Operation']);
    for(const block of source){const original=block.pdfSource.items.map(id=>raw[block.pdfSource.page-1][id].str).join(' ');assert.equal(normalizedText(block.text),normalizedText(original));}
  }finally{await task.destroy();}
});
