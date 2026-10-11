import test from "node:test";
import assert from "node:assert/strict";
import {handleMcp} from "../src/mcp.ts";
import type {MailStore} from "../src/store.ts";
import type {DraftService} from "../src/drafts.ts";
test("MCP advertises read, search and draft tools but never send or approve",async()=>{
 const result=await handleMcp({jsonrpc:"2.0",id:1,method:"tools/list"},{} as MailStore,{} as DraftService);
 const names=(result as any).result.tools.map((t:{name:string})=>t.name);
 assert.deepEqual(names,["list_emails","search_emails","read_email","create_draft"]);
 assert.equal(names.includes("send_email"),false);
});
test("MCP creates draft without any send capability",async()=>{
 let drafted=false;
 const drafts={create:async(to:string,subject:string,text:string)=>{drafted=true;return {id:"draft_1",to,subject,text,approval_required:true}}} as DraftService;
 const response=await handleMcp({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"create_draft",arguments:{to:"user@example.org",subject:"Hi",text:"Hello"}}},{} as MailStore,drafts);
 assert.equal(drafted,true);
 assert.equal((response as any).result.content[0].text.includes("approval_required"),true);
 const denied=await handleMcp({jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"send_email",arguments:{}}},{} as MailStore,drafts);
 assert.equal((denied as any).error.code,-32602);
});
