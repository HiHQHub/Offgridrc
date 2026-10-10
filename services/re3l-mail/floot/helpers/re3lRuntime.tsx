import postgres from 'postgres';
import {createService,MailError} from './re3lCore';
export const mailSql=postgres(process.env.FLOOT_DATABASE_URL,{prepare:false,max:3,idle_timeout:10});
export const mailService=createService(mailSql);
export function fail(error:unknown){return Response.json({error:error instanceof MailError?error.message:'Invalid request or operation failed'},{status:error instanceof MailError?error.status:400,headers:{'Cache-Control':'no-store'}});}
