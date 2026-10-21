// Turns a "Suggest a tool" issue into a tools.json entry.
//
//   node .github/scripts/suggestion.mjs check   Read the issue, write a review comment to comment.md
//   node .github/scripts/suggestion.mjs apply   Same checks, then add the tool to tools.json
//
// The issue text comes from the ISSUE_BODY environment variable (set by the
// suggestions workflow). It's treated as untrusted input: it's only ever parsed
// as data, and the result has to pass the same validator as a hand edit.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validate, slugify, normaliseUrl, OPSEC, LOOKUP_TYPES } from "./validate-tools.mjs";

const TOOLS_FILE = "tools.json";
const FORM_FILE = ".github/ISSUE_TEMPLATE/suggest-tool.yml";
export const MARKER = "<!-- spotlight-suggestion -->";

// Headings exactly as they appear in the issue form (suggest-tool.yml).
const H = {
  name: "Tool name",
  url: "Link",
  desc: "What does it do?",
  cats: "Categories",
  newCat: "New category",
  opsec: "OPSEC rating",
  opsecNote: "OPSEC note",
  lookups: "Lookup links",
  confirm: "Checks",
  notes: "Anything else?",
};
// The OPSEC dropdown's options start with these words.
const OPSEC_FROM_FORM = { "submissions public": "public", "contacts target": "active", "passive lookup": "passive", "reference": "reference" };

// ════════ tools.json formatting ════════
// Writes tools.json in the same hand-made layout it already uses, so a robot
// change shows up as a small, readable diff instead of a reformatted file.
const j = v => JSON.stringify(v);
const inline = arr => `[${arr.map(j).join(", ")}]`;

function formatLookup(spec) {
  if (typeof spec === "string") return j(spec);
  const parts = Object.entries(spec).map(([k, v]) => `${j(k)}: ${Array.isArray(v) ? inline(v) : j(v)}`);
  return `{ ${parts.join(", ")} }`;
}
function formatTool(t) {
  const lines = Object.entries(t).map(([k, v]) => {
    if (k === "lookups") {
      const inner = Object.entries(v).map(([type, spec]) => `        ${j(type)}: ${formatLookup(spec)}`);
      return `      "lookups": {\n${inner.join(",\n")}\n      }`;
    }
    return `      ${j(k)}: ${Array.isArray(v) ? inline(v) : j(v)}`;
  });
  return `    {\n${lines.join(",\n")}\n    }`;
}
export function formatToolsFile(d) {
  const out = ["{"];
  const blocks = [];
  if (d.$comment !== undefined) blocks.push(`  "$comment": ${j(d.$comment)}`);
  if (d.categories) {
    const w = Math.max(...d.categories.map(c => j(c.id).length + 1));
    blocks.push(`  "categories": [\n${d.categories.map(c => `    { "id": ${(j(c.id) + ",").padEnd(w)} "label": ${j(c.label)} }`).join(",\n")}\n  ]`);
  }
  if (d.extraTags) blocks.push(`  "extraTags": {\n${Object.entries(d.extraTags).map(([k, v]) => `    ${j(k)}: ${j(v)}`).join(",\n")}\n  }`);
  if (d.lookupOrder) {
    const w = Math.max(...Object.keys(d.lookupOrder).map(k => j(k).length + 1));
    blocks.push(`  "lookupOrder": {\n${Object.entries(d.lookupOrder).map(([k, v]) => `    ${(j(k) + ":").padEnd(w)} ${inline(v)}`).join(",\n")}\n  }`);
  }
  blocks.push(`  "tools": [\n${d.tools.map(formatTool).join(",\n")}\n  ]`);
  out.push(blocks.join(",\n"), "}");
  return out.join("\n") + "\n";
}

