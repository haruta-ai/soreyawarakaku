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
    privateApproach: "empathy",
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
    const renderers = { home: renderHome, category: renderCategory, audience: renderAudience, tone: renderTone, settings: renderSettings, result: renderResult, search: renderSearch, favorites: renderFavorites, history: renderHistory };
    screen.innerHTML = (renderers[state.view] || renderHome)();
    if (backButton) backButton.hidden = ["home", "search", "favorites", "history"].includes(state.view);
    bottomNav.querySelectorAll("button").forEach(button => button.classList.toggle("is-active", button.dataset.nav === state.view || (button.dataset.nav === "home" && !["search", "favorites", "history"].includes(state.view))));
    bindScreenEvents();
  }

  function renderHome() {
    const recent = state.saved.history.slice(0, 2);
    const quickCategories = DATA.categories.slice(0, 6);
    const otherCategories = DATA.categories.slice(6);
    return `<div class="hero"><h1 class="hero-title">言いにくいを、言いやすく</h1><p class="hero-subtitle">本音の角を、すこし丸く</p></div>
      <div class="section-heading"><h2>今、近い場面は？</h2><span>選ぶだけ</span></div>
      <div class="category-grid">${quickCategories.map(categoryCard).join("")}</div>
      <details class="more-choices"><summary>ほかの場面を見る <span>${otherCategories.length}件</span></summary><div class="category-grid">${otherCategories.map(categoryCard).join("")}</div></details>
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
    const primary = ["boss", "colleague", "family", "friend"];
    const rest = Object.keys(DATA.audiences).filter(id => !primary.includes(id));
    return `${steps(2)}<p class="eyebrow">STEP 2 / 3</p><h1>誰に伝える？</h1><p class="selection-summary">「${escapeHtml(state.item.honest)}」</p><div class="chip-grid chip-grid-primary">${primary.map(id => audienceChip(id)).join("")}</div><details class="more-choices"><summary>ほかの相手を見る <span>${rest.length}件</span></summary><div class="chip-grid">${rest.map(id => audienceChip(id)).join("")}</div></details>`;
  }

  function renderTone() {
    const primary = ["soft", "polite", "firm"];
    const rest = Object.keys(DATA.tones).filter(id => !primary.includes(id));
    const isPrivate = DATA.audiences[state.audience].style === "casual";
    const approach = isPrivate ? `<fieldset class="private-approach"><legend>相手への向き合い方</legend><button class="approach-chip ${state.privateApproach === "empathy" ? "is-selected" : ""}" type="button" data-private-approach="empathy" aria-pressed="${state.privateApproach === "empathy"}">共感を先に</button><button class="approach-chip ${state.privateApproach === "solve" ? "is-selected" : ""}" type="button" data-private-approach="solve" aria-pressed="${state.privateApproach === "solve"}">一緒に整理する</button></fieldset>` : "";
    return `${steps(3)}<p class="eyebrow">STEP 3 / 3</p><h1>どんな温度で？</h1><p class="selection-summary">${escapeHtml(DATA.audiences[state.audience].label)}へ：「${escapeHtml(state.item.honest)}」</p>${approach}<div class="chip-grid tone-grid">${primary.map(id => toneChip(id)).join("")}</div><details class="more-choices"><summary>ほかの温度を選ぶ <span>${rest.length}件</span></summary><div class="chip-grid">${rest.map(id => toneChip(id)).join("")}</div></details>`;
  }

  function audienceChip(id) { return `<button class="chip" type="button" data-audience="${id}">${escapeHtml(DATA.audiences[id].label)}</button>`; }
  function toneChip(id) { return `<button class="chip tone-${id}" type="button" data-tone="${id}">${escapeHtml(DATA.tones[id].label)}</button>`; }

  function renderSettings() {
    return `<p class="eyebrow">必要なときだけ調整</p><h1>相手と温度を変える</h1><p class="selection-summary">本音：「${escapeHtml(state.item.honest)}」</p><h2 class="setting-title">誰に伝える？</h2><div class="chip-grid">${Object.entries(DATA.audiences).map(([id, audience]) => `<button class="chip ${state.audience === id ? "is-selected" : ""}" type="button" data-set-audience="${id}" aria-pressed="${state.audience === id}">${escapeHtml(audience.label)}</button>`).join("")}</div><h2 class="setting-title">どんな温度で？</h2><div class="chip-grid">${Object.entries(DATA.tones).map(([id, tone]) => `<button class="chip ${state.tone === id ? "is-selected" : ""}" type="button" data-set-tone="${id}" aria-pressed="${state.tone === id}">${escapeHtml(tone.label)}</button>`).join("")}</div><button class="primary-button" type="button" data-apply-settings>この条件で3案を見る</button>`;
  }

  function sourceToneFor(audience, toneId) {
    if (audience.style === "upward" || audience.style === "external") {
      if (toneId === "firm") return "polite";
      if (toneId === "humor") return "soft";
    }
    if (audience.style === "downward" && toneId === "polite") return "soft";
    if (audience.style === "casual" && toneId === "polite") return "soft";
    return toneId;
  }

  function downwardize(text) {
    return text
      .replaceAll("いただけますでしょうか", "もらえますか")
      .replaceAll("いただけますか", "もらえますか")
      .replaceAll("いただけると助かります", "もらえると助かります")
      .replaceAll("お願いいたします", "お願いします")
      .replaceAll("ご確認いただけます", "確認してもらえます")
      .replaceAll("ご共有いただけます", "共有してもらえます")
      .replaceAll("ご教示いただけます", "教えてもらえます")
      .replaceAll("もう一度確認をお願いします。", "もう一度確認してください。")
      .replaceAll("気をつけてもらえますか。", "気をつけてください。")
      .replaceAll("対応方法を一緒に確認したいです。", "対応方法を一緒に確認しましょう。")
      .replaceAll("一緒に進め方を整理してからお願いしたいです。", "進め方を整理してから依頼してください。")
      .replaceAll("教えてもらえると助かります。", "教えてください。")
      .replaceAll("対応してもらえると助かります。", "対応してください。");
  }

  function casualize(text) {
    return downwardize(text)
      // 家族・友人には敬語の「変換結果」を見せない。ここでは丁寧語を
      // 単に語尾だけ削るのではなく、日常会話で使う言い方へ寄せる。
      .replaceAll("恐れ入りますが、", "")
      .replaceAll("お手数ですが、", "")
      .replaceAll("恐縮ですが、", "")
      .replaceAll("差し支えなければ、", "できれば、")
      .replaceAll("可能であれば、", "できれば、")
      .replaceAll("いかがでしょうか。", "どう？")
      .replaceAll("いかがでしょうか", "どう？")
      .replaceAll("可能でしょうか。", "できそう？")
      .replaceAll("可能でしょうか", "できそう？")
      .replaceAll("いただけますでしょうか", "もらえる？")
      .replaceAll("いただけますか", "もらえる？")
      .replaceAll("いただけると助かります", "もらえると助かる")
      .replaceAll("してもらえますか", "してもらえる？")
      .replaceAll("教えてもらえますか", "教えてもらえる？")
      .replaceAll("できますか", "できる？")
      .replaceAll("お願いいたします", "お願い")
      .replaceAll("お願いします", "お願いね")
      .replaceAll("申し訳ございません", "ごめん")
      .replaceAll("申し訳ありません", "ごめん")
      .replaceAll("すみません", "ごめん")
      .replaceAll("見送らせてください。", "見送るね。")
      .replaceAll("お引き受けできません。", "引き受けられないんだ。")
      .replaceAll("対応いたしかねます。", "今回は難しいんだ。")
      .replaceAll("お受けすることが難しいです。", "引き受けるのは難しいんだ。")
      .replaceAll("させてください。", "させてほしい。")
      .replaceAll("お待ちください。", "待ってね。")
      .replaceAll("してください。", "してね。")
      .replaceAll("してください", "してね")
      .replaceAll("ください。", "ね。")
      .replaceAll("ください", "ね")
      .replaceAll("でしょうか。", "？")
      .replaceAll("でしょうか", "？")
      .replaceAll("ますか。", "？")
      .replaceAll("ますか", "？")
      .replaceAll("できません。", "できないんだ。")
      .replaceAll("できません", "できない")
      .replaceAll("できると", "できるなら")
      .replaceAll("難しいです。", "難しいんだ。")
      .replaceAll("ほしいです。", "ほしいんだ。")
      .replaceAll("うれしいです。", "うれしいんだ。")
      .replaceAll("大切です。", "大切なんだ。")
      .replaceAll("大丈夫です。", "大丈夫だよ。")
      .replaceAll("必要です。", "必要だよ。")
      .replaceAll("ありません。", "ないんだ。")
      .replaceAll("ございます。", "あるよ。")
      .replaceAll("いたします。", "するね。")
      .replaceAll("します。", "するね。")
      .replaceAll("です。", "だよ。")
      .replaceAll("申し上げます", "伝えるね");
  }

  // 家族・恋人・友人にだけ使う、最初から日常会話として書いた文章。
  // ビジネス文を敬語だけ外す方式では、自然な会話にならないため分けている。
  const CASUAL_RESULTS = {
    d1: ["今回は無理なんだ。", "今は引き受けられないよ。", "今回は見送らせて。"],
    d2: ["そのやり方だと、私にはできないんだ。", "別の方法なら考えられるよ。", "今回はその希望には応えられない。"],
    d3: ["今ちょっと手が回ってないんだ。少し待ってもらえる？", "少し時間があればできそう。", "何を優先するか、一緒に決めたい。"],
    r1: ["今どんな感じ？", "進み具合だけ教えて。", "いつ頃になりそうか分かる？"],
    r2: ["できれば少し急いでもらえる？", "これ、先にやってもらえると助かる。", "いつ頃できそうか教えて。"],
    r3: ["見たら一言返してほしい。", "受け取ったって分かると安心する。", "時間あるときでいいから返事ちょうだい。"],
    c1: ["前にも話したことだから、もう一度気をつけてほしい。", "同じことが続くと困るんだ。", "次からどうするか一緒に決めたい。"],
    c2: ["一度ちゃんと見直してから進めてほしい。", "全体をもう一回確認してもらえる？", "次は確認してから出してね。"],
    c3: ["進める前に一度話してほしい。", "次からは先に教えてね。", "大事なところは一緒に確認してから決めたい。"],
    o1: ["ごめん、ちょっと意味が分からなかった。もう少し教えて？", "具体的に言ってもらえると分かりやすい。", "どういうつもりか聞かせて。"],
    o2: ["私は少し違うと思ってる。", "別の見方もあるんじゃないかな。", "そこは私の考えと違うんだ。"],
    o3: ["そのやり方、私はちょっと心配。", "別の進め方のほうがよさそう。", "一回やり方を見直したい。"],
    a1: ["忘れてた。ごめん、すぐやるね。", "確認が抜けてた。本当にごめん。", "私のミスだね。今から直す。"],
    a2: ["遅くなってごめん。今からやるね。", "待たせちゃったね。ごめん。", "予定より遅れちゃった。ちゃんと対応する。"],
    a3: ["嫌な思いをさせたならごめん。", "迷惑をかけたことは分かってる。ごめん。", "説明が足りなかったね。ごめん。"],
    q1: ["これ、お願いしてもいい？", "手が空いたときにやってもらえる？", "できそうなら、この件お願いしたい。"],
    q2: ["少し手伝ってもらえる？", "一人だと大変で、力を貸してほしい。", "この部分だけ一緒にやってほしい。"],
    q3: ["分かる範囲で予定を教えて。", "空いてる時間をいくつか教えてほしい。", "これからの予定、分かったら共有して。"],
    g1: ["今の言い方、ちょっと傷ついた。", "もう少しやわらかく言ってほしい。", "その言葉は、私は気持ちよく受け取れなかった。"],
    g2: ["同じことが続いてて、正直困ってる。", "これ以上続くとつらいから、変えてほしい。", "そろそろやり方を見直してほしい。"],
    g3: ["今の説明だけじゃ、まだ納得できない。", "もう少し理由を教えてほしい。", "どうしてそうなったのか聞きたい。"],
    s1: ["予定、変えてもらえる？", "別の日にできると助かる。", "日程をもう一回相談したい。"],
    s2: ["ごめん、今日は行けなくなっちゃった。", "急で悪いんだけど、今日は無理そう。", "別の日にしてもらえる？"],
    s3: ["少し遅れそう。ごめん。", "着くのが少し遅くなる。分かったらまた連絡するね。", "先に始めてて。あとで追いつくね。"],
    i1: ["今回は行かないでおこうかな。", "誘ってくれてうれしいけど、今回はやめておくね。", "今はあまり行く気分じゃないんだ。"],
    i2: ["今回はちょっと気が乗らないから、やめておく。", "今は参加する余裕がなさそう。", "また別のときに誘って。"],
    i3: ["その日は自分の時間にしたいんだ。", "予定はないけど、今回はゆっくりしたい。", "今回は行かないでおくね。"],
    l1: ["返事忘れてた。ごめん。", "返したつもりになってた。遅くなってごめん。", "待たせちゃったね。今から返す。"],
    l2: ["どう返すか迷ってて、遅くなった。ごめん。", "少し考える時間がほしかった。", "すぐ返せなくてごめん。"],
    l3: ["遅くなったけど、今から返してもいい？", "時間が空いちゃってごめん。", "今さらだけど、気になってたから連絡した。"],
    w1: ["これ、そっちの担当だと思ってたんだけど、違う？", "誰がやるか、一回確認したい。", "役割分担だと、そっちの範囲だったと思う。"],
    w2: ["何を目指すか、もう少し教えてほしい。", "どう進めるか整理してから頼んでほしい。", "判断に必要なことも一緒に教えて。"],
    w3: ["その締切だと、ちゃんと仕上げるのは難しい。", "期限か量を調整できない？", "無理のない日程を一緒に決めたい。"],
    h1: ["使ったもの、元に戻してね。", "あとで一緒に片づけよう。", "気づいたときに片づけてもらえるとうれしい。"],
    h2: ["今、少しだけ話を聞いてほしい。", "解決しなくていいから、まず聞いて。", "大事な話だから、時間をつくってほしい。"],
    h3: ["今は一人で落ち着きたい。", "今は話す余裕がないから、少し待って。", "気持ちが落ち着いたら、こっちから話すね。"],
    n1: ["もう少し安くできないかな。", "条件を変えて、少し抑えられない？", "続けるつもりだから、値段を相談したい。"],
    n2: ["その条件のままだと、引き受けるのは難しい。", "何を優先するか相談したい。", "お互い進めやすい条件を考え直したい。"],
    n3: ["こっちの希望も入れてほしい。", "お互いの条件を一つずつ整理したい。", "ここを受け入れてもらえたら、ほかは柔軟に考えるよ。"]
  };

  // 同じ本音でも、ビジネス上の立場で会話の出発点を変える。
  // 上司=判断を仰ぐ / 同僚=協力して決める / 部下=状況と次の行動を示す /
  // 取引先=当方の条件として丁寧に伝える、という役割に固定する。
  const BUSINESS_FRAMES = {
    upward: ["ご相談なのですが、", "優先順位を確認したく、", "ご判断を仰ぎたく、"],
    peer: ["相談なんだけど、", "一緒に進めやすくしたいから、", "認識を合わせたいので、"],
    downward: ["状況を整理すると、", "次に進むために、", "期限に間に合わせるため、"],
    external: ["恐れ入りますが、", "当方で確認したところ、", "円滑に進めるため、ご相談があり、"]
  };

  function businessFrame(audience, index) {
    return (BUSINESS_FRAMES[audience.style] || audience.frames)[index] || "";
  }

  function privateFrame(audienceId, category, index, toneId, approach) {
    const emotional = ["home", "anger", "caution", "object"].includes(category);
    const frames = {
      family: emotional
        ? ["家のことだから、", "お互い気持ちよくいたいから、", "先に言っておくね、"]
        : ["今ちょっと話したいんだけど、", "気持ちだけ聞いてほしいんだけど、", "先に言っておくね、"],
      partner: emotional
        ? ["聞いてほしいんだけど、", "ふたりで気持ちよくいたいから、", "責めたいわけじゃないんだけど、"]
        : ["ちゃんと伝えておきたいんだけど、", "無理をしたくないから、", "先に言っておくね、"],
      friend: ["正直に言うと、", "ちょっと相談なんだけど、", "先に言っておくね、"]
    };
    if (approach === "solve") {
      const solve = { family: ["今のことを整理したいんだけど、", "次どうするか決めたいから、", "先に言っておくね、"], partner: ["落ち着いて話したいんだけど、", "ふたりでどうするか決めたいから、", "先に言っておくね、"], friend: ["一緒に考えたいんだけど、", "どうするか相談したくて、", "先に言っておくね、"] };
      return solve[audienceId][index];
    }
    if (toneId === "firm") {
      const firm = { family: ["はっきり言うと、", "ここは大事だから、", "先に言っておくね、"], partner: ["はっきり伝えると、", "ここは大事だから、", "先に言っておくね、"], friend: ["率直に言うと、", "ここは大事だから、", "先に言っておくね、"] };
      return firm[audienceId][index];
    }
    return frames[audienceId][index];
  }

  function getResults(item, audienceId, toneId) {
    const audience = DATA.audiences[audienceId];
    if (audience.style === "casual" && CASUAL_RESULTS[item.id]) {
      return CASUAL_RESULTS[item.id].map((text, index) => `${privateFrame(audienceId, item.category, index, toneId, state.privateApproach)}${text}`);
    }
    const raw = item.variants[sourceToneFor(audience, toneId)];
    return raw.map((text, index) => {
      const wording = audience.style === "casual" ? casualize(text) : audience.style === "downward" ? downwardize(text) : text;
      return `${businessFrame(audience, index)}${wording}`;
    });
  }

  const FOLLOW_UPS = {
    decline: ["現状では対応できる範囲が限られています。", "今回はこの条件でのお引き受けは難しいため、別の進め方をご検討ください。"],
    remind: ["いつ頃までに見通しが立つか、目安を教えてください。", "予定を合わせたいので、難しい場合も一度ご連絡をお願いします。"],
    caution: ["同じことが起きないよう、次からの確認方法を一緒に決めたいです。", "この点が整うまで、次の工程には進めません。"],
    object: ["考え方は理解しました。そのうえで、気になっている点をもう一度確認させてください。", "この条件では合意が難しいため、別案を含めて考えたいです。"],
    apology: ["ご迷惑をおかけした点は受け止めています。対応と再発防止を進めます。", "まずは今回の対応を完了させ、次回に向けた確認方法も見直します。"],
    request: ["難しい点があれば、どこまでならできるか相談させてください。", "この件を進めるため、対応の可否と目安を教えてください。"],
    anger: ["責めたいわけではなく、同じことが続かないようにしたいです。", "この点は私にとって大切なので、対応方法を一緒に決めたいです。"],
    reschedule: ["影響を小さくするため、代わりの日程や進め方を相談させてください。", "この日程では難しいため、変更後の予定で合意してから進めたいです。"],
    invitation: ["誘ってくれたことはうれしいです。今回は見送りますが、また別の機会にお願いします。", "今回は参加できません。気を遣わず、皆さんで楽しんでください。"],
    lateReply: ["遅くなってしまいすみません。必要なことはきちんとお返事します。", "今後同じことがないよう、確認の仕方を見直します。"],
    work: ["役割と必要な情報を整理できれば、進め方を一緒に考えられます。", "担当範囲を確認したうえで、対応できる部分を決めましょう。"],
    home: ["お互いに気持ちよく過ごしたいから、どうしたら続けられるか一緒に考えたいです。", "この点は譲れないので、次からの約束を決めたいです。"],
    negotiate: ["こちらの事情も踏まえ、双方が進めやすい着地点を探したいです。", "この条件では合意が難しいため、条件が整ったら改めて相談させてください。"]
  };

  const DOWNWARD_FOLLOW_UPS = {
    decline: ["今の状況でできる範囲を整理して、改めて相談してください。", "この条件のままでは進められないので、別案を出してください。"],
    remind: ["いつ頃までにできそうか、目安を教えてください。", "難しい場合は、先に連絡してください。"],
    caution: ["同じことが起きないよう、次からの確認方法を決めましょう。", "この点が整うまで、次の工程には進めません。"],
    object: ["考え方は分かりました。気になる点をもう一度整理してください。", "この条件では進められないので、別案を考えてください。"],
    apology: ["対応と再発防止を進めてください。困ったら早めに相談してください。", "今回の対応を終えたら、次回に向けた確認方法も見直しましょう。"],
    request: ["難しい点があれば、どこまでならできるか教えてください。", "進めるために、対応の可否と目安を決めましょう。"],
    anger: ["責めたいわけではなく、同じことが続かないようにしたいです。", "この点は大切なので、次からの対応方法を決めましょう。"],
    reschedule: ["影響を小さくするため、代わりの日程を一緒に決めましょう。", "変更後の予定で合意してから進めてください。"],
    invitation: ["今回は見送ります。気を遣わず、皆さんで楽しんでください。", "今回は参加できません。次の予定は早めに教えてください。"],
    lateReply: ["必要なことはきちんと返してください。難しい時は先に一言ください。", "次からは確認の仕方を見直してください。"],
    work: ["役割と必要な情報を整理してから進めてください。", "担当範囲を確認して、対応できる部分を決めましょう。"],
    home: ["お互いに気持ちよく過ごすため、次からの約束を決めましょう。", "この点は大切なので、続けられる形を一緒に考えましょう。"],
    negotiate: ["こちらの事情も踏まえて、進めやすい着地点を考えましょう。", "この条件では進められないので、条件を整理してください。"]
  };

  const CASUAL_FOLLOW_UPS = {
    decline: ["今のままだと難しいから、できる範囲を一緒に考えたい。", "今回は引き受けられないよ。別の方法を考えよう。"],
    remind: ["いつ頃できそうか、目安だけ教えて。", "難しそうなら、先にひとことちょうだい。"],
    caution: ["同じことが続かないように、次からどうするか決めたい。", "ここが整うまでは、次には進めないよ。"],
    object: ["言いたいことは分かったよ。気になってるところをもう一度話したい。", "このままだと納得できないから、別の方法を考えたい。"],
    apology: ["迷惑をかけたことは分かってる。ちゃんと対応するね。", "今回を片づけたら、次から困らない方法も考えるね。"],
    request: ["難しいところがあったら、どこまでならできるか教えて。", "進めたいから、できそうかどうか教えてほしい。"],
    anger: ["責めたいわけじゃなくて、同じことが続かないようにしたい。", "私には大事なことだから、これからどうするか一緒に決めたい。"],
    reschedule: ["困らないように、代わりの日を一緒に決めたい。", "この日だと難しいから、予定を変えてから進めたい。"],
    invitation: ["誘ってくれてうれしい。でも今回は見送るね。", "今回は行けないから、気にせず楽しんでね。"],
    lateReply: ["遅くなってごめん。必要なことはちゃんと返すね。", "次からは確認の仕方を変えるね。"],
    work: ["役割と必要なことを整理してから進めたい。", "どこまで誰がやるか決めてから進めよう。"],
    home: ["お互い気持ちよく過ごしたいから、次からの約束を決めたい。", "ここは大事だから、続けられる形を一緒に考えたい。"],
    negotiate: ["こっちの事情もあるから、進めやすいところを一緒に探したい。", "この条件のままは難しいから、もう一度考えたい。"]
  };

  function followUpPrefix(audience, toneId, level) {
    const prefixes = {
      upward: {
        soft: ["ご事情は承知しました。ただ、", "恐れ入りますが、"],
        polite: ["ご事情は承知しております。ただ、", "恐縮ですが、"],
        firm: ["承知しました。ただ、", "恐縮ですが、"],
        distance: ["今後については、", "方針として、"],
        humor: ["ご事情は承知しました。ただ、", "恐れ入りますが、"]
      },
      external: {
        soft: ["ご状況は承知しております。ただ、", "恐れ入りますが、"],
        polite: ["ご事情は承知しております。ただ、", "恐縮ではございますが、"],
        firm: ["承知しております。ただ、", "恐れ入りますが、"],
        distance: ["今後につきましては、", "方針として、"],
        humor: ["ご状況は承知しております。ただ、", "恐れ入りますが、"]
      },
      downward: {
        soft: ["状況は分かりました。ただ、", "次に進めるため、"],
        polite: ["状況は分かりました。ただ、", "次に進めるため、"],
        firm: ["状況は分かりました。ただ、", "次に必要なのは、"],
        distance: ["今後は、", "方針として、"],
        humor: ["状況は分かりました。ただ、", "次に進めるため、"]
      },
      peer: {
        soft: ["そうなんですね。ただ、", "進め方を合わせたいので、"],
        polite: ["そうなんですね。ただ、", "進め方を合わせたいので、"],
        firm: ["理解しました。ただ、", "ここは決めておきたいので、"],
        distance: ["今後については、", "方針として、"],
        humor: ["なるほど。ただ、", "真面目な話をすると、"]
      },
      casual: {
        soft: ["そっか。でも、", "だからこそ、"],
        polite: ["そっか。でも、", "だからこそ、"],
        firm: ["分かった。でも、", "ここは大事だから、"],
        distance: ["これからは、", "私としては、"],
        humor: ["そうきたか。でも、", "冗談はここまでで、"]
      }
    };
    return prefixes[audience.style][toneId][level];
  }

  function getFollowUps(item, audienceId, toneId) {
    const audience = DATA.audiences[audienceId];
    const lines = audience.style === "casual" ? CASUAL_FOLLOW_UPS[item.category] || CASUAL_FOLLOW_UPS.request : audience.style === "downward" ? DOWNWARD_FOLLOW_UPS[item.category] || DOWNWARD_FOLLOW_UPS.request : FOLLOW_UPS[item.category] || FOLLOW_UPS.request;
    return lines.map((line, index) => {
      return `${followUpPrefix(audience, toneId, index)}${line}`;
    });
  }

  function renderResult() {
    const results = getResults(state.item, state.audience, state.tone);
    addHistory(results[0]);
    const followUps = getFollowUps(state.item, state.audience, state.tone);
    return `<div class="result-intro"><p class="eyebrow">このまま伝えられます</p><h1>まずは、このひと言。</h1><div class="honest-box"><small>本音</small><p>「${escapeHtml(state.item.honest)}」</p></div><p class="lead">${escapeHtml(DATA.audiences[state.audience].label)}へ・${escapeHtml(DATA.tones[state.tone].label)}</p><button class="adjust-button" type="button" data-adjust>相手・温度を変える</button></div><div class="result-list">${results.map((text, index) => resultCard(text, index)).join("")}</div><section class="conversation-path" aria-label="会話を続けるための返答"><p class="eyebrow">会話が続くなら</p><h2>次に返すひと言</h2><p class="lead">相手に押し返されたときの、次のひと言です。</p>${followUps.map((text, index) => followUpCard(text, index)).join("")}</section><button class="secondary-button" type="button" data-restart>別の言い方を探す</button>`;
  }

  function resultCard(text, index) {
    const key = favoriteKey(text);
    const active = state.saved.favorites.some(item => item.key === key);
    return `<article class="result-card"><small>案 ${index + 1}</small><p>${escapeHtml(text)}</p><button class="favorite-button" type="button" data-favorite="${index}" aria-label="お気に入り${active ? "から削除" : "に追加"}" aria-pressed="${active}">${active ? "♥" : "♡"}</button><button class="copy-button" type="button" data-copy="${index}">この言い方をコピー</button></article>`;
  }

  function followUpCard(text, index) {
    const title = index === 0 ? "2つ目の返し" : "3つ目の返し";
    return `<article class="followup-card"><small>${title}</small><p>${escapeHtml(text)}</p><button class="copy-button" type="button" data-copy-followup="${index}">この返しをコピー</button></article>`;
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
    screen.querySelectorAll("[data-item], [data-search-item]").forEach(button => button.addEventListener("click", () => navigate("audience", { item: DATA.items.find(item => item.id === (button.dataset.item || button.dataset.searchItem)), audience: null, tone: null, privateApproach: "empathy" })));
    screen.querySelectorAll("[data-adjust]").forEach(button => button.addEventListener("click", () => navigate("settings")));
    screen.querySelectorAll("[data-set-audience]").forEach(button => button.addEventListener("click", () => { state.audience = button.dataset.setAudience; render(); }));
    screen.querySelectorAll("[data-set-tone]").forEach(button => button.addEventListener("click", () => { state.tone = button.dataset.setTone; render(); }));
    screen.querySelectorAll("[data-private-approach]").forEach(button => button.addEventListener("click", () => { state.privateApproach = button.dataset.privateApproach; render(); }));
    screen.querySelectorAll("[data-apply-settings]").forEach(button => button.addEventListener("click", () => navigate("result")));
    screen.querySelectorAll("[data-audience]").forEach(button => button.addEventListener("click", () => navigate("tone", { audience: button.dataset.audience })));
    screen.querySelectorAll("[data-tone]").forEach(button => button.addEventListener("click", () => navigate("result", { tone: button.dataset.tone })));
    screen.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", () => copyText(getResults(state.item, state.audience, state.tone)[Number(button.dataset.copy)])));
    screen.querySelectorAll("[data-copy-followup]").forEach(button => button.addEventListener("click", () => copyText(getFollowUps(state.item, state.audience, state.tone)[Number(button.dataset.copyFollowup)])));
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
      results.querySelectorAll("[data-search-item]").forEach(button => button.addEventListener("click", () => navigate("audience", { item: DATA.items.find(item => item.id === button.dataset.searchItem), audience: null, tone: null, privateApproach: "empathy" })));
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
    const previous = { category: "home", audience: "category", tone: "audience", result: "tone", settings: "result" };
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
  let swipeStart = null;
  screen.addEventListener("touchstart", event => {
    const touch = event.changedTouches[0];
    if (!touch || touch.clientX > 32 || event.target.closest("input, textarea, select")) return;
    swipeStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  screen.addEventListener("touchend", event => {
    if (!swipeStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - swipeStart.x;
    const dy = Math.abs(touch.clientY - swipeStart.y);
    swipeStart = null;
    if (dx >= 72 && dy <= 48 && !["home", "search", "favorites", "history"].includes(state.view)) goBack();
  }, { passive: true });
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; installButton.hidden = false; });
  installButton.addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; installButton.hidden = true; });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  render();
  if (!state.saved.introSeen) showDialog(introDialog);
}());
