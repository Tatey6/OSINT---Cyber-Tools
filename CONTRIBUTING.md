# Adding or editing tools

Every tool on the site comes from one file: **`tools.json`**. Edit it on GitHub (open the file, click the pencil), commit, and the site updates about a minute later.

A check runs automatically on every change. If you see a red ✗ next to your commit, open it to see a plain-English list of what to fix. The live site skips any broken entry rather than going blank, but fix it promptly so the tool shows up.

## A tool entry

Copy an existing entry, paste it after another one (mind the commas), and change the values.

```json
{
  "id": "example-tool",
  "name": "Example Tool",
  "url": "https://example.com",
  "desc": "One sentence on what the tool does and when to use it.",
  "cats": ["intel", "network"],
  "tags": ["intel", "network"],
  "opsec": "passive",
  "opsecNote": "Anything specific to watch for, or \"\" if nothing.",
  "lookups": {
    "ip": "https://example.com/ip/{value}"
  }
}
```

| Field | What it is | Rules |
|---|---|---|
| `id` | A permanent name used to store people's favourites and notes | Lowercase letters, numbers and dashes. **Never change it once published**, or people lose their notes for that tool. |
| `name` | The name shown on the card | Can be changed any time. |
| `url` | The tool's home page | Must start with `https://`. |
| `desc` | One sentence for the card | Under about 300 characters. |
| `cats` | Which sidebar categories it appears under | At least one. Must match a category `id` exactly, all lowercase. |
| `tags` | The small labels on the card, also searchable | Category ids, or ids from `extraTags` (such as `sandbox`). If a tag is a category id, put it in `cats` too. |
| `opsec` | The OPSEC rating | `public`, `active`, `passive` or `reference` (see below). |
| `opsecNote` | One sentence of OPSEC detail | Required in practice for `public` and `active`. Use `""` for none. |
| `lookups` | *Optional.* Adds the tool to the indicator lookup | See below. |
| `lookupLabel` | *Optional.* A shorter name for the lookup button | e.g. `"Cisco Talos"` instead of the full name. |
| `added` | *Optional.* Date added, as `"2026-10-21"` | Filled in automatically by the suggestion pipeline. |

### OPSEC ratings

| Rating | Use when |
|---|---|
| `public` | Others can see what you submit (public scans, uploaded samples). |
| `active` | The tool connects to the target site or IP, so the target sees traffic. |
| `passive` | It only searches data the tool already holds. |
| `reference` | No indicator is entered: documentation, databases, roadmaps. |

When unsure, pick the more cautious rating.

### Lookups

Lookup types are `ip`, `domain`, `url`, `hash`, `email` and `cve`. Each one is a URL with a placeholder where the indicator goes:

| Placeholder | Becomes |
|---|---|
| `{value}` | The indicator as-is, e.g. `8.8.8.8` |
| `{enc}` | The indicator made safe for a URL. Use this for URLs, emails and anything after `?` or `#`. |
| `{enc2}` | Encoded twice (only VirusTotal's URL search needs this) |
| `{hashtype}` | `md5`, `sha1` or `sha256` |
| `{cveyear}` / `{cvenum}` | For `CVE-2024-3400`: `2024` / `2024-3400` |

To limit a hash lookup to one hash type, or give the button its own label:

```json
"hash": { "url": "https://example.com/file?s={value}", "only": ["sha256"] },
"email": { "url": "https://example.com/", "label": "Example (paste it in)" }
```

**Only add passive lookups.** A lookup link must search data the tool already has. Never add a link that makes a service scan, visit or publish the indicator.

Lookup buttons appear in the order listed in `lookupOrder` at the top of the file. Tools not listed there appear after, in file order.

## Adding a category

Add it to the `categories` list at the top of `tools.json`:

```json
{ "id": "cloud", "label": "Cloud" }
```

The sidebar button appears automatically. Then add `"cloud"` to the `cats` of the tools that belong in it.

## Checking your changes before committing

If you have Node.js installed, run this in the repo folder:

```
node .github/scripts/validate-tools.mjs
```

To preview the site on your own computer, run `python3 -m http.server` in the repo folder and open `http://localhost:8000`. Opening `index.html` by double-clicking it won't load the tools, because browsers block pages opened from disk from reading other files.
