# pdoom.art

A meme museum for AI doom culture: a single-page static site about **p(doom)** — the probability that AI causes a catastrophic outcome for humanity.

Sections: hero with a p(doom) vibe-check roulette (spin, slider, share) → featured exhibit (click-to-play YouTube + museum placard) → horizontally scrolling feed → primer → related projects (DoomBench, p(Doom)1, pdoom.org).

Fonts: Bricolage Grotesque (display/body), Instrument Serif (italic accents), JetBrains Mono (labels) via Google Fonts. Motion respects `prefers-reduced-motion`.

No build step. Vanilla HTML / CSS / JS. Deploy as static files to GitHub Pages or Vercel.

## Read aloud (Pocket TTS)

The page can read the hero, primer, featured placard, or selected text aloud in the browser using [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) via the community [xn WASM](https://laurentmazare.github.io/pocket-tts/) runtime.

- On-site assets: `js/pocket-tts/ptts_wasm.js` + `ptts_wasm_bg.wasm` (~931 KB) + worker
- On first listen, the browser downloads ~146 MB q8 weights (+ one voice embedding) from Hugging Face (`lmz/pocket-tts-without-voice-cloning-q8`, `kyutai/pocket-tts-without-voice-cloning`)
- No build step; still static GitHub Pages–friendly (model is not vendored in the repo)


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
| `youtube` | `mediaUrl` or `url` | Any watch / embed / shorts / youtu.be URL. Rendered as a thumbnail facade that loads a `youtube-nocookie.com` iframe on click. Shorts get a vertical frame. |

Featured tweets get the full blockquote embed. Feed tweets show a text card linking out. A feed item with the same `id` as the featured item is skipped so the exhibit isn't shown twice. `note` is shown on the featured placard and as the feed card blurb.

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
├── sitemap.xml
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
