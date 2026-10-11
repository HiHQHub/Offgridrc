import {createServer} from "node:http";
import {timingSafeEqual} from "node:crypto";
import {makePool,MailStore} from "./store.ts";
import {verifyResendWebhook} from "./webhook.ts";
import {handleIncoming} from "./inbound.ts";
import {ResendInbound} from "./resend-inbound.ts";
import {validateConfig} from "./config.ts";
const env=process.env;
const config=validateConfig({version:1,domain:env.RE3L_DOMAIN,mailbox:env.RE3L_MAILBOX,provider:"resend"});
if(!env.RESEND_WEBHOOK_SECRET||!env.RESEND_API_KEY||!env.RE3L_OWNER_TOKEN||env.RE3L_OWNER_TOKEN.length<32)
 throw Error("Missing webhook, provider or strong owner authentication secret");
const store=new MailStore(makePool(env.DATABASE_URL||""));
const inbound=new ResendInbound(env.RESEND_API_KEY);
function authenticated(value:string|null):boolean {
 const token=value?.match(/^Bearer (.+)$/)?.[1]||"";
 const a=Buffer.from(token),b=Buffer.from(env.RE3L_OWNER_TOKEN||"");
 return a.length===b.length&&timingSafeEqual(a,b);
}
async function bodyText(req:import("node:http").IncomingMessage,max=200000):Promise<string> {
 let raw="";
 for await(const chunk of req){raw+=chunk.toString("utf8");if(Buffer.byteLength(raw)>max)throw Error("Request too large");}
 return raw;
}
const server=createServer(async(req,res)=>{
 const send=(status:number,data:unknown)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));};
 try{
  const path=new URL(req.url||"/","http://localhost").pathname;
  if(path==="/health"&&req.method==="GET")return send(200,{status:"running"});
  if(path==="/webhooks/resend"&&req.method==="POST"){
   const raw=await bodyText(req);
   const headers=new Headers();
   for(const key of ["svix-id","svix-timestamp","svix-signature"]){const val=req.headers[key];if(typeof val==="string")headers.set(key,val);}
   const event=verifyResendWebhook(raw,headers,env.RESEND_WEBHOOK_SECRET!);
   const result=await handleIncoming(store,inbound,event.eventId,event.eventType,event.emailId,config.mailbox);
   return send(200,result);
  }
  if(!authenticated(typeof req.headers.authorization==="string"?req.headers.authorization:null))return send(401,{error:"Unauthorized"});
  if(path==="/api/status"&&req.method==="GET")return send(200,{mailbox:config.mailbox,provider:"resend",ownership:"customer"});
  if(path==="/api/messages"&&req.method==="GET"){
   const url=new URL(req.url||"/","http://localhost");
   const limit=Number(url.searchParams.get("limit")||30);
   const q=url.searchParams.get("q");
   return send(200,{messages:q?await store.search(q,limit):await store.list(limit)});
  }
  if(path.startsWith("/api/messages/")&&req.method==="GET"){
   const id=path.slice("/api/messages/".length);
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return send(400,{error:"Invalid message id"});
   const message=await store.get(id);
   return send(message?200:404,message||{error:"Not found"});
  }
  return send(404,{error:"Not found"});
 }catch(e){
  const message=e instanceof Error?e.message:"Unexpected failure";
  console.error("RE3L request error",message.replace(/Bearer\s+[^\s]+/g,"Bearer [redacted]"));
  return send(400,{error:"Request failed"});
 }
});
server.listen(Number(env.PORT||3000),()=>console.log("RE3L customer-owned API ready"));
