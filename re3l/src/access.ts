import {timingSafeEqual} from "node:crypto";
export type Role="owner"|"assistant"|"none";
function equal(a:string,b:string):boolean {
 const left=Buffer.from(a),right=Buffer.from(b);
 return left.length>0&&left.length===right.length&&timingSafeEqual(left,right);
}
/** Assistant tokens are intentionally incapable of approval or sending. */
export function classifyBearer(header:string|undefined,ownerToken:string,assistantToken:string):Role {
 const token=header?.match(/^Bearer ([^\s]+)$/)?.[1]||"";
 if(!token)return "none";
 if(equal(token,ownerToken))return "owner";
 if(assistantToken && assistantToken!==ownerToken && equal(token,assistantToken))return "assistant";
 return "none";
}
export function canPerform(role:Role,operation:"read"|"draft"|"approve"|"send"):boolean {
 if(role==="owner")return true;
 return role==="assistant"&&(operation==="read"||operation==="draft");
}
