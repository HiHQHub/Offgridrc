import {createHmac, timingSafeEqual} from "node:crypto";
export interface VerifiedWebhook { eventId:string; eventType:string; emailId:string; raw:unknown }
export function verifyResendWebhook(body:string,headers:Headers,secret:string,now=Date.now()):VerifiedWebhook {
  if (body.length > 200000) throw Error("Webhook too large");
  const id=headers.get("svix-id"),stamp=headers.get("svix-timestamp"),signature=headers.get("svix-signature");
  if (!id||!stamp||!signature||!/^\d+$/.test(stamp)||Math.abs(now/1000-Number(stamp))>300) throw Error("Invalid webhook");
  const key=Buffer.from(secret.replace(/^whsec_/,""),"base64");
  if(key.length < 16) throw Error("Invalid webhook secret");
  const expected=createHmac("sha256",key).update(`${id}.${stamp}.${body}`).digest();
  const match=signature.split(" ").some(part=>{
    const [version,value]=part.split(",");
    const actual=Buffer.from(value||"","base64");
    return version==="v1"&&actual.length===expected.length&&timingSafeEqual(actual,expected);
  });
  if(!match)throw Error("Invalid webhook");
  const parsed=JSON.parse(body) as {type?:unknown;data?:{email_id?:unknown}};
  if(typeof parsed.type!=="string"||typeof parsed.data?.email_id!=="string")throw Error("Invalid event");
  return {eventId:id,eventType:parsed.type,emailId:parsed.data.email_id,raw:parsed};
}
