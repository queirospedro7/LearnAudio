export const defaults={paragraph:700,sentence:150,list:500,heading:1100,beforeHeading:700};
export function readingPause(current,next,options={}){const p={...defaults,...options},kind=current.boundary||current.kind;return Math.max(kind==='continuation'?p.sentence:kind==='heading'?p.heading:kind==='list'?p.list:p.paragraph,next?.pauseBefore?p.beforeHeading:0);}
