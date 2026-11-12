import {test} from 'node:test';
import assert from 'node:assert/strict';
import {segments,blocks} from '../src/text.js';
import {readingPause} from '../public/js/pauses.js';

const topics=['O que é um projeto','Como se organiza a gestão de um projeto','As dez áreas de conhecimento','PM Canvas','Waterfall e termo de abertura','Objetivos requisitos e entregas','WBS e dependências','Caminho crítico','Pessoas cronograma e marcos','Riscos e formas de responder','RACI e SWOT','Agile e Manifesto Ágil','Scrum e os seus papéis','Backlogs e trabalho concluído','O que acontece num Sprint','Gráficos e comparação de abordagens','Exercícios com soluções','Revisão final e materiais'];
test('study outline has a title and eighteen separately paused topics',()=>{
 const parts=segments('O que vais estudar\n'+topics.map((t,i)=>`${i+1} • ${t}`).join('\n'));
 assert.equal(parts.length,19);assert.equal(parts[0].kind,'heading');
 assert.equal(readingPause(parts[0],parts[1]),1100);
 parts.slice(1).forEach((part,i)=>{
  assert.equal(part.kind,'list');assert.equal(part.ordered,true);
  assert.equal(part.text,`${i+1}. ${topics[i]}`);
  assert.equal(readingPause(part,parts[i+2],{list:900}),900);
 });
});
test('recognises common bullet glyphs and preserves wrapped list items',()=>{
 for(const glyph of ['•','·','●','◦','‣','⁃']){
  const result=blocks(`Título\n1 ${glyph} Primeiro tópico\ncontinuação do tópico\n2 ${glyph} Segundo tópico`);
  assert.equal(result.length,3);assert.equal(result[1].text,'1. Primeiro tópico continuação do tópico');
  assert.equal(result[2].text,'2. Segundo tópico');
 }
 assert.deepEqual(blocks('• Primeiro\n• Segundo').map(b=>b.kind),['list','list']);
});
test('keeps ordinary wrapped prose together',()=>{
 assert.deepEqual(blocks('Este parágrafo continua\nna linha seguinte.'),[{kind:'paragraph',text:'Este parágrafo continua na linha seguinte.'}]);
});
