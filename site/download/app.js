(function () {
  const REPO = "iamthamanic/sagatree";
  const API = `https://api.github.com/repos/${REPO}/releases/latest`;
  const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
  const PLATFORMS = [
    { id: "macos", label: "macOS" },
    { id: "windows", label: "Windows" },
    { id: "linux", label: "Linux" },
  ];
  function classify(name) {
    const n = String(name || "").trim().toLowerCase();
    if (!n || n.endsWith(".json") || n.endsWith(".sig") || n.endsWith(".asc")) return null;
    if (n.endsWith(".dmg") || n.endsWith(".pkg") || /(?:^|[^a-z])(darwin|macos|mac-?os)(?:[^a-z]|$)/.test(n) || /aarch64-apple|x86_64-apple|universal-apple/.test(n)) return "macos";
    if (n.endsWith(".msi") || n.endsWith(".exe") || /(?:^|[^a-z])(windows|win32|win64)(?:[^a-z]|$)/.test(n)) return "windows";
    if (n.endsWith(".appimage") || n.endsWith(".deb") || n.endsWith(".rpm") || /(?:^|[^a-z])linux(?:[^a-z]|$)/.test(n)) return "linux";
    return null;
  }
  function rank(platform, name) {
    const n = name.toLowerCase();
    if (platform === "macos") { if (n.endsWith(".dmg")) return 30; if (n.includes("universal")) return 25; if (n.endsWith(".pkg")) return 20; return 10; }
    if (platform === "windows") { if (n.endsWith(".msi")) return 30; if (n.endsWith(".exe")) return 20; return 10; }
    if (n.endsWith(".appimage")) return 30; if (n.endsWith(".deb")) return 20; if (n.endsWith(".rpm")) return 15; return 10;
  }
  function pick(assets) {
    const best = { macos: null, windows: null, linux: null };
    const ranks = { macos: -1, windows: -1, linux: -1 };
    for (const asset of assets) {
      const platform = classify(asset.name);
      if (!platform) continue;
      const r = rank(platform, asset.name);
      if (r > ranks[platform]) { ranks[platform] = r; best[platform] = asset; }
    }
    return best;
  }
  function guessOs(ua) {
    const u = ua.toLowerCase();
    if (/windows|win32|win64/.test(u)) return "windows";
    if (/android|iphone|ipad|ipod/.test(u)) return "unknown";
    if (/mac os x|macintosh/.test(u)) return "macos";
    if (/linux|cros/.test(u)) return "linux";
    return "unknown";
  }
  function formatBytes(size) {
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return null;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  function iconSvg(platform) {
    if (platform === "macos") return '<svg class="icon" viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M128.2 48c-12.3 0-25.4 7.4-33.4 19.1-7.3 10.7-10.6 24-9.2 36.8 14.2 1.1 28.7-6.6 37-18.4C130.5 74.8 134.2 61.2 128.2 48Zm53.5 91.1c-.5-30.8 25.1-45.6 26.2-46.3-14.3-20.9-36.5-23.8-44.4-24.1-18.9-1.9-36.9 11.1-46.5 11.1s-24.3-10.8-40-10.5c-20.6.3-39.6 12-50.2 30.5-21.4 37.1-5.5 92 15.4 122.1 10.2 14.7 22.4 31.2 38.4 30.6 15.4-.6 21.2-9.9 39.8-9.9s23.8 9.9 40.1 9.6c16.5-.3 27-15 37.1-29.8 11.7-17.1 16.5-33.6 16.8-34.5-.4-.2-32.1-12.3-32.7-48.8Z"/></svg>';
    if (platform === "windows") return '<svg class="icon" viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M96 120V48L16 60.4V120Zm0 16H16v59.6L96 208Zm16-16V47.1L240 28v92Zm128 16H112v97.9L240 228Z"/></svg>';
    return '<svg class="icon" viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M230.2 158.3a8 8 0 0 0-7.2-1.3 88.1 88.1 0 0 1-27.4 4.4c-40.3 0-73.4-28.4-73.4-63.4 0-19.7 10.5-37.4 28.4-49.1a8 8 0 0 0-1.1-13.5A103.7 103.7 0 0 0 128 32C74.4 32 32 74.4 32 128s42.4 96 96 96a95.5 95.5 0 0 0 68.4-28.4 8 8 0 0 0-1.8-12.9 56 56 0 0 1-20.4-12.5 8 8 0 0 1 10.2-12.3 72 72 0 0 0 36.6 14.5 8 8 0 0 0 9.2-9.1Z"/></svg>';
  }
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("platforms");
  const releasesLink = document.getElementById("releases-link");
  if (releasesLink) releasesLink.href = RELEASES_PAGE;
  const suggested = guessOs(navigator.userAgent || "");
  function render(state) {
    if (!statusEl || !listEl) return;
    if (state.kind === "loading") {
      statusEl.dataset.state = "loading";
      statusEl.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Installer werden geladen…</span>';
    } else if (state.kind === "ready") {
      statusEl.dataset.state = "ready";
      statusEl.textContent = `Aktuelle Version ${state.tag}`;
    } else if (state.kind === "empty") {
      statusEl.dataset.state = "empty";
      statusEl.textContent = "Desktop-Installer erscheinen hier, sobald das erste Release gebaut ist.";
    } else {
      statusEl.dataset.state = "error";
      statusEl.textContent = "Releases konnten gerade nicht geladen werden. GitHub Releases bleibt erreichbar.";
    }
    const assets = state.assets || { macos: null, windows: null, linux: null };
    listEl.innerHTML = PLATFORMS.map((p) => {
      const asset = assets[p.id];
      const enabled = Boolean(asset);
      const size = enabled ? formatBytes(asset.size) : null;
      const meta = enabled ? `${asset.name}${size ? ` · ${size}` : ""}` : "Noch kein Installer in einem öffentlichen Release";
      const btn = enabled
        ? `<a class="btn btn-primary" href="${asset.browser_download_url}" rel="noopener noreferrer" aria-label="${p.label} Installer herunterladen">Download</a>`
        : `<button type="button" class="btn btn-disabled" disabled aria-label="${p.label} Installer noch nicht verfügbar">Bald verfügbar</button>`;
      return `<li><article class="card" data-suggested="${suggested === p.id ? "true" : "false"}"><div class="card-head">${iconSvg(p.id)}<div><h2>${p.label}</h2><p class="meta">${meta}</p>${suggested === p.id ? '<p class="hint">Empfohlen für dieses Gerät</p>' : ""}</div></div><div class="actions">${btn}</div></article></li>`;
    }).join("");
  }
  render({ kind: "loading" });
  fetch(API, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } })
    .then(async (res) => {
      if (res.status === 404) { render({ kind: "empty" }); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const tag = typeof body.tag_name === "string" ? body.tag_name : "";
      const raw = Array.isArray(body.assets) ? body.assets : [];
      const assets = pick(raw.map((a) => ({ name: a && a.name, browser_download_url: a && a.browser_download_url, size: a && a.size })).filter((a) => a.name && a.browser_download_url));
      if (!(assets.macos || assets.windows || assets.linux)) { render({ kind: "empty", assets }); return; }
      render({ kind: "ready", tag, assets });
    })
    .catch(() => render({ kind: "error" }));
})();
