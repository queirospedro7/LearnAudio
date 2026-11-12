import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdfRenderSize,DocumentView} from '../public/js/document-view.js';
test('expanded PDF gets a larger backing canvas with HiDPI resolution',()=>{
 const normal=pdfRenderSize(600,630,1,800),expanded=pdfRenderSize(600,1230,2,800);
 assert.equal(normal.pixelWidth,600);assert.equal(expanded.width,1200);assert.equal(expanded.pixelWidth,2400);assert.equal(expanded.pixelHeight,3200);
 assert.ok(expanded.scale>normal.scale);
});
test('render size fits narrow windows and bounds unusually large pages',()=>{
 assert.equal(pdfRenderSize(600,250,2,800).width,220);
 const size=pdfRenderSize(600,10030,4,800);
 assert.ok(size.pixelWidth<=8193);assert.ok(size.pixelHeight<=8193);assert.ok(size.pixelWidth*size.pixelHeight<16010000);
});
test('resize redraws original PDF while keeping the text layer and reading matches',async()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 const renders=[],updates=[];let replacement;
 globalThis.window={devicePixelRatio:2};globalThis.document={createElement:()=>({style:{},setAttribute(){},getContext:()=>({}),replaceWith:c=>replacement=c})};
 try{
  const container={clientWidth:1230,scrollTop:150};const view=new DocumentView(container,{});
  const sheet={offsetTop:0,get offsetHeight(){return Number.parseFloat(this.style.height)||800;},style:{setProperty(){}}};
  const layer={update:value=>updates.push(value)};const matches=[{start:0,end:10}];view.matches=matches;
  view.pdfPages=[{page:{getViewport:({scale})=>({width:600*scale,height:800*scale}),render:options=>{renders.push(options);return {promise:Promise.resolve()};}},original:{width:600,height:800},sheet,textLayer:layer,canvas:{style:{},replaceWith:c=>replacement=c},size:pdfRenderSize(600,630,1,800)}];
  await view.refreshPdf();
  assert.equal(replacement.width,2400);assert.equal(replacement.height,3200);assert.deepEqual(renders[0].transform,[2,0,0,2,0,0]);assert.equal(updates[0].viewport.width,1200);
  assert.equal(view.pdfPages[0].textLayer,layer);assert.equal(view.matches,matches);assert.equal(container.scrollTop,300);
  await view.refreshPdf();assert.equal(renders.length,1);
  container.clientWidth=630;await view.refreshPdf();assert.equal(renders.length,2);assert.equal(view.pdfPages[0].size.width,600);assert.equal(container.scrollTop,150);
  view.setZoom(1.5);clearTimeout(view.resizeTimer);await view.refreshPdf();assert.equal(view.pdfPages[0].size.width,900);assert.equal(view.pdfPages[0].canvas.width,1800);
  assert.equal(view.setZoom(5),2);clearTimeout(view.resizeTimer);assert.equal(view.setZoom(.1),.5);clearTimeout(view.resizeTimer);
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
