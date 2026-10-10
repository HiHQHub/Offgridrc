import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {digest,MailError} from './core.mjs';
export const clientId='https://chatgpt.com/oauth/client.json';
export const redirectUri='https://chatgpt.com/connector_platform_oauth_redirect';
export function challenge(verifier){return createHash('sha256').update(verifier).digest('base64url');}
export function metadata(base,resource){return {issuer:base,authorization_endpoint:base+'/connect',token_endpoint:base+'/_api/re3l-oauth-token',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],client_id_metadata_document_supported:true,authorization_response_iss_parameter_supported:true,scopes_supported:['read','write']};}
export function authorizeInput(input,resource){
 if(input.client_id!==clientId||input.redirect_uri!==redirectUri||input.response_type!=='code'||input.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(input.code_challenge||'')||input.resource!==resource||!input.state||input.state.length>1000)throw new MailError(400,'Invalid OAuth authorization request');
 const scopes=(input.scope||'read write').split(' ');if(scopes.some(s=>!['read','write'].includes(s))||!scopes.includes('read'))throw new MailError(400,'Invalid scopes');return {...input,scopes};
}
export function createOAuth(sql,resource,base){
 async function grant(input,ownerUserId){
  const args=authorizeInput(input,resource);
  // CIMD is fetched only at a fixed, trusted HTTPS URL; no redirects or user supplied fetch targets.
  const r=await fetch(clientId,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new MailError(503,'ChatGPT client metadata unavailable');const client=await r.json();
  if(client.client_id!==clientId||!client.redirect_uris?.includes(redirectUri))throw new MailError(400,'Client metadata mismatch');
  const [box]=await sql`SELECT * FROM re3l_mailboxes WHERE owner_user_id=${ownerUserId} AND enabled=true AND address='hello@offgridrc.com'`;
  if(!box)throw new MailError(403,'No mailbox assigned');
  const code=randomBytes(32).toString('hex');
  await sql`INSERT INTO re3l_oauth_codes(code_hash,client_id,redirect_uri,challenge,tenant_id,mailbox_id,resource,scopes,expires_at) VALUES(${digest(code)},${args.client_id},${args.redirect_uri},${args.code_challenge},${box.tenant_id},${box.id},${resource},${sql.array(args.scopes)},now()+interval '5 minutes')`;
  const redirect=new URL(redirectUri);redirect.searchParams.set('code',code);redirect.searchParams.set('state',args.state);redirect.searchParams.set('iss',base);return {redirect:redirect.href};
 }
 async function token(args){
  if(args.client_id!==clientId||args.resource!==resource)throw new MailError(400,'Client or resource mismatch');
  return sql.begin(async tx=>{
   let grant;
   if(args.grant_type==='authorization_code'){
    if(args.redirect_uri!==redirectUri||!/^[A-Za-z0-9._~-]{43,128}$/.test(args.code_verifier||''))throw new MailError(400,'Invalid token request');
    const [row]=await tx`SELECT * FROM re3l_oauth_codes WHERE code_hash=${digest(args.code||'')} AND used_at IS NULL AND expires_at>now() FOR UPDATE`;
    if(!row||row.client_id!==args.client_id||row.redirect_uri!==args.redirect_uri||row.resource!==args.resource||row.challenge!==challenge(args.code_verifier))throw new MailError(400,'Invalid or expired authorization code');
    await tx`UPDATE re3l_oauth_codes SET used_at=now() WHERE code_hash=${row.code_hash}`;grant=row;
   }else if(args.grant_type==='refresh_token'){
    const [row]=await tx`SELECT k.*,r.token_hash,r.client_id FROM re3l_oauth_refresh r JOIN re3l_keys k ON k.id=r.key_id WHERE r.token_hash=${digest(args.refresh_token||'')} AND r.used_at IS NULL AND r.expires_at>now() AND k.revoked_at IS NULL FOR UPDATE`;
    if(!row||row.client_id!==args.client_id||row.audience!==resource)throw new MailError(400,'Invalid refresh token');
    await tx`UPDATE re3l_oauth_refresh SET used_at=now() WHERE token_hash=${row.token_hash}`;
    await tx`UPDATE re3l_keys SET revoked_at=now() WHERE id=${row.id}`;grant=row;
   }else throw new MailError(400,'Unsupported grant');
   const access=randomBytes(32).toString('hex'),refresh=randomBytes(32).toString('hex'),id=randomUUID();
   await tx`INSERT INTO re3l_keys(id,tenant_id,mailbox_id,token_hash,scopes,expires_at,audience) VALUES(${id},${grant.tenant_id},${grant.mailbox_id},${digest(access)},${tx.array(grant.scopes)},now()+interval '1 hour',${resource})`;
   await tx`INSERT INTO re3l_oauth_refresh(token_hash,client_id,key_id,expires_at) VALUES(${digest(refresh)},${args.client_id},${id},now()+interval '30 days')`;
   return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:grant.scopes.join(' ')};
  });
 }
 return {grant,token};
}
