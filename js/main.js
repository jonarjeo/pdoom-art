async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function renderMedia(item, slot) {
  slot.innerHTML = "";
  if (!item) {
    slot.innerHTML = "<p style='color:var(--muted)'>No featured media yet. Check back soon.</p>";
    return;
  }
  if (item.embedHtml) {
    slot.innerHTML = item.embedHtml;
    if (window.twttr?.widgets) window.twttr.widgets.load(slot);
    else {
      const s = document.createElement("script");
      s.src = "https://platform.twitter.com/widgets.js";
      s.async = true;
      document.body.appendChild(s);
    }
    return;
  }
  if (item.type === "youtube" && item.mediaUrl) {
    const iframe = document.createElement("iframe");
    iframe.src = item.mediaUrl.includes("embed")
      ? item.mediaUrl
      : item.mediaUrl.replace("watch?v=", "embed/");
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    slot.appendChild(iframe);
    return;
  }
  if (item.type === "image" && item.mediaUrl) {
    const img = document.createElement("img");
    img.src = item.mediaUrl;
    img.alt = item.title || "p(doom) media";
    slot.appendChild(img);
    return;
  }
  if (item.type === "video" && item.mediaUrl) {
    const v = document.createElement("video");
    v.src = item.mediaUrl;
    v.controls = true;
    v.playsInline = true;
    slot.appendChild(v);
    return;
  }
  slot.innerHTML = `<p><a href="${item.url}" target="_blank" rel="noopener">Open featured post →</a></p>`;
}

function feedCard(item) {
  const el = document.createElement("article");
  el.className = "feed-card";
  const media =
    item.type === "image" && item.mediaUrl
      ? `<img class="thumb" src="${item.mediaUrl}" alt="">`
      : item.type === "youtube" && item.mediaUrl
        ? `<iframe class="thumb" src="${item.mediaUrl.includes("embed") ? item.mediaUrl : item.mediaUrl.replace("watch?v=", "embed/")}" loading="lazy"></iframe>`
        : `<div class="thumb" style="display:grid;place-items:center;color:var(--muted);font-family:var(--mono)">p(doom)</div>`;
  el.innerHTML = `
    ${media}
    <div class="badge">${item.type}</div>
    <h3>${item.title || "Untitled"}</h3>
    <div class="stats">${item.author || ""} · ${item.engagement || ""}</div>
    <a href="${item.url}" target="_blank" rel="noopener">View →</a>
  `;
  return el;
}

async function boot() {
  try {
    const featured = await loadJSON("data/featured.json");
    const item = featured.item || featured;
    document.getElementById("featured-title").textContent = item.title || "Featured p(doom)";
    document.getElementById("featured-meta").innerHTML = `
      <span class="badge">FEATURED</span>
      <span>${item.author || ""}</span>
      <span>${item.engagement || ""}</span>
      <a href="${item.url}" target="_blank" rel="noopener">Source →</a>`;
    renderMedia(item, document.getElementById("featured-embed"));
  } catch (e) {
    console.warn(e);
  }

  try {
    const feed = await loadJSON("data/feed.json");
    const items = Array.isArray(feed) ? feed : feed.items || [];
    const rail = document.getElementById("feed-rail");
    rail.innerHTML = "";
    items.forEach((it) => rail.appendChild(feedCard(it)));
  } catch (e) {
    console.warn(e);
  }
}

boot();
