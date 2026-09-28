/* pdoom.art — vanilla JS, no build step.
   DOM hooks: #prob-* (vibe check), #featured-root, #feed-root, [data-rail], .reveal */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- helpers ---------- */

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// Only allow http(s) and same-site relative URLs into href/src.
function safeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url, location.href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function isShort(item) {
  return /\/shorts\//.test(item.url || "") || /\/shorts\//.test(item.mediaUrl || "");
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

const PLAY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z"/></svg>`;

/* ---------- YouTube: lightweight click-to-load facade ---------- */

function youtubeFacade(id, title, { wide = true, label = "" } = {}) {
  const poster = wide
    ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
    : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return `
    <button type="button" class="facade" data-yt="${esc(id)}" data-title="${esc(title)}"
            aria-label="Play video: ${esc(title)}">
      <img src="${poster}" data-fallback="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
           alt="" loading="lazy" decoding="async" />
      <span class="play">${PLAY_ICON}</span>
      ${label ? `<span class="facade-label">${label}</span>` : ""}
    </button>`;
}

function youtubeIframe(id, title) {
  const iframe = document.createElement("iframe");
  const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", modestbranding: "1" });
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?${params}`;
  iframe.title = title || "YouTube video";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  // YouTube rejects embeds that send no Referer (error 153); keep origin-level referrer.
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  return iframe;
}

function wireFacades(root) {
  root.querySelectorAll(".facade img[data-fallback]").forEach((img) => {
    const swap = () => {
      if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
    };
    // maxresdefault 404s as a 120px grey placeholder rather than an error on some videos.
    img.addEventListener("error", swap, { once: true });
    img.addEventListener("load", () => { if (img.naturalWidth <= 120) swap(); });
  });
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".facade[data-yt]");
    if (!btn) return;
    const iframe = youtubeIframe(btn.dataset.yt, btn.dataset.title);
    btn.replaceWith(iframe);
    iframe.focus();
  });
}

/* ---------- Featured ---------- */

function renderFeaturedMedia(item) {
  const id = item.type === "youtube" || youtubeId(item.mediaUrl || item.url)
    ? youtubeId(item.mediaUrl) || youtubeId(item.url)
    : null;

  if (id) {
    const label = `<span>▶ Play exhibit</span><span>${esc(hostOf(item.url) || "youtube.com")}</span>`;
    return `<div class="screen"><div class="embed${isShort(item) ? " embed-vertical" : ""}">
      ${youtubeFacade(id, item.title, { wide: !isShort(item), label })}
    </div></div>`;
  }
  const media = safeUrl(item.mediaUrl);
  if (item.type === "image" && media) {
    return `<div class="screen"><a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">
      <img class="embed" style="object-fit:contain;aspect-ratio:auto" src="${media}" alt="${esc(item.title)}" /></a></div>`;
  }
  if (item.type === "video" && media) {
    return `<div class="screen"><div class="embed"><video src="${media}" controls playsinline preload="metadata"></video></div></div>`;
  }
  return "";
}

function renderFeatured(root, item) {
  // Tweets: editor-supplied embed HTML from our own JSON (trusted), full width.
  if (item.type === "tweet" && item.embedHtml) {
    root.innerHTML = `<div class="featured-tweet">${item.embedHtml}</div>`;
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    document.body.appendChild(s);
    return;
  }

  const url = safeUrl(item.url);
  root.innerHTML = `
    ${renderFeaturedMedia(item)}
    <aside class="placard" aria-label="About this exhibit">
      <p class="placard-exhibit">Exhibit A · ${esc(item.type || "media")}</p>
      <h3 class="placard-title">${esc(item.title || "Untitled")}</h3>
      ${item.author ? `<p class="placard-author">${esc(item.author)}</p>` : ""}
      ${item.note ? `<p class="placard-note">${esc(item.note)}</p>` : ""}
      <div class="placard-meta">
        <span>${esc(item.engagement || "")}</span>
        ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">Watch on ${esc(hostOf(url) || "source")} ↗</a>` : ""}
      </div>
    </aside>`;
  wireFacades(root);
}

/* ---------- Feed ---------- */

function feedMedia(item) {
  const id = youtubeId(item.mediaUrl) || youtubeId(item.url);
  if (id) {
    const short = isShort(item);
    return `<div class="embed${short ? "" : " embed-wide"}">
      ${youtubeFacade(id, item.title, { wide: !short, label: `<span>▶ ${short ? "Short" : "Play"}</span>` })}
    </div>`;
  }
  const url = safeUrl(item.url);
  const media = safeUrl(item.mediaUrl);
  if (item.type === "image" && media) {
    return `<a class="feed-media-link" href="${url}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">
      <img src="${media}" alt="" loading="lazy" decoding="async" /></a>`;
  }
  if (item.type === "video" && media) {
    return `<div class="embed"><video src="${media}" controls playsinline preload="metadata"></video></div>`;
  }
  return `<a class="feed-media-link" href="${url}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">
    <span class="feed-fallback">p(doom)</span></a>`;
}

function feedCard(item, index) {
  const url = safeUrl(item.url);
  const no = String(index + 2).padStart(3, "0"); // 001 is the featured exhibit
  return `<article class="feed-card" role="listitem">
    ${feedMedia(item)}
    <div class="feed-body">
      <div class="feed-top">
        <span class="badge">${esc(item.type || "media")}</span>
        <span class="exhibit-no">No. ${no}</span>
      </div>
      <h3 class="feed-title">${url
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(item.title || "Untitled")}</a>`
        : esc(item.title || "Untitled")}</h3>
      ${item.note ? `<p class="feed-note">${esc(item.note)}</p>` : ""}
      <p class="feed-stats"><b>${esc(item.author || "")}</b>${item.engagement ? ` · ${esc(item.engagement)}` : ""}</p>
    </div>
  </article>`;
}

function wireRail(rail) {
  const prev = document.querySelector('[data-rail="prev"]');
  const next = document.querySelector('[data-rail="next"]');
  if (!prev || !next) return;
  const step = () => (rail.querySelector(".feed-card")?.offsetWidth || 300) + 18;
  const behavior = REDUCED_MOTION ? "auto" : "smooth";
  prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior }));
  next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior }));
  const update = () => {
    prev.disabled = rail.scrollLeft <= 4;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
  };
  rail.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/* ---------- Vibe check ---------- */

