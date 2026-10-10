import postgres from 'postgres';import {randomUUID,randomBytes} from 'node:crypto';import {readFile} from 'node:fs/promises';import {createService,digest} from './core.mjs';
if(!process.env.DATABASE_URL||!process.env.RESEND_API_KEY)throw new Error('DATABASE_URL and RESEND_API_KEY required');
const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
const service=createService(sql);const domains=await service.provider('/domains');const domain=domains.data?.find(d=>d.name==='offgridrc.com');
if(!domain||domain.status!=='verified')throw new Error('Pilot domain must be verified in the existing account');
await sql.unsafe(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
const tenant=randomUUID(),box=randomUUID(),key=randomUUID(),token=randomBytes(32).toString('hex');
await sql.begin(async tx=>{await tx`INSERT INTO re3l_tenants(id,name) VALUES(${tenant},'Offgrid RC')`;await tx`INSERT INTO re3l_mailboxes(id,tenant_id,address,owner_user_id,enabled,domain_verified_at) VALUES(${box},${tenant},'hello@offgridrc.com',1,true,now())`;await tx`INSERT INTO re3l_keys(id,tenant_id,mailbox_id,token_hash,scopes) VALUES(${key},${tenant},${box},${digest(token)},ARRAY['read','write'])`;});
// One-time credential output is for the operator's terminal, not an application log.
console.log('Store the following mailbox API key securely; it is shown once:');console.log(token);await sql.end();
