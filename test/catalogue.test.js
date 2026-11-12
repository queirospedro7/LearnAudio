import {test} from 'node:test';
import assert from 'node:assert/strict';
import {europeanEdgeVoices} from '../src/voice-discovery.js';
import {localDefinitions,localCatalogue,validWav} from '../src/local-voices.js';
test('discovers only PT-PT voices, without duplicates or unsafe identifiers',()=>{
 const voices=europeanEdgeVoices([{Locale:'pt-PT',ShortName:'pt-PT-NewNeural',Gender:'Female'},{Locale:'pt-PT',ShortName:'pt-PT-NewNeural',Gender:'Female'},{Locale:'pt-BR',ShortName:'pt-BR-FranciscaNeural'},{Locale:'pt-PT',ShortName:'../../file'},{Locale:'en-US',ShortName:'pt-PT-FakeNeural'}]);
 assert.equal(voices.length,1);assert.equal(voices[0].name,'New');assert.equal(voices[0].verified,true);assert.equal(voices[0].provider,'edge');
});
test('local models have separate identities and source attribution',()=>{
 assert.equal(localDefinitions.length,2);assert.equal(new Set(localDefinitions.map(v=>v.id)).size,2);assert.ok(localDefinitions.every(v=>v.source.startsWith('https://huggingface.co/')&&v.license));
});
test('an uninstalled local model cannot appear as ready',async()=>{
 for(const v of await localCatalogue())if(!v.installed)assert.equal(v.available,false);
});
test('rejects non-audio responses as local synthesis output',()=>{
 assert.equal(validWav(Buffer.from('<html>not audio</html>')),false);
 const wav=Buffer.alloc(60);wav.write('RIFF',0);wav.write('WAVE',8);assert.equal(validWav(wav),true);
});
