import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizedText,DocumentView} from '../public/js/document-view.js';
import {safeWordHtml} from '../src/document-structure.js';
test('matches original passages across accents and line-wrap punctuation',()=>{
 const viewer=new DocumentView({},{});viewer.text=normalizedText('GESTÃO DE PROJETOS Um projeto tem um início. Um projeto tem um fim.');
 viewer.bind([{text:'GESTÃO DE PROJETOS',kind:'heading'},{text:'Um projeto tem um início.',kind:'paragraph'},{text:'Um projeto tem um fim.',kind:'paragraph'}]);
 assert.ok(viewer.matches.every(Boolean));assert.ok(viewer.matches[2].start>=viewer.matches[1].end);
});
test('does not guess when the original passage is absent',()=>{const viewer=new DocumentView({},{});viewer.text=normalizedText('Texto original.');viewer.bind([{text:'Texto que não existe.',kind:'paragraph'}]);assert.equal(viewer.matches[0],null);});
test('numbered list matches Word text even when numbering is decorative',()=>{const viewer=new DocumentView({},{});viewer.text=normalizedText('Planear Executar');viewer.bind([{text:'1. Planear',kind:'list'},{text:'2. Executar',kind:'list'}]);assert.ok(viewer.matches.every(Boolean));assert.equal(viewer.matches[0].skip,3);});
test('Word preview retains headings and tables but rejects active content',()=>{const result=safeWordHtml('<h1 onclick="bad()">Título</h1><script>bad()</script><table><tr><td colspan="2">Texto</td></tr></table><img src="https://external.example/img"><iframe src="https://external.example"></iframe><a href="javascript:bad()">Ligação</a>');assert.ok(result.includes('<h1>Título</h1>'));assert.ok(result.includes('colspan="2"'));assert.ok(!/script|onclick|iframe|https:|javascript:/.test(result));});

test('explicit recenter focuses the current passage once without changing the match',()=>{
 const previous=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});
 try{
  let top=900;const scrolls=[];
  const viewer=new DocumentView({getBoundingClientRect:()=>({top:100,bottom:700}),scrollBy:options=>{scrolls.push(options);top-=options.top;}},{});
  viewer.document={defaultView:{}};viewer.matches=[{start:0,end:12,skip:0}];
  viewer.range=()=>({getClientRects:()=>[{top,bottom:top+20}]});
  viewer.forceFollow=true;viewer.follow(0,{text:'Texto atual.'},null,null,true);
  assert.equal(scrolls[0].top,510);assert.equal(viewer.forceFollow,false);assert.equal(viewer.matches[0].start,0);
  viewer.follow(0,{text:'Texto atual.'},null,null,true);assert.equal(scrolls.length,1);
 }finally{if(previous===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=previous;}
});

test('PDF click selects the matching sentence and ignores text selection',()=>{
 const viewer=new DocumentView({},{}),node={parentElement:{closest:()=>true}};
 viewer.pdfPages=[{}];viewer.document={getSelection:()=>({toString:()=>''}),caretPositionFromPoint:()=>({offsetNode:node,offset:5})};
 viewer.matches=[{mapping:[{node,start:0,end:4}]},{mapping:[{node,start:5,end:10}]}];
 let selected=-1;viewer.onSeek=i=>selected=i;viewer.seekAt({clientX:1,clientY:1});assert.equal(selected,1);
 selected=-1;viewer.document.getSelection=()=>({toString:()=> 'selected text'});viewer.seekAt({clientX:1,clientY:1});assert.equal(selected,-1);
});
test('automatic centring follows successive lines even while visible',()=>{
 const previous=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});
 try{
 let top=200;const scrolls=[];const viewer=new DocumentView({getBoundingClientRect:()=>({top:100,bottom:700}),scrollBy:options=>scrolls.push(options)},{});
 viewer.document={defaultView:{}};viewer.matches=[{start:0,end:12,skip:0}];viewer.range=()=>({getClientRects:()=>[{top,bottom:top+20}]});viewer.centeredFollow=true;
 viewer.follow(0,{text:'Texto atual.'},null,null,true);assert.equal(scrolls[0].top,-190);
 top=450;viewer.nextScrollAt=0;viewer.follow(0,{text:'Texto atual.'},null,null,true);assert.equal(scrolls[1].top,60);
 }finally{if(previous===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=previous;}
});

test('disabled document follow preserves highlights without scrolling',()=>{
 const viewer=new DocumentView({scrollBy:()=>assert.fail('manual scroll must be preserved')},{});
 viewer.document={defaultView:{}};viewer.matches=[{start:0,end:12,skip:0}];
 viewer.range=()=>({getClientRects:()=>[{top:900,bottom:920}]});
 viewer.follow(0,{text:'Texto atual.'},null,null,false);
 assert.equal(viewer.status.textContent,'Passagem em leitura no documento');
});
