// Weekly tool finder for SpotLight.
//
// For each list in .github/discovery-sources.json, compares the file now with
// how it looked DAYS days ago (using the list's own git history, so nothing
// needs storing between runs), and collects links that were added. It drops
// links SpotLight already has or that were already suggested, ranks the rest
// by how cyber-relevant they look, and writes discovery.md for a GitHub issue.
//
// It never changes tools.json. Every tool still goes through the suggestion
// form and its checks, which the issue links to with the details pre-filled.
//
//   DAYS=7 GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node .github/scripts/discover-tools.mjs
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://api.github.com";
const MAX_SHOWN = 25;          // rows in "Most likely useful"
const MIN_SCORE = 4;           // how cyber-relevant a link must look to make that list
const MAX_BODY = 60000;        // GitHub's issue limit is 65,536 characters

// ════════ Reading a list ════════
const SKIP_HOSTS = [
  "github.com", "gitlab.com", "bitbucket.org", "githubusercontent.com", "github.io", "gist.github.com",
  "youtube.com", "youtu.be", "twitter.com", "x.com", "t.me", "telegram.me", "facebook.com", "instagram.com",
  "linkedin.com", "reddit.com", "medium.com", "substack.com", "discord.gg", "discord.com",
  "wikipedia.org", "archive.org", "web.archive.org", "google.com", "docs.google.com", "goo.gl", "bit.ly",
  "chrome.google.com", "chromewebstore.google.com", "addons.mozilla.org", "microsoftedge.microsoft.com",
  "apps.apple.com", "play.google.com", "pypi.org", "npmjs.com", "hub.docker.com", "shields.io", "img.shields.io",
  "creativecommons.org", "awesome.re",
];
export const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const skippedHost = h => SKIP_HOSTS.some(s => h === s || h.endsWith("." + s));
export const normUrl = u => { try { const p = new URL(u); return (hostOf(u) + p.pathname.replace(/\/+$/, "") + p.search).toLowerCase(); } catch { return u.toLowerCase(); } };

