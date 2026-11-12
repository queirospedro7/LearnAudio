export function shortcutAction(event,{modal=false}={}){
 if(event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||modal)return null;
 const target=event.target;
 if(target?.isContentEditable||target?.closest?.('input,textarea,select,button,a,summary,audio,[contenteditable]:not([contenteditable="false"]),[role="listbox"],[role="option"],[role="slider"]'))return null;
 if(event.shiftKey&&!['+','_'].includes(event.key))return null;
 return ({' ':'toggle',ArrowLeft:'previous',ArrowRight:'next',r:'recenter',f:'expand','+':'zoomIn','=':'zoomIn','-':'zoomOut','0':'zoomReset',Escape:'collapse'})[event.key.length===1?event.key.toLowerCase():event.key]||null;
}
