// Brendava Global AI backend (Cloudflare Worker + KV). Detects visitors and public posts, alerts you on Telegram.
const TARGETS = new Set("US GB DE FR NL BE CH AT ES IT PT IE SE NO DK FI PL CA AU NZ AE SA QA IN SG JP KR CN ZA BR MX".split(" "));
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" } });
const AGENT = /agent|agency|partner|trade|b2b|operator|dmc|wholesale/i;
const rate = t => Math.min(100, (/gorilla|safari|serengeti|mara|trek|wildlife|bwindi/i.test(t) ? 25 : 0) + (/uganda|rwanda|kenya|tanzania|east africa/i.test(t) ? 25 : 0) + (/planning|looking for|recommend|book|quote|price|itinerary|honeymoon|\?/i.test(t) ? 25 : 0) + (AGENT.test(t) ? 10 : 0));
const strip = s => (s || "").replace(/&lt;[\s\S]*?&gt;|<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;|&#39;/g, "'").trim();

async function load(env) { const all = JSON.parse((await env.LEADS.get("leads")) || "[]"); return all.filter(l => Date.now() - l.ts < 30 * 864e5); }
const save = (env, a) => env.LEADS.put("leads", JSON.stringify(a.slice(0, 300)));
async function notify(env, l) {
  if (!env.TG_TOKEN) return;
  const text = `Hot ${l.type} lead from ${l.country || "unknown country"}\nSource: ${l.source} | Score ${l.score}\n${l.text}${l.url ? "\n" + l.url : ""}`;
  await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: env.TG_CHAT, text }) });
}
async function upsert(env, lead) {
  const all = await load(env), i = all.findIndex(l => l.id === lead.id), old = all[i];
  lead.alerted = old?.alerted || false; lead.score = Math.max(lead.score, old?.score || 0);
  if (lead.score >= 70 && !lead.alerted) { lead.alerted = true; await notify(env, lead); }
  if (i >= 0) all[i] = lead; else all.unshift(lead);
  await save(env, all);
}
async function collect(req, env) {
  if (req.headers.get("origin") !== env.SITE) return J({ error: "origin" }, 403);
  const b = await req.json().catch(() => ({})), cc = req.cf?.country || "";
  if (!TARGETS.has(cc) || !b.id) return J({ ok: true, skipped: true });
  let host = ""; try { host = new URL(b.ref).hostname; } catch {}
  const source = /google|bing|duckduckgo/.test(host) ? "Search engine" : /facebook|instagram|fb\./.test(host) ? "Facebook/Instagram" : /linkedin/.test(host) ? "LinkedIn" : /tripadvisor|lonelyplanet|reddit/.test(host) ? "Travel forum" : host ? "Other permitted source" : "Direct enquiry";
  const path = String(b.path || "").slice(0, 300).toLowerCase(), country = new Intl.DisplayNames(["en"], { type: "region" }).of(cc);
  const score = Math.min(100, 20 + (source !== "Direct enquiry" ? 15 : 0) + (/gorilla|safari|uganda|rwanda|kenya|tanzania|trek|tour/.test(path) ? 25 : 0) + (/contact|book|quote|enquir|price/.test(path) ? 30 : 0) + (AGENT.test(path) ? 20 : 0) + Math.min(20, (b.pages || 1) * 5) + (b.secs > 60 ? 10 : 0));
  if (score < 50) return J({ ok: true, low: true });
  await upsert(env, { id: "v_" + String(b.id).slice(0, 12), name: "Website visitor " + String(b.id).slice(0, 4), type: AGENT.test(path) ? "Travel Agent" : "Tourist", country, source, score, text: `Visited from ${country} via ${host || "direct"}: ${path.trim().slice(0, 160)}`, url: "", ts: Date.now() });
  return J({ ok: true });
}
async function poll(env) {
  for (const u of (env.RSS || "").split(",").map(s => s.trim()).filter(Boolean)) {
    const xml = await (await fetch(u)).text();
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1], g = r => (e.match(r) || [])[1] || "", title = strip(g(/<title[^>]*>([\s\S]*?)<\/title>/)), body = strip(g(/<content[^>]*>([\s\S]*?)<\/content>/));
      let link = g(/href="([^"]+)"/).replace(/&amp;/g, "&"); try { link = new URL(link).searchParams.get("url") || link; } catch {}
      const text = (title + ". " + body).slice(0, 400), score = rate(text);
      if (score >= 40) await upsert(env, { id: "g_" + g(/<id>(.*?)<\/id>/).slice(-24), name: title.slice(0, 70) || "Google Alert", type: AGENT.test(text) ? "Travel Agent" : "Tourist", country: "", source: "Public website", score, text, url: link, ts: Date.now() });
    }
  }
}
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return J({});
        if (u.pathname === "/health") return J({ dashKeySet: !!env.DASH_KEY, dashKeyLength: (env.DASH_KEY || "").length });

    if (u.pathname === "/leads.json" && u.searchParams.get("key") === env.DASH_KEY) return J(await load(env));
    return J({ error: "not found" }, 404);
  },
  async scheduled(_e, env, ctx) { ctx.waitUntil(poll(env)); }
};
