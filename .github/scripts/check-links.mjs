// Weekly link check for the Free Cyber Tools Index.
// Reads every tool URL from index.html, checks it, and writes link-report.md.
// No dependencies: runs on the Node version that ships with GitHub's runners.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const tools = [...html.matchAll(/\{name:"([^"]+)",url:"([^"]+)"/g)].map(m => ({ name: m[1], url: m[2] }));
if (tools.length === 0) { console.error("No tools found in index.html"); process.exit(1); }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 25000;
const host = u => new URL(u).hostname.replace(/^www\./, "");

async function checkOnce(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "en-AU,en;q=0.9" },
    });
    res.body?.cancel().catch(() => {});
    return { status: res.status, finalUrl: res.url };
  } catch (err) {
    const code = err.cause?.code || err.name || "error";
    return { status: 0, error: code === "TimeoutError" ? "timed out" : code };
  }
}

function classify(tool, r) {
  if (r.status === 0) return { level: "dead", reason: `No response (${r.error})` };
  if ([404, 410].includes(r.status)) return { level: "dead", reason: `HTTP ${r.status}: page not found` };
  if ([401, 403, 429, 503].includes(r.status)) return { level: "blocked", reason: `HTTP ${r.status}: likely bot protection` };
  if (r.status >= 500) return { level: "dead", reason: `HTTP ${r.status}: server error` };
  if (r.status >= 400) return { level: "dead", reason: `HTTP ${r.status}` };
  if (r.finalUrl && host(r.finalUrl) !== host(tool.url)) return { level: "moved", reason: `Redirects to another site: ${r.finalUrl}` };
  if (r.finalUrl && /\/(login|log-in|signin|sign-in|signup|sign-up|auth|register)\b/i.test(new URL(r.finalUrl).pathname))
    return { level: "moved", reason: `Redirects to a login/sign-up page: ${r.finalUrl}` };
  return { level: "ok", reason: `HTTP ${r.status}` };
}

async function check(tool) {
  let r = await checkOnce(tool.url);
  let c = classify(tool, r);
  if (c.level === "dead") {               // one retry after a pause, to skip brief outages
    await new Promise(res => setTimeout(res, 5000));
    r = await checkOnce(tool.url);
    c = classify(tool, r);
  }
  console.log(`${c.level.padEnd(8)} ${tool.name} — ${c.reason}`);
  return { ...tool, ...c };
}

// Check a few at a time so no site gets hammered.
const results = [];
const queue = [...tools];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) results.push(await check(queue.shift()));
}));

const by = lvl => results.filter(r => r.level === lvl).sort((a, b) => a.name.localeCompare(b.name));
const dead = by("dead"), moved = by("moved"), blocked = by("blocked"), ok = by("ok");
const clean = s => s.replace(/\|/g, "\\|");
const table = rows => ["| Tool | URL | Result |", "|---|---|---|",
  ...rows.map(r => `| ${clean(r.name)} | ${r.url} | ${clean(r.reason)} |`)].join("\n");

const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";

let md = `Automated link check of **${tools.length} tools** on ${new Date().toISOString().slice(0, 10)}.\n\n`;
md += `**${dead.length} broken**, **${moved.length} moved**, ${blocked.length} couldn't be verified, ${ok.length} OK.\n\n`;
if (dead.length)    md += `## Broken\nThese didn't respond or returned an error, even after a retry. Check them in a browser, then fix or remove them.\n\n${table(dead)}\n\n`;
if (moved.length)   md += `## Moved\nThese now redirect to a different site or to a login page. The tool may have been renamed, sold, or put behind an account.\n\n${table(moved)}\n\n`;
if (blocked.length) md += `## Couldn't verify\nThese block automated checks (common with Cloudflare). They're probably fine, but worth an occasional manual look.\n\n<details><summary>Show ${blocked.length}</summary>\n\n${table(blocked)}\n\n</details>\n\n`;
md += `This issue is updated by the weekly link check and closes itself when everything passes.${runUrl ? ` [View this run](${runUrl}).` : ""}\n`;

writeFileSync("link-report.md", md);
writeFileSync("link-summary.env", `PROBLEMS=${dead.length + moved.length}\nDEAD=${dead.length}\nMOVED=${moved.length}\n`);
console.log(`\n${dead.length} broken, ${moved.length} moved, ${blocked.length} unverified, ${ok.length} ok`);
