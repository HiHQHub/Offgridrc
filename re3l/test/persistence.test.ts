import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {MailStore} from "../src/store.ts";
import {DraftService} from "../src/drafts.ts";
import {ResendProvider} from "../src/resend.ts";
import {handleIncoming} from "../src/inbound.ts";

test("PostgreSQL persistence, replay, rollback, approval expiry and reply correlation",{skip:!process.env.RE3L_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.RE3L_TEST_DATABASE_URL!);
 // Never run destructive fixture cleanup against customer or staging databases.
 assert.ok(["localhost","127.0.0.1"].includes(url.hostname));
 assert.equal(url.pathname,"/re3l_test");
 const schema="test_"+randomUUID().replaceAll("-","");
 const admin=new pg.Pool({connectionString:url.toString()});
 const pool=new pg.Pool({connectionString:url.toString(),options:"-c search_path="+schema});
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);
  for(const migration of ["001_initial.sql","002_drafts.sql","003_message_id_index.sql"]){await pool.query(await readFile(new URL("../sql/"+migration,import.meta.url),"utf8"));}
  const store=new MailStore(pool);
  let sends=0;
  const fetchFn=(async(_url:unknown,init?:RequestInit)=>{
   if(init?.method==="POST"){
    sends++;
    if(sends===2)assert.equal(JSON.parse(init.body as string).headers["In-Reply-To"],"<reply@example.net>");
    return new Response(JSON.stringify({id:"out_"+sends}));
   }
   return new Response(JSON.stringify({message_id:"<original@example.org>"}));
  }) as typeof fetch;
  const drafts=new DraftService(pool,new ResendProvider("test-only-key",fetchFn),"hello@example.org");
  const draft=await drafts.create("test@example.net","Approval test","Synthetic message only");
  await assert.rejects(drafts.send(draft.id,"a".repeat(64)));
  assert.equal(sends,0);
  const approval=await drafts.approve(draft.id);
  const results=await Promise.allSettled([drafts.send(draft.id,approval.approval_token),drafts.send(draft.id,approval.approval_token)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(sends,1);
  assert.equal((await store.get(draft.id))?.message_id,"<original@example.org>");
  const provider={fetchReceived:async()=>({id:"in_1",from:"test@example.net",to:["hello@example.org"],subject:"Re: Approval test",text:"Synthetic reply",message_id:"<reply@example.net>",headers:{"In-Reply-To":"<original@example.org>"}})};
  await handleIncoming(store,provider,"evt_1","email.received","in_1","hello@example.org");
  assert.deepEqual(await handleIncoming(store,provider,"evt_1","email.received","in_1","hello@example.org"),{duplicate:true});
  await handleIncoming(store,provider,"evt_2","email.received","in_1","hello@example.org");
  assert.equal((await store.list()).length,2);
  assert.equal((await store.thread(draft.id)).length,2);
  assert.equal((await store.search("Synthetic reply")).length,1);
  await assert.rejects(store.processEvent("evt_rollback","test",async tx=>{await tx.ingest({providerId:"rollback",messageId:null,from:"test@example.net",to:["hello@example.org"],subject:"Rollback",text:"Fixture"});throw Error("Simulated processing failure");}));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM re3l_events WHERE event_id='evt_rollback'")).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM re3l_messages WHERE provider_id='rollback'")).rows[0].n,0);
  // Delivery before the send has persisted must be retryable, not silently lost.
  await assert.rejects(handleIncoming(store,provider,"evt_early","email.delivered","missing","hello@example.org"));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM re3l_events WHERE event_id='evt_early'")).rows[0].n,0);
  await handleIncoming(store,provider,"evt_delivered","email.delivered","out_1","hello@example.org");
  await handleIncoming(store,provider,"evt_bounced","email.bounced","out_1","hello@example.org");
  assert.deepEqual(await handleIncoming(store,provider,"evt_delivered","email.delivered","out_1","hello@example.org"),{duplicate:true});
  assert.equal((await store.get(draft.id))?.status,"bounced");
  const expired=await drafts.create("test@example.net","Expiry test","Synthetic draft");
  const token=await drafts.approve(expired.id);
  await pool.query("UPDATE re3l_drafts SET approval_expires=now()-interval '1 second' WHERE id=$1",[expired.id]);
  await assert.rejects(drafts.send(expired.id,token.approval_token));
  assert.equal(sends,1);
  const incoming=(await store.search("Synthetic reply"))[0];
  await assert.rejects(drafts.create("other@example.net","Re: Approval test","Reply",incoming.id));
  const reply=await drafts.create("test@example.net","Re: Approval test","Owner-approved synthetic reply",incoming.id);
  const replyApproval=await drafts.approve(reply.id);
  await drafts.send(reply.id,replyApproval.approval_token);
  assert.equal(sends,2);
  assert.equal((await store.thread(draft.id)).length,3);
 }finally{
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
 }
});
