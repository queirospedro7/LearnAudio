import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.VERCEL='1';
const {default:app}=await import('../src/server.js');
const handler=path=>app.router.stack.find(layer=>layer.route?.path===path).route.stack.at(-1).handle;
const response=()=>({code:200,data:null,status(code){this.code=code;return this;},json(data){this.data=data;return this;},setHeader(){}});
test('cloud import limit is below the Vercel payload cap',()=>{
 const res=response();handler('/api/config')({},res);assert.equal(res.data.cloud,true);assert.equal(res.data.maxUploadBytes,4*1024*1024);
});
test('cloud mode excludes local voices and refuses model installation',async()=>{
 const res=response();await handler('/api/local/status')({},res);assert.deepEqual(res.data,[]);
 const install=response();handler('/api/local/install/:provider')({params:{provider:'piper'}},install);assert.equal(install.code,404);
});
test('same origin deployed requests pass while foreign origins are rejected',()=>{
 const middleware=app.router.stack[0].handle;let passed=false;
 middleware({headers:{host:'audio.example',origin:'https://audio.example'}},response(),()=>{passed=true;});assert.equal(passed,true);
 const res=response();middleware({headers:{host:'audio.example',origin:'https://other.example'}},res,()=>assert.fail('foreign origin'));assert.equal(res.code,403);
});
