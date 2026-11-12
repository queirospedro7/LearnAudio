export class StableFollower {
 constructor(){this.reset();}
 reset(){this.position=-1;this.lastMove=-Infinity;this.forceNext=true;}
 delta(rect,viewport,position,now=performance.now(),force=false){
  force=force||this.forceNext;this.forceNext=false;const backwards=this.position>=0&&position<this.position;this.position=position;
  if(!force&&!backwards&&now-this.lastMove<380)return 0;
  const margin=Math.min(55,(viewport.bottom-viewport.top)*.13);let delta=0;
  if(rect.bottom>viewport.bottom-margin)delta=rect.bottom-(viewport.bottom-margin)+margin;
  else if((force||backwards||rect.bottom<viewport.top)&&rect.top<viewport.top+margin)delta=rect.top-(viewport.top+margin);
  if(Math.abs(delta)<2)return 0;this.lastMove=now;return delta;
 }
}
