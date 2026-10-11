import test from "node:test";
import assert from "node:assert/strict";
import {handleIncoming} from "../src/inbound.ts";
import type {MailStore} from "../src/store.ts";
test("imports incoming email only for configured mailbox",async()=>{
 let writes=0,events=0;
 const store={ingest:async()=>{writes++;return true},processEvent:async(_id:string,_type:string,work:(tx:MailStore)=>Promise<unknown>)=>{events++;return work(store)}} as unknown as MailStore;
 const provider={fetchReceived:async()=>({id:"in_1",from:"person@example.net",to:["hello@example.org"],subject:"Hi",text:"World"})};
 assert.deepEqual(await handleIncoming(store,provider,"evt_1","email.received","in_1","hello@example.org"),{imported:true});
 assert.equal(writes,1);assert.equal(events,1);
 await assert.rejects(handleIncoming(store,provider,"evt_2","email.received","in_1","other@example.org"));
 assert.equal(writes,1);assert.equal(events,1);
});
test("failed fetch does not mark an event processed",async()=>{
 let events=0;
 const store={recordEvent:async()=>{events++;return true}} as unknown as MailStore;
 await assert.rejects(handleIncoming(store,{fetchReceived:async()=>{throw Error("network")}},"evt_1","email.received","in_1","hello@example.org"));
 assert.equal(events,0);
});
