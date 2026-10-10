import {mailService,fail} from '../helpers/re3lRuntime';
import {api} from '../helpers/re3lProtocol';
export async function handle(request:Request){try{return Response.json(await api(mailService,request,await mailService.auth(request)),{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
