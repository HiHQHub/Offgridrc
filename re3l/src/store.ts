import {randomUUID} from "node:crypto";
import pg from "pg";
export interface StoredMail {
  id:string; provider_id:string|null; message_id:string|null; thread_id:string;
  direction:"inbound"|"outbound"; sender:string; recipients:string[];
  subject:string; body_text:string; status:string; created_at:Date;
}
export class MailStore {
  constructor(readonly pool:pg.Pool){}
  async list(limit=30):Promise<StoredMail[]> {
    const n=Math.max(1,Math.min(100,Math.trunc(limit)||30));
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages ORDER BY created_at DESC LIMIT $1",[n]);
    return result.rows;
  }
  async get(id:string):Promise<StoredMail|null> {
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages WHERE id=$1",[id]);
    return result.rows[0]||null;
  }
  async search(query:string,limit=30):Promise<StoredMail[]> {
    const safe=query.trim().slice(0,200).replace(/[\\%_]/g,"\\$&");
    if(!safe)return [];
    const n=Math.max(1,Math.min(100,Math.trunc(limit)||30));
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages WHERE sender ILIKE $1 ESCAPE '\\' OR subject ILIKE $1 ESCAPE '\\' OR body_text ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT $2",[`%${safe}%`,n]);
    return result.rows;
  }
  async ingest(input:{providerId:string;messageId:string|null;from:string;to:string[];subject:string;text:string}):Promise<boolean> {
    const id=randomUUID(), thread=randomUUID();
    const result=await this.pool.query(
      "INSERT INTO re3l_messages(id,provider_id,message_id,thread_id,direction,sender,recipients,subject,body_text,status) VALUES($1,$2,$3,$4,'inbound',$5,$6::jsonb,$7,$8,'received') ON CONFLICT(provider_id) DO NOTHING RETURNING id",
      [id,input.providerId,input.messageId,thread,input.from,JSON.stringify(input.to),input.subject,input.text]
    );
    return (result.rowCount||0)>0;
  }
  async updateDelivery(providerId:string,event:string):Promise<void> {
    const status=event.replace(/^email\./,"");
    await this.pool.query("UPDATE re3l_messages SET status=$1 WHERE provider_id=$2",[status,providerId]);
  }
  async recordEvent(id:string,type:string):Promise<boolean> {
    const r=await this.pool.query("INSERT INTO re3l_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id",[id,type]);
    return (r.rowCount||0)>0;
  }
}
export function makePool(connectionString:string):pg.Pool {
  if(!connectionString)throw Error("Customer DATABASE_URL must be provided");
  return new pg.Pool({connectionString,max:5,connectionTimeoutMillis:5000,ssl:connectionString.includes("sslmode=require")?{rejectUnauthorized:true}:undefined});
}
