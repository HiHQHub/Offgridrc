import type {IncomingMessage,ServerResponse,RequestListener} from "node:http";
import {portalHtml,portalScript} from "../src/portal.js";
import {setupHtml,setupScript} from "../src/setup.js";

// Render setup without secrets; all mail operations remain unavailable until configured.
let application:Promise<RequestListener>|undefined;
export default async function handler(req:IncomingMessage,res:ServerResponse){
 const path=new URL(req.url||"/","http://localhost").pathname;
 const customer=process.env.RE3L_MODE==="customer";
 if(req.method==="GET"&&["/","/setup","/setup.js","/portal.js"].includes(path)){
  res.writeHead(200,{"content-type":path.endsWith(".js")?"application/javascript; charset=utf-8":"text/html; charset=utf-8",
   "cache-control":"no-store","x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
  res.end(path==="/setup.js"?setupScript():path==="/portal.js"?portalScript():path==="/setup"||!customer?setupHtml():portalHtml());return;
 }
 if(!customer){
  res.writeHead(404,{"content-type":"application/json","cache-control":"no-store"});
  res.end(JSON.stringify({status:"customer_deployment_required",error:"Email operations run only in your customer-owned deployment"}));return;
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