const VERDICTS = [
  [0, "Brunch accelerationist. \"It's just autocomplete.\""],
  [5, "Median surveyed AI researcher. Still skipping that flight."],
  [10, '"Relatively optimistic" frontier-lab CEO.'],
  [25, "Nervous laugh at dinner."],
  [50, "Coin-flip enjoyer. Heads = utopia."],
  [75, "Alignment Twitter at 3 a.m."],
  [90, "Canned goods in the cart. Drafting the longpost."],
];

function verdictFor(n) {
  let v = VERDICTS[0][1];
  for (const [min, text] of VERDICTS) if (n >= min) v = text;
  return v;
}

function wireVibeCheck() {
  const out = document.getElementById("prob-value");
  const num = document.getElementById("prob-number");
  const verdict = document.getElementById("prob-verdict");
  const slider = document.getElementById("prob-slider");
  const spin = document.getElementById("prob-spin");
  const share = document.getElementById("prob-share");
  const status = document.getElementById("share-status");
  const fill = document.getElementById("gauge-fill");
  const needle = document.getElementById("gauge-needle");
  if (!out || !num) return;

  let current = 50;
  let raf = 0;
  let fallback = 0;

  const paint = (n) => {
    num.textContent = Math.round(n);
    if (fill) fill.style.strokeDashoffset = String(100 - n);
    if (needle) needle.style.transform = `rotate(${-90 + n * 1.8}deg)`;
  };

  const land = (n) => {
    current = n;
    paint(n);
    if (slider) slider.value = String(n);
    if (verdict) verdict.textContent = verdictFor(n);
    out.classList.remove("is-rolling");
    out.classList.remove("is-landed");
    void out.offsetWidth; // restart animation
    out.classList.add("is-landed");
  };

  const roll = () => {
    cancelAnimationFrame(raf);
    clearTimeout(fallback);
    const target = Math.floor(Math.random() * 101);
    if (REDUCED_MOTION) return land(target);
    out.classList.add("is-rolling");
    if (verdict) verdict.textContent = "Consulting the priors…";
    const start = performance.now();
    const from = current;
    const dur = 1300;
    // Swing past a couple of times before settling: feels like a roulette, lands exactly.
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const ease = 1 - Math.pow(1 - p, 4);
      const wobble = Math.sin(p * Math.PI * 5) * (1 - p) * 40;
      const n = Math.max(0, Math.min(100, from + (target - from) * ease + wobble));
      paint(n);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { clearTimeout(fallback); land(target); }
    };
    raf = requestAnimationFrame(tick);
    // rAF is paused in hidden tabs; make sure we still land.
    clearTimeout(fallback);
    fallback = setTimeout(() => { cancelAnimationFrame(raf); land(target); }, dur + 250);
  };

  spin?.addEventListener("click", roll);
  slider?.addEventListener("input", () => {
    cancelAnimationFrame(raf);
    clearTimeout(fallback);
    current = Number(slider.value);
    paint(current);
    out.classList.remove("is-rolling");
    if (verdict) verdict.textContent = verdictFor(current);
  });

  share?.addEventListener("click", async () => {
    const text = `My p(doom) is ${current}%. What's yours?`;
    const url = "https://pdoom.art/";
    try {
      if (navigator.share) {
        await navigator.share({ title: "What's your p(doom)?", text, url });
        status.textContent = "Shared. Godspeed.";
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        status.textContent = "Copied. Go ruin a group chat.";
      }
    } catch (err) {
      if (err?.name !== "AbortError") status.textContent = "Couldn't share. Machines said no.";
    }
  });

  // Initial spin so the hero is alive on load.
  paint(0);
  setTimeout(roll, REDUCED_MOTION ? 0 : 450);
}

