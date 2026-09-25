# pdoom.art

Clean, fun, meme-savvy single-page static site about **p(doom)** — the probability that AI causes a catastrophic outcome for humanity.

No build step. Vanilla HTML / CSS / JS. Deploy as static files to GitHub Pages or Vercel.

## Local preview

`fetch()` for `data/*.json` does **not** work from `file://`. Serve the folder over HTTP:

```bash
cd pdoom-art
python3 -m http.server 8080
# open http://localhost:8080
```

Or: `npx serve .`

## Update content (no HTML edits)

| File | Purpose |
|------|---------|
| `data/featured.json` | Single featured media item for `#featured` |
| `data/feed.json` | Array of cards for the scrolling feed |

### Item schema

```json
{
  "id": "feat-001",
  "url": "https://…",
  "type": "tweet | image | video | youtube",
  "title": "Short title",
  "author": "@handle",
  "engagement": "12k likes",
  "embedHtml": "<blockquote class=\"twitter-tweet\" …>…</blockquote>",
  "mediaUrl": "assets/….svg | https://….mp4 | https://www.youtube.com/embed/…",
  "note": "Optional editor note"
}
```

### Type → render rules

| `type` | Uses | Notes |
|--------|------|-------|
| `tweet` | `embedHtml` | Official X embed: `blockquote.twitter-tweet` + lazy-loaded `widgets.js` |
| `image` | `mediaUrl` | `<img>` (local or remote URL) |
| `video` | `mediaUrl` | `<video controls>` |
| `youtube` | `mediaUrl` | iframe; prefer `https://www.youtube.com/embed/VIDEO_ID` |

Featured tweets get the full blockquote embed. Feed tweets show a compact text preview (full embed only in featured to keep the grid fast).

## Deploy: GitHub Pages

1. Push this folder to a repo (e.g. `pdoom-art`), contents at repo root **or** `/docs`.
2. **Settings → Pages →** Source: Deploy from branch → `main` / root (or `/docs`).
3. Custom domain: set to `pdoom.art`. This repo already includes a `CNAME` file with `pdoom.art`.
4. At your DNS provider, add:
   - **Apex:** A records to GitHub Pages IPs (see [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)), **or**
   - **www:** CNAME → `YOURUSER.github.io`, then redirect apex as preferred.
5. Enable “Enforce HTTPS” once DNS propagates.

## Deploy: Vercel

1. Import the Git repo in Vercel (framework: **Other** / static).
2. Root directory: the folder that contains `index.html` (this project root).
3. Build command: leave empty. Output: `.` (static).
4. **Project → Settings → Domains →** add `pdoom.art` (and optionally `www.pdoom.art`).
5. Point DNS:
   - Apex: A record to `76.76.21.21` (Vercel), or use their nameservers.
   - `www`: CNAME to `cname.vercel-dns.com`.

No `vercel.json` required for a plain static site; optional:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

## Project layout

```
pdoom-art/
├── index.html
├── favicon.svg
├── CNAME                 # pdoom.art
├── robots.txt
├── README.md
├── css/styles.css
├── js/main.js
├── data/
│   ├── featured.json
│   └── feed.json
└── assets/               # placeholder SVGs, future media
```

## License / vibe

Ship memes responsibly. Update JSON often. Touch grass occasionally.
