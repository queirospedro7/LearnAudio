const defaults={scale:100,text:100,spacing:100};
let preferences={...defaults};
try{const saved=JSON.parse(localStorage.getItem('audio-interface')||'{}');for(const key of Object.keys(defaults))if(Number.isFinite(saved[key]))preferences[key]=Math.max(100,Math.min(key==='scale'?150:180,saved[key]));}catch{}
const dialog=document.createElement('dialog');dialog.className='preferences-dialog';dialog.setAttribute('aria-labelledby','preferencesTitle');
dialog.innerHTML='<form method="dialog" class="preferences-head"><div><h2 id="preferencesTitle">Definições</h2><p>Adapta o espaço de leitura ao teu conforto.</p></div><button aria-label="Fechar definições">Fechar</button></form><div class="preferences-fields"></div>';
const fields=dialog.querySelector('.preferences-fields'),controls=new Map();
for(const [key,title,description] of [
 ['scale','Tamanho da interface','Aumenta os menus, botões e texto da aplicação.'],
 ['text','Texto de leitura','Aumenta o texto editável e o acompanhamento da leitura. Para o PDF, usa os botões de zoom.'],
 ['spacing','Espaçamento das linhas','Dá mais espaço entre as linhas do texto de leitura.'],
]){
 const label=document.createElement('label');label.className='preference-row';
 const name=document.createElement('span');name.textContent=title;
 const output=document.createElement('output'),input=document.createElement('input');input.type='range';input.min='100';input.max=key==='scale'?'150':'180';input.step='10';input.value=preferences[key];input.setAttribute('aria-label',title);
 const hint=document.createElement('small');hint.textContent=description;label.append(name,output,input,hint);fields.append(label);controls.set(key,{input,output});
 input.oninput=()=>{preferences[key]=Number(input.value);apply();};
}
const reset=document.createElement('button');reset.type='button';reset.textContent='Repor apresentação';reset.onclick=()=>{preferences={...defaults};apply();};fields.append(reset);document.body.append(dialog);
function apply(){
 document.documentElement.style.zoom=String(preferences.scale/100);
 document.documentElement.style.setProperty('--reading-text-scale',String(preferences.text/100));
 document.documentElement.style.setProperty('--reading-line-height',String(1.95*preferences.spacing/100));
 for(const [key,{input,output}] of controls){input.value=preferences[key];output.textContent=preferences[key]+'%';}
 try{localStorage.setItem('audio-interface',JSON.stringify(preferences));}catch{}
 window.dispatchEvent(new Event('resize'));
}
for(const button of document.querySelectorAll('[data-open-preferences]'))button.onclick=()=>dialog.showModal();
apply();

const shortcutHelp=document.createElement('section');shortcutHelp.className='shortcut-help';
shortcutHelp.innerHTML='<h3>Atalhos de teclado</h3><dl><dt><kbd>Espaço</kbd></dt><dd>Pausar / continuar ou iniciar leitura</dd><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Excerto anterior / seguinte</dd><dt><kbd>R</kbd></dt><dd>Recentrar na leitura</dd><dt><kbd>F</kbd></dt><dd>Expandir / reduzir documento</dd><dt><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd></dt><dd>Aumentar, diminuir ou repor zoom</dd><dt><kbd>Esc</kbd></dt><dd>Sair do modo expandido</dd></dl><p>Ao escrever ou usar um controlo, as teclas mantêm a sua função normal.</p>';
fields.append(shortcutHelp);
