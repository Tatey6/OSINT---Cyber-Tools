// Monthly check of the indicator lookup buttons.
//
// The weekly link check only tests each tool's home page. Lookup buttons use
// search addresses that services can change without warning, so this fills
// each lookup in tools.json with a well-known, harmless sample indicator and
// checks the address still works. Writes lookup-report.md and lookup-summary.env.
//
// Limits: many services load results with JavaScript, so a page can "work" here
// but show nothing in a browser. This catches addresses that have gone missing,
// moved, or now bounce to the home page or a login, which is the common failure.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Safe, public sample indicators. Nothing here is private or sensitive:
// Google's DNS server, google.com, and the EICAR antivirus test file's hashes.
export const SAMPLES = {
  ip: { type: "ipv4", value: "8.8.8.8" },
  domain: { type: "domain", value: "google.com" },
  url: { type: "url", value: "https://www.google.com/" },
  email: { type: "email", value: "test@example.com" },
  cve: { type: "cve", value: "CVE-2021-44228" },
  hash: [
    { type: "sha256", value: "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f" },
    { type: "md5", value: "44d88612fea8a8f36de82e1278abb02f" },
    { type: "sha1", value: "3395856ce81f2b7382dee72602f798b642f14140" },
  ],
};

// Must match fillTemplate() in index.html.
export function fillTemplate(tpl, value, type) {
  const E = encodeURIComponent;
  const parts = { value, enc: E(value), enc2: E(E(value)), hashtype: type, cveyear: "", cvenum: "" };
  if (type === "cve") { parts.cveyear = value.split("-")[1]; parts.cvenum = value.replace(/^CVE-/, ""); }
  return tpl.replace(/\{(value|enc2|enc|hashtype|cveyear|cvenum)\}/g, (m, k) => parts[k]);
}

// Every lookup button in tools.json, filled with a sample indicator.
export function lookupsToCheck(data) {
  const out = [];
  for (const t of data.tools) {
    for (const [kind, raw] of Object.entries(t.lookups || {})) {
      const spec = typeof raw === "string" ? { url: raw } : raw;
      if (!/\{[a-z0-9]+\}/.test(spec.url)) continue;              // fixed pages (e.g. "paste it in") are covered by the link check
      const samples = kind === "hash" ? SAMPLES.hash : [SAMPLES[kind]];
      const sample = samples.find(s => !spec.only || spec.only.includes(s.type));
      if (!sample) continue;
      out.push({ tool: t.name, id: t.id, kind, sample: sample.value, template: spec.url, url: fillTemplate(spec.url, sample.value, sample.type) });
    }
  }
  return out;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const host = u => new URL(u).hostname.replace(/^www\./, "");
// "search.censys.io" and "accounts.censys.io" are the same site. Handles co.uk-style endings too.
const site = u => { const p = host(u).split("."); return p.slice(p.length > 2 && /^(co|com|net|org|gov|ac|edu)$/.test(p[p.length - 2]) ? -3 : -2).join("."); };
const path = u => new URL(u).pathname.replace(/\/+$/, "") || "/";

async function fetchOnce(url) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25000), headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8" } });
    res.body?.cancel().catch(() => {});
    return { status: res.status, finalUrl: res.url };
  } catch (err) {
    const code = err.cause?.code || err.name || "error";
    return { status: 0, error: code === "TimeoutError" ? "timed out" : code };
  }
}

export function classify(item, r) {
  if (r.status === 0) return { level: "broken", reason: `No response (${r.error})` };
  if ([404, 410].includes(r.status)) return { level: "broken", reason: `HTTP ${r.status}: the search address no longer exists` };
  if ([401, 403, 429, 503].includes(r.status)) return { level: "blocked", reason: `HTTP ${r.status}: blocks automated checks` };
  if (r.status >= 400) return { level: "broken", reason: `HTTP ${r.status}` };
  if (r.finalUrl) {
    if (site(r.finalUrl) !== site(item.url))
      return { level: "changed", reason: `Now redirects to another site: ${r.finalUrl}` };
    if (/\/(login|log-in|signin|sign-in|signup|sign-up|auth|register)\b/i.test(new URL(r.finalUrl).pathname))
      return { level: "changed", reason: `Now redirects to a login or sign-up page: ${r.finalUrl}` };
    if (path(r.finalUrl) === "/" && path(item.url) !== "/" && !new URL(r.finalUrl).search && !new URL(r.finalUrl).hash)
      return { level: "changed", reason: `Now redirects to the home page, so the search address has probably changed` };
  }
  return { level: "ok", reason: `HTTP ${r.status}` };
}

