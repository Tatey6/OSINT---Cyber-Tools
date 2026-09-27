# 🔍 Free Cyber Tools Index

A searchable index of free, web-based cybersecurity tools, with a built-in indicator lookup, OPSEC ratings on every tool, and weekly checks for dead links. No install and no account needed: open it in a browser and go.

**Live site:** [https://tatey6.github.io/OSINT---Cyber-Tools/](https://tatey6.github.io/OSINT---Cyber-Tools/)

> ⚠️ **Nothing you enter into these tools is private.** They're third-party services, and several publish what you submit. Never enter client data, internal hostnames, credentials or sensitive files. Look up a file's hash instead of uploading the file.

---

## What's included

**55 tools**, each verified to work without a paid account. Most tools sit in more than one category.

| Category | Tools | Examples |
|---|---|---|
| URL / File scan | 14 | VirusTotal, URLScan.io, URLhaus, SSL Labs |
| Threat intel | 16 | AbuseIPDB, Cisco Talos, OTX AlienVault, GreyNoise |
| OSINT | 14 | OSINT Framework, Wayback Machine, Intelligence X, Shodan |
| Malware | 10 | ANY.RUN, Hybrid Analysis, MalwareBazaar, Joe Sandbox |
| Network / IoT | 14 | Shodan, Censys, LeakIX, BGP.he.net |
| Vulnerabilities | 6 | NVD, Exploit-DB, CVE Details, Shodan CVEDB |
| Breach / Creds | 3 | Have I Been Pwned, Pwned Passwords, Intelligence X |
| Domain / DNS | 15 | MXToolbox, DNSDumpster, DomainTools WHOIS, ViewDNS |
| Study | 1 | Paul Jerimy Security Certification Roadmap |
| CVE / PoC | 1 | Nomi Sec PoC-in-GitHub |

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

| Rating | Meaning | Tools |
|---|---|---|
| 🔴 **Submissions public** | Others can see what you submit | 11 |
| 🟠 **Contacts target** | The tool connects to the site or IP, so the target sees traffic | 8 |
| 🟢 **Passive lookup** | Searches existing data only | 26 |
| ⚪ **Reference** | No indicator needed | 10 |

The **Passive only** filter shows just the passive and reference tools, which is a safe default view for newer analysts.

### Favourites, notes and recently used
- **Favourites:** star any tool and it sorts to the top. The **Favourites** filter shows only starred tools.
- **Notes:** add your own notes to any tool, such as what it's best for or its limits. Notes show on the card, are searchable, and have their own **Has notes** filter.
- **Recently used:** your last 8 tools appear above the grid, including ones opened from the indicator lookup.
- **Backup:** open **Your data** in the top bar. **Export** downloads a small `.json` file, and **Import** merges it back in on another browser or device.

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

### Automated link checks
A GitHub Action checks every tool URL each Monday at 00:00 UTC. It can also be run on demand from the **Actions** tab (**Link check** → **Run workflow**).

- **Broken** (no response, 404 or server error after a retry) and **Moved** (redirects to another site or a login page) tools are reported in a single issue labelled `link-check`.
- Later runs update that same issue, and it closes itself once everything passes.
- Sites that block automated checks are listed separately as **Couldn't verify**, rather than being reported as broken.

---

## Adding a tool

Open `index.html`, find the `TOOLS` array, and add a line in the right section:

```js
{name:"Tool Name",url:"https://example.com",desc:"One or two sentences on what it does.",cats:["osint"],tags:["osint"],opsec:"passive",opsecNote:""},
```

| Field | What goes in it |
|---|---|
| `name` | Display name. Must be unique, because favourites and notes are keyed by it. |
| `url` | The tool's homepage. |
| `desc` | One or two sentences. |
| `cats` | Which filter buttons it appears under. |
| `tags` | The coloured labels shown on the card. Usually the same as `cats`. |
| `opsec` | One of `public`, `active`, `passive` or `reference`. |
| `opsecNote` | Anything specific to watch for, or `""` for none. |

**Category values:** `scan`, `intel`, `osint`, `malware`, `network`, `vuln`, `breach`, `domain`, `study`, `poc`. There is also `sandbox`, a tag used on the malware sandboxes.

**Rules:**
- `cats` and `tags` must always be **lowercase**.
- Every line ends with `},`.
- Renaming a tool resets any favourites and notes people have saved against the old name.

### Adding a new category
A new category needs the **same lowercase value** in three places in `index.html`:

1. The tool entry: `cats:["newcat"],tags:["newcat"]`
2. A sidebar button, in the **Categories** list: `<button class="filter-btn" data-cat="newcat"><span class="label">New category</span><span class="count"></span></button>`
3. The `TAG_LABEL` list in the JavaScript: `newcat:"New category"`

The count next to the button fills in automatically.

---

## Name and logo

`index.html` has two marked spots near the top of the page. Search the file for `LOGO:` and `NAME:`.

- **Logo:** upload the image to the repo (SVG is best), then replace the placeholder `<span class="brand-logo is-placeholder" ...>LOGO</span>` with `<img class="brand-logo" src="logo.svg" alt="">`.
- **Name:** replace `Site Name` with your site's name.
- **Browser tab icon:** add `<link rel="icon" href="logo.svg">` inside `<head>`.
- **Link previews:** a commented block in `<head>` shows the two lines to add so shared links show your name and image in Teams, Slack or email.

---

## Repo structure

```
index.html                          The whole site: page, styles, tool list and code
README.md                           This file
.github/workflows/link-check.yml    Weekly link-check schedule
.github/scripts/check-links.mjs     The link checker itself
```

No frameworks, no build step and no dependencies. The only outside resource is Google Fonts (Archivo and JetBrains Mono). GitHub Pages serves `index.html` directly and redeploys about a minute after each commit.

---

## Disclaimer

All tools listed are third-party services and are not affiliated with this project. Free tiers, terms and privacy practices change. Check a tool's current terms before using it for work, and always follow your organisation's policies on handling client data.
