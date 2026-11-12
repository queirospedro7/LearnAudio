import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shortcutAction} from '../public/js/shortcuts.js';
test('maps playback, passage navigation and document controls',()=>{
 for(const [key,action] of [[' ','toggle'],['ArrowLeft','previous'],['ArrowRight','next'],['r','recenter'],['f','expand'],['+','zoomIn'],['-','zoomOut'],['0','zoomReset']])assert.equal(shortcutAction({key}),action);
});
test('preserves typing, native controls, modifiers, dialogs and held keys',()=>{
 for(const extra of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{defaultPrevented:true},{target:{isContentEditable:true}},{target:{closest:()=>true}}])assert.equal(shortcutAction({key:' ',...extra}),null);
 assert.equal(shortcutAction({key:' '},{modal:true}),null);
 assert.equal(shortcutAction({key:'+' ,shiftKey:true}),'zoomIn');
});
