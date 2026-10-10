import postgres from 'postgres';import {createService} from './core.mjs';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const sql=postgres(process.env.DATABASE_URL,{prepare:false,max:2});const service=createService(sql);
async function tick(){
 // Never retry outside Resend's 24-hour idempotency retention window.
 await sql`UPDATE re3l_messages SET status='manual_review',lease_until=NULL WHERE direction='outbound' AND status IN ('sending','queued') AND created_at<now()-interval '23 hours'`;
 await sql`UPDATE re3l_messages SET status='queued',lease_until=NULL WHERE status='sending' AND lease_until<now()`;
 const rows=await sql`SELECT m.id,m.tenant_id,m.mailbox_id,b.address FROM re3l_messages m JOIN re3l_mailboxes b ON b.id=m.mailbox_id AND b.tenant_id=m.tenant_id WHERE m.status='queued' AND (m.next_attempt IS NULL OR m.next_attempt<=now()) AND b.enabled=true ORDER BY m.created_at LIMIT 10`;
 for(const m of rows){try{await service.dispatch({...m,id:'00000000-0000-0000-0000-000000000000',scopes:['read','write']},m.id);}catch{/* Failure and retry deadline are persisted by dispatch. No bodies or credentials logged. */}}
}
async function loop(){try{await tick();}catch{console.error('Queue worker database operation failed');}setTimeout(loop,60000);}
await loop();