/* ---------- Motion + nav ---------- */

function wireReveal() {
  const els = document.querySelectorAll(".reveal");
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js-reveal");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  els.forEach((el) => {
    // light stagger for siblings in grids
    const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains("reveal")) : [];
    el.style.setProperty("--delay", `${Math.min(sibs.indexOf(el), 4) * 0.08}s`);
    io.observe(el);
  });
}

function wireNavHighlight() {
  const links = [...document.querySelectorAll(".site-nav a[href^='#']")];
  if (!("IntersectionObserver" in window) || !links.length) return;
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => { a.classList.remove("is-active"); a.removeAttribute("aria-current"); });
      const a = byId.get(e.target.id);
      if (a) { a.classList.add("is-active"); a.setAttribute("aria-current", "location"); }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

function wireCardGlow() {
  document.querySelectorAll(".related-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

/* ---------- Boot ---------- */

async function boot() {
  wireReveal();
  wireVibeCheck();
  wireNavHighlight();
  wireCardGlow();

  const featuredRoot = document.getElementById("featured-root");
  const feedRoot = document.getElementById("feed-root");
  let featuredId = null;

  const [featured, feed] = await Promise.allSettled([
    loadJSON("data/featured.json"),
    loadJSON("data/feed.json"),
  ]);

  if (featuredRoot) {
    if (featured.status === "fulfilled") {
      const item = featured.value.item || featured.value;
      featuredId = item.id;
      renderFeatured(featuredRoot, item);
    } else {
      console.warn(featured.reason);
      featuredRoot.innerHTML = `<p class="status">Couldn't load Exhibit A. <a href="https://www.youtube.com/watch?v=mp-HWukUDSE">Watch Level 5 on YouTube ↗</a></p>`;
    }
  }

  if (feedRoot) {
    if (feed.status === "fulfilled") {
      const all = Array.isArray(feed.value) ? feed.value : feed.value.items || [];
      // Don't repeat the featured exhibit on the wall.
      const items = all.filter((it) => !featuredId || it.id !== featuredId);
      feedRoot.innerHTML = items.map(feedCard).join("") || `<p class="status">Wall's empty. Weird.</p>`;
      wireFacades(feedRoot);
      wireRail(feedRoot);
    } else {
      console.warn(feed.reason);
      feedRoot.innerHTML = `<p class="status">Feed won't load.</p>`;
    }
  }
}

boot();
