import {createHash,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {ResendProvider} from "./resend.ts";
const digest=(v:string)=>createHash("sha256").update(v).digest("hex");
const validAddress=(v:string)=>/^[^\s@<>\r\n]+@[^\s@<>\r\n]+$/.test(v);
export class DraftService {
 constructor(private readonly pool:pg.Pool|pg.PoolClient,private readonly provider:ResendProvider,private readonly sender:string){}
 async create(to:string,subject:string,text:string,replyToId?:string){
  if(!validAddress(to)||!subject.trim()||!text.trim()||subject.length>998||text.length>100000||/[\r\n]/.test(subject))throw Error("Invalid draft");
  const id=randomUUID();
  let threadId=id,inReplyTo:string|null=null;
  if(replyToId){
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(replyToId))throw Error("Invalid reply target");
   const result=await this.pool.query("SELECT thread_id,message_id,sender,recipients,direction FROM re3l_messages WHERE id=$1",[replyToId]);
   const parent=result.rows[0];
   if(!parent?.message_id||!/^<[^<>\s]{1,998}>$/.test(parent.message_id))throw Error("Reply target requires reconciled message ID");
   const address=(value:string)=>(value.match(/<([^<>]+)>\s*$/)?.[1]||value).trim().toLowerCase();
   const participants=parent.direction==="inbound"?[address(parent.sender)]:parent.recipients.map(address);
   if(!participants.includes(address(to)))throw Error("Reply recipient must match the conversation");
   threadId=parent.thread_id;inReplyTo=parent.message_id;
  }
  await this.pool.query("INSERT INTO re3l_drafts(id,recipient,subject,body_text,thread_id,in_reply_to) VALUES($1,$2,$3,$4,$5,$6)",[id,to,subject,text,threadId,inReplyTo]);
  return {id,status:"draft",to,subject,text,approval_required:true};
 }
 async pending(){
  const result=await this.pool.query("SELECT id,recipient,subject,body_text,status,created_at FROM re3l_drafts WHERE status='draft' ORDER BY created_at DESC LIMIT 50");
  return result.rows;
 }
 async approve(id:string){
  const token=randomBytes(32).toString("hex");
  const r=await this.pool.query("UPDATE re3l_drafts SET approval_hash=$2, approval_expires=now()+interval '10 minutes' WHERE id=$1 AND status='draft' RETURNING id",[id,digest(token)]);
  if(!r.rowCount)throw Error("Draft unavailable");
  return {draft_id:id,approval_token:token};
 }
 async send(id:string,token:string){
  if(!/^[0-9a-f]{64}$/i.test(token))throw Error("Invalid approval");
  const r=await this.pool.query("UPDATE re3l_drafts SET status='sending',approval_hash=NULL WHERE id=$1 AND status='draft' AND approval_hash=$2 AND approval_expires>now() RETURNING *",[id,digest(token)]);
  if(!r.rowCount)throw Error("Invalid or expired approval");
  const draft=r.rows[0];
  try{
   const sent=await this.provider.send({from:{email:this.sender},to:[{email:draft.recipient}],subject:draft.subject,text:draft.body_text,...(draft.in_reply_to?{inReplyTo:draft.in_reply_to}:{})},`re3l-${id}`);
   await this.pool.query("UPDATE re3l_drafts SET status='sent',provider_id=$2 WHERE id=$1",[id,sent.providerId]);
   await this.pool.query("INSERT INTO re3l_messages(id,provider_id,thread_id,direction,sender,recipients,subject,body_text,status) VALUES($1,$2,$7,'outbound',$3,$4::jsonb,$5,$6,'sent') ON CONFLICT DO NOTHING",[id,sent.providerId,this.sender,JSON.stringify([draft.recipient]),draft.subject,draft.body_text,draft.thread_id||id]);
   // Reconciliation failure must never turn an accepted send into a retry.
   try{
    const messageId=await this.provider.messageId(sent.providerId);
    if(messageId)await this.pool.query("UPDATE re3l_messages SET message_id=$2 WHERE id=$1",[id,messageId]);
   }catch{}
   return {id,status:"sent",provider_id:sent.providerId};
  }catch{
   // Provider outcomes can be ambiguous. Never resend automatically without reconciliation.
   await this.pool.query("UPDATE re3l_drafts SET status='failed' WHERE id=$1",[id]);
   throw Error("Sending failed; check provider status before retrying");
  }
 }
}