// ════════ Reading the issue ════════
export function parseIssue(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const headings = Object.values(H);
  const sections = {};
  let current = null;
  for (const line of text.split("\n")) {
    const m = /^###\s+(.+?)\s*$/.exec(line);
    if (m && headings.includes(m[1])) { current = m[1]; sections[current] = []; continue; }
    if (current) sections[current].push(line);
  }
  const get = h => {
    const v = (sections[h] || []).join("\n").trim();
    return v === "_No response_" ? "" : v;
  };
  return {
    isSuggestion: H.name in sections && H.url in sections,
    name: get(H.name).replace(/\s+/g, " "),
    url: get(H.url).replace(/^<|>$/g, "").trim(),
    desc: get(H.desc).replace(/\s+/g, " "),
    cats: get(H.cats),
    newCat: get(H.newCat).replace(/\s+/g, " "),
    opsec: get(H.opsec),
    opsecNote: get(H.opsecNote).replace(/\s+/g, " "),
    lookups: get(H.lookups),
    confirm: get(H.confirm),
    notes: get(H.notes),
  };
}

// Build a tools.json entry from the form. Returns the entry plus any problems
// that stop it being added (errors) and things worth a second look (warnings).
export function buildEntry(form, data, today = new Date().toISOString().slice(0, 10)) {
  const errors = [], warnings = [];
  const catByLabel = Object.fromEntries(data.categories.map(c => [c.label.toLowerCase(), c.id]));
  const catIds = new Set(data.categories.map(c => c.id));

  if (!form.name) errors.push("The **Tool name** is empty.");
  if (!form.url) errors.push("The **Link** is empty.");
  if (!form.desc) errors.push("**What does it do?** is empty.");

  // Categories: labels picked in the dropdown, plus an optional new one.
  const cats = [];
  for (const raw of form.cats.split(/,\s*/).map(s => s.trim()).filter(Boolean)) {
    const id = catByLabel[raw.toLowerCase()] || (catIds.has(raw.toLowerCase()) ? raw.toLowerCase() : null);
    if (id) { if (!cats.includes(id)) cats.push(id); }
    else errors.push(`The category "${raw}" doesn't exist any more. Pick from the list, or use **New category**.`);
  }
  let newCategory = null;
  if (form.newCat) {
    const label = form.newCat.trim();
    const id = slugify(label);
    if (!id) errors.push(`The new category "${label}" needs at least one letter or number.`);
    else if (/[,]/.test(label)) errors.push(`The new category "${label}" can't contain a comma.`);
    else if (label.length > 30) errors.push(`The new category "${label}" is too long for the sidebar. Keep it under 30 characters.`);
    else if (catIds.has(id) || catByLabel[label.toLowerCase()]) {
      const existing = catIds.has(id) ? id : catByLabel[label.toLowerCase()];
      const existingLabel = data.categories.find(c => c.id === existing).label;
      warnings.push(`**${existingLabel}** already exists as a category, so the tool goes there instead of creating a new one.`);
      if (!cats.includes(existing)) cats.push(existing);
    } else {
      newCategory = { id, label };
      cats.push(id);
    }
  }
  if (!cats.length) errors.push("Pick at least one **Category**, or fill in **New category**.");

  // OPSEC rating
  const opsecKey = Object.keys(OPSEC_FROM_FORM).find(k => form.opsec.toLowerCase().startsWith(k));
  const opsec = opsecKey ? OPSEC_FROM_FORM[opsecKey] : (OPSEC.includes(form.opsec.toLowerCase()) ? form.opsec.toLowerCase() : null);
  if (!opsec) errors.push("Pick an **OPSEC rating**.");

  // Lookup links, one per line as "type: https://...{value}".
  const lookups = {};
  for (const line of form.lookups.split("\n").map(l => l.trim()).filter(Boolean)) {
    if (/^```/.test(line)) continue;
    const m = /^[-*]?\s*([a-z]+)\s*[:=]\s*(\S+)$/i.exec(line);
    if (!m || !LOOKUP_TYPES.includes(m[1].toLowerCase())) {
      errors.push(`I couldn't read the lookup line \`${line.slice(0, 120)}\`. Each line should look like \`ip: https://example.com/ip/{value}\`, using one of: ${LOOKUP_TYPES.join(", ")}.`);
      continue;
    }
    const type = m[1].toLowerCase();
    if (lookups[type]) errors.push(`There are two **${type}** lookup lines. Keep one.`);
    lookups[type] = m[2];
  }

  const entry = {
    id: slugify(form.name) || "new-tool",
    name: form.name,
    url: form.url,
    desc: form.desc,
    cats,
    tags: [...cats],
    opsec: opsec || "reference",
    opsecNote: form.opsecNote,
  };
  if (Object.keys(lookups).length) entry.lookups = lookups;
  entry.added = today;

  // Make the id unique without changing the name.
  if (data.tools.some(t => t.id === entry.id)) {
    let n = 2;
    while (data.tools.some(t => t.id === `${entry.id}-${n}`)) n++;
    entry.id = `${entry.id}-${n}`;
  }

  // Already listed? Compare without http/https and www, so near-copies are caught too.
  const sameUrl = s => normaliseUrl(s.replace(/^http:\/\//i, "https://"));
  const dupe = form.url && data.tools.find(t => sameUrl(t.url) === sameUrl(form.url));
  if (dupe) errors.push(`This link is already listed as **${dupe.name}**.`);
  const dupeName = form.name && data.tools.find(t => t.name.toLowerCase() === form.name.toLowerCase());
  if (dupeName && dupeName !== dupe) errors.push(`There's already a tool called **${dupeName.name}** (${dupeName.url}). If this is a different tool, give it a more specific name.`);

  // Same website as a tool we already have? Often fine (e.g. two tools on one site), so just flag it.
  try {
    const host = new URL(entry.url).hostname.replace(/^www\./, "");
    const same = data.tools.filter(t => { try { return new URL(t.url).hostname.replace(/^www\./, "") === host; } catch { return false; } });
    if (same.length && !same.some(t => normaliseUrl(t.url) === normaliseUrl(entry.url)))
      warnings.push(`${host} is already listed as **${same.map(t => t.name).join("**, **")}**. Make sure this is a different tool, not the same one.`);
    for (const [type, tpl] of Object.entries(lookups)) {
      const lh = new URL(tpl.replace(/\{[a-z0-9]+\}/g, "x")).hostname.replace(/^www\./, "");
      if (lh !== host && !lh.endsWith("." + host) && !host.endsWith("." + lh))
        warnings.push(`The **${type}** lookup goes to ${lh}, a different site from the tool's link (${host}). Check it's the right address.`);
    }
  } catch {}
  if (Object.keys(lookups).length && opsec && opsec !== "passive" && opsec !== "reference")
    warnings.push(`This tool has lookup links but is rated **${opsec}**. Lookup buttons must only search existing data. Check that none of them make the service scan, visit or publish the indicator.`);
  if (!/\byes\b|\[x\]/i.test(form.confirm)) warnings.push("The **free to use** box wasn't ticked.");

  return { entry, newCategory, errors, warnings };
}

// Put the new tool after the last tool in its first category, so related tools stay together.
export function addToData(data, entry, newCategory) {
  const d = structuredClone(data);
  if (newCategory) d.categories.push(newCategory);
  let at = -1;
  d.tools.forEach((t, i) => { if (t.cats && t.cats[0] === entry.cats[0]) at = i; });
  if (at === -1) d.tools.push(entry); else d.tools.splice(at + 1, 0, entry);
  return d;
}

// Keep the form's category list in step with tools.json.
export function syncFormCategories(formText, categories) {
  const re = /(# CATEGORIES-START[^\n]*\n)([\s\S]*?)(\n[ \t]*# CATEGORIES-END)/;
  const m = re.exec(formText);
  if (!m) return formText;
  const indent = (/^([ \t]*)/.exec(m[2]) || ["", "        "])[1] || "        ";
  const lines = categories.map(c => `${indent}- ${JSON.stringify(c.label)}`).join("\n");
  return formText.replace(re, `$1${lines}$3`);
}

// ════════ Checking the link ════════
// Same rules as the weekly link check (check-links.mjs).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
export async function checkLink(url) {
  let res;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": UA, "Accept": "text/html,*/*;q=0.8" } });
    res.body?.cancel().catch(() => {});
  } catch (err) {
    const code = err.cause?.code || err.name || "error";
    return { level: "dead", text: `didn't respond (${code === "TimeoutError" ? "timed out" : code})` };
  }
  const host = u => new URL(u).hostname.replace(/^www\./, "");
  if ([401, 403, 429, 503].includes(res.status)) return { level: "blocked", text: `blocks automated checks (HTTP ${res.status}), so open it yourself to confirm it works` };
  if (res.status >= 400) return { level: "dead", text: `returned an error (HTTP ${res.status})` };
  if (res.url && host(res.url) !== host(url)) return { level: "moved", text: `redirects to a different site: ${res.url}` };
  if (res.url && /\/(login|log-in|signin|sign-in|signup|sign-up|auth|register)\b/i.test(new URL(res.url).pathname)) return { level: "moved", text: `redirects to a login or sign-up page: ${res.url}` };
  return { level: "ok", text: `works (HTTP ${res.status})` };
}

// ════════ The review comment ════════
const OPSEC_LABEL = { public: "🔴 Submissions public", active: "🟠 Contacts target", passive: "🟢 Passive lookup", reference: "⚪ Reference" };
function fence(s) { return "````json\n" + s + "\n````"; }
function cell(s) { return String(s).replace(/\|/g, "\\|").replace(/\n/g, " "); }

export function reviewComment({ entry, newCategory, errors, warnings, link, data, mode }) {
  const catLabel = id => (data.categories.find(c => c.id === id) || newCategory || {}).label || id;
  const ready = !errors.length;
  let md = `${MARKER}\n`;
  if (mode === "apply-failed") md += `## ✗ Couldn't add this tool yet\nI've removed the **approved** label. Fix the problems below by editing the issue, then add **approved** again.\n`;
  else md += ready ? `## ✓ Ready for review\n` : `## ✗ Needs a fix before it can be added\n`;
  if (errors.length) md += `\n**To fix** (edit the issue, and this check runs again):\n${errors.map(e => `- ${e}`).join("\n")}\n`;
  if (warnings.length) md += `\n**Worth a look:**\n${warnings.map(w => `- ${w}`).join("\n")}\n`;
  md += `\n| | |\n|---|---|\n`;
  md += `| **Name** | ${cell(entry.name || "–")} |\n`;
  md += `| **Link** | ${cell(entry.url || "–")}${link ? ` — ${cell(link.text)}` : ""} |\n`;
  md += `| **Categories** | ${cell(entry.cats.map(catLabel).join(", ") || "–")}${newCategory ? ` (new category: **${cell(newCategory.label)}**)` : ""} |\n`;
  md += `| **OPSEC** | ${OPSEC_LABEL[entry.opsec] || "–"}${entry.opsecNote ? ` — ${cell(entry.opsecNote)}` : ""} |\n`;
  md += `| **Lookups** | ${entry.lookups ? cell(Object.keys(entry.lookups).join(", ")) : "None"} |\n`;
  md += `\n<details><summary>The entry that will go into tools.json</summary>\n\n${fence(formatTool(entry).replace(/^ {4}/gm, ""))}\n\n</details>\n`;
  if (ready && mode === "check") md += `\n**To add it:** check the details above. If you'd change anything, such as the OPSEC rating, edit the issue and this comment updates. Then add the **approved** label, and a pull request will be opened for you to merge.\n`;
  return md;
}

// ════════ Run from the workflow ════════
async function main(mode) {
  const body = process.env.ISSUE_BODY || "";
  const form = parseIssue(body);
  const out = { suggestion: form.isSuggestion ? "yes" : "no", ready: "no" };
  const writeOutputs = () => {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
    else console.log(out);
  };
  if (!form.isSuggestion) { console.log("Not a tool suggestion. Nothing to do."); writeOutputs(); return; }

  const data = JSON.parse(readFileSync(TOOLS_FILE, "utf8"));
  const built = buildEntry(form, data);
  const updated = addToData(data, built.entry, built.newCategory);

  // The real test: does tools.json still pass the validator with this tool added?
  // Its messages talk about tools.json fields, so reword them to match the form.
  const v = validate(updated);
  const where = new RegExp(`^Tool #\\d+ "${built.entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"(?: lookup "(\\w+)")?: `);
  const toForm = (msg, lookupType) => {
    let m = msg
      .replace(/^url /, "the **Link** ").replace(/^name /, "the **Tool name** ")
      .replace(/^description /, "**What does it do?** ").replace(/\bopsecNote\b/g, "**OPSEC note**")
      .replace(/^is rated "(\w+)"/, (x, r) => `the tool is rated **${r}**`);
    if (lookupType) m = `The **${lookupType}** lookup link ${m}`;
    return m.charAt(0).toUpperCase() + m.slice(1);
  };
  const alreadyCovered = msg =>
    (/at least one category/.test(msg) && built.errors.some(e => /Category/.test(e))) ||
    (/the same as tool #/.test(msg) && built.errors.some(e => /already listed/.test(e))) ||
    (/already used by tool #/.test(msg) && built.errors.some(e => /already a tool called/.test(e))) ||
    (/^id /.test(msg));                          // ids are made automatically
  for (const e of v.errors) {
    const m = where.exec(e);
    if (!m) { built.errors.push(`tools.json has a problem unrelated to this suggestion, so nothing can be added until it's fixed: ${e}`); continue; }
    const msg = e.slice(m[0].length);
    if (!alreadyCovered(msg)) built.errors.push(toForm(msg, m[1]));
  }
  for (const w of v.warnings) { const m = where.exec(w); if (m) built.warnings.push(toForm(w.slice(m[0].length), m[1])); }
  built.errors = [...new Set(built.errors)];
  built.warnings = [...new Set(built.warnings)];

  let link = null;
  if (/^https:\/\//.test(built.entry.url)) {
    link = await checkLink(built.entry.url);
    if (link.level === "dead") built.errors.push(`The link ${link.text}. Check the address.`);
    if (link.level === "moved") built.warnings.push(`The link ${link.text}.`);
  }

  const ready = built.errors.length === 0;
  out.ready = ready ? "yes" : "no";
  out.id = built.entry.id;

  if (mode === "apply" && ready) {
    writeFileSync(TOOLS_FILE, formatToolsFile(updated));
    try { writeFileSync(FORM_FILE, syncFormCategories(readFileSync(FORM_FILE, "utf8"), updated.categories)); } catch {}
    writeFileSync("pr-title.txt", `Add ${built.entry.name}`);
    writeFileSync("pr-body.md",
      `Adds **${built.entry.name}** (${built.entry.url}) from the suggestion in #${process.env.ISSUE_NUMBER || "?"}.\n\n` +
      (built.newCategory ? `Also adds a new category: **${built.newCategory.label}**.\n\n` : "") +
      `${fence(formatTool(built.entry).replace(/^ {4}/gm, ""))}\n\n` +
      `The validator has passed. Merge this to publish the tool, usually live within a minute or two.\n\n` +
      `Closes #${process.env.ISSUE_NUMBER || "?"}\n`);
    console.log(`Added ${built.entry.name} as "${built.entry.id}".`);
  }
  writeFileSync("comment.md", reviewComment({ ...built, link, data, mode: mode === "apply" && !ready ? "apply-failed" : "check" }));
  console.log(readFileSync("comment.md", "utf8"));
  writeOutputs();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2];
  if (!["check", "apply"].includes(mode)) { console.error("Usage: node suggestion.mjs check|apply"); process.exit(2); }
  await main(mode);
}
