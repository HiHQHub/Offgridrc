/** Informational customer control plane. Live states are loaded only after owner authentication. */
export function portalHtml(){
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RE3L | Connections</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#071522;color:#e9f3fa}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(90deg,#ffffff06 1px,transparent 1px),linear-gradient(#ffffff06 1px,transparent 1px),radial-gradient(ellipse at 85% 0%,#10364c 0,transparent 45%),#071522;background-size:38px 38px,38px 38px,auto}main{max-width:1080px;margin:auto;padding:28px 24px 70px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #264052;padding-bottom:23px}.brand{font-size:25px;font-weight:850;letter-spacing:-1px}.brand span{color:#4bdbf2}.eyebrow{font-size:11px;font-weight:750;letter-spacing:2px;color:#61c8d8;text-transform:uppercase}.hero{margin:52px 0 33px}.hero h1{font-size:clamp(32px,5vw,54px);letter-spacing:-2.2px;margin:10px 0 9px;line-height:1.1}.muted{color:#9db2c4}p{line-height:1.6}.auth{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:22px}.auth input{width:min(390px,100%);background:#10293b;border:1px solid #34536a;color:white;border-radius:5px;padding:14px 16px;font:inherit}.auth button,.refresh{background:#53daf0;border:0;color:#042234;font:inherit;font-weight:750;border-radius:5px;padding:14px 21px;cursor:pointer}.auth button:disabled{opacity:.45;cursor:wait}.small{font-size:12px}.state{border:1px solid #29485a;background:#0d2535;border-radius:6px;padding:15px 19px;display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}.state strong{font-size:14px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.panel{background:linear-gradient(145deg,#142637,#0a1825);border:1px solid #28495e;border-radius:8px;padding:22px;min-height:185px;box-shadow:0 16px 34px #0002;display:flex;flex-direction:column;gap:12px}.top{display:flex;align-items:center;justify-content:space-between;gap:10px}.symbol{display:grid;place-items:center;width:42px;height:42px;border-radius:5px;background:#1d4152;font-size:22px}.pill{border:1px solid #526575;color:#b9c6d0;border-radius:3px;font-size:11px;padding:6px 10px;font-weight:750;white-space:nowrap}.pill.ok{border-color:#1e796e;color:#80f1bd;background:#0f3936}.pill.warning{border-color:#856b3e;color:#f4cc85;background:#3c3021}.pill.down{border-color:#944b52;color:#ffc0be;background:#41252a}.panel h2{font-size:18px;margin:0}.detail{color:#92aabd;font-size:13px;margin:0;overflow-wrap:anywhere}.caption{margin-top:auto;font-size:12px;color:#6f91a6}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#8095a3;margin-right:7px}.dot.ok{background:#68e9b2;box-shadow:0 0 0 4px #68e9b219}.dot.warning{background:#e4b970}.dot.down{background:#f38c90}footer{margin-top:36px;font-size:12px;color:#7292a5}input:focus-visible,button:focus-visible{outline:2px solid #65dff5;outline-offset:2px}@media(max-width:780px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:530px){main{padding:22px 16px}.grid{grid-template-columns:1fr}.hero{margin-top:37px}.state{align-items:flex-start;flex-direction:column}}
</style></head><body><main><header><div class="brand">RE3L<span>.</span></div><div class="eyebrow">Your infrastructure. One view.</div></header><section class="hero"><div class="eyebrow">SYSTEM / CONNECTIONS</div><h1>Your infrastructure.<br>Under your control.</h1><p class="muted">Operational status for the infrastructure powering your email. Every account and every byte remains yours.</p></section><form id="auth-form" class="auth"><input id="owner-key" type="password" autocomplete="off" required minlength="32" placeholder="Enter your owner access token" aria-label="Owner access token"><button id="check" type="submit">Check connections ↗</button></form><section class="state" role="status" aria-live="polite"><strong id="summary">Connect securely to load your service health.</strong><span class="small muted" id="checked">Not yet checked</span></section><section id="cards" class="grid" aria-label="Infrastructure connections"></section><footer>Statuses are verified when you request a check. AI connectivity is not assumed from a configured token. The owner token stays in this browser tab's memory only, and is never saved to local storage.</footer></main><script src="/portal.js" defer></script></body></html>`;
}
export function portalScript(){
return `"use strict";
const definitions=[
 ["domain","◎","Domain"],["email","✉","Email transport"],["database","▦","Your database"],["ai","✦","AI assistant"],["hosting","◈","Deployment"]
];
const cards=document.getElementById("cards"), summary=document.getElementById("summary"), checked=document.getElementById("checked"), form=document.getElementById("auth-form"), button=document.getElementById("check");
function node(tag,className,content){const el=document.createElement(tag);if(className)el.className=className;if(content!==undefined)el.textContent=content;return el;}
function render(data={}){
 cards.replaceChildren();
 for(const [id,icon,title] of definitions){
  const item=data[id]||{state:"unknown",label:"Not checked",detail:"Run a live check",owner:"Customer owned"};
  const state=["ok","warning","down"].includes(item.state)?item.state:"unknown";
  const panel=node("article","panel"),top=node("div","top"),symbol=node("span","symbol",icon),pill=node("span","pill "+state);
  pill.append(node("span","dot "+state));pill.append(document.createTextNode(item.label||"Not checked"));
  top.append(symbol,pill);panel.append(top,node("h2","",title),node("p","detail",item.detail||"Status unavailable"),node("div","caption",item.owner||"Customer owned"));
  cards.append(panel);
 }
}
render();
form.addEventListener("submit",async e=>{
 e.preventDefault();button.disabled=true;summary.textContent="Checking service connections…";
 try{
  const token=document.getElementById("owner-key").value;
  const response=await fetch("/api/connections",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(!response.ok)throw Error(response.status===401?"Access denied — check the owner token":"Connection check failed");
  const data=await response.json();render(data.connections);
  checked.textContent="Checked "+new Date(data.checkedAt).toLocaleTimeString();
  const all=Object.values(data.connections), good=all.filter(x=>x.state==="ok").length;
  summary.textContent=good+" of "+all.length+" services verified healthy";
 }catch(err){summary.textContent=err.message||"Unable to load connections";checked.textContent="Check failed";render();}
 finally{button.disabled=false}
});
`;
}
