import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import {pdfBlocks as serverPdfBlocks} from '../src/pdf-structure.js';

test('browser import ships the shared parser without Node-only dependencies',async()=>{
 globalThis.DOMParser=DOMParser;
 const {pdfBlocks}=await import('../public/vendor/structure/pdf-structure.js');
 const {wordBlocks,sourceText}=await import('../public/vendor/structure/semantic-word.js');
 const {safeWordHtml}=await import('../public/vendor/structure/document-structure.js');
 const pages=[[{text:'Uma frase completa.',x:48,y:700,size:11,ids:[0],cells:[{text:'Uma frase completa.',x:48,endX:160,ids:[0]}]}]];
 assert.deepEqual(pdfBlocks(pages),serverPdfBlocks(pages));
 assert.equal(sourceText(wordBlocks('<p>Texto do Word.</p>')),'Texto do Word.');
 assert.ok(!safeWordHtml('<p onclick="bad()">Texto</p><script>bad()</script>').includes('script'));
 for(const name of ['text.js','pdf-structure.js','semantic-word.js','document-structure.js','xml.js']){
  const code=await readFile(new URL('../public/vendor/structure/'+name,import.meta.url),'utf8');
  assert.ok(!code.includes("from '@xmldom"));assert.ok(!code.includes("from 'node:"));
 }
});
