import type {InboundProvider} from "./inbound.ts";
export class ResendInbound implements InboundProvider {
  constructor(private readonly key:string,private readonly fetchFn:typeof fetch=fetch){}
  async fetchReceived(id:string){
    const r=await this.fetchFn("https://api.resend.com/emails/receiving/"+encodeURIComponent(id),{
      headers:{Authorization:"Bearer "+this.key},signal:AbortSignal.timeout(20000)
    });
    if(!r.ok)throw Error("Resend inbound retrieval failed: "+r.status);
    const json=await r.json() as {id?:string;from?:string;to?:string[];subject?:string;text?:string;message_id?:string;headers?:Record<string,string>};
    if(!json.id||!json.from||!Array.isArray(json.to))throw Error("Invalid inbound provider message");
    return {id:json.id,from:json.from,to:json.to,subject:json.subject,text:json.text,message_id:json.message_id,headers:json.headers};
  }
}
