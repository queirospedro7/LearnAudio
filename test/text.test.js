import {test} from 'node:test';import assert from 'node:assert/strict';import {normalize,segments,escapeXml} from '../src/text.js';
test('reconstitui palavras divididas na extração',()=>assert.equal(normalize('infor-\nmação\r\n\r\nOutra ideia.'),'informação\n\nOutra ideia.'));
test('mantém conteúdo e pausa entre parágrafos',()=>{const parts=segments('Primeira ideia. Outra frase!\n\nSegundo parágrafo.');assert.equal(parts.length,2);assert.equal(parts[0].pause,650);assert.equal(parts[1].text,'Segundo parágrafo.');});
test('divide documentos longos sem perder palavras',()=>{const text=('Uma frase de exemplo. ').repeat(300);const parts=segments(text);assert.ok(parts.every(p=>p.text.length<1800));assert.equal(parts.map(p=>p.text).join(' '),text.trim());});
test('escapa marcação enviada ao motor de voz',()=>assert.equal(escapeXml('<teste> & voz'),'&lt;teste&gt; &amp; voz'));
