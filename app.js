/* それ、やわらかく。— 依存ライブラリなしの画面制御 */
(function () {
  "use strict";

  const DATA = window.YAWARAKA_DATA;
  const screen = document.getElementById("screen");
  const backButton = document.getElementById("backButton");
  const menuButton = document.getElementById("bottomMenuButton");
  const brandButton = document.getElementById("brandButton");
  const bottomNav = document.getElementById("bottomNav");
  const toast = document.getElementById("toast");
  const introDialog = document.getElementById("introDialog");
  const menuDialog = document.getElementById("menuDialog");
  const installButton = document.getElementById("installButton");
  const STORAGE_KEY = "yawarakaku.v1";
  let deferredInstallPrompt = null;
  let toastTimer = null;

  const state = {
    view: "home",
    category: null,
    item: null,
    audience: null,
    tone: null,
    query: "",
    saved: loadSaved()
  };

  function loadSaved() {
    const empty = { favorites: [], history: [], introSeen: false };
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.favorites) || !Array.isArray(parsed.history)) return empty;
      return { favorites: parsed.favorites.slice(0, 100), history: parsed.history.slice(0, 30), introSeen: Boolean(parsed.introSeen) };
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      return empty;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
      return true;
    } catch (error) {
      showToast("端末に保存できませんでした。空き容量をご確認ください");
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function navigate(view, options) {
    state.view = view;
    Object.assign(state, options || {});
    render();
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.getElementById("main").focus({ preventScroll: true }));
  }

  function render() {
    const renderers = { home: renderHome, category: renderCategory, settings: renderSettings, result: renderResult, search: renderSearch, favorites: renderFavorites, history: renderHistory };
    screen.innerHTML = (renderers[state.view] || renderHome)();
    if (backButton) backButton.hidden = ["home", "search", "favorites", "history"].includes(state.view);
    bottomNav.querySelectorAll("button").forEach(button => button.classList.toggle("is-active", button.dataset.nav === state.view || (button.dataset.nav === "home" && !["search", "favorites", "history"].includes(state.view))));
    bindScreenEvents();
  }

  function renderHome() {
    const recent = state.saved.history.slice(0, 2);
    return `<div class="hero"><p class="eyebrow">言いにくいを、言いやすく。</p><h1>本音の角を、<br>すこし丸く。</h1><p class="lead">言いたいことを選ぶだけ。大人の言い方を、すぐ3つ。</p></div>
      <div class="section-heading"><h2>どんな場面ですか？</h2><span>${DATA.items.length * Object.keys(DATA.tones).length * Object.keys(DATA.audiences).length}通り</span></div>
      <div class="category-grid">${DATA.categories.map(categoryCard).join("")}</div>
      ${recent.length ? `<div class="section-heading"><h2>最近使った言い方</h2></div><div class="list">${recent.map(savedCard).join("")}</div>` : ""}`;
  }

  function categoryCard(category) {
    return `<button class="choice-card" type="button" data-category="${category.id}" aria-label="${escapeHtml(category.label)}。${escapeHtml(category.description)}"><span class="choice-icon" aria-hidden="true">${category.icon}</span><span>${escapeHtml(category.label)}</span></button>`;
  }

  function steps(current) {
    return `<div class="steps" aria-label="4ステップ中${current}ステップ目">${[1,2,3,4].map(n => `<span class="step ${n <= current ? "is-done" : ""}"></span>`).join("")}</div>`;
  }

  function renderCategory() {
    const category = DATA.categories.find(c => c.id === state.category);
    const items = DATA.items.filter(item => item.category === state.category);
    return `<p class="eyebrow">本音を選ぶ</p><h1>${escapeHtml(category.label)}</h1><p class="lead">いちばん近い本音を選んでください。</p><div class="list" style="margin-top:22px">${items.map(item => `<button class="phrase-card" type="button" data-item="${item.id}"><span>「${escapeHtml(item.honest)}」</span><span class="chevron" aria-hidden="true">›</span></button>`).join("")}</div>`;
  }

  function renderAudience() {
    return `${steps(2)}<p class="eyebrow">STEP 2</p><h1>誰に伝えますか？</h1><p class="selection-summary">本音：「${escapeHtml(state.item.honest)}」</p><div class="chip-grid">${Object.entries(DATA.audiences).map(([id, audience]) => `<button class="chip" type="button" data-audience="${id}">${escapeHtml(audience.label)}</button>`).join("")}</div>`;
  }

  function renderTone() {
    return `${steps(3)}<p class="eyebrow">STEP 3</p><h1>どんな温度で？</h1><p class="selection-summary">${escapeHtml(DATA.audiences[state.audience].label)}へ：「${escapeHtml(state.item.honest)}」</p><div class="chip-grid">${Object.entries(DATA.tones).map(([id, tone]) => `<button class="chip" type="button" data-tone="${id}">${escapeHtml(tone.label)}</button>`).join("")}</div>`;
  }

  function renderSettings() {
    return `<p class="eyebrow">必要なときだけ調整</p><h1>相手と温度を変える</h1><p class="selection-summary">本音：「${escapeHtml(state.item.honest)}」</p><h2 class="setting-title">誰に伝える？</h2><div class="chip-grid">${Object.entries(DATA.audiences).map(([id, audience]) => `<button class="chip ${state.audience === id ? "is-selected" : ""}" type="button" data-set-audience="${id}" aria-pressed="${state.audience === id}">${escapeHtml(audience.label)}</button>`).join("")}</div><h2 class="setting-title">どんな温度で？</h2><div class="chip-grid">${Object.entries(DATA.tones).map(([id, tone]) => `<button class="chip ${state.tone === id ? "is-selected" : ""}" type="button" data-set-tone="${id}" aria-pressed="${state.tone === id}">${escapeHtml(tone.label)}</button>`).join("")}</div><button class="primary-button" type="button" data-apply-settings>この条件で3案を見る</button>`;
  }

  function getResults(item, audienceId, toneId) {
    const raw = item.variants[toneId];
    const tone = DATA.tones[toneId];
    const audience = DATA.audiences[audienceId];
    return raw.map((text, index) => {
      let result = text.replace("{lead}", tone.lead[index]).replace("{suffix}", audience.suffix);
      if ((audienceId === "client" || audienceId === "boss") && toneId === "soft" && index === 2) result += ` ${audience.suffix}`;
      return result;
    });
  }

  function renderResult() {
    const results = getResults(state.item, state.audience, state.tone);
    addHistory(results[0]);
    return `<div class="result-intro"><p class="eyebrow">すぐ使える3案</p><h1>角は取れました。<br>要点は残っています。</h1><div class="honest-box"><small>本音</small><p>「${escapeHtml(state.item.honest)}」</p></div><h2>大人の言い方</h2><p class="lead">${escapeHtml(DATA.audiences[state.audience].label)}へ・${escapeHtml(DATA.tones[state.tone].label)}</p><button class="adjust-button" type="button" data-adjust>相手・温度を変える</button></div><div class="result-list">${results.map((text, index) => resultCard(text, index)).join("")}</div><button class="secondary-button" type="button" data-restart>別の言い方を探す</button>`;
  }

  function resultCard(text, index) {
    const key = favoriteKey(text);
    const active = state.saved.favorites.some(item => item.key === key);
    return `<article class="result-card"><small>案 ${index + 1}</small><p>${escapeHtml(text)}</p><button class="favorite-button" type="button" data-favorite="${index}" aria-label="お気に入り${active ? "から削除" : "に追加"}" aria-pressed="${active}">${active ? "♥" : "♡"}</button><button class="copy-button" type="button" data-copy="${index}">この言い方をコピー</button></article>`;
  }

  function renderSearch() {
    const query = state.query.trim().toLowerCase();
    const matches = query ? DATA.items.filter(item => item.honest.toLowerCase().includes(query) || (DATA.categories.find(c => c.id === item.category) || {}).label.includes(query)) : DATA.items;
    return `<p class="eyebrow">すぐ見つける</p><h1>本音から検索</h1><div class="search-box"><input id="searchInput" type="search" value="${escapeHtml(state.query)}" placeholder="例：無理、遅れ、片づけ" aria-label="本音を検索" enterkeyhint="search"></div><div id="searchResults" class="list">${renderSearchResults(matches, query)}</div>`;
  }

  function renderSearchResults(matches, query) {
    if (!matches.length) return `<div class="empty"><span class="empty-mark" aria-hidden="true">…</span><h2>ぴったりの本音がありません</h2><p>言葉が少し遠出中です。短い言葉で探してみてください。</p></div>`;
    return matches.map(item => { const category = DATA.categories.find(c => c.id === item.category); return `<button class="phrase-card" type="button" data-search-item="${item.id}"><span><small class="saved-meta">${escapeHtml(category.label)}</small><br>「${escapeHtml(item.honest)}」</span><span class="chevron" aria-hidden="true">›</span></button>`; }).join("");
  }

  function renderFavorites() {
    return `<p class="eyebrow">また使える</p><h1>お気に入り</h1>${state.saved.favorites.length ? `<div class="list">${state.saved.favorites.map(savedCard).join("")}</div>` : emptyState("♡", "まだ、まっさらです", "気に入った言い方の♡を押すと、ここに並びます。")}`;
  }

  function renderHistory() {
    return `<p class="eyebrow">振り返る</p><h1>最近使った履歴</h1>${state.saved.history.length ? `<div class="list">${state.saved.history.map(savedCard).join("")}</div>` : emptyState("↺", "まだ履歴はありません", "最初のひと言を選ぶところから、どうぞ。")}`;
  }

  function emptyState(mark, title, body) { return `<div class="empty"><span class="empty-mark" aria-hidden="true">${mark}</span><h2>${title}</h2><p>${body}</p><button class="secondary-button" type="button" data-go-home>言い換えを始める</button></div>`; }

  function savedCard(item) {
    return `<article class="saved-card"><p>${escapeHtml(item.text)}</p><div class="saved-meta">${escapeHtml(item.meta || "保存した言い方")}</div><div class="saved-actions"><button type="button" data-copy-saved="${escapeHtml(item.key)}">コピー</button>${state.view === "favorites" ? `<button type="button" data-remove-favorite="${escapeHtml(item.key)}">削除</button>` : ""}</div></article>`;
  }

  function favoriteKey(text) { return hashString(text); }
  function hashString(text) { let hash = 0; for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0; return String(hash); }

  function savedRecord(text) {
    return { key: favoriteKey(text), text, meta: `${DATA.audiences[state.audience].label}へ・${DATA.tones[state.tone].label}`, at: Date.now() };
  }

  function addHistory(text) {
    const record = savedRecord(text);
    state.saved.history = [record, ...state.saved.history.filter(item => item.key !== record.key)].slice(0, 30);
    save();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea");
        area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
        document.body.appendChild(area); area.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
        area.remove();
      }
      showToast(["角を丸めて、コピーしました", "言葉の身だしなみ、整いました", "そのひと言、いい感じです"][Math.floor(Math.random() * 3)]);
    } catch (error) { showToast("コピーできませんでした。長押しで選択してください"); }
  }

  function bindScreenEvents() {
    screen.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => navigate("category", { category: button.dataset.category })));
    screen.querySelectorAll("[data-item], [data-search-item]").forEach(button => button.addEventListener("click", () => navigate("result", { item: DATA.items.find(item => item.id === (button.dataset.item || button.dataset.searchItem)), audience: "colleague", tone: "soft" })));
    screen.querySelectorAll("[data-adjust]").forEach(button => button.addEventListener("click", () => navigate("settings")));
    screen.querySelectorAll("[data-set-audience]").forEach(button => button.addEventListener("click", () => { state.audience = button.dataset.setAudience; render(); }));
    screen.querySelectorAll("[data-set-tone]").forEach(button => button.addEventListener("click", () => { state.tone = button.dataset.setTone; render(); }));
    screen.querySelectorAll("[data-apply-settings]").forEach(button => button.addEventListener("click", () => navigate("result")));
    screen.querySelectorAll("[data-audience]").forEach(button => button.addEventListener("click", () => navigate("tone", { audience: button.dataset.audience })));
    screen.querySelectorAll("[data-tone]").forEach(button => button.addEventListener("click", () => navigate("result", { tone: button.dataset.tone })));
    screen.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", () => copyText(getResults(state.item, state.audience, state.tone)[Number(button.dataset.copy)])));
    screen.querySelectorAll("[data-favorite]").forEach(button => button.addEventListener("click", () => toggleFavorite(getResults(state.item, state.audience, state.tone)[Number(button.dataset.favorite)], button)));
    screen.querySelectorAll("[data-copy-saved]").forEach(button => button.addEventListener("click", () => { const item = [...state.saved.favorites, ...state.saved.history].find(entry => entry.key === button.dataset.copySaved); if (item) copyText(item.text); }));
    screen.querySelectorAll("[data-remove-favorite]").forEach(button => button.addEventListener("click", () => { state.saved.favorites = state.saved.favorites.filter(item => item.key !== button.dataset.removeFavorite); save(); render(); showToast("お気に入りから外しました"); }));
    screen.querySelectorAll("[data-go-home], [data-restart]").forEach(button => button.addEventListener("click", () => navigate("home")));
    const input = document.getElementById("searchInput");
    if (input) input.addEventListener("input", () => {
      state.query = input.value;
      const q = state.query.trim().toLowerCase();
      const matches = q ? DATA.items.filter(item => item.honest.toLowerCase().includes(q) || (DATA.categories.find(c => c.id === item.category) || {}).label.includes(q)) : DATA.items;
      const results = document.getElementById("searchResults");
      results.innerHTML = renderSearchResults(matches, q);
      results.querySelectorAll("[data-search-item]").forEach(button => button.addEventListener("click", () => navigate("result", { item: DATA.items.find(item => item.id === button.dataset.searchItem), audience: "colleague", tone: "soft" })));
    });
  }

  function toggleFavorite(text, button) {
    const record = savedRecord(text);
    const exists = state.saved.favorites.some(item => item.key === record.key);
    state.saved.favorites = exists ? state.saved.favorites.filter(item => item.key !== record.key) : [record, ...state.saved.favorites].slice(0, 100);
    save();
    button.setAttribute("aria-pressed", String(!exists));
    button.setAttribute("aria-label", `お気に入り${exists ? "に追加" : "から削除"}`);
    button.textContent = exists ? "♡" : "♥";
    showToast(exists ? "お気に入りから外しました" : "あとで使えるように保存しました");
  }

  function goBack() {
    const previous = { category: "home", settings: "result", result: "category" };
    navigate(previous[state.view] || "home");
  }

  if (backButton) backButton.addEventListener("click", goBack);
  if (brandButton) brandButton.addEventListener("click", () => navigate("home"));
  menuButton.addEventListener("click", () => { menuButton.setAttribute("aria-expanded", "true"); showDialog(menuDialog); });
  menuDialog.addEventListener("close", () => menuButton.setAttribute("aria-expanded", "false"));
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => {
    const dialog = button.closest("dialog");
    if (dialog === introDialog) {
      state.saved.introSeen = true;
      save();
    }
    closeDialog(dialog);
  }));
  document.getElementById("startButton").addEventListener("click", () => { state.saved.introSeen = true; save(); closeDialog(introDialog); });
  document.getElementById("showIntroButton").addEventListener("click", () => { closeDialog(menuDialog); showDialog(introDialog); });
  document.getElementById("clearDataButton").addEventListener("click", () => { if (!window.confirm("お気に入りと履歴をすべて消しますか？")) return; state.saved = { favorites: [], history: [], introSeen: true }; save(); closeDialog(menuDialog); navigate("home"); showToast("保存データを消去しました"); });
  bottomNav.addEventListener("click", event => { const button = event.target.closest("button[data-nav]"); if (button) navigate(button.dataset.nav); });
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; installButton.hidden = false; });
  installButton.addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; installButton.hidden = true; });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  render();
  if (!state.saved.introSeen) showDialog(introDialog);
}());
