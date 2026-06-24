# 🔍 Free Cyber Tools Index

A searchable, filterable index of free web-based cybersecurity tools — no install required, just open a browser.

**Live site:** `https://tatey6.github.io/OSINT---Cyber-Tools/`

---

## What's included

75+ tools across 8 categories:

| Category | Examples |
|---|---|
| URL / File scan | VirusTotal, URLScan.io, Metadefender |
| Threat intel | Cisco Talos, OTX AlienVault, Pulsedive |
| OSINT | Shodan, Maltego CE, SpiderFoot |
| Malware analysis | ANY.RUN, Hybrid Analysis, Joe Sandbox |
| Network / IoT | Censys, FOFA, ZoomEye, GreyNoise |
| Vulnerabilities | NVD/NIST, Exploit-DB, CVE Details |
| Breach / Creds | Have I Been Pwned, DeHashed, EmailRep |
| Domain / DNS | MXToolbox, CRT.sh, SSL Labs, DNSDumpster |

---

## Features

- **Search** by tool name or description
- **Filter** by category
- **Copy URL** button on every card
- No frameworks, no dependencies — single `index.html` file
- Works on mobile and desktop

---

## How to add a tool

Open `index.html` and find the `TOOLS` array near the bottom of the file. Add a new entry following this format:

```js
{
  name: "Tool Name",
  url: "https://example.com",
  desc: "One or two sentences describing what it does.",
  cats: ["intel", "domain"],   // used for filtering
  tags: ["intel", "domain"]    // displayed on the card
},
```

**Available category/tag values:**

| Value | Label shown |
|---|---|
| `scan` | URL / File scan |
| `intel` | Threat intel |
| `osint` | OSINT |
| `malware` | Malware |
| `network` | Network / IoT |
| `vuln` | Vulnerabilities |
| `breach` | Breach / Creds |
| `domain` | Domain / DNS |
| `sandbox` | Sandbox |

A tool can belong to multiple categories — just list them all in the `cats` and `tags` arrays.

---

## Deployment

This site is hosted on **GitHub Pages** for free. Any commit to `main` redeploys automatically within ~60 seconds.

To update the live site: edit `index.html` → commit → done.

---

## Disclaimer

All tools listed are third-party services. Always verify a tool is safe and appropriate for your use case before submitting sensitive data. This index is for educational and research purposes.

---

## Contributing

Found a tool that should be here? Open an issue or submit a pull request with the tool's name, URL, description, and relevant categories.
