import test from "node:test";
import assert from "node:assert/strict";
import {runInNewContext} from "node:vm";
import {buildSetup,setupScript} from "../src/setup.ts";
import {validateConfig} from "../src/config.ts";
const input={domain:"EXAMPLE.org",mailbox:"hello@example.org",deployment:"https://mail.example.org",ai:"mcp"};
test("customer setup exports credential-free configuration scoped to that deployment",()=>{
 const plan=buildSetup(input,validateConfig);
 assert.equal(plan.webhook,"https://mail.example.org/webhooks/resend");
 assert.equal(plan.mcp,"https://mail.example.org/mcp");
 assert.match(plan.environment,/RE3L_MODE=customer/);
 for(const key of ["DATABASE_URL","RESEND_API_KEY","RESEND_WEBHOOK_SECRET","RE3L_OWNER_TOKEN","RE3L_ASSISTANT_TOKEN"])
  assert.ok(plan.environment.split("\n").includes(key+"="));
 assert.throws(()=>buildSetup({...input,mailbox:"hello@other.org"},validateConfig));
 for(const deployment of ["http://mail.example.org","https://user:password@mail.example.org","https://mail.example.org?token=secret","https://mail.example.org/#secret","https://mail.example.org/path"])
  assert.throws(()=>buildSetup({...input,deployment},validateConfig));
 assert.throws(()=>buildSetup({...input,domain:"example.org\nRESEND_API_KEY=secret"},validateConfig));
});
test("browser setup keeps the same validation after function serialization",()=>{
 const script=setupScript();
 const validators=script.slice(0,script.indexOf("let plan;"));
 const plan=runInNewContext(validators+"\nbuildSetup(input,validateConfig)",{input,URL});
 assert.equal(plan.config.mailbox,"hello@example.org");
 assert.equal(plan.base,"https://mail.example.org");
 new Function(script);
 assert.doesNotMatch(script,/localStorage|sessionStorage|fetch\(/);
});
