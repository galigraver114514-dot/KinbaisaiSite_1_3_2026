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
    '<g class="clap"><line x1="110" y1="104" x2="126" y2="126" stroke="#232c33" stroke-width="4.5"/><circle cx="130" cy="133" r="8.5" fill="#232c33"/></g>' +
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
/* ============================================================
   site.js 追補：サブページ共通の狐火＋左ベル（収納⇄接近で降臨）
   P0(index.html) は style.css / script.js の独自狐火を使うので除外。
   ルール：ベルは普段上に収納。蒼い狐火（カーソル）が近づくと
   ベルが降りてきて、狐火はベルの方へ吸い寄せられる。離れると収納。
============================================================ */
(function () {
  if (!document.body || !document.body.classList.contains("site-page")) return;
  if (document.getElementById("fxLayer")) return;
  const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const coarse  = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
  const bell = document.getElementById("siteBell");
  if (!bell) return;

  const wrap = document.createElement("div");
  wrap.id = "fxLayer";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = '<div id="fxHalo" class="foxfire"></div><div id="fxCore" class="foxfire"></div>';
  document.body.appendChild(wrap);
  const core = document.getElementById("fxCore");
  const halo = document.getElementById("fxHalo");

  const DOTS = 8, dots = [];
  for (let i = 0; i < DOTS; i++) {
    const d = document.createElement("i");
    d.className = "trailDot";
    const s = (11 - i) + "px";
    d.style.width = s; d.style.height = s;
    d.style.opacity = String(Math.max(0.5 - i * 0.05, 0.06));
    wrap.appendChild(d);
    dots.push({ el: d, x: 0, y: 0 });
  }

  const LURE_R = 260;
  let px = innerWidth * 0.78, py = innerHeight * 0.32;
  let cx = px, cy = py, hx = px, hy = py;
  let up = false, awaySince = 0, intro = true;
  let bTZ = 0, bTX = 0;                    /* ベルがマウスに顔を向ける角度 */
  const t0 = performance.now();
  /* ホバー中の操作要素を狐火が「包む」（ベルより優先） */
  const INTERACT = "a,button,input,select,textarea,#siteBell,#planSvg .room,#modeRail button";
  let hoverEl = null, foxOn = null, ringA = 0;

  function bellCenter() {
    const r = bell.getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.6 };
  }
  function setBell(on) {
    up = on;
    bell.classList.toggle("b-retract", !on);
    bell.classList.toggle("b-up", on);
    bell.classList.remove("b-intro");
    /* 変形はインラインで確定させる（CSS優先度に依存しない） */
    bell.style.transition = "transform .5s cubic-bezier(.55,0,.2,1), opacity .3s ease";
    bell.style.transform = on ? "none" : "translateY(-88%)";
    bell.style.opacity = on ? "1" : "0";
    bell.style.pointerEvents = on ? "" : "none";
  }
  /* ---- 鳴らす（WebAudioで「ちりーん」を合成。ファイル不要） ---- */
  let actx = null;
  function bTone(f, dur, vol, delay) {
    if (!actx) return;
    try {
      const t = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function playBell() {
    if (reduced) return;
    try {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
      }
      if (actx.state === "suspended") actx.resume();
      const f = 1520 + Math.random() * 200;
      bTone(f, 0.9, 0.13, 0);
      bTone(f * 1.335, 0.55, 0.06, 0.03);
      bTone(f * 0.5, 0.75, 0.045, 0.08);
    } catch (e) {}
  }
  bell.addEventListener("click", function () {
    bell.classList.remove("rung");
    void bell.offsetWidth;
    bell.classList.add("rung");
    setTimeout(function () { bell.classList.remove("rung"); }, 960);
    playBell();
  });
  function step(now) {
    const a = bellCenter();
    /* 序盤1.4秒：狐火をベルの隣に置いて「ベルが降りる」のを見せる */
    if (intro) {
      if (now - t0 < 1400) {
        px = a.x - 96; py = a.y + 8;
        if (!up) setBell(true);
      } else intro = false;
    }
    /* --- ホバー中の操作要素：狐火で「包む」（他要素の時はベルを引かない） --- */
    let wrapT = null;
    if (hoverEl && !hoverEl.closest("#siteMenu")) wrapT = hoverEl;
    if (foxOn !== wrapT) {
      if (foxOn) foxOn.classList.remove("foxglow");
      foxOn = wrapT;
      if (foxOn) foxOn.classList.add("foxglow");
    }
    document.body.classList.toggle("fxwrap", !!wrapT);
    const wrapOther = !!(wrapT && wrapT !== bell);
    const d = Math.hypot(px - a.x, py - a.y);
    let lure = 0;
    if (coarse || reduced) {
      if (!up) setBell(true);
      px = innerWidth * 0.5; py = innerHeight * 0.55;
    } else if (wrapOther) {
      /* ベル以外を包んでいる間はベルの誘引を抑え、そのまま収納へ */
      awaySince = awaySince || now;
      if (now - awaySince > 620) setBell(false);
      else lure = 0.05;
    } else {
      if (d < LURE_R) {
        awaySince = 0;
        if (!up) setBell(true);
        lure = Math.max(0, 1 - Math.min(d, LURE_R) / LURE_R);
      } else if (up) {
        awaySince = awaySince || now;
        if (now - awaySince > 620) setBell(false);
        else lure = 0.05;
      }
    }
    bell.classList.toggle("lure", up && lure > 0.05 && !wrapOther);
    let tx = px, ty = py;
    if (lure > 0.05) { tx = px + (a.x - px) * lure * 0.6; ty = py + (a.y - py) * lure * 0.6; }
    cx += (tx - cx) * 0.17; cy += (ty - cy) * 0.17;
    hx += (px - hx) * 0.055; hy += (py - hy) * 0.055;
    core.style.left = cx + "px"; core.style.top = cy + "px";
    halo.style.left = hx + "px"; halo.style.top = hy + "px";
    for (let i = 0; i < DOTS; i++) {
      let gx = cx, gy = cy;
      if (wrapT) {
        /* 要素の周りを蒼火が輪になって遊ぶ */
        const wb = wrapT.getBoundingClientRect();
        const wcx = wb.left + wb.width / 2, wcy = wb.top + wb.height / 2;
        const rx = wb.width / 2 + 18, ry = wb.height / 2 + 14;
        ringA += 0.05;
        const ang = (i / DOTS) * Math.PI * 2 + ringA;
        gx = wcx + Math.cos(ang) * rx;
        gy = wcy + Math.sin(ang) * ry;
      } else if (lure > 0.05) {
        const t = (DOTS - i) / DOTS;
        gx = cx + (a.x - cx) * t * lure;
        gy = cy + (a.y - cy) * t * lure;
      }
      const k = 0.16 + i * 0.035;
      dots[i].x += (gx - dots[i].x) * k;
      dots[i].y += (gy - dots[i].y) * k;
      dots[i].el.style.left = dots[i].x + "px";
      dots[i].el.style.top  = dots[i].y + "px";
    }
    /* ベルがマウスへ顔を向ける（吸着の傾き。P0 と同じ二次減衰） */
    const rb = bell.getBoundingClientRect();
    const bpx = rb.left + rb.width / 2, bpy = rb.top + rb.height * 0.12;
    const ddx = px - bpx, ddy = py - bpy, db = Math.hypot(ddx, ddy);
    const RR = Math.max(380, Math.min(innerWidth * 0.5, 620));
    const f2 = up ? (1 - Math.min(1, db / RR)) * (1 - Math.min(1, db / RR)) : 0;
    const gZ = Math.max(-1, Math.min(1, ddx / (RR * 0.5))) * -22 * f2;
    const gX = Math.max(-1, Math.min(1, ddy / (RR * 0.5))) * 5 * f2;
    bTZ += (gZ - bTZ) * 0.2; bTX += (gX - bTX) * 0.2;
    const bsvg = bell.querySelector("svg");
    if (bsvg && (Math.abs(bTZ) > 0.05 || Math.abs(bTX) > 0.05)) {
      bsvg.style.transform = "perspective(900px) rotateX(" + bTX.toFixed(2) + "deg) rotateZ(" + bTZ.toFixed(2) + "deg)";
    } else if (bsvg && bsvg.style.transform) bsvg.style.transform = "";
    requestAnimationFrame(step);
  }
  window.addEventListener("mousemove", function (e) {
    px = e.clientX; py = e.clientY;
    if (intro) intro = false;
    var t = e.target;
    var el = null;
    if (t && t.closest) {
      try { el = t.closest(INTERACT); } catch (err) { el = null; }
      if (el && el.closest("#siteMenu")) el = null;
    }
    hoverEl = el;
  }, { passive: true });

  if (coarse || reduced) {
    setBell(true);
    core.style.left = px + "px"; core.style.top = py + "px";
    halo.style.left = hx + "px"; halo.style.top = hy + "px";
    dots.forEach(function (d) { d.x = px; d.y = py; d.el.style.left = px + "px"; d.el.style.top = py + "px"; });
  } else {
    requestAnimationFrame(step);
  }
})();
