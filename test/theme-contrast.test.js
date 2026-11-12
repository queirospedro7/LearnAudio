import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function palette(theme){const values={};const root={style:{setProperty:(k,v)=>values[k.slice(8)]=v},dataset:{}};vm.runInNewContext(fs.readFileSync(new URL('../public/js/themes.js',import.meta.url),'utf8'),{document:{documentElement:root,querySelectorAll:()=>[],addEventListener:()=>{}},localStorage:{getItem:()=>theme},window:{}});return values;}
const luminance=hex=>{const values=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const theme of ['light','dark','sepia'])test(`${theme}: text, secondary text, highlights and control outlines have sufficient contrast`,()=>{
 const p=palette(theme);
 for(const background of ['page','paper','soft','active'])for(const foreground of ['text','muted'])assert.ok(contrast(p[foreground],p[background])>=4.5,`${foreground} on ${background}: ${contrast(p[foreground],p[background])}`);
 assert.ok(contrast(p.onAccent,p.accent)>=4.5);
 for(const bg of ['paper','soft'])assert.ok(contrast(p.controlBorder,p[bg])>=3,`control border on ${bg}`);
});
