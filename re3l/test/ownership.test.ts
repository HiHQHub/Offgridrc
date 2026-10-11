import test from "node:test";
import assert from "node:assert/strict";
import {createHmac,randomBytes} from "node:crypto";
import {validateConfig} from "../src/config.ts";
import {verifyResendWebhook} from "../src/webhook.ts";
test("deployment uses customer-controlled environment settings, not embedded keys",()=>{
 const c=validateConfig({version:1,domain:"example.org",mailbox:"hello@example.org",provider:"resend"});
 assert.equal(c.databaseUrlEnv,"DATABASE_URL");
 assert.equal(c.providerKeyEnv,"RESEND_API_KEY");
 assert.equal(JSON.stringify(c).includes("secret-value"),false);
});
test("rejects unrelated mailboxes",()=>{
 assert.throws(()=>validateConfig({version:1,domain:"example.org",mailbox:"hello@other.org",provider:"resend"}));
});
test("verifies signed inbound event and rejects tampering",()=>{
 const secret=randomBytes(32),body=JSON.stringify({type:"email.received",data:{email_id:"abc"}});
 const timestamp="1780000000",id="evt_abc";
 const signature=createHmac("sha256",secret).update(`${id}.${timestamp}.${body}`).digest("base64");
 const headers=new Headers({"svix-id":id,"svix-timestamp":timestamp,"svix-signature":`v1,${signature}`});
 assert.equal(verifyResendWebhook(body,headers,"whsec_"+secret.toString("base64"),1780000000000).eventType,"email.received");
 assert.throws(()=>verifyResendWebhook(body+" ",headers,"whsec_"+secret.toString("base64"),1780000000000));
});
