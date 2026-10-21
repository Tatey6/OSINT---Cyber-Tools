// Checks tools.json for mistakes before they reach the live site.
//
//   node .github/scripts/validate-tools.mjs            check tools.json
//   node .github/scripts/validate-tools.mjs other.json check another file
//
// Exits with an error and a plain-English list of problems if anything is wrong.
// No dependencies. Other scripts can import { validate } to reuse the same rules.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const OPSEC = ["public", "active", "passive", "reference"];
export const LOOKUP_TYPES = ["ip", "domain", "url", "hash", "email", "cve"];
export const HASH_TYPES = ["md5", "sha1", "sha256"];
const PLACEHOLDERS = ["value", "enc", "enc2", "hashtype", "cveyear", "cvenum"];
const TOP_FIELDS = ["$comment", "categories", "extraTags", "lookupOrder", "tools"];
const TOOL_FIELDS = ["id", "name", "url", "desc", "cats", "tags", "opsec", "opsecNote", "lookups", "lookupLabel", "added"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, " ").trim().replace(/[\s_-]+/g, "-").replace(/^-|-$/g, "");
}
// Treat https://www.x.com/ and https://x.com as the same tool.
export function normaliseUrl(u) {
  try {
    const p = new URL(u);
    return (p.hostname.replace(/^www\./, "") + p.pathname.replace(/\/+$/, "") + p.search).toLowerCase();
  } catch { return String(u).toLowerCase(); }
}

