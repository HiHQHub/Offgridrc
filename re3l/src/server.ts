import {createServer} from "node:http";
import {classifyBearer,canPerform} from "./access.ts";
import {makePool,MailStore} from "./store.ts";
import {verifyResendWebhook} from "./webhook.ts";
import {handleIncoming} from "./inbound.ts";
import {ResendInbound} from "./resend-inbound.ts";
import {validateConfig} from "./config.ts";
import {ResendProvider} from "./resend.ts";
import {DraftService} from "./drafts.ts";
import {portalHtml} from "./portal.ts";
const env=process.env;
const config=validateConfig({version:1,domain:env.RE3L_DOMAIN,mailbox:env.RE3L_MAILBOX,provider:"resend"});
if(!env.RESEND_WEBHOOK_SECRET||!env.RESEND_API_KEY||!env.RE3L_OWNER_TOKEN||env.RE3L_OWNER_TOKEN.length<32)
 throw Error("Missing webhook, provider or strong owner authentication secret");
const store=new MailStore(makePool(env.DATABASE_URL||""));
const inbound=new ResendInbound(env.RESEND_API_KEY);
const drafts=new DraftService(store.pool,new ResendProvider(env.RESEND_API_KEY),config.mailbox);
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
  if(path==="/"&&req.method==="GET"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});res.end(portalHtml());return;}
  if(path==="/webhooks/resend"&&req.method==="POST"){
   const raw=await bodyText(req);
   const headers=new Headers();
   for(const key of ["svix-id","svix-timestamp","svix-signature"]){const val=req.headers[key];if(typeof val==="string")headers.set(key,val);}
   const event=verifyResendWebhook(raw,headers,env.RESEND_WEBHOOK_SECRET!);
   const result=await handleIncoming(store,inbound,event.eventId,event.eventType,event.emailId,config.mailbox);
   return send(200,result);
  }
  const role=classifyBearer(typeof req.headers.authorization==="string"?req.headers.authorization:undefined,env.RE3L_OWNER_TOKEN!,env.RE3L_ASSISTANT_TOKEN||"");
  if(role==="none")return send(401,{error:"Unauthorized"});
  if(path.endsWith("/approve")||path.endsWith("/send")){
   if(!canPerform(role,path.endsWith("/approve")?"approve":"send"))return send(403,{error:"Owner approval required"});
  }
  if(path==="/api/drafts"&&req.method==="POST"){
   const data=JSON.parse(await bodyText(req,120000)) as {to?:string;subject?:string;text?:string};
   return send(201,await drafts.create(data.to||"",data.subject||"",data.text||""));
  }
  if(/^\/api\/drafts\/[0-9a-f-]{36}\/approve$/i.test(path)&&req.method==="POST"){
   return send(200,await drafts.approve(path.split("/")[3]));
  }
  if(/^\/api\/drafts\/[0-9a-f-]{36}\/send$/i.test(path)&&req.method==="POST"){
   const data=JSON.parse(await bodyText(req,4000)) as {approval_token?:string};
   return send(200,await drafts.send(path.split("/")[3],data.approval_token||""));
  }
  if(path==="/api/status"&&req.method==="GET")return send(200,{mailbox:config.mailbox,provider:"resend",ownership:"customer",role});
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
