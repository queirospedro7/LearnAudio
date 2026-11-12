export function enhanceSelect(select,{search=false}={}){
 const root=document.createElement('div');root.className='select-control';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 const label=document.querySelector(`label[for="${select.id}"]`);if(label){label.id=select.id+'Label';trigger.setAttribute('aria-labelledby',label.id+' '+select.id+'Value');label.onclick=e=>{e.preventDefault();trigger.focus();};}
 const value=document.createElement('span');value.id=select.id+'Value';trigger.append(value);
 const chevron=document.createElement('span');chevron.className='select-chevron';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');trigger.append(chevron);
 const popup=document.createElement('div');popup.className='select-popup';popup.hidden=true;
 const filter=document.createElement('input');filter.type='search';filter.placeholder='Procurar voz…';filter.setAttribute('aria-label','Procurar voz');filter.className='select-search';if(search)popup.append(filter);
 const list=document.createElement('div');list.className='select-options';list.id=select.id+'Options';list.setAttribute('role','listbox');list.setAttribute('aria-label',label?.textContent||'Escolher');trigger.setAttribute('aria-controls',list.id);popup.append(list);root.append(trigger,popup);select.after(root);select.hidden=true;
 let choices=[];
 function close(focus=false){popup.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
 function render(){
  const current=select.selectedOptions[0];value.textContent=current?.textContent||'Sem vozes disponíveis';trigger.disabled=select.disabled||![...select.options].some(o=>!o.disabled&&o.value);root.classList.toggle('is-disabled',trigger.disabled);
  choices=[];list.replaceChildren();
  const query=filter.value.toLocaleLowerCase('pt-PT');
  for(const option of select.options){if(!option.value||!option.textContent.toLocaleLowerCase('pt-PT').includes(query))continue;
   const b=document.createElement('button');b.type='button';b.className='select-option';b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.textContent=option.textContent;b.disabled=option.disabled;b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close(true);};list.append(b);if(!b.disabled)choices.push(b);
  }
  if(!list.children.length){const empty=document.createElement('p');empty.className='select-empty';empty.textContent='Nenhuma voz encontrada.';list.append(empty);}
 }
 function open(last=false){filter.value='';render();document.dispatchEvent(new CustomEvent('select-open',{detail:root}));popup.hidden=false;trigger.setAttribute('aria-expanded','true');if(search)filter.focus();else(choices.find(b=>b.getAttribute('aria-selected')==='true')||choices[last?choices.length-1:0])?.focus();}
 trigger.onclick=()=>popup.hidden?open():close();
 trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();open(e.key==='ArrowUp');}};
 root.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close(true);}if(e.key==='Tab')close();if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&!popup.hidden){if((e.key==='Home'||e.key==='End')&&document.activeElement===filter)return;e.preventDefault();const i=choices.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?choices.length-1:e.key==='ArrowDown'?Math.min(choices.length-1,i+1):Math.max(0,i-1);choices[next]?.focus();}};
 filter.oninput=render;
 document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))close();});document.addEventListener('select-open',e=>{if(e.detail!==root)close();});
 select.addEventListener('change',render);new MutationObserver(render).observe(select,{childList:true,subtree:true,attributes:true});render();
 return {refresh:render,close};
}
