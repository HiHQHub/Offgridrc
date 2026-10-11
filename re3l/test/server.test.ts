import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {randomBytes,randomInt,createHmac} from "node:crypto";
import {request as httpRequest} from "node:http";

test("HTTP boundary denies AI approval/send and unauthenticated MCP",async()=>{
 const owner=randomBytes(32).toString("hex"),assistant=randomBytes(32).toString("hex");
 const port=randomInt(20000,50000);
 const webhookKey=randomBytes(32);
 const child=spawn(process.execPath,["--import","tsx","src/server.ts"],{
  env:{...process.env,PORT:String(port),DATABASE_URL:"postgres://test:test@127.0.0.1:1/test",
   RESEND_API_KEY:"test-only-not-a-real-key",RESEND_WEBHOOK_SECRET:"whsec_"+webhookKey.toString("base64"),
   RE3L_OWNER_TOKEN:owner,RE3L_ASSISTANT_TOKEN:assistant,RE3L_DOMAIN:"example.org",RE3L_MAILBOX:"hello@example.org"},
  stdio:["ignore","pipe","pipe"]
 });
 try{
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("Test server startup timeout")),10000);
   child.stdout.on("data",chunk=>{if(String(chunk).includes("API ready")){clearTimeout(timer);resolve();}});
   child.once("error",()=>{clearTimeout(timer);reject(Error("Test server failed to start"));});
   child.once("exit",()=>{clearTimeout(timer);reject(Error("Test server exited before ready"));});
  });
  const request=(path:string,token?:string,body?:unknown)=>fetch(`http://127.0.0.1:${port}${path}`,{
   method:body===undefined?"GET":"POST",headers:{...(token?{Authorization:"Bearer "+token}:{}),"Content-Type":"application/json"},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)
  });
  const rpc={jsonrpc:"2.0",id:1,method:"tools/list"};
  assert.equal((await request("/mcp",undefined,rpc)).status,401);
  assert.equal((await request("/mcp","invalid",rpc)).status,401);
  const tools=await request("/mcp",assistant,rpc);
  assert.equal(tools.status,200);
  assert.deepEqual((await tools.json()).result.tools.map((t:{name:string})=>t.name),["list_emails","search_emails","read_email","get_thread","create_draft"]);
  for(const operation of ["approve","send"]){
   assert.equal((await request(`/api/drafts/00000000-0000-0000-0000-000000000000/${operation}`,assistant,{})).status,403);
  }
  assert.equal((await request("/api/connections",assistant)).status,403);
  assert.equal((await request("/api/drafts/pending",assistant)).status,403);
  assert.equal((await request("/api/status",owner)).status,200);
  assert.equal((await request("/webhooks/resend",undefined,{type:"email.received",data:{email_id:"test"}})).status,400);
  // A signed body split within a multibyte character must remain byte-for-byte valid.
  const body=Buffer.from(JSON.stringify({type:"email.test",data:{email_id:"fixture",text:"\u00e9"}}));
  const id="evt_utf8",timestamp=String(Math.floor(Date.now()/1000));
  const signature=createHmac("sha256",webhookKey).update(`${id}.${timestamp}.`).update(body).digest("base64");
  const status=await new Promise<number>((resolve,reject)=>{
   const req=httpRequest(`http://127.0.0.1:${port}/webhooks/resend`,{method:"POST",headers:{"svix-id":id,"svix-timestamp":timestamp,"svix-signature":"v1,"+signature,"content-type":"application/json"}},res=>{res.resume();res.on("end",()=>resolve(res.statusCode!));});
   req.on("error",reject);req.setTimeout(5000,()=>req.destroy(Error("Test request timeout")));
   const split=body.indexOf(Buffer.from("\u00e9"))+1;
   req.write(body.subarray(0,split));req.end(body.subarray(split));
  });
  assert.equal(status,503); // Signature passed; unavailable fixture DB requires retry.
  const html=await (await request("/")).text();
  assert.match(html,/SYSTEM \/ CONNECTIONS/);
  assert.match(html,/OWNER \/ APPROVAL QUEUE/);
 }finally{
  if(child.exitCode===null){const stopped=new Promise<void>(resolve=>child.once("exit",()=>resolve()));child.kill();await stopped;}
 }
});
