import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getServerUserSession} from '../helpers/getServerUserSession';
import {mailSql as sql,mailService,fail} from '../helpers/re3lRuntime';
import {digest,MailError} from '../helpers/re3lCore';
const schema=z.object({action:z.enum(['status','create_key','revoke_key','revoke_connections','list','read','thread','draft','reply','forward','approve_send','retry','search','sync','delivery']),arguments:z.record(z.unknown()).default({})}).strict();
export async function handle(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new MailError(403,'Same-origin owner request required');
 const {user}=await getServerUserSession(request);
 const [box]=await sql`SELECT * FROM re3l_mailboxes WHERE owner_user_id=${user.id} AND enabled=true`;
 if(!box)throw new MailError(403,'No mailbox assigned');
 const key={id:'00000000-0000-0000-0000-000000000000',tenant_id:box.tenant_id,mailbox_id:box.id,address:box.address,scopes:['read','write']};
 const raw=await request.text();if(raw.length>8000000)throw new MailError(413,'Request too large');
 const body=schema.parse(JSON.parse(raw)),args=body.arguments;
 let result:unknown;
 if(body.action==='status'){const domain=await mailService.provider('/domains/a1ce479a-3088-4e9b-947b-6788e44619b5');result={address:box.address,transport:'Resend',domain_status:domain.status};}
 else if(body.action==='create_key'){
  const token=randomBytes(32).toString('hex'),id=randomUUID();
  await sql`INSERT INTO re3l_keys(id,tenant_id,mailbox_id,token_hash,scopes) VALUES(${id},${box.tenant_id},${box.id},${digest(token)},ARRAY['read','write'])`;
  result={id,token,note:'Shown once. Store securely. Never paste into chat.'};
 }else if(body.action==='revoke_key'){const id=z.string().uuid().parse(args.id);await sql`UPDATE re3l_keys SET revoked_at=now() WHERE id=${id} AND tenant_id=${box.tenant_id} AND mailbox_id=${box.id}`;result={revoked:true};}
 else if(body.action==='revoke_connections'){await sql`UPDATE re3l_keys SET revoked_at=now() WHERE tenant_id=${box.tenant_id} AND mailbox_id=${box.id}`;result={revoked:true};}
 else if(body.action==='retry'){const id=z.string().uuid().parse(args.id);const [m]=await sql`SELECT id FROM re3l_messages WHERE id=${id} AND tenant_id=${box.tenant_id} AND mailbox_id=${box.id} AND status='queued' AND created_at>now()-interval '23 hours'`;if(!m)throw new MailError(409,'No safely retryable queued message');result=await mailService.dispatch(key,id);}
 else if(body.action==='approve_send'){const id=z.string().uuid().parse(args.draft_id);const approved=await mailService.approve(key,id);result=await mailService.execute(key,'send_email',approved);}
 else {const operations={search:'search_emails',list:'list_emails',read:'read_email',thread:'get_thread',draft:'create_draft',reply:'reply_to_email',forward:'forward_email',sync:'sync_inbox',delivery:'delivery_status'};result=await mailService.execute(key,operations[body.action],args);}
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
