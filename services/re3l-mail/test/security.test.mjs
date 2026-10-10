import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {schemas,verifyWebhook,referenceIds,createService,MailError} from '../core.mjs';
import {mcp,tools} from '../protocol.mjs';
test('rejects header injection and extra fields',()=>{
 assert.throws(()=>schemas.create_draft.parse({to:['a@example.com'],subject:'Hello\r\nBcc: victim@example.com',text:'x'}));
 assert.throws(()=>schemas.create_draft.parse({to:['a@example.com'],subject:'Hello',text:'x',from:'attacker@example.com'}));
 assert.throws(()=>schemas.create_draft.parse({to:['bad'],subject:'Hi',text:'x'}));
});
test('requires a draft and an owner token to send',()=>{
 assert.throws(()=>schemas.send_email.parse({to:['a@example.com'],subject:'Hi',text:'x'}));
 assert.throws(()=>schemas.send_email.parse({draft_id:'ad8548dd-7ed8-4dfe-ac1e-d80232f23613',approval_token:'yes'}));
});
test('webhook requires valid signature and recent timestamp',()=>{
 const secret=Buffer.from('test-secret').toString('base64'),raw=JSON.stringify({type:'email.received'}),timestamp='1700000000',id='msg_test';
 const signature=createHmac('sha256',Buffer.from(secret,'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64');
 const headers=new Headers({'svix-id':id,'svix-timestamp':timestamp,'svix-signature':`v1,${signature}`});
 assert.equal(verifyWebhook(raw,headers,'whsec_'+secret,1700000000000).id,id);
 assert.throws(()=>verifyWebhook(raw+' ',headers,'whsec_'+secret,1700000000000));
 assert.throws(()=>verifyWebhook(raw,headers,'whsec_'+secret,1700000600000));
 assert.throws(()=>verifyWebhook(raw,new Headers(),'whsec_'+secret));
});
test('threading uses RFC references, never matching subjects',()=>{
 assert.deepEqual(referenceIds({'References':'<a@x> <b@x>','In-Reply-To':'<b@x>'}),['<a@x>','<b@x>']);
 assert.deepEqual(referenceIds({Subject:'Re: Same subject'}),[]);
});
test('read-only MCP key never lists write tools',async()=>{
 const result=await mcp({}, {scopes:['read']},{jsonrpc:'2.0',id:1,method:'tools/list'});
 assert.ok(!result.result.tools.some(t=>t.name==='send_email'));
 assert.ok(tools.find(t=>t.name==='send_email').annotations.destructiveHint);
});
test('read-only key cannot execute writes even through tools/call',async()=>{
 const sql=()=>{throw new Error('database must not be reached')};const service=createService(sql,{});
 const result=await mcp(service,{scopes:['read']},{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'reply_to_email',arguments:{id:'ad8548dd-7ed8-4dfe-ac1e-d80232f23613',text:'Hi'}}});
 assert.equal(result.result.isError,true);assert.match(result.result.content[0].text,/permission/);
});
test('missing authentication fails before querying database',async()=>{
 const service=createService(()=>{throw new Error('must not query')},{});
 await assert.rejects(()=>service.auth(new Request('https://example.com')),(e)=>e instanceof MailError&&e.status===401);
});
test('unauthorised recipients fail before storing drafts',async()=>{
 const service=createService(()=>{throw new Error('must not query')},{});
 await assert.rejects(()=>service.execute({scopes:['write']},'create_draft',{to:['stranger@example.com'],subject:'Hi',text:'Hi'}),/not authorised/);
});
import {challenge,authorizeInput,clientId,redirectUri} from '../oauth.mjs';
import {seal,open} from '../vault.mjs';
test('OAuth enforces client, redirect, audience, state and PKCE S256',()=>{
 const resource='https://example.com/mcp',input={client_id:clientId,redirect_uri:redirectUri,response_type:'code',code_challenge_method:'S256',code_challenge:challenge('a'.repeat(43)),state:'state',resource};
 assert.deepEqual(authorizeInput(input,resource).scopes,['read','write']);
 for(const change of [{resource:'https://attacker.example/mcp'},{redirect_uri:'https://attacker.example/callback'},{code_challenge_method:'plain'},{client_id:'attacker'},{state:''}])assert.throws(()=>authorizeInput({...input,...change},resource));
});
test('webhook secret storage is authenticated encryption',()=>{
 const encrypted=seal('webhook-test-secret','encryption-test-secret');assert.equal(open(encrypted,'encryption-test-secret'),'webhook-test-secret');assert.throws(()=>open(encrypted,'wrong'));assert.ok(!encrypted.includes('webhook-test-secret'));
});
