const decode=s=>String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
export function wordTimings(text,events){
 const result=[];let cursor=0;
 for(const event of events){if(event.Type!=='WordBoundary')continue;const data=event.Data,word=decode(data?.text?.Text||'');if(!word)continue;
  const start=text.indexOf(word,cursor),time=Number(data.Offset)/10000000,duration=Number(data.Duration)/10000000;
  if(start<0||!Number.isFinite(time)||time<0||!Number.isFinite(duration)||duration<0)continue;
  result.push({start,end:start+word.length,time,duration});cursor=start+word.length;
 }
 return result.sort((a,b)=>a.time-b.time);
}
