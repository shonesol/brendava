/* Paste before </body> on brendavatoursandtravel.com. Runs only after the visitor accepts. Set API to your Worker URL. */
(()=>{if(location.pathname.startsWith("/global-ai"))return;const API="https://YOUR-WORKER.workers.dev/collect",S=localStorage;
function run(){const id=S.bt_id||(S.bt_id=crypto.randomUUID()),t0=Date.now(),p=JSON.parse(sessionStorage.bt_p||"[]");
 p.push(location.pathname);sessionStorage.bt_p=JSON.stringify(p.slice(-20));sessionStorage.bt_r=sessionStorage.bt_r||document.referrer;
 const send=()=>navigator.sendBeacon(API,new Blob([JSON.stringify({id,path:p.join(" "),pages:p.length,secs:Math.round((Date.now()-t0)/1e3),ref:sessionStorage.bt_r})],{type:"text/plain"}));
 setTimeout(send,4e3);setTimeout(send,35e3);addEventListener("pagehide",send)}
if(S.bt_consent==="yes")return run();if(S.bt_consent==="no")return;
const b=document.createElement("div");b.style.cssText="position:fixed;left:0;right:0;bottom:0;background:#173d2c;color:#fff;padding:12px 16px;font:13px Arial;z-index:9999;display:flex;gap:12px;flex-wrap:wrap;align-items:center";
b.innerHTML='<span style="flex:1;min-width:220px">We use anonymous visit statistics (country and pages viewed) to improve our safari service.</span><button id="btY">Accept</button><button id="btN">Decline</button>';
document.body.append(b);b.querySelector("#btY").onclick=()=>{S.bt_consent="yes";b.remove();run()};b.querySelector("#btN").onclick=()=>{S.bt_consent="no";b.remove()}})();
