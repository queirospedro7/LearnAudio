import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blocks,segments,pauseBetween} from '../src/text.js';
import {wordHtmlToText,pdfLines,formatPdfPages} from '../src/document-structure.js';
test('keeps Word heading levels, paragraphs, lists and entities',()=>{
 const text=wordHtmlToText('<h1>Projectos &amp; equipas</h1><p>Uma ideia bem explicada.</p><h2>Etapas</h2><ol><li>Planear</li><li>Executar</li></ol><p>A &lt; B</p>');
 const parts=segments(text);assert.deepEqual(parts.map(p=>p.kind),['heading','paragraph','heading','list','list','paragraph']);assert.equal(parts[0].level,1);assert.equal(parts[2].level,2);assert.equal(parts[0].text,'Projectos & equipas');assert.equal(parts[3].text,'1. Planear');assert.equal(parts[4].text,'2. Executar');assert.equal(parts[5].text,'A < B');
});
test('Markdown titles and list items are spoken separately without markers',()=>{
 const parts=segments('# Título\nO projeto tem um início e um fim.\n## Objetivos\n- Planear as tarefas\n- Avaliar os resultados');
 assert.deepEqual(parts.map(p=>p.kind),['heading','paragraph','heading','list','list']);assert.equal(parts[0].text,'Título');assert.equal(parts[0].speechText,'Título.');assert.equal(parts[3].speechText,'Planear as tarefas.');assert.ok(pauseBetween(parts[0],parts[1],0)>=1000);assert.ok(pauseBetween(parts[1],parts[2],0)>=700);
});
test('distinguishes wrapped body lines from uppercase and numbered headings',()=>{
 const text='GESTÃO DE PROJETOS\nUm projeto é um esforço temporário\npara alcançar um resultado específico.\n\n2.1 Planeamento\nO trabalho começa aqui.\n\n1. Identificar tarefas\n2. Rever resultados';
 const parts=segments(text);assert.equal(parts[0].kind,'heading');assert.equal(parts[1].text,'Um projeto é um esforço temporário para alcançar um resultado específico.');assert.equal(parts[2].kind,'heading');assert.equal(parts.at(-1).kind,'list');
});
test('supports underlined headings and does not read separators',()=>{
 assert.deepEqual(blocks('Introdução\n===\nUma frase.\n\n---\n\nConclusão\n---').map(b=>b.kind),['heading','paragraph','heading']);
});
test('PDF extraction marks larger fonts and removes repeated headers and page numbers',()=>{
 const line=(text,y,size=12)=>({text,y,size,x:50});
 const pages=Array.from({length:3},(_,i)=>[line('Manual da disciplina',800),line('CAPÍTULO '+(i+1),750,22),line('Este parágrafo contém o corpo do documento, com uma explicação suficientemente longa para estabelecer o tamanho normal da letra.',710),line(String(i+1),40)]);
 const formatted=formatPdfPages(pages);assert.ok(!formatted.includes('Manual da disciplina'));assert.ok(formatted.includes('# CAPÍTULO 1'));assert.ok(!formatted.includes('\n1\n'));assert.equal(segments(formatted).filter(p=>p.kind==='heading').length,3);
});
test('PDF line reconstruction preserves word spacing',()=>{
 const items=[{str:'Uma',transform:[12,0,0,12,50,700],width:20},{str:'frase.',transform:[12,0,0,12,75,700],width:35,hasEOL:true},{str:'Outra linha.',transform:[12,0,0,12,50,680],width:80}];
 const lines=pdfLines(items);assert.equal(lines.length,2);assert.equal(lines[0].text,'Uma frase.');
});
test('a very long word still fits the speech endpoint limit',()=>{assert.ok(segments('a'.repeat(4000)).every(s=>s.speechText.length<=1800));});
test('real PDF text extraction retains font-based headings',async()=>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const stream='BT /F1 24 Tf 50 750 Td (Project Management) Tj /F1 12 Tf 0 -40 Td (A project has a beginning and an end. This is the body of the document.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;
 const task=getDocument({data:new Uint8Array(Buffer.from(pdf)),isEvalSupported:false,useSystemFonts:true});try{const doc=await task.promise;const page=await doc.getPage(1);const content=await page.getTextContent();const prepared=segments(formatPdfPages([pdfLines(content.items)]));assert.equal(prepared[0].kind,'heading');assert.equal(prepared[0].text,'Project Management');assert.equal(prepared[1].kind,'paragraph');}finally{await task.destroy();}
});
