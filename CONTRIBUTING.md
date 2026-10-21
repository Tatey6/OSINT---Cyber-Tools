# Adding or editing tools

## The easy way: the suggestion form

1. Open the **[Suggest a tool](https://github.com/Tatey6/OSINT---Cyber-Tools/issues/new?template=suggest-tool.yml)** form (also linked in the site's footer) and fill it in.
2. Within a minute, a comment appears on the issue with a preview of the tool card, the result of a link check, and anything that needs fixing. To fix something, edit the issue (**⋯ → Edit** on the first post) and the comment updates.
3. **Reviewer:** when the preview looks right, add the **approved** label. A pull request is opened that adds the tool to `tools.json`.
4. **Reviewer:** open the pull request and click **Merge pull request**. The tool is live a minute or two later, and the issue closes itself.

**To change a suggestion after approving it,** edit the issue, then remove the **approved** label and add it again. The pull request updates to match.

**To turn a suggestion down,** close the issue with a short comment explaining why.

Things the check catches: a missing category, a dead link, a tool that's already listed (even with a different `www` or `http`), an `http://` link, a badly written lookup line, and a missing OPSEC note on a risky tool. It also flags things worth a human look, such as a link that redirects somewhere else or a site that already has a tool listed.

The robot only adds what's in the form, and only after the **approved** label is added. Only people with write access to the repo can add labels.

## Finding new tools

Every Monday morning (9am Perth), the **Find new tools** robot checks the lists named in `.github/discovery-sources.json` for links added in the past week. It skips GitHub projects, social media and app stores, and anything already in `tools.json` or already suggested. Then it opens one **Possible new tools** issue:

- **Most likely useful:** up to 25 links whose descriptions mention cyber topics such as IPs, domains, malware, CVEs, phishing or breaches.
- **Other new links:** everything else, collapsed. Mostly general OSINT (people search, social media, maps).

For anything worth adding, click **Suggest it**. The suggestion form opens with the name, link and description filled in. Pick the category and OPSEC rating, check the description reads well, and submit. From there it's the normal suggestion process above.

Last week's issue closes when the new one opens. If nothing new turned up, no issue is opened.

**To run it now,** go to **Actions → Find new tools → Run workflow**. You can set how many days back to look (up to 90).

**To change which lists are watched,** edit `.github/discovery-sources.json`. Each line names a GitHub repository and the file in it that holds the list. A list that can't be read is named at the bottom of the issue.

The robot only reads public lists and writes an issue. It never changes `tools.json`.

## Looking after the site

These robots open an issue or pull request when something needs you. Otherwise they stay quiet.

**Link check issue (Mondays).** A tool's home page is broken or has moved. Open the link to confirm. If the tool has moved, update its `url` in `tools.json`. If it's gone for good, remove the tool. The issue closes itself on the next run once everything passes. "Couldn't verify" entries are sites that block robots and can usually be ignored.

**Lookup check issue (1st of the month).** A lookup button's search address has broken or changed. Each row has a sample link: click it and see whether the results page still shows the indicator. If the service changed its search address, find the new format (search for something on the site and copy the address bar), then update that lookup in `tools.json`, replacing the sample indicator with `{value}` or `{enc}`. If the service no longer offers that search, delete the lookup. Many sites load results with JavaScript, so a button can pass this check and still show nothing. If you notice one, fix it the same way.

**Dependabot pull request (monthly, only when needed).** The workflows use shared building blocks from GitHub, such as `actions/checkout`. When one has a new version, Dependabot opens a pull request titled "Update workflow actions". Merge it. If a workflow fails afterwards, revert the pull request from its page and tell whoever maintains the repo.

**README numbers.** These update themselves whenever `tools.json` changes. Don't edit the numbers by hand: they sit between hidden `<!-- ... -->` markers and are overwritten. Everything else in the README is yours to edit.

**Running anything now.** Every robot except the suggestion one has a **Run workflow** button under **Actions**.

## Editing tools.json by hand

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

New categories created through the suggestion form are added for you. A category you add by hand appears in the form's dropdown after the next approved suggestion. To add it straight away, also add its label between the `CATEGORIES-START` and `CATEGORIES-END` lines in `.github/ISSUE_TEMPLATE/suggest-tool.yml`.

## Checking your changes before committing

If you have Node.js installed, run this in the repo folder:

```
node .github/scripts/validate-tools.mjs
```

To preview the site on your own computer, run `python3 -m http.server` in the repo folder and open `http://localhost:8000`. Opening `index.html` by double-clicking it won't load the tools, because browsers block pages opened from disk from reading other files.
