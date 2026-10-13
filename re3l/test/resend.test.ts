import test from "node:test";
import assert from "node:assert/strict";
import { ResendProvider } from "../src/resend.ts";
import { ProviderError } from "../src/types.ts";

test("sends using customer credentials and maps mail fields", async () => {
  let request: RequestInit | undefined;
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    request = init;
    return new Response(JSON.stringify({id:"sent_123"}),{status:200});
  }) as typeof fetch;
  const result = await new ResendProvider("test-customer-key",fakeFetch).send({
    from:{email:"hello@example.com"}, to:[{email:"person@example.net"}],
    subject:"Hello",text:"Test"
  },"request-1");
  assert.equal(result.providerId,"sent_123");
  assert.equal((request?.headers as Record<string,string>).Authorization,"Bearer test-customer-key");
  assert.equal((request?.headers as Record<string,string>)["Idempotency-Key"],"request-1");
  assert.equal(JSON.parse(request?.body as string).to[0],"person@example.net");
});

test("rejects empty email before contacting provider", async () => {
  let called = false;
  const fakeFetch = (async () => {called=true; return new Response("");}) as typeof fetch;
  await assert.rejects(() => new ResendProvider("test",fakeFetch).send({
    from:{email:"hello@example.com"},to:[],subject:"Hello",text:"Test"
  }));
  assert.equal(called,false);
});

test("maps reply headers and rejects header injection",async()=>{
 let payload:any;
 const fakeFetch=(async(_url:unknown,init?:RequestInit)=>{payload=JSON.parse(init?.body as string);return new Response(JSON.stringify({id:"sent_reply"}));}) as typeof fetch;
 const provider=new ResendProvider("test-only-key",fakeFetch);
 const message={from:{email:"hello@example.org"},to:[{email:"test@example.net"}],subject:"Re: test",text:"Fixture",inReplyTo:"<parent@example.net>"};
 await provider.send(message);
 assert.deepEqual(payload.headers,{"In-Reply-To":"<parent@example.net>",References:"<parent@example.net>"});
 await assert.rejects(provider.send({...message,inReplyTo:"<parent@example.net>\r\nBcc: other@example.net"}));
});

test("does not leak provider error body or API credentials", async () => {
  const fakeFetch = (async () => new Response("private provider diagnostic",{status:403})) as typeof fetch;
  await assert.rejects(() => new ResendProvider("secret-key",fakeFetch).send({
    from:{email:"hello@example.com"},to:[{email:"person@example.net"}],subject:"Hello",text:"Test"
  }), (err: unknown) => err instanceof ProviderError && err.status === 403 && !err.message.includes("secret-key") && !err.message.includes("private provider diagnostic"));
});
