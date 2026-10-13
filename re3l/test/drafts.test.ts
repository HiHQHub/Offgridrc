import test from "node:test";
import assert from "node:assert/strict";
import {DraftService} from "../src/drafts.ts";
import type pg from "pg";
import {ResendProvider} from "../src/resend.ts";

test("rejects malformed drafts before database writes",async()=>{
 let writes=0;
 const pool={query:async()=>{writes++;return {rows:[],rowCount:0}}} as unknown as pg.Pool;
 const fakeFetch=(async()=>new Response(JSON.stringify({id:"sent"}),{status:200})) as typeof fetch;
 const service=new DraftService(pool,new ResendProvider("fake-key",fakeFetch),"hello@example.org");
 await assert.rejects(service.create("bad address","Hi","Body"));
 await assert.rejects(service.create("person@example.net","Hello\r\nBcc:evil","Body"));
 assert.equal(writes,0);
});

test("draft approval must correspond to stored draft and returns one token",async()=>{
 let issued=false;
 const pool={query:async(sql:string,parameters:unknown[])=>{
  if(sql.startsWith("UPDATE re3l_drafts SET approval_hash")){
    assert.equal(parameters[0],"draft-1");
    assert.equal(typeof parameters[1],"string");
    issued=true;
    return {rowCount:1,rows:[{id:"draft-1"}]};
  }
  throw Error("Unexpected statement");
 }} as unknown as pg.Pool;
 const fakeFetch=(async()=>{throw Error("Transport must not be called")}) as typeof fetch;
 const service=new DraftService(pool,new ResendProvider("fake-key",fakeFetch),"hello@example.org");
 const approval=await service.approve("draft-1");
 assert.equal(approval.draft_id,"draft-1");
 assert.match(approval.approval_token,/^[0-9a-f]{64}$/);
 assert.equal(issued,true);
 await assert.rejects(service.send("draft-1","invalid"));
});
