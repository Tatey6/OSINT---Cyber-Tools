// Keeps the numbers in README.md in step with tools.json.
//
//   node .github/scripts/update-readme.mjs
//
// Rewrites only the parts of README.md between these invisible markers:
//   <!-- TOOL-COUNT -->55<!-- /TOOL-COUNT -->
//   <!-- CATEGORY-TABLE --> ... <!-- /CATEGORY-TABLE -->
//   <!-- OPSEC-TABLE --> ... <!-- /OPSEC-TABLE -->
// Everything else in the README is left exactly as it is.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OPSEC_ROWS = [
  ["public",    "🔴 **Submissions public**", "Others can see what you submit"],
  ["active",    "🟠 **Contacts target**",    "The tool connects to the site or IP, so the target sees traffic"],
  ["passive",   "🟢 **Passive lookup**",     "Searches existing data only"],
  ["reference", "⚪ **Reference**",          "No indicator needed"],
];
const EXAMPLES = 4;

export function categoryTable(data) {
  const rows = data.categories.map(c => {
    const tools = data.tools.filter(t => t.cats.includes(c.id));
    // Examples: tools whose main (first) category is this one, then the rest.
    const ranked = [...tools.filter(t => t.cats[0] === c.id), ...tools.filter(t => t.cats[0] !== c.id)];
    const examples = ranked.slice(0, EXAMPLES).map(t => t.name).join(", ") || "–";
    return `| ${c.label} | ${tools.length} | ${examples} |`;
  });
  return ["| Category | Tools | Examples |", "|---|---|---|", ...rows].join("\n");
}
export function opsecTable(data) {
  const rows = OPSEC_ROWS.map(([id, label, meaning]) => `| ${label} | ${meaning} | ${data.tools.filter(t => t.opsec === id).length} |`);
  return ["| Rating | Meaning | Tools |", "|---|---|---|", ...rows].join("\n");
}

export function updateReadme(readme, data) {
  let out = readme, missing = [];
  const swap = (name, value, block) => {
    const re = new RegExp(`(<!-- ${name} -->)[\\s\\S]*?(<!-- /${name} -->)`);
    if (!re.test(out)) { missing.push(name); return; }
    out = out.replace(re, (m, a, b) => block ? `${a}\n${value}\n${b}` : `${a}${value}${b}`);
  };
  swap("TOOL-COUNT", String(data.tools.length), false);
  swap("CATEGORY-TABLE", categoryTable(data), true);
  swap("OPSEC-TABLE", opsecTable(data), true);
  return { readme: out, missing };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = JSON.parse(readFileSync("tools.json", "utf8"));
  const before = readFileSync("README.md", "utf8");
  const { readme, missing } = updateReadme(before, data);
  if (missing.length) console.warn(`README.md is missing these markers, so those parts weren't updated: ${missing.join(", ")}`);
  if (readme === before) console.log("README.md is already up to date.");
  else { writeFileSync("README.md", readme); console.log(`README.md updated: ${data.tools.length} tools.`); }
}
