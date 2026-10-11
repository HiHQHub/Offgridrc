import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import handler from "../api/index.ts";

test("unconfigured Vercel deployment serves portal and refuses mail operations",async()=>{
 const previous=process.env.DATABASE_URL;
 delete process.env.DATABASE_URL;
 const server=createServer(handler);
 try{
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();
  assert.ok(address&&typeof address!=="string");
  const base=`http://127.0.0.1:${address.port}`;
  const portal=await fetch(base);
  assert.equal(portal.status,200);
  assert.match(await portal.text(),/SYSTEM \/ CONNECTIONS/);
  for(const path of ["/health","/api/connections","/mcp","/webhooks/resend"]){
   const response=await fetch(base+path,{method:path==="/mcp"||path.includes("webhooks")?"POST":"GET"});
   assert.equal(response.status,503);
   assert.equal((await response.json()).status,"setup_required");
  }
 }finally{
  if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});
