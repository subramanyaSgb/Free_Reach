<div align="center">

<img src="icons/icon128.png" alt="FreeReach Logo" width="96" height="96" />

# FreeReach — Lead Collector

**A Chrome Extension that automates lead collection on RocketReach**  
Reveal contacts · Extract everything · Auto-download across all pages

[![Version](https://img.shields.io/badge/version-1.2.1-6366f1?style=flat-square)](https://github.com/subramanyaSgb/Free_Reach/releases)
[![Manifest](https://img.shields.io/badge/Manifest-V3-4f46e5?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome-f59e0b?style=flat-square)](https://www.google.com/chrome/)

</div>

---

## About FreeReach

FreeReach was built out of frustration.

Manually clicking "Get Contact Info" on hundreds of contacts, page after page, copying emails and phones one by one — it's slow, repetitive, and error-prone. There was no free tool that could just **do it all automatically**.

So FreeReach was born.

It clicks every reveal button for you, expands each contact's full profile, captures everything — emails, phones, job history, education, skills, social links — and silently saves it all as clean JSON files to your computer. No dialogs. No manual exports. No data loss. Just run it and walk away.

> Works on RocketReach search result pages. An active RocketReach account is required to reveal contacts.

---

## Features

| Feature | Description |
|---|---|
| **Auto Reveal** | Clicks every "Get Contact Info" button on the page automatically |
| **Deep Extract** | Expands each contact's full profile (View More) to capture all data |
| **Full Data** | Captures emails, phones, job history, education, skills, social links |
| **Auto Paginate** | Moves through up to 2,800 pages without you touching anything |
| **Silent Download** | Saves one JSON file per page (`freereach-leads/page-0001.json`) — no dialogs |
| **Zero Memory Bloat** | Storage never exceeds ~66 KB regardless of how many pages you collect |
| **Live Progress** | Real-time popup showing page, contacts revealed, files saved, total leads |
| **Stop Anytime** | Clean stop button — saves the current page before stopping |

---

## Data Captured Per Contact

```json
{
  "id": "12345678",
  "name": "Jane Doe",
  "title": "VP of Engineering",
  "company": "Acme Corp",
  "companyUrl": "https://rocketreach.co/acme-corp-profile_...",
  "location": "San Francisco, CA, United States",
  "emails": ["jane@acme.com", "jane.doe@gmail.com"],
  "phones": ["+1 415-555-0100"],
  "positions": ["VP of Engineering at Acme Corp", "Senior Engineer at Startup Inc"],
  "education": ["B.S. Computer Science, Stanford University"],
  "skills": ["Python", "System Design", "Team Leadership"],
  "socials": ["LinkedIn", "Twitter"],
  "socialLinks": ["https://linkedin.com/in/janedoe"],
  "revealed": true,
  "sourceUrl": "https://rocketreach.co/search?...",
  "collectedAt": "2026-06-23T10:30:00.000Z"
}
```

---

## Installation

### Option A — Install from ZIP (Recommended)

1. [**Download the latest ZIP**](https://github.com/subramanyaSgb/Free_Reach/archive/refs/heads/main.zip)
2. Extract the ZIP to any folder on your computer
3. Open Chrome → go to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** → select the extracted folder
6. The FreeReach icon appears in your Chrome toolbar ✅

### Option B — Clone with Git

```bash
git clone https://github.com/subramanyaSgb/Free_Reach.git
```
Then follow steps 3–6 above.

---

## How to Use

> **One-time Chrome setting:** Chrome Settings → Downloads → turn **OFF** "Ask where to save each file before downloading". This ensures files save silently with no prompts.

### Auto Mode (Recommended)

1. Open any RocketReach search results page
2. Click the **FreeReach** icon in your toolbar
3. Click **Automate**
4. Walk away — FreeReach collects every contact on every page and saves files to:

```
Downloads/
  freereach-leads/
    page-0001.json   ← 50 contacts
    page-0002.json   ← 50 contacts
    page-0003.json   ← 50 contacts
    ...
```

5. Click **Stop** whenever you want. The current page saves before stopping.

### Manual Mode (Step by Step)

| Step | Button | What it does |
|---|---|---|
| 1 | **Get Contact Info** | Reveals all masked emails & phones on the current page |
| 2 | **Extract Data** | Scrapes all visible contact data into the buffer |
| 3 | **Download JSON** | Downloads the current page's leads as a JSON file |

---

## Output Files

- One JSON file per page: `freereach-leads/page-NNNN.json`
- Each file is a clean JSON array — ready for Excel, databases, or CRM imports
- Files are auto-named and never overwritten
- Download folder is created automatically by Chrome

---

## Memory & Storage

FreeReach is engineered to handle thousands of pages without crashing.

| Metric | Value |
|---|---|
| Storage used during run | ≤ 66 KB (one page buffer, always cleared after save) |
| Storage used after 2,800 pages | ≤ 66 KB |
| Disk space for 2,800 pages | ~180 MB (files in Downloads) |
| Chrome storage cap risk | **None** — buffer never accumulates |

---

## Project Structure

```
Free_Reach/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Service worker — handles all file downloads
├── content/
│   └── content.js         # Core automation logic (runs on rocketreach.co)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic & live status
│   └── popup.css          # Popup styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Saves automation state and current-page buffer between navigations |
| `activeTab` | Interacts with the active RocketReach tab |
| `downloads` | Silently saves one JSON file per page to your Downloads folder |
| `host: rocketreach.co` | Extension only activates on RocketReach pages |

---

## Requirements

- Google Chrome (version 88 or later)
- An active RocketReach account with search access
- Developer mode enabled in `chrome://extensions`

---

## About the Developer

Hey, I'm **Subramanya** — a solo developer who builds tools to solve real workflow problems.

I built FreeReach because I needed it. There was nothing free, nothing that worked well, and nothing that captured the full picture of every contact. So I built it from scratch — every selector, every retry loop, every edge case handled — until it just worked.

If this tool saved you hours of manual work, consider supporting future development. Every coffee keeps the bugs fixed and the features coming. ☕

---

## ☕ Support This Project

FreeReach is completely **free and open-source**. If it's useful to you, a small contribution goes a long way.

### Pay via UPI (India)

```
UPI ID: 9008059668@upi
```

> Open any UPI app (GPay, PhonePe, Paytm, BHIM) → Send to `9008059668@upi`

Even ₹50 makes a difference — thank you! 🙏

---

## Disclaimer

FreeReach is an independent tool not affiliated with or endorsed by RocketReach.  
Use it responsibly and in accordance with RocketReach's Terms of Service.  
You are responsible for how you use the data collected.

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">

Built with ❤️ by a solo developer to save you thousands of manual clicks

**[⬇ Download ZIP](https://github.com/subramanyaSgb/Free_Reach/archive/refs/heads/main.zip)** &nbsp;·&nbsp; **[🐛 Report an Issue](https://github.com/subramanyaSgb/Free_Reach/issues)** &nbsp;·&nbsp; **[☕ Buy Me a Coffee — UPI: 9008059668@upi](#-support-this-project)**

</div>
