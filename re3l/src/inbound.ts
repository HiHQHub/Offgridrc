import {MailStore} from "./store.ts";
export interface InboundProvider {
  fetchReceived(id:string):Promise<{id:string;from:string;to:string[];subject?:string;text?:string;message_id?:string}>;
}
export async function handleIncoming(store:MailStore, provider:InboundProvider, eventId:string, eventType:string, emailId:string, mailbox:string):Promise<{duplicate?:boolean;imported?:boolean}> {
  // Fetch before recording event: failed provider calls can then be retried safely.
  if(eventType==="email.received"){
    const email=await provider.fetchReceived(emailId);
    if(!Array.isArray(email.to)||!email.to.some(a=>a.toLowerCase()===mailbox.toLowerCase()))throw Error("Unexpected destination");
    const imported=await store.ingest({providerId:email.id,messageId:email.message_id||null,from:email.from,to:email.to,subject:email.subject||"",text:email.text||""});
    await store.recordEvent(eventId,eventType);
    return {imported};
  }
  if(["email.delivered","email.bounced","email.complained","email.failed","email.delivery_delayed"].includes(eventType)){
    await store.updateDelivery(emailId,eventType);
    await store.recordEvent(eventId,eventType);
    return {imported:false};
  }
  await store.recordEvent(eventId,eventType);
  return {imported:false};
}