const stripMd = s => s
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")              // images
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")           // links → text
  .replace(/<[^>]+>/g, "")                           // html tags
  .replace(/[*_`~]/g, "")
  .replace(/^\s*[-*+|>]\s*/, "").replace(/\s*\|\s*$/, "")
  .replace(/\s*\|\s*/g, " — ")
  .replace(/^[\s:–—-]+/, "").replace(/\s+/g, " ").trim();

// Every list item or table row whose first link is a website, with its description and section.
export function parseLinks(md) {
  const out = [];
  let section = "";
  for (const raw of String(md).split("\n")) {
    const line = raw.trim();
    const h = /^#{1,6}\s+(.+)$/.exec(line);
    if (h) { section = stripMd(h[1]); continue; }
    if (!/^([-*+]|\||\d+\.)\s*/.test(line)) continue;           // list items and table rows only
    const m = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(line);
    if (!m) continue;
    const url = m[2].replace(/[.,;]+$/, "");
    const host = hostOf(url);
    if (!host || skippedHost(host)) continue;
    const name = stripMd(m[1]).slice(0, 80);
    const desc = stripMd(line.slice(m.index + m[0].length)).slice(0, 300);
    out.push({ name, url, host, desc, section });
  }
  return out;
}

// Links in the new version whose address wasn't anywhere in the old version.
export function newLinks(oldMd, newMd) {
  const seen = new Set(parseLinks(oldMd).map(l => normUrl(l.url)));
  const oldText = String(oldMd).toLowerCase();
  const out = [], dup = new Set();
  for (const l of parseLinks(newMd)) {
    const k = normUrl(l.url);
    if (seen.has(k) || dup.has(k) || oldText.includes(k)) continue;   // also skip links that just moved
    dup.add(k);
    out.push(l);
  }
  return out;
}

// ════════ Ranking ════════
// Whole words only, so "c2" doesn't match "C2PA" and "hash" doesn't match "hashtag".
const W = s => new RegExp(`\\b(?:${s})\\b`, "i");
const CYBER = [
  [W("ip|ipv4|ipv6|asn|bgp|rdap|looking glass|subnets?"), 3],
  [W("dns|whois|domains?|subdomains?|certificates?|ssl|tls|certificate transparency"), 3],
  [W("malware|ransomware|sandbox(es)?|yara|sigma|iocs?|indicators? of compromise|hash(es)?|sha-?256|sha-?1|md5|phishing|botnets?|c2|infostealers?|stealers?"), 4],
  [W("cves?|vulnerabilit(y|ies)|exploits?|pocs?|advisor(y|ies)|kev"), 4],
  [W("threats?|threat intel(ligence)?|cti|reputation|blocklists?|blacklists?|abuse"), 3],
  [W("breach(es)?|leak(s|ed)?|credentials?|dark ?web|darknet|onion|tor"), 2],
  [W("scan(s|ner|ning)?|port scan(ner)?|exposed|attack surface"), 2],
  [W("forensics?|incident response|dfir|soc|siem"), 2],
  [W("dmarc|spf|dkim|email headers?|urls?"), 1],
];
const GOOD = [[W("free"), 1], [/no[- ](login|account|registration|sign[- ]?up|api key)/i, 1], [W("lookups?|look up|checker|analy[sz]e[rs]?"), 1]];
const BAD = [
  [W("paid|pricing|subscription|enterprise|premium|trial|commercial"), -2],
  [W("twitter|tiktok|instagram|youtube|facebook|telegram|whatsapp|reddit|shadowban(ned)?|social media|people search|usernames?|dating|onlyfans"), -3],
  [W("audio|voice|music|video|deepfakes?|photos?|images?|exif|fonts?"), -3],
  [W("compan(y|ies)|corporate|directors?|flights?|vessels?|ships?|elections?|candidates?|politics"), -3],
  [W("cli|command[- ]line|python|library|framework|install"), -1],
];

export function score(l) {
  const text = `${l.name} ${l.desc}`;
  let s = 0; const why = [];
  for (const [re, w] of CYBER) { const m = re.exec(text); if (m) { s += w; why.push(m[0].toLowerCase()); } }
  if (CYBER.some(([re]) => re.test(l.section || ""))) s += 1;    // a cyber-sounding section helps a little
  for (const [re, w] of [...GOOD, ...BAD]) if (re.test(text)) s += w;
  return { score: s, why: [...new Set(why)].slice(0, 4) };
}

// ════════ The issue ════════
const cell = s => String(s || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
export function suggestLink(repo, l) {
  const p = new URLSearchParams({ template: "suggest-tool.yml", title: `Suggest: ${l.name}`, name: l.name, url: l.url, desc: l.desc });
  return `https://github.com/${repo}/issues/new?${p.toString()}`;
}
export function renderIssue({ repo, days, items, others, sources, stats, failures, hidden = 0 }) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  let md = `New links added since ${since} to the lists SpotLight watches, minus anything already listed or already suggested.\n\n`;
  const n = items.length + others.length + hidden;
  md += `**${n} new link${n === 1 ? "" : "s"}** found: ${items.length} look cyber-related${n - items.length ? `, ${n - items.length} probably don't` : ""}.\n\n`;
  md += `**How to use this:** open any that look useful. For one worth adding, click **Suggest it**. The form opens with the name, link and description filled in, so you only pick the category and OPSEC rating. It then goes through the usual checks. When you're done, close this issue. Next week's list replaces it anyway.\n\n`;
  if (items.length) {
    md += `## Most likely useful\n\n| Tool | What it says it does | Found in | |\n|---|---|---|---|\n`;
    for (const l of items) md += `| **[${cell(l.name)}](${l.url})**<br>\`${l.host}\` | ${cell(l.desc.length > 200 ? l.desc.slice(0, 197) + "…" : l.desc) || "–"} | ${cell(l.source)}${l.section ? `<br><sub>${cell(l.section)}</sub>` : ""} | [Suggest it](${suggestLink(repo, l)}) |\n`;
    md += "\n";
  }
  if (others.length) {
    md += `<details><summary>${others.length} other new link${others.length === 1 ? "" : "s"} (less likely to be cyber tools)</summary>\n\n| Tool | Description | Found in | |\n|---|---|---|---|\n`;
    for (const l of others) md += `| [${cell(l.name)}](${l.url}) | ${cell(l.desc.length > 140 ? l.desc.slice(0, 137) + "…" : l.desc) || "–"} | ${cell(l.source)} | [Suggest it](${suggestLink(repo, l)}) |\n`;
    md += `\n</details>\n\n`;
  }
  if (hidden) md += `<sub>${hidden} more link${hidden === 1 ? "" : "s"} not shown to keep this issue under GitHub's size limit. They're in the run summary on the Actions tab.</sub>\n\n`;
  md += `---\n<sub>Watched: ${sources.map(s => `[${s.repo}](https://github.com/${s.repo})${stats[s.repo] !== undefined ? ` (${stats[s.repo]} new)` : ""}`).join(", ")}. `;
  md += `Edit \`.github/discovery-sources.json\` to change the lists.${failures.length ? ` Couldn't read: ${failures.join(", ")}.` : ""}</sub>\n`;
  return md;
}
// Drop the least relevant rows until the issue fits GitHub's size limit.
export function fitIssue(args) {
  const items = [...args.items], others = [...args.others];
  let hidden = 0, md = renderIssue({ ...args, items, others, hidden });
  while (md.length > MAX_BODY && (others.length || items.length)) {
    (others.length ? others : items).pop();
    hidden++;
    md = renderIssue({ ...args, items, others, hidden });
  }
  return md;
}

// ════════ GitHub ════════
async function gh(path, { raw = false } = {}) {
  const res = await fetch(API + path, { headers: {
    "Accept": raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "User-Agent": "spotlight-tool-finder",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  } });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return raw ? res.text() : res.json();
}
async function fileAt(repo, file, sha) { return gh(`/repos/${repo}/contents/${encodeURIComponent(file).replace(/%2F/g, "/")}${sha ? `?ref=${sha}` : ""}`, { raw: true }); }
async function shaBefore(repo, file, isoDate) {
  const commits = await gh(`/repos/${repo}/commits?path=${encodeURIComponent(file)}&until=${encodeURIComponent(isoDate)}&per_page=1`);
  return commits[0] ? commits[0].sha : null;
}
async function alreadySuggested(repo) {
  const hosts = new Set(), urls = new Set();
  for (let page = 1; page <= 10; page++) {
    const list = await gh(`/repos/${repo}/issues?labels=suggestion&state=all&per_page=100&page=${page}`);
    for (const i of list) for (const m of String(i.body || "").matchAll(/https?:\/\/[^\s)<>"'`]+/g)) { urls.add(normUrl(m[0])); hosts.add(hostOf(m[0])); }
    if (list.length < 100) break;
  }
  return { hosts, urls };
}

// ════════ Run ════════
async function main() {
  const days = Math.max(1, Math.min(90, parseInt(process.env.DAYS || "7", 10) || 7));
  const repo = process.env.GITHUB_REPOSITORY || "Tatey6/OSINT---Cyber-Tools";
  const { sources } = JSON.parse(readFileSync(".github/discovery-sources.json", "utf8"));
  const tools = JSON.parse(readFileSync("tools.json", "utf8")).tools;
  const knownHosts = new Set(tools.map(t => hostOf(t.url)));
  const sinceIso = new Date(Date.now() - days * 864e5).toISOString();

  let suggested = { hosts: new Set(), urls: new Set() };
  try { suggested = await alreadySuggested(repo); } catch (e) { console.warn(`Couldn't read past suggestions: ${e.message}`); }

  const found = new Map(), stats = {}, failures = [];
  for (const s of sources) {
    try {
      const old = await shaBefore(s.repo, s.file, sinceIso);
      if (!old) { stats[s.repo] = 0; console.log(`${s.repo}: no history before ${sinceIso.slice(0, 10)}, skipped`); continue; }
      const [oldMd, newMd] = await Promise.all([fileAt(s.repo, s.file, old), fileAt(s.repo, s.file)]);
      const fresh = newLinks(oldMd, newMd);
      let kept = 0;
      for (const l of fresh) {
        const k = normUrl(l.url);
        if (knownHosts.has(l.host) || suggested.urls.has(k) || suggested.hosts.has(l.host) || found.has(k)) continue;
        found.set(k, { ...l, source: s.repo.split("/")[1], ...score(l) });
        kept++;
      }
      stats[s.repo] = kept;
      console.log(`${s.repo}: ${fresh.length} added, ${kept} new to SpotLight`);
    } catch (e) {
      failures.push(s.repo);
      console.warn(`${s.repo}: ${e.message}`);
    }
  }

  const all = [...found.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const items = all.filter(l => l.score >= MIN_SCORE).slice(0, MAX_SHOWN);
  const others = all.filter(l => !items.includes(l));
  const total = all.length;
  const title = `Possible new tools: ${items.length} likely, ${others.length} other (${new Date().toISOString().slice(0, 10)})`;
  writeFileSync("discovery.md", fitIssue({ repo, days, items, others, sources, stats, failures }));
  writeFileSync("discovery-title.txt", title);
  const env = `FOUND=${total}\nLIKELY=${items.length}\nFAILED=${failures.length}\n`;
  writeFileSync("discovery.env", env);
  // The run summary gets everything, untrimmed (its limit is much larger than an issue's).
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${title}\n\n${total ? renderIssue({ repo, days, items, others, sources, stats, failures }) : "Nothing new this week."}\n`);
  console.log(`\n${title}`);
  if (failures.length === sources.length) process.exit(1);   // every list failed: show a red ✗
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
