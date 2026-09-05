/* ============================================================
   site.js — 全站共通：ベルメニュー・ページ遷移の幕・シェル注入
   P0(index.html) は既存の #bellFig をボタンに使う。
   P1〜P5 は body.site-page でこのスクリプトが左ベルとメニューを挿入する。
============================================================ */
(() => {
  "use strict";
  const PAGES = [
    { file: "index.html",  label: "入口",           sub: "ホーム" },
    { file: "story.html",  label: "物語",           sub: "旧校舎の記録" },
    { file: "game.html",   label: "本編",           sub: "計時・ヒント（予定）" },
    { file: "venue.html",  label: "会場案内",       sub: "開催日時・場所" },
    { file: "staff.html",  label: "スタッフ",       sub: "一年三組" },
    { file: "end.html",    label: "結末",           sub: "成功／失敗の演出" }
  ];
  const cur = (location.pathname.split("/").pop() || "index.html");

  /* ---------- 部品の注入 ---------- */
  const transHTML = '<div id="trans" aria-hidden="true"><i></i><i></i><i></i><b>The Last Bell</b></div>';
  function menuHTML() {
    const items = PAGES.map(p => {
      const here = (p.file === cur) ? ' class="here"' : '';
      return '<a data-nav="' + p.file + '"' + here + '>' + p.label + '<small>' + p.sub + '</small></a>';
    }).join("");
    return '<div id="siteMenu">' +
      '<div class="mask" data-close></div>' +
      '<nav><div class="m-title">— 目 次 —</div>' + items +
      '<div class="m-close" data-close>閉じる ✕</div></nav></div>';
  }
  const BELL_SVG = '<svg viewBox="0 0 220 150" preserveAspectRatio="xMidYMid meet">' +
    '<defs><radialGradient id="bellGrad2" cx=".5" cy=".3" r=".8">' +
    '<stop offset="0" stop-color="#9fb0b6"/><stop offset=".55" stop-color="#5c6b73"/><stop offset="1" stop-color="#2c3740"/>' +
    '</radialGradient></defs>' +
    '<rect x="84" y="4" width="52" height="11" rx="3" fill="#39454d"/>' +
    '<rect x="104" y="11" width="12" height="9" fill="#2b343c"/>' +
    '<g class="swing2">' +
    '<path d="M110,30 C70,30 48,64 48,104 L172,104 C172,64 150,30 110,30 Z" fill="url(#bellGrad2)"/>' +
    '<ellipse cx="110" cy="104" rx="64" ry="9" fill="#3c4850"/>' +
    '<path d="M66,100 C72,58 92,38 110,38 C121,38 127,47 123,57 C101,52 86,76 79,100 Z" fill="rgba(10,14,18,.34)"/>' +
    '</g></svg>';

  if (!document.getElementById("trans")) {
    document.body.insertAdjacentHTML("beforeend", transHTML);
  }
  if (!document.getElementById("siteMenu")) {
    document.body.insertAdjacentHTML("beforeend", menuHTML());
  }
  /* P1〜P5 には左ベルを新規作成。P0 は既存 #bellFig を使うので何もしない */
  const hasOwnBell = !!document.getElementById("bellFig");
  if (!hasOwnBell) {
    const b = document.createElement("button");
    b.id = "siteBell";
    b.type = "button";
    b.setAttribute("aria-label", "メニュー");
    b.title = "メニュー";
    b.innerHTML = BELL_SVG;
    document.body.appendChild(b);
  }
  /* 初見向け：ベル（＝メニュー）の下に小さな木札を下げる。
     一度でもメニューを開いたセッションではもう出さない */
  function ensureBellTag() {
    const bell = document.getElementById("bellFig") || document.getElementById("siteBell");
    if (!bell || bell.querySelector(".bellTag")) return;
    const tag = document.createElement("span");
    tag.className = "bellTag";
    tag.textContent = "メニュー";
    bell.appendChild(tag);
  }
  ensureBellTag();
  try {
    if (sessionStorage.getItem("ksBellHint") === "1") document.body.classList.add("hint-off");
  } catch (e) {}

  /* ---------- 開閉 ---------- */
  const menu = document.getElementById("siteMenu");
  function setHintDone() {
    try { sessionStorage.setItem("ksBellHint", "1"); } catch (e) {}
    document.body.classList.add("hint-off");   /* 木札を消す（もう分かっている） */
  }
  function openMenu() {
    menu.classList.add("open");
    document.body.classList.add("bell-open", "menu-on");
    setHintDone();
  }
  function closeMenu() {
    menu.classList.remove("open");
    document.body.classList.remove("bell-open", "menu-on");
  }
  function toggleMenu() {
    menu.classList.contains("open") ? closeMenu() : openMenu();
  }
  window.SiteMenu = { open: openMenu, close: closeMenu, toggle: toggleMenu };

  /* ベルをクリックして開閉。P0 は既存 #bellFig を script.js が担当するので、
     ここではサイト共通の鐘（新規注入したもの）だけにバインドする（二重発火防止） */
  const bellBtn = document.getElementById("siteBell");
  if (bellBtn && !hasOwnBell) bellBtn.addEventListener("click", toggleMenu);
  document.addEventListener("click", (e) => {
    const close = e.target.closest("[data-close]");
    if (close) { closeMenu(); return; }
    const nav = e.target.closest("[data-nav]");
    if (nav) { go(nav.getAttribute("data-nav")); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) closeMenu();
  });

  /* 遷移で入ってきたページは、幕が閉じた状態から開く */
  function playEnter() {
    let incoming = false;
    try { incoming = sessionStorage.getItem("ks-in") === "1"; } catch (e) {}
    if (!incoming) return;
    try { sessionStorage.removeItem("ks-in"); } catch (e) {}
    document.body.classList.add("tenter");
    setTimeout(() => document.body.classList.add("arrive"), 130);
    setTimeout(() => document.body.classList.remove("tenter", "arrive"), 900);
  }
  playEnter();

  /* ---------- 遷移：左右から血幕が合わさってから移動 ---------- */
  function go(file) {
    if (!file || file === cur) { closeMenu(); return; }
    closeMenu();
    document.body.classList.add("leaving");
    try { sessionStorage.setItem("ks-in", "1"); } catch (e) {}
    setTimeout(() => { location.href = file; }, 840);
  }
})();