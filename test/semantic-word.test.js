import {test} from 'node:test';import assert from 'node:assert/strict';
import {wordBlocks,sourceText,validatedBlocks} from '../src/semantic-word.js';
import {segmentsFromBlocks} from '../src/text.js';
test('preserves original topic and subtopic nesting without guessing paragraph headings',()=>{
 const html='<h1>Planeamento</h1><p>ESTE TEXTO É UM PARÁGRAFO</p><ul><li><p>Primeiro tópico</p><ul><li>Subtópico</li></ul></li><li>Segundo tópico</li></ul>';
 const source=wordBlocks(html);assert.deepEqual(source.map(b=>b.kind),['heading','paragraph','list','list','list']);assert.equal(source[3].depth,1);assert.equal(source[4].depth,0);const prepared=segmentsFromBlocks(source);assert.equal(prepared[1].kind,'paragraph');assert.equal(prepared[3].depth,1);assert.equal(validatedBlocks(source,sourceText(source)),source);
});
test('keeps numbering and tables in reading order',()=>{const source=wordBlocks('<ol start="3"><li>Fazer</li><li>Rever</li></ol><table><tr><td>Etapa</td><td>Resultado</td></tr></table>');assert.equal(source[0].text,'3. Fazer');assert.equal(source[1].text,'4. Rever');assert.equal(source[2].kind,'table');assert.equal(source[2].text,'Etapa; Resultado');});
test('rejects stale or invalid imported structure after the editor changes',()=>{const source=wordBlocks('<h1>Título</h1><p>Texto</p>');assert.equal(validatedBlocks(source,'Texto alterado'),null);assert.equal(validatedBlocks([{kind:'heading',level:100,text:'Título'}],'Título'),null);});
