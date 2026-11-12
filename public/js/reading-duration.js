import {readingPause} from './pauses.js';
export function wordCount(text){return [...new Intl.Segmenter('pt-PT',{granularity:'word'}).segment(text)].filter(w=>w.isWordLike).length;}
export function formatDuration(seconds){const n=Math.max(0,Math.round(Number.isFinite(seconds)?seconds:0));const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?`${h} h ${String(m).padStart(2,'0')} min`:m?`${m} min ${String(s).padStart(2,'0')} s`:`${s} s`;}
export function boundaryPause(current,next,paragraphMs){return Math.max(current.boundary==='paragraph'?paragraphMs:current.pause||0,next?.pauseBefore||0)/1000;}
export function playbackEstimate(parts,index,time,durations,rate=1,playbackRate=1,paragraphMs=700,provider='edge',options=null){
 const safeRate=Math.max(.1,rate),words=parts.map(p=>wordCount(p.text));let measuredWords=0,measuredSeconds=0;
 for(const [i,duration] of durations){if(words[i]>=8&&Number.isFinite(duration)&&duration>0){measuredWords+=words[i];measuredSeconds+=duration*(provider==='kokoro'?1:safeRate);}}
 const secondsPerWord=measuredWords?Math.min(1,Math.max(.18,measuredSeconds/measuredWords)):60/155;
 const speech=parts.map((p,i)=>durations.has(i)?durations.get(i)/(i===index?Math.max(.1,playbackRate):provider==='kokoro'?safeRate:1):words[i]*secondsPerWord/safeRate);
 const pauses=parts.map((p,i)=>i+1<parts.length?(options?readingPause(p,parts[i+1],options)/1000:boundaryPause(p,parts[i+1],paragraphMs)):0);
 const total=speech.reduce((a,b)=>a+b,0)+pauses.reduce((a,b)=>a+b,0);
 let elapsed=0;for(let i=0;i<index;i++)elapsed+=speech[i]+pauses[i];if(parts[index])elapsed+=Math.min(speech[index],Math.max(0,time)/Math.max(.1,playbackRate));
 return {total,elapsed:Math.min(total,elapsed),remaining:Math.max(0,total-elapsed),percent:total?Math.min(100,elapsed/total*100):0};
}
export function documentEstimate(text,rate=1,pauseMs=700,source=null,options=null){
 const words=wordCount(text.replace(/^\s*#{1,6}\s*/gm,''));if(!words)return 0;
 const lines=source||text.split(/\n+/).filter(s=>s.trim()).map(s=>({kind:/^\s*#{1,6}\s/.test(s)?'heading':/^\s*(?:[-*+\u2022]|\d+[.)])\s/.test(s)?'list':'paragraph'}));
 const pauses=lines.slice(0,-1).reduce((sum,b,i)=>sum+(options?readingPause({...b,boundary:b.kind},{pauseBefore:lines[i+1]?.kind==='heading'?1:0},options)/1000:b.kind==='heading'?1.1:b.kind==='list'?.4:pauseMs/1000),0)+(options?Math.max(0,[...new Intl.Segmenter('pt-PT',{granularity:'sentence'}).segment(text)].length-lines.length)*options.sentence/1000:0);
 return words*60/(155*Math.max(.1,rate))+pauses;
}
