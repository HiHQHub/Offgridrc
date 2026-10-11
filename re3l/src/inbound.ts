import {MailStore} from "./store.ts";
export interface InboundProvider {
  fetchReceived(id:string):Promise<{id:string;from:string;to:string[];subject?:string;text?:string;message_id?:string;headers?:Record<string,string>}>;
}
function references(headers:Record<string,string>={}){
 const normalized=Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value]));
 const ids=(value:string)=>(value||"").match(/<[^<>\s]{1,998}>/g)||[];
 return [...new Set([...ids(normalized["in-reply-to"]),...ids(normalized.references).reverse()])].slice(0,100);
}
export async function handleIncoming(store:MailStore, provider:InboundProvider, eventId:string, eventType:string, emailId:string, mailbox:string):Promise<{duplicate?:boolean;imported?:boolean}> {
  // Fetch before recording event: failed provider calls can then be retried safely.
  if(eventType==="email.received"){
    const email=await provider.fetchReceived(emailId);
    if(!Array.isArray(email.to)||!email.to.some(a=>a.toLowerCase()===mailbox.toLowerCase()))throw Error("Unexpected destination");
    if(email.id!==emailId)throw Error("Unexpected provider message");
    return store.processEvent(eventId,eventType,async tx=>({imported:await tx.ingest({providerId:email.id,messageId:email.message_id||null,from:email.from,to:email.to,subject:email.subject||"",text:email.text||"",references:references(email.headers)})}));
  }
  if(["email.delivered","email.bounced","email.complained","email.failed","email.delivery_delayed"].includes(eventType)){
    return store.processEvent(eventId,eventType,async tx=>{await tx.updateDelivery(emailId,eventType);return {imported:false};});
  }
  await store.recordEvent(eventId,eventType);
  return {imported:false};
}
