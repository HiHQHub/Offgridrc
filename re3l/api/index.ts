import type {IncomingMessage,ServerResponse,RequestListener} from "node:http";
import {portalHtml,portalScript} from "../src/portal.js";

// Render setup without secrets; all mail operations remain unavailable until configured.
let application:Promise<RequestListener>|undefined;
export default async function handler(req:IncomingMessage,res:ServerResponse){
 const path=new URL(req.url||"/","http://localhost").pathname;
 if(req.method==="GET"&&(path==="/"||path==="/portal.js")){
  res.writeHead(200,{"content-type":path==="/"?"text/html; charset=utf-8":"application/javascript; charset=utf-8",
   "cache-control":"no-store","x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
  res.end(path==="/"?portalHtml():portalScript());return;
 }
 const required=["DATABASE_URL","RESEND_API_KEY","RESEND_WEBHOOK_SECRET","RE3L_OWNER_TOKEN","RE3L_ASSISTANT_TOKEN","RE3L_DOMAIN","RE3L_MAILBOX"];
 if(required.some(name=>!process.env[name])){
  res.writeHead(503,{"content-type":"application/json","cache-control":"no-store"});
  res.end(JSON.stringify({status:"setup_required",error:"Staging connections must be configured before email operations are available"}));return;
 }
 try{
  application??=import("../src/server.js").then(module=>module.handler);
  await (await application)(req,res);
 }catch{
  application=undefined;
  res.writeHead(503,{"content-type":"application/json","cache-control":"no-store"});
  res.end(JSON.stringify({status:"unavailable",error:"Staging configuration unavailable"}));
 }
}