export function validate(data) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { errors: ["The file must contain a single { ... } object."], warnings };
  }
  for (const k of Object.keys(data)) if (!TOP_FIELDS.includes(k)) err("Top level", `unknown field "${k}". Allowed: ${TOP_FIELDS.join(", ")}.`);

  // ── Categories ──
  const catIds = new Set();
  if (!Array.isArray(data.categories) || !data.categories.length) {
    err("categories", "must be a list with at least one category.");
  } else {
    data.categories.forEach((c, i) => {
      const where = `Category #${i + 1}${c && c.label ? ` "${c.label}"` : ""}`;
      if (!c || typeof c !== "object") return err(where, "must be { \"id\": \"...\", \"label\": \"...\" }.");
      if (typeof c.id !== "string" || !SLUG.test(c.id)) err(where, `id "${c.id}" must be lowercase letters, numbers and dashes only (e.g. "cloud" or "red-team").`);
      if (typeof c.label !== "string" || !c.label.trim()) err(where, "needs a label, the text shown on the button.");
      if (catIds.has(c.id)) err(where, `id "${c.id}" is used twice.`);
      catIds.add(c.id);
    });
  }
  const extraTags = data.extraTags && typeof data.extraTags === "object" ? data.extraTags : {};
  if (data.extraTags !== undefined && (typeof data.extraTags !== "object" || Array.isArray(data.extraTags))) err("extraTags", "must be an object like { \"sandbox\": \"Sandbox\" }.");
  for (const k of Object.keys(extraTags)) if (!SLUG.test(k)) err("extraTags", `"${k}" must be lowercase letters, numbers and dashes only.`);
  const tagIds = new Set([...catIds, ...Object.keys(extraTags)]);

  // Suggest the right id when someone types a label, or the wrong case.
  const suggest = (bad, pool, labels = {}) => {
    const low = String(bad).toLowerCase().trim();
    for (const id of pool) if (id === low || (labels[id] || "").toLowerCase() === low || (labels[id] || "").toLowerCase().split(/\s*\/\s*/).includes(low)) return ` Did you mean "${id}"?`;
    return "";
  };
  const catLabels = Object.fromEntries((data.categories || []).filter(c => c && c.id).map(c => [c.id, c.label]));
  const tagLabels = { ...catLabels, ...extraTags };

  // ── Tools ──
  if (!Array.isArray(data.tools) || !data.tools.length) {
    err("tools", "must be a list with at least one tool.");
    return { errors, warnings };
  }
  const ids = new Map(), names = new Map(), urls = new Map();
  data.tools.forEach((t, i) => {
    const where = `Tool #${i + 1}${t && t.name ? ` "${t.name}"` : ""}`;
    if (!t || typeof t !== "object" || Array.isArray(t)) return err(where, "must be a { ... } object.");

    for (const k of Object.keys(t)) if (!TOOL_FIELDS.includes(k)) {
      const near = TOOL_FIELDS.find(f => f.toLowerCase() === k.toLowerCase());
      err(where, `unknown field "${k}".${near ? ` Did you mean "${near}"?` : ` Allowed: ${TOOL_FIELDS.join(", ")}.`}`);
    }

    // id
    if (typeof t.id !== "string" || !SLUG.test(t.id)) err(where, `id "${t.id ?? ""}" must be lowercase letters, numbers and dashes only.${t.name ? ` Try "${slugify(t.name)}".` : ""}`);
    else if (ids.has(t.id)) err(where, `id "${t.id}" is already used by tool #${ids.get(t.id)}. Every id must be unique.`);
    else ids.set(t.id, i + 1);

    // name
    if (typeof t.name !== "string" || !t.name.trim()) err(where, "needs a name.");
    else {
      const key = t.name.trim().toLowerCase();
      if (names.has(key)) err(where, `name is already used by tool #${names.get(key)}.`);
      else names.set(key, i + 1);
      if (t.name !== t.name.trim()) err(where, "name has spaces at the start or end.");
    }

    // url
    let parsed = null;
    try { parsed = new URL(t.url); } catch {}
    if (!parsed) err(where, `url "${t.url ?? ""}" isn't a valid web address.`);
    else if (parsed.protocol !== "https:") err(where, `url must start with https:// (got "${t.url}").`);
    else {
      const key = normaliseUrl(t.url);
      if (urls.has(key)) err(where, `url is the same as tool #${urls.get(key)}. Is this a duplicate?`);
      else urls.set(key, i + 1);
    }

    // description
    if (typeof t.desc !== "string" || !t.desc.trim()) err(where, "needs a description (desc).");
    else if (t.desc.trim().length < 20) warn(where, "description is very short. One clear sentence on what the tool does helps people choose.");
    else if (t.desc.length > 320) warn(where, `description is ${t.desc.length} characters. Keep it under about 300 so cards stay tidy.`);

    // categories and tags
    if (!Array.isArray(t.cats) || !t.cats.length) err(where, `needs at least one category in cats. Options: ${[...catIds].join(", ")}.`);
    else {
      t.cats.forEach(c => { if (!catIds.has(c)) err(where, `cats contains "${c}", which isn't a category.${suggest(c, catIds, catLabels)} Categories are lowercase and must match an id in the categories list.`); });
      if (new Set(t.cats).size !== t.cats.length) err(where, "cats lists the same category twice.");
    }
    if (!Array.isArray(t.tags)) err(where, "tags must be a list, e.g. [\"scan\", \"malware\"].");
    else {
      t.tags.forEach(g => { if (!tagIds.has(g)) err(where, `tags contains "${g}", which isn't a known tag.${suggest(g, tagIds, tagLabels)} Tags are lowercase and must be a category id or listed in extraTags.`); });
      if (new Set(t.tags).size !== t.tags.length) err(where, "tags lists the same tag twice.");
      if (Array.isArray(t.cats)) t.tags.forEach(g => {
        if (catIds.has(g) && !t.cats.includes(g)) warn(where, `has the tag "${g}" but isn't in the "${g}" category, so searches for it will find this tool but the ${catLabels[g] || g} filter won't. Add "${g}" to cats, or remove the tag.`);
      });
    }

    // OPSEC
    if (!OPSEC.includes(t.opsec)) err(where, `opsec "${t.opsec ?? ""}" must be one of: ${OPSEC.join(", ")}.${suggest(t.opsec, OPSEC)}`);
    if (t.opsecNote !== undefined && typeof t.opsecNote !== "string") err(where, "opsecNote must be text (use \"\" for none).");
    if ((t.opsec === "public" || t.opsec === "active") && !(t.opsecNote || "").trim()) warn(where, `is rated "${t.opsec}" but has no opsecNote. Say what becomes public or what gets contacted.`);

    // lookups
    if (t.lookupLabel !== undefined && (typeof t.lookupLabel !== "string" || !t.lookupLabel.trim())) err(where, "lookupLabel must be text.");
    if (t.added !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(t.added)) err(where, `added must be a date like "2026-10-21".`);
    if (t.lookups !== undefined) {
      if (!t.lookups || typeof t.lookups !== "object" || Array.isArray(t.lookups)) err(where, "lookups must be an object like { \"ip\": \"https://...{value}\" }.");
      else for (const [type, spec] of Object.entries(t.lookups)) {
        const lw = `${where} lookup "${type}"`;
        if (!LOOKUP_TYPES.includes(type)) { err(lw, `isn't a lookup type. Use one of: ${LOOKUP_TYPES.join(", ")}.`); continue; }
        const s = typeof spec === "string" ? { url: spec } : spec;
        if (!s || typeof s !== "object" || typeof s.url !== "string") { err(lw, "must be a URL template, or { \"url\": \"...\" }."); continue; }
        for (const k of Object.keys(s)) if (!["url", "label", "only"].includes(k)) err(lw, `unknown option "${k}". Allowed: url, label, only.`);
        if (!/^https:\/\//.test(s.url)) err(lw, "URL must start with https://.");
        const used = [...s.url.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
        used.forEach(p => { if (!PLACEHOLDERS.includes(p)) err(lw, `uses {${p}}. Allowed placeholders: ${PLACEHOLDERS.map(x => `{${x}}`).join(", ")}.`); });
        if (!used.length && !s.label) warn(lw, "has no placeholder like {value}, so it opens the same page whatever is looked up. Add a label explaining what to do (e.g. \"paste it in\").");
        if (s.only !== undefined && (!Array.isArray(s.only) || !s.only.every(h => HASH_TYPES.includes(h)) || type !== "hash")) err(lw, `"only" is for hash lookups and must list some of: ${HASH_TYPES.join(", ")}.`);
        if (s.label !== undefined && typeof s.label !== "string") err(lw, "label must be text.");
      }
    }
  });

  // ── Lookup order ──
  if (data.lookupOrder !== undefined) {
    if (!data.lookupOrder || typeof data.lookupOrder !== "object" || Array.isArray(data.lookupOrder)) err("lookupOrder", "must be an object like { \"ip\": [\"virustotal\", ...] }.");
    else for (const [type, list] of Object.entries(data.lookupOrder)) {
      if (!LOOKUP_TYPES.includes(type)) { err("lookupOrder", `"${type}" isn't a lookup type.`); continue; }
      if (!Array.isArray(list)) { err(`lookupOrder.${type}`, "must be a list of tool ids."); continue; }
      list.forEach(id => {
        const tool = data.tools.find(t => t && t.id === id);
        if (!tool) err(`lookupOrder.${type}`, `"${id}" isn't the id of any tool.`);
        else if (!tool.lookups || !tool.lookups[type]) warn(`lookupOrder.${type}`, `"${id}" has no ${type} lookup, so listing it here does nothing.`);
      });
    }
  }

  // Categories nobody uses show as empty buttons.
  for (const id of catIds) if (!data.tools.some(t => t && Array.isArray(t.cats) && t.cats.includes(id))) warn(`Category "${id}"`, "has no tools yet, so its button will show 0.");

  return { errors, warnings };
}

// Turn a JSON syntax error into "line X, column Y" so it's easy to find.
export function parseWithLocation(text) {
  try { return { data: JSON.parse(text) }; }
  catch (e) {
    const m = /position (\d+)/.exec(e.message);
    let where = "";
    if (m) {
      const pos = +m[1];
      const before = text.slice(0, pos);
      const line = before.split("\n").length;
      const col = pos - before.lastIndexOf("\n");
      where = ` at line ${line}, column ${col}`;
    } else {
      const lc = /line (\d+) column (\d+)/.exec(e.message);
      if (lc) where = ` at line ${lc[1]}, column ${lc[2]}`;
    }
    return { error: `tools.json isn't valid JSON${where}. Common causes: a missing comma between entries, a comma after the last entry in a list, or a missing quote. (${e.message})` };
  }
}

// ── Run from the command line ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2] || "tools.json";
  let text;
  try { text = readFileSync(file, "utf8"); }
  catch { console.error(`Can't read ${file}.`); process.exit(1); }
  const { data, error } = parseWithLocation(text);
  if (error) { console.error(`✗ ${error}`); process.exit(1); }

  const { errors, warnings } = validate(data);
  const summary = [];
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning${warnings.length > 1 ? "s" : ""} (won't block anything):`);
    warnings.forEach(w => console.log(`  • ${w}`));
    summary.push(`### ⚠ ${warnings.length} warning(s)\n${warnings.map(w => `- ${w}`).join("\n")}`);
  }
  if (errors.length) {
    console.error(`\n✗ ${errors.length} problem${errors.length > 1 ? "s" : ""} in ${file}:`);
    errors.forEach(e => console.error(`  • ${e}`));
    summary.unshift(`### ✗ ${errors.length} problem(s) to fix\n${errors.map(e => `- ${e}`).join("\n")}`);
  } else {
    const n = data.tools.length, c = data.categories.length;
    console.log(`\n✓ ${file} is valid: ${n} tools in ${c} categories.`);
    summary.unshift(`### ✓ tools.json is valid\n${n} tools in ${c} categories.`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { (await import("node:fs")).appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n\n") + "\n"); } catch {}
  }
  process.exit(errors.length ? 1 : 0);
}
