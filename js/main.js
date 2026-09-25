async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function youtubeEmbed(url) {
  if (!url) return null;
  if (url.includes("embed/")) return url;
  if (url.includes("watch?v=")) return url.replace("watch?v=", "embed/");
  if (url.includes("youtu.be/")) return "https://www.youtube.com/embed/" + url.split("youtu.be/").pop().split(/[?&]/)[0];
  if (url.includes("shorts/")) return "https://www.youtube.com/embed/" + url.split("shorts/").pop().split(/[?&]/)[0];
  return url;
}

function renderMedia(item) {
  if (!item) return `<p class="feed-status">No featured media yet.</p>`;
  if (item.embedHtml) return item.embedHtml;
  if (item.type === "youtube" || (item.mediaUrl && item.mediaUrl.includes("youtube"))) {
    const src = youtubeEmbed(item.mediaUrl || item.url);
    return `<div class="embed-frame"><iframe src="${src}" title="${item.title || "featured"}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (item.type === "image" && item.mediaUrl) {
    return `<a href="${item.url}" target="_blank" rel="noopener"><img class="media-img" src="${item.mediaUrl}" alt="${item.title || ""}" /></a>`;
  }
  if (item.type === "video" && item.mediaUrl) {
    return `<video class="media-video" src="${item.mediaUrl}" controls playsinline></video>`;
  }
  return `<p><a href="${item.url}" target="_blank" rel="noopener">Open featured post →</a></p>`;
}

function feedCard(item) {
  const thumb =
    item.type === "image" && item.mediaUrl
      ? `<img src="${item.mediaUrl}" alt="" />`
      : item.type === "youtube"
        ? `<div class="thumb-fallback">▶ YouTube</div>`
        : `<div class="thumb-fallback">p(doom)</div>`;
  return `<article class="feed-card">
    <a class="thumb" href="${item.url}" target="_blank" rel="noopener">${thumb}</a>
    <div class="feed-body">
      <div class="badge">${item.type || "media"}</div>
      <h3>${item.title || "Untitled"}</h3>
      <p class="stats">${item.author || ""} · ${item.engagement || ""}</p>
    </div>
  </article>`;
}

function wireProb() {
  const btn = document.getElementById("prob-value");
  if (!btn) return;
  const roll = () => {
    const n = Math.floor(Math.random() * 101);
    btn.textContent = n + "%";
  };
  btn.addEventListener("click", roll);
  roll();
}

async function boot() {
  wireProb();
  const featuredRoot = document.getElementById("featured-root");
  const feedRoot = document.getElementById("feed-root");
  try {
    const featured = await loadJSON("data/featured.json");
    const item = featured.item || featured;
    const title = document.getElementById("featured-title");
    if (title) title.textContent = item.title || "Featured p(doom)";
    if (featuredRoot) {
      featuredRoot.innerHTML = `
        <div class="meta"><span class="badge">FEATURED</span>
          <span>${item.author || ""}</span>
          <span>${item.engagement || ""}</span>
          <a href="${item.url}" target="_blank" rel="noopener">Source →</a></div>
        ${renderMedia(item)}`;
      if (item.embedHtml && window.twttr?.widgets) window.twttr.widgets.load(featuredRoot);
      else if (item.embedHtml) {
        const s = document.createElement("script");
        s.src = "https://platform.twitter.com/widgets.js";
        s.async = true;
        document.body.appendChild(s);
      }
    }
  } catch (e) {
    console.warn(e);
    if (featuredRoot) featuredRoot.innerHTML = `<p class="feed-status">Couldn't load featured media.</p>`;
  }

  try {
    const feed = await loadJSON("data/feed.json");
    const items = Array.isArray(feed) ? feed : feed.items || [];
    if (feedRoot) feedRoot.innerHTML = items.map(feedCard).join("") || `<p class="feed-status">Feed empty.</p>`;
  } catch (e) {
    console.warn(e);
    if (feedRoot) feedRoot.innerHTML = `<p class="feed-status">Couldn't load feed.</p>`;
  }
}

boot();
