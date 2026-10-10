import {mailService,fail} from '../helpers/re3lRuntime';
export async function handle(request:Request){try{return Response.json(await mailService.webhook(request));}catch(e){return fail(e);}}