async function check(item) {
  let r = await fetchOnce(item.url), c = classify(item, r);
  if (c.level === "broken") { await new Promise(res => setTimeout(res, 5000)); r = await fetchOnce(item.url); c = classify(item, r); }
  console.log(`${c.level.padEnd(8)} ${item.tool} (${item.kind}) — ${c.reason}`);
  return { ...item, ...c };
}

export function report(results, runUrl = "") {
  const by = lvl => results.filter(r => r.level === lvl).sort((a, b) => a.tool.localeCompare(b.tool) || a.kind.localeCompare(b.kind));
  const broken = by("broken"), changed = by("changed"), blocked = by("blocked"), ok = by("ok");
  const clean = s => String(s).replace(/\|/g, "\\|");
  const table = rows => ["| Tool | Lookup | Tested with | Result |", "|---|---|---|---|",
    ...rows.map(r => `| ${clean(r.tool)} | ${r.kind} | [${clean(r.sample.length > 20 ? r.sample.slice(0, 12) + "…" : r.sample)}](${r.url}) | ${clean(r.reason)} |`)].join("\n");
  let md = `Monthly check of **${results.length} lookup buttons** on ${new Date().toISOString().slice(0, 10)}, each tested with a harmless sample indicator.\n\n`;
  md += `**${broken.length} broken**, **${changed.length} probably changed**, ${blocked.length} couldn't be verified, ${ok.length} OK.\n\n`;
  if (broken.length) md += `## Broken\nThese return an error or don't respond. Click the sample link to see for yourself. If the service has changed its search address, update the lookup in \`tools.json\`. If the tool no longer offers that search, remove the lookup.\n\n${table(broken)}\n\n`;
  if (changed.length) md += `## Probably changed\nThese now land somewhere unexpected, such as the home page, a login page or another site. Click the sample link and check the results page still shows the indicator.\n\n${table(changed)}\n\n`;
  if (blocked.length) md += `<details><summary>${blocked.length} couldn't be verified (they block automated checks)</summary>\n\n${table(blocked)}\n\n</details>\n\n`;
  md += `This issue is updated by the monthly lookup check and closes itself when everything passes.${runUrl ? ` [View this run](${runUrl}).` : ""}\n`;
  return { md, broken: broken.length, changed: changed.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const items = lookupsToCheck(JSON.parse(readFileSync("tools.json", "utf8")));
  if (!items.length) { console.error("No lookups found in tools.json"); process.exit(1); }
  const results = [], queue = [...items];
  // A few at a time, and never more than 2 at once on the same site.
  const busy = new Map();
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const i = queue.findIndex(x => (busy.get(host(x.url)) || 0) < 2);
      if (i === -1) { await new Promise(r => setTimeout(r, 200)); continue; }
      const item = queue.splice(i, 1)[0], h = host(item.url);
      busy.set(h, (busy.get(h) || 0) + 1);
      try { results.push(await check(item)); } finally { busy.set(h, busy.get(h) - 1); }
    }
  }));
  const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
  const { md, broken, changed } = report(results, runUrl);
  writeFileSync("lookup-report.md", md);
  writeFileSync("lookup-summary.env", `PROBLEMS=${broken + changed}\nBROKEN=${broken}\nCHANGED=${changed}\n`);
  console.log(`\n${broken} broken, ${changed} changed, ${results.length - broken - changed} fine or unverifiable`);
}
