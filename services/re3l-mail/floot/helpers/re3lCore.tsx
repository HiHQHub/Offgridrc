// @ts-nocheck
// Generated from portable JavaScript. Validate using the Node tests.
import {createHash, randomBytes, randomUUID, createHmac, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {open} from './re3lVault';
export const digest = value => createHash('sha256').update(value).digest('hex');
const address = z.string().email().max(254).refine(s=>!/[\r\n]/.test(s));
const envelope = z.object({to:z.array(address).min(1).max(10), subject:z.string().max(998).refine(s=>!/[\r\n]/.test(s)), text:z.string().min(1).max(100000), attachments:z.array(z.object({filename:z.string().min(1).max(120).refine(s=>!/[\r\n\/\\]/.test(s)),content:z.string().max(1400000).regex(/^[A-Za-z0-9+/]*={0,2}$/)})).max(5).default([])}).strict();
export const schemas = {
 create_draft:envelope,
 send_email:z.object({draft_id:z.string().uuid(),approval_token:z.string().min(32).max(128)}).strict(),
 list_emails:z.object({limit:z.number().int().min(1).max(100).default(30)}).strict(),
 search_emails:z.object({query:z.string().min(1).max(200),limit:z.number().int().min(1).max(100).default(30)}).strict(),
 read_email:z.object({id:z.string().uuid()}).strict(),
 get_thread:z.object({thread_id:z.string().uuid()}).strict(),
 reply_to_email:z.object({id:z.string().uuid(),text:z.string().min(1).max(100000)}).strict(),
 forward_email:z.object({id:z.string().uuid(),to:z.array(address).min(1).max(10),text:z.string().max(100000).default('')}).strict(),
 sync_inbox:z.object({}).strict(),
 delivery_status:z.object({id:z.string().uuid()}).strict()
};
export class MailError extends Error {status=400; retryable=false; constructor(status,message){super(message);this.status=status;}}
export function verifyWebhook(raw,headers,secret,now=Date.now()) {
 const id=headers.get('svix-id'), timestamp=headers.get('svix-timestamp'), signature=headers.get('svix-signature');
 if(!id||!timestamp||!signature||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300) throw new MailError(401,'Invalid webhook');
 const key=Buffer.from(secret.replace(/^whsec_/,''),'base64');
 const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${raw}`).digest();
 const valid=signature.split(' ').some(s=>{const [version,value]=s.split(','); const candidate=Buffer.from(value||'','base64');return version==='v1'&&candidate.length===expected.length&&timingSafeEqual(candidate,expected);});
 if(!valid) throw new MailError(401,'Invalid webhook');
 return {id,event:JSON.parse(raw)};
}
export function referenceIds(headers={}) {
 const normalized=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),String(v)]));
 return [...new Set([...(normalized.references||'').matchAll(/<[^<>\r\n]+>/g),...(normalized['in-reply-to']||'').matchAll(/<[^<>\r\n]+>/g)].map(m=>m[0]))].slice(-50);
}
export function createService(sql,env=process.env,fetcher=fetch) {
 const mailbox='hello@offgridrc.com';
 async function provider(path,options={}) {
  if(!env.RESEND_API_KEY) throw new MailError(503,'Resend credential not connected');
  const result=await fetcher(`https://api.resend.com${path}`,{...options,headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
  const body=await result.json();
  if(!result.ok) {const error=new MailError(result.status===429||result.status>=500?503:422,'Email provider rejected the request');error.retryable=result.status===429||result.status>=500;throw error;}
  return body;
 }
 async function auth(request,write=false) {
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(token.length<32) throw new MailError(401,'API key required');
  const [key]=await sql`SELECT k.*,m.address FROM re3l_keys k JOIN re3l_mailboxes m ON m.id=k.mailbox_id AND m.tenant_id=k.tenant_id WHERE k.token_hash=${digest(token)} AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at>now()) AND m.enabled=true`;
  if(!key||!key.scopes.includes(write?'write':'read')) throw new MailError(403,'Mailbox permission denied');
  if(key.audience&&key.audience!==(env.RE3L_MCP_RESOURCE||request.url.split('?')[0]))throw new MailError(403,'Token audience mismatch');
  // Pilot keys cannot be used for any other domain/mailbox.
  if(key.address!==mailbox) throw new MailError(403,'Pilot mailbox unavailable');
  await sql`INSERT INTO re3l_rate_windows(key_id,window_start,requests) VALUES(${key.id},date_trunc('minute',now()),1) ON CONFLICT(key_id,window_start) DO UPDATE SET requests=re3l_rate_windows.requests+1`;
  const [window]=await sql`SELECT requests FROM re3l_rate_windows WHERE key_id=${key.id} AND window_start=date_trunc('minute',now())`;
  if(window.requests>30) throw new MailError(429,'Rate limit exceeded');
  return key;
 }
 async function audit(key,action,messageId=null) {await sql`INSERT INTO re3l_audit(tenant_id,key_id,action,message_id) VALUES(${key.tenant_id},${key.id},${action},${messageId})`;}
 async function message(key,id) {const [m]=await sql`SELECT * FROM re3l_messages WHERE id=${id} AND tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id}`;if(!m)throw new MailError(404,'Message not found');return m;}
 async function draft(key,data,parent=null) {
  const input=envelope.parse(data); const id=randomUUID(), thread=parent?.thread_id||randomUUID();
  // Only the pilot test recipient is permitted until the complete loop passes.
  const allowed=(env.RE3L_ALLOWED_RECIPIENTS||'andrewgodliman@hotmail.com').split(',').map(s=>s.trim().toLowerCase());
  if(input.to.some(a=>!allowed.includes(a.toLowerCase())))throw new MailError(403,'Recipient not authorised for pilot');
  const suppressed=await sql`SELECT address FROM re3l_suppressions WHERE tenant_id=${key.tenant_id} AND address = ANY(${sql.array(input.to.map(a=>a.toLowerCase()))})`;
  if(suppressed.length)throw new MailError(403,'Recipient suppressed after bounce or complaint');
  const refs=parent?[...referenceIds(parent.headers),parent.rfc_message_id].filter(Boolean).slice(-50):[];
  const headers={'Message-ID':`<${id}@offgridrc.com>`,...(parent?{'In-Reply-To':parent.rfc_message_id,References:refs.join(' ')}:{})};
  await sql`INSERT INTO re3l_messages(id,tenant_id,mailbox_id,thread_id,direction,sender,recipients,subject,body_text,headers,attachments,status,rfc_message_id) VALUES(${id},${key.tenant_id},${key.mailbox_id},${thread},'outbound',${key.address},${sql.json(input.to)},${input.subject},${input.text},${sql.json(headers)},${sql.json(input.attachments)},'draft',${headers['Message-ID']})`;
  await audit(key,'draft.created',id);
  return {draft_id:id,thread_id:thread,from:key.address,...input,approval_required:true};
 }
 async function approve(key,id) {
  const token=randomBytes(32).toString('hex');
  const rows=await sql`UPDATE re3l_messages SET approval_hash=${digest(token)},approval_expires=now()+interval '10 minutes' WHERE id=${id} AND tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND status='draft' RETURNING id`;
  if(!rows.length) throw new MailError(409,'Draft unavailable');
  await audit(key,'draft.approved',id); return {draft_id:id,approval_token:token};
 }
 async function dispatch(key,id) {
  const [m]=await sql`UPDATE re3l_messages SET status='sending',attempts=attempts+1,lease_until=now()+interval '90 seconds' WHERE id=${id} AND tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND status='queued' AND (next_attempt IS NULL OR next_attempt<=now()) RETURNING *`;
  if(!m)return {id,status:(await message(key,id)).status};
  try {
   const suppressed=await sql`SELECT address FROM re3l_suppressions WHERE tenant_id=${key.tenant_id} AND address = ANY(${sql.array(m.recipients.map(a=>a.toLowerCase()))})`;
   if(suppressed.length)throw new MailError(403,'Recipient suppressed');
   const [count]=await sql`SELECT count(*)::int AS total FROM re3l_messages WHERE tenant_id=${key.tenant_id} AND direction='outbound' AND sent_at>now()-interval '24 hours'`;
   if(count.total>=25)throw new MailError(429,'Pilot daily send limit exceeded');
   const result=await provider('/emails',{method:'POST',headers:{'Idempotency-Key':`re3l-${id}`},body:JSON.stringify({from:m.sender,to:m.recipients,subject:m.subject,text:m.body_text,headers:m.headers,attachments:m.attachments})});
   await sql`UPDATE re3l_messages SET status='sent',provider_id=${result.id},sent_at=now(),lease_until=NULL WHERE id=${id} AND tenant_id=${key.tenant_id} AND status='sending'`;
   // Resend may generate the final RFC Message-ID; reconcile before replies arrive.
   try {const sent=await provider(`/emails/${encodeURIComponent(result.id)}`);if(sent.message_id)await sql`UPDATE re3l_messages SET rfc_message_id=${sent.message_id} WHERE id=${id} AND tenant_id=${key.tenant_id}`;} catch { /* webhook/delivery_status reconciles later */ }
   await audit(key,'message.sent',id);return {id,provider_id:result.id,status:'sent',thread_id:m.thread_id};
  } catch(error) {
   // Transport timeouts are ambiguous. Reuse the same provider idempotency key on retry.
   const retry=error.retryable||!(error instanceof MailError);
   await sql`UPDATE re3l_messages SET status=${retry&&m.attempts<5?'queued':'failed'},next_attempt=now()+(${Math.min(3600,30*2**m.attempts)} * interval '1 second'),lease_until=NULL WHERE id=${id} AND tenant_id=${key.tenant_id}`;
   await audit(key,retry?'message.retry_pending':'message.failed',id);throw error;
  }
 }
 async function send(key,{draft_id,approval_token}) {
  const rows=await sql`UPDATE re3l_messages SET status='queued',approval_hash=NULL WHERE id=${draft_id} AND tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND status='draft' AND approval_hash=${digest(approval_token)} AND approval_expires>now() RETURNING id`;
  if(!rows.length)throw new MailError(403,'Approve the exact draft in the owner interface first');
  await audit(key,'message.queued',draft_id); return dispatch(key,draft_id);
 }
 async function ingest(key,email) {
  const recipients=email.to||[];
  if(!recipients.some(a=>a.toLowerCase()===key.address.toLowerCase()))return null;
  if(!email.message_id)throw new MailError(422,'Inbound Message-ID missing');
  const refs=referenceIds(email.headers);
  const [parent]=refs.length?await sql`SELECT thread_id FROM re3l_messages WHERE tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND rfc_message_id = ANY(${sql.array(refs)}) ORDER BY created_at DESC LIMIT 1`:[];
  const id=randomUUID();
  const rows=await sql`INSERT INTO re3l_messages(id,tenant_id,mailbox_id,thread_id,direction,sender,recipients,subject,body_text,headers,attachments,status,provider_id,rfc_message_id) VALUES(${id},${key.tenant_id},${key.mailbox_id},${parent?.thread_id||randomUUID()},'inbound',${email.from},${sql.json(recipients)},${email.subject||''},${email.text||''},${sql.json(email.headers||{})},${sql.json(email.attachments||[])},'received',${email.id},${email.message_id}) ON CONFLICT(tenant_id,mailbox_id,provider_id) DO NOTHING RETURNING id`;
  if(rows.length)await audit(key,'message.received',id);return rows[0]?.id||null;
 }
 async function execute(key,operation,args) {
  const schema=schemas[operation];if(!schema)throw new MailError(404,'Unknown operation');const input=schema.parse(args);
  if(['create_draft','send_email','reply_to_email','forward_email','sync_inbox'].includes(operation)&&!key.scopes.includes('write'))throw new MailError(403,'Write permission denied');
  if(operation==='create_draft')return draft(key,input);
  if(operation==='send_email')return send(key,input);
  if(operation==='reply_to_email') {const parent=await message(key,input.id); if(!parent.rfc_message_id)throw new MailError(409,'Thread headers unavailable');return draft(key,{to:[parent.direction==='inbound'?parent.sender.replace(/^.*<([^>]+)>$/,'$1'):parent.recipients[0]],subject:/^re:/i.test(parent.subject)?parent.subject:`Re: ${parent.subject}`,text:input.text},parent);}
  if(operation==='forward_email') {const m=await message(key,input.id);return draft(key,{to:input.to,subject:`Fwd: ${m.subject}`,text:`${input.text}\n\n--- Forwarded message ---\nFrom: ${m.sender}\nSubject: ${m.subject}\n\n${m.body_text}`});}
  if(operation==='read_email'){const m=await message(key,input.id);await audit(key,'message.read',m.id);const {approval_hash,approval_expires,...safe}=m;return {...safe,content_trust:'untrusted_email_data'};}
  if(operation==='get_thread')return {messages:await sql`SELECT id,direction,sender,recipients,subject,body_text,rfc_message_id,status,created_at FROM re3l_messages WHERE tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND thread_id=${input.thread_id} ORDER BY created_at LIMIT 100`,content_trust:'untrusted_email_data'};
  if(operation==='list_emails')return {messages:await sql`SELECT id,thread_id,direction,sender,recipients,subject,status,created_at FROM re3l_messages WHERE tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} ORDER BY created_at DESC LIMIT ${input.limit}`};
  if(operation==='search_emails'){const q='%'+input.query.replace(/[\\%_]/g,'\\$&')+'%';return {messages:await sql`SELECT id,thread_id,direction,sender,subject,status,created_at FROM re3l_messages WHERE tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND (subject ILIKE ${q} OR body_text ILIKE ${q} OR sender ILIKE ${q}) ORDER BY created_at DESC LIMIT ${input.limit}`};}
  if(operation==='sync_inbox'){const list=await provider('/emails/receiving?limit=100');let added=0;for(const item of list.data||[]){if(!(item.to||[]).some(a=>a.toLowerCase()===key.address))continue;const [existing]=await sql`SELECT id FROM re3l_messages WHERE tenant_id=${key.tenant_id} AND mailbox_id=${key.mailbox_id} AND provider_id=${item.id}`;if(!existing){if(await ingest(key,await provider(`/emails/receiving/${encodeURIComponent(item.id)}`)))added++;}}return {added,has_more:!!list.has_more};}
  if(operation==='delivery_status'){const m=await message(key,input.id);if(!m.provider_id||m.direction!=='outbound')return {id:m.id,status:m.status};const result=await provider(`/emails/${encodeURIComponent(m.provider_id)}`);if(result.message_id)await sql`UPDATE re3l_messages SET rfc_message_id=${result.message_id},status=${result.last_event||m.status} WHERE id=${m.id} AND tenant_id=${key.tenant_id}`;return {id:m.id,status:result.last_event||m.status,provider_id:m.provider_id};}
 }
 async function webhook(request) {
  let secret=env.RESEND_WEBHOOK_SECRET;
  if(!secret){const [setting]=await sql`SELECT value FROM re3l_settings WHERE name='resend_webhook_secret'`;if(setting)secret=open(setting.value,env.RE3L_ENCRYPTION_KEY||env.JWT_SECRET);}
  if(!secret)throw new MailError(503,'Webhook secret not configured');
  const raw=await request.text();if(raw.length>200000)throw new MailError(413,'Webhook too large');
  const {id,event}=verifyWebhook(raw,request.headers,secret);
  // Transaction provides replay protection only after all processing succeeds.
  return sql.begin(async tx=>{
   const inserted=await tx`INSERT INTO re3l_events(provider_event_id,event_type,payload) VALUES(${id},${event.type},${tx.json({type:event.type,email_id:event.data.email_id,created_at:event.created_at})}) ON CONFLICT DO NOTHING RETURNING provider_event_id`;
   if(!inserted.length)return {duplicate:true};
   const service=createService(tx,env,fetcher);
   if(event.type==='email.received'){
    const email=await provider(`/emails/receiving/${encodeURIComponent(event.data.email_id)}`);
    const [key]=await tx`SELECT '00000000-0000-0000-0000-000000000000'::uuid AS id,m.tenant_id,m.id AS mailbox_id,m.address FROM re3l_mailboxes m WHERE m.address=${mailbox} AND m.enabled=true LIMIT 1`;
    if(!key)throw new MailError(503,'Mailbox not provisioned');await service.ingest(key,email);
   } else if(['email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed'].includes(event.type)) {
    const status=event.type.split('.')[1];
    if(event.data.message_id)await tx`UPDATE re3l_messages SET rfc_message_id=${event.data.message_id} WHERE provider_id=${event.data.email_id} AND direction='outbound'`;
    await tx`UPDATE re3l_messages SET status=${status} WHERE provider_id=${event.data.email_id} AND direction='outbound' AND status NOT IN ('bounced','complained')`;
    if(['bounced','complained'].includes(status)){await tx`INSERT INTO re3l_suppressions(tenant_id,address) SELECT tenant_id,lower(jsonb_array_elements_text(recipients)) FROM re3l_messages WHERE provider_id=${event.data.email_id} ON CONFLICT DO NOTHING`;}
   }
   return {accepted:true};
  });
 }
 return {auth,execute,approve,ingest,webhook,provider,dispatch};
}
