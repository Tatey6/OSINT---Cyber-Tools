# SpotLight · Free Cyber Tools Index

A searchable index of free, web-based cybersecurity tools, with a built-in indicator lookup, OPSEC ratings on every tool, and automatic checks that every link and lookup still works. No install and no account needed: open it in a browser and go.

**Live site:** [https://tatey6.github.io/OSINT---Cyber-Tools/](https://tatey6.github.io/OSINT---Cyber-Tools/)

> ⚠️ **Nothing you enter into these tools is private.** They're third-party services, and several publish what you submit. Never enter client data, internal hostnames, credentials or sensitive files. Look up a file's hash instead of uploading the file.

---

## What's included

**<!-- TOOL-COUNT -->56<!-- /TOOL-COUNT --> tools**, each verified to work without a paid account. Most tools sit in more than one category.

<!-- CATEGORY-TABLE -->
| Category | Tools | Examples |
|---|---|---|
| URL / file scan | 14 | VirusTotal, URLScan.io, Metadefender, URLhaus |
| Threat intel | 17 | AbuseIPDB, Cisco Talos Intelligence, OTX – AlienVault, GreyNoise |
| OSINT | 14 | OSINT Framework, GrayhatWarfare, Wayback Machine, Intelligence X |
| Malware | 11 | ANY.RUN, Hybrid Analysis, MalwareBazaar, Joe Sandbox |
| Network / IoT | 14 | Shodan, Censys, FullHunt, LeakIX |
| Vulnerabilities | 6 | NVD – NIST, Exploit-DB, CVE Details, CIRCL CVE Search |
| Breach / creds | 3 | Have I Been Pwned, Pwned Passwords, Intelligence X |
| Domain / DNS | 15 | MXToolbox, DNSDumpster, WHOIS Lookup, DomainTools WHOIS |
| Study | 1 | Paul Jerimy Cyber Roadmap |
| CVE / PoC | 1 | Nomi Sec CVE POCs |
<!-- /CATEGORY-TABLE -->

---

## Features

### Indicator lookup
Paste an IP, domain, URL, file hash (MD5, SHA-1 or SHA-256), email address or CVE ID. The page detects what it is and shows one-click lookups in every relevant tool.

- **Defanged input works.** `hxxps://evil[.]com` and `bob[@]phish[.]co` are re-fanged automatically.
- **It pivots a step further.** A URL also gives lookups for its domain, and an email also gives lookups for the sender's domain.
- **Copy** and **Copy defanged** buttons give you a clean or ticket-safe version of the indicator.
- **Private addresses are caught.** IPs like `10.x.x.x` or `192.168.x.x` get a note to check your own logs instead, since public tools have no data on them.
- **Lookups are passive only.** Every button searches data the tool already holds. None of them tell a service to scan or visit the indicator.

### OPSEC ratings
Every tool card shows how the tool handles what you give it, with a short note on anything specific to watch for, such as which setting keeps a scan private.

<!-- OPSEC-TABLE -->
| Rating | Meaning | Tools |
|---|---|---|
| 🔴 **Submissions public** | Others can see what you submit | 11 |
| 🟠 **Contacts target** | The tool connects to the site or IP, so the target sees traffic | 8 |
| 🟢 **Passive lookup** | Searches existing data only | 27 |
| ⚪ **Reference** | No indicator needed | 10 |
<!-- /OPSEC-TABLE -->

The **Passive only** filter shows just the passive and reference tools, which is a safe default view for newer analysts.

### Favourites, notes and recently used
- **Favourites:** star any tool and it sorts to the top. The **Favourites** filter shows only starred tools.
- **Notes:** add your own notes to any tool, such as what it's best for or its limits. Notes show on the card, are searchable, and have their own **Has notes** filter.
- **Recently used:** your last 8 tools appear above the grid, including ones opened from the indicator lookup.
- **Backup:** open **Your data** in the top bar. **Export** downloads a small `.json` file, and **Import** merges it back in on another browser or device. Backups from older versions still import.

All of this is stored in your own browser only. Nothing is sent anywhere, and nobody else can see your favourites, notes or history.

### Search, filter, copy and open
- Search matches tool names, domains, descriptions, tags and your own notes.
- The sidebar filters by category or by your own views (Favourites, Has notes, Passive only), with a count on each. On phones it becomes swipeable rows.
- Every card shows the tool's domain and has buttons to add a note, copy the URL, open the tool in a new tab, or star it. On desktop the buttons appear on hover.
- Switch between **Grid** and a denser **List** view. Your choice is remembered.

### Light and dark themes
The site follows your device's light or dark setting. The moon button in the top bar overrides it, and your choice is remembered.

### Keyboard shortcuts
Press `?` on the site to see these at any time.

| Key | Action |
|---|---|
| `/` | Search tools |
| `i` | Look up an indicator |
| `a` / `f` / `p` | Show all / favourites / passive only |
| `v` | Switch between grid and list view |
| `↓` or `Enter` | From a search or lookup box, jump to the results |
| `Esc` | Clear and leave a box |
| Arrow keys, `j` / `k` | Move between tool cards |
| `Enter` or `o` | Open the selected tool |
| `s` | Star or unstar the selected tool |
| `n` | Add or edit a note on the selected tool |
| `c` | Copy the selected tool's URL |
| `Ctrl` + `Enter` | Save a note |

Shortcuts never fire while you're typing, and they don't override browser shortcuts like `Ctrl` + `F`.

---

## Suggesting and adding tools

**Know a free tool that should be here?** [Suggest a tool](https://github.com/Tatey6/OSINT---Cyber-Tools/issues/new?template=suggest-tool.yml) using the short form (a free GitHub account is needed). A check replies within a minute with a preview and anything that needs fixing. Once the tool is approved, it's added to the site automatically.

The tool list lives in **`tools.json`**, separate from the page code. It can also be edited by hand. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the format, the rules and how suggestions are reviewed.

**New tools are found automatically, too.** Every Monday a robot checks a handful of well-maintained "awesome" lists for links added that week, drops anything already listed or already suggested, ranks the rest by how cyber-related they look, and opens a **Possible new tools** issue. Each tool in it has a **Suggest it** link that opens the form already filled in. Nothing is added without going through the form and a review.

Every change to `tools.json` is checked automatically. Mistakes such as an uppercase category, a missing comma, a duplicate tool or an `http://` link are caught, with a plain-English explanation of what to fix.

---

## Repo structure

```
index.html                              The page: layout, styles and code
tools.json                              The tool list, categories and lookup links
CONTRIBUTING.md                         How to add or edit tools
LICENSE                                 MIT licence
README.md                               This file
.github/ISSUE_TEMPLATE/suggest-tool.yml The "Suggest a tool" form
.github/discovery-sources.json          The lists the weekly tool finder watches
.github/workflows/validate.yml          Checks tools.json on every change
.github/workflows/link-check.yml        Weekly link-check schedule
.github/workflows/suggestions.yml       Checks suggestions and opens pull requests
.github/workflows/discover-tools.yml    Weekly "Possible new tools" issue
.github/workflows/lookup-check.yml      Monthly test of every lookup button
.github/workflows/update-readme.yml     Keeps the numbers in this README up to date
.github/dependabot.yml                  Monthly updates for the workflows' building blocks
.github/scripts/validate-tools.mjs      The tools.json checker
.github/scripts/check-links.mjs         The link checker
.github/scripts/suggestion.mjs          Turns a suggestion into a tools.json entry
.github/scripts/discover-tools.mjs      Finds new links in the watched lists
.github/scripts/check-lookups.mjs       The lookup button tester
.github/scripts/update-readme.mjs       Recounts tools for this README
```

### What runs automatically

| When | What | What you see |
|---|---|---|
| Any change to `tools.json` | Checks it for mistakes, then updates the numbers in this README | A green ✓ or red ✗ on the commit |
| A suggestion is opened or edited | Checks it and previews the tool card | A comment on the issue |
| You add the **approved** label | Adds the tool to `tools.json` | A pull request to merge |
| Mondays, 8am Perth | Tests every tool's home page | A **Link check** issue, only if something's broken |
| Mondays, 9am Perth | Looks for new tools in curated lists | A **Possible new tools** issue |
| 1st of the month, 10am Perth | Tests every lookup button | A **Lookup check** issue, only if something's broken |
| Monthly | Checks the workflows' building blocks for updates | A Dependabot pull request, only if there's an update |

No frameworks, no build step and no dependencies. The only outside resource is Google Fonts (Archivo and JetBrains Mono). GitHub Pages serves the files directly and redeploys about a minute after each commit.

To preview locally, run `python3 -m http.server` in the repo folder and open `http://localhost:8000`. Opening `index.html` straight from disk won't load the tool list.

---

## Licence

Released under the [MIT Licence](LICENSE). © 2026 Tatey6.

Tool names and trademarks belong to their respective owners and are used here only to identify and link to their services.

## Disclaimer

All tools listed are third-party services and are not affiliated with this project. Free tiers, terms and privacy practices change. Check a tool's current terms before using it for work, and always follow your organisation's policies on handling client data.
