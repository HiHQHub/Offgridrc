import http from 'node:http';
import postgres from 'postgres';
import {createService,MailError,digest} from './core.mjs';
import {mcp,api} from './protocol.mjs';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const sql=postgres(process.env.DATABASE_URL,{max:3,prepare:false});
const service=createService(sql);
http.createServer(async(req,res)=>{
 try{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8000000)throw new MailError(413,'Request too large');chunks.push(chunk);}
  const request=new Request(`http://localhost${req.url}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'re3l-mail',ready:!!process.env.RESEND_API_KEY}));return;}
  if(req.method!=='POST')throw new MailError(405,'POST required');
  let output;
  if(req.url==='/webhook')output=await service.webhook(request);
  else {
   const key=await service.auth(request);
   if(req.url==='/mcp')output=await mcp(service,key,await request.json());
   else if(req.url==='/api')output=await api(service,request,key);
   else if(req.url==='/approve'){
    // Owner approval credential is distinct from the connector API key and never exposed to MCP.
    if(!process.env.RE3L_OWNER_APPROVAL_TOKEN||digest(req.headers['x-owner-approval']||'')!==digest(process.env.RE3L_OWNER_APPROVAL_TOKEN))throw new MailError(403,'Owner approval credential required');
    const body=await request.json();output=await service.approve(key,body.draft_id);
   }else throw new MailError(404,'Route not found');
  }
  res.writeHead(output===null?202:200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(output||{accepted:true}));
 }catch(e){res.writeHead(e instanceof MailError?e.status:400,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:e instanceof MailError?e.message:'Invalid request or operation failed'}));}
}).listen(Number(process.env.PORT||3001));
