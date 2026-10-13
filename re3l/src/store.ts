import {randomUUID} from "node:crypto";
import pg from "pg";
export interface StoredMail {
  id:string; provider_id:string|null; message_id:string|null; thread_id:string;
  direction:"inbound"|"outbound"; sender:string; recipients:string[];
  subject:string; body_text:string; status:string; created_at:Date;
}
export class MailStore {
  constructor(readonly pool:pg.Pool|pg.PoolClient){}
  async processEvent<T>(id:string,type:string,work:(store:MailStore)=>Promise<T>):Promise<T|{duplicate:true}> {
    if(!(this.pool instanceof pg.Pool))throw Error("Nested event transaction not supported");
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const tx=new MailStore(client);
      if(!await tx.recordEvent(id,type)){await client.query("COMMIT");return {duplicate:true};}
      const result=await work(tx);
      await client.query("COMMIT");
      return result;
    }catch(error){await client.query("ROLLBACK");throw error;}
    finally{client.release();}
  }
  async list(limit=30):Promise<StoredMail[]> {
    const n=Math.max(1,Math.min(100,Math.trunc(limit)||30));
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages ORDER BY created_at DESC LIMIT $1",[n]);
    return result.rows;
  }
  async get(id:string):Promise<StoredMail|null> {
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages WHERE id=$1",[id]);
    return result.rows[0]||null;
  }
  async thread(id:string):Promise<StoredMail[]> {
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages WHERE thread_id=$1 ORDER BY created_at,id LIMIT 200",[id]);
    return result.rows;
  }
  async search(query:string,limit=30):Promise<StoredMail[]> {
    const safe=query.trim().slice(0,200).replace(/[\\%_]/g,"\\$&");
    if(!safe)return [];
    const n=Math.max(1,Math.min(100,Math.trunc(limit)||30));
    const result=await this.pool.query<StoredMail>("SELECT * FROM re3l_messages WHERE sender ILIKE $1 ESCAPE '\\' OR subject ILIKE $1 ESCAPE '\\' OR body_text ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT $2",[`%${safe}%`,n]);
    return result.rows;
  }
  async ingest(input:{providerId:string;messageId:string|null;from:string;to:string[];subject:string;text:string;references?:string[]}):Promise<boolean> {
    const id=randomUUID(), thread=randomUUID();
    const refs=(input.references||[]).slice(0,100);
    const result=await this.pool.query(
      "INSERT INTO re3l_messages(id,provider_id,message_id,thread_id,direction,sender,recipients,subject,body_text,status) VALUES($1,$2,$3,COALESCE((SELECT thread_id FROM re3l_messages WHERE message_id=ANY($9::text[]) ORDER BY array_position($9::text[],message_id) LIMIT 1),$4::uuid),'inbound',$5,$6::jsonb,$7,$8,'received') ON CONFLICT(provider_id) DO NOTHING RETURNING id",
      [id,input.providerId,input.messageId,thread,input.from,JSON.stringify(input.to),input.subject,input.text,refs]
    );
    return (result.rowCount||0)>0;
  }
  async updateDelivery(providerId:string,event:string):Promise<void> {
    const status=event.replace(/^email\./,"");
    const result=await this.pool.query("UPDATE re3l_messages SET status=CASE WHEN status IN ('bounced','complained','failed') THEN status ELSE $1 END WHERE provider_id=$2",[status,providerId]);
    if(!result.rowCount)throw Error("Outbound message not persisted yet");
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
