(() => {
  "use strict";
  /* ============================================================
     開幕シーケンス
  ============================================================ */
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse  = window.matchMedia("(pointer: coarse)").matches; /* スマホ/タブレット */
  /* タッチ端末（Bプラン）は開幕を約3割縮めて待たせない */
  const TS = coarse ? 0.72 : 1;

  /* ============================================================
     主タイトルを「深夜の掛け軸」に構成
     ・板面に The Last Bell（英語活字）＋天辺のベル
     ・右端に縦書き落款 時は満ちた（かな＝小・満＝朱）
     ・「呪」の朱印（CSS側の sealPaper）
  ============================================================ */
  const h1 = document.getElementById("mainTitle");
  const tateLine = document.getElementById("sideTate");

  function addCh(parent, cls, c, tBase) {
    const s = document.createElement("span");
    s.className = "ch " + cls;
    s.dataset.c = c;
    s.textContent = c;
    const d = reduced ? 0.03 : (tBase + (coarse ? 0.3 : 0)) * TS;
    s.style.setProperty("--d", d.toFixed(2) + "s");
    parent.appendChild(s);
  }
  /* 紙面の主文：THE LAST（金属体）／BELL（Rye・血朱）の二段構え */
  const tlA = document.createElement("span"); tlA.className = "tlA";
  const tlB = document.createElement("span"); tlB.className = "tlB";
  h1.appendChild(tlA); h1.appendChild(tlB);
  "THE LAST".split("").forEach((c, i) => {
    const cls = c === " " ? "cMain cSpace" : "cMain";
    addCh(tlA, cls, c, 1.35 + i * 0.1);
  });
  "BELL".split("").forEach((c, i) =>
    addCh(tlB, "cMain cBell", c, 2.2 + i * 0.14));
  /* 右端の落款：時は満ちた（灰＝かな・朱＝満）― 終業の鐘と制限時間を示す */
  const tateChars = [
    { c: "時", cls: "cPa", d: 2.85 },
    { c: "は", cls: "cPa", d: 2.97 },
    { c: "満", cls: "cEsc", d: 3.09 },
    { c: "ち", cls: "cPa", d: 3.3 },
    { c: "た", cls: "cPa", d: 3.5 }
  ];
  tateChars.forEach(t => addCh(tateLine, t.cls, t.c, t.d));

  /* 幕開け */
  function openCurtain() {
    document.getElementById("veil").classList.add("gone");
    document.querySelectorAll(".curtain").forEach(c => c.classList.add("rise"));
    const fh = document.querySelector(".festHead");
    if (fh) fh.classList.add("in");
  }
  if (reduced) openCurtain();
  else setTimeout(openCurtain, Math.round(350 * TS));

  setTimeout(() => document.getElementById("credit").classList.add("in"), reduced ? 50 : Math.round(6600 * TS));

  /* 登場アニメーション中はまだ現れていない物を操作できないようにする */
  function setLock(id, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("locked", on);
  }
  if (!reduced) {
    setLock("door", true); setLock("windchime", true); setLock("bellFig", true);
    const tBell = (coarse ? 1.6 : 1.8) * 1000;    /* 幕が開き終わる頃 */
    const tChim = (coarse ? 2.15 : 2.6) * 1000;   /* 掛け軸(紙)が開き切る頃 */
    const tDoor = (coarse ? 5.6 : 7.6) * 1000;    /* 扉が現れ終わる頃 */
    setTimeout(() => setLock("bellFig", false), tBell);
    setTimeout(() => setLock("windchime", false), tChim);
    setTimeout(() => setLock("door", false), tDoor);
  }

  /* タイトルが揃ってから、文字をゆらゆらと動かす */
  if (!reduced) setTimeout(startTitleSway, Math.round(5100 * TS));

  /* ============================================================
     マウスフォロー（狐火）
  ============================================================ */
  const layer = document.getElementById("fxLayer");
  const core  = document.getElementById("fxCore");
  const halo  = document.getElementById("fxHalo");
  const ripp  = document.getElementById("fxRipple");
  const trailDots = [];
  const N_DOTS = 9;

  /* 掛け軸をマウスに合わせてそっと傾ける（入場後から） */
  const kakejikuEl = document.getElementById("kakejiku");
  let tiltReady = false;
  if (!reduced && !coarse && kakejikuEl) {
    setTimeout(() => {
      kakejikuEl.style.animation = "none";
      kakejikuEl.style.opacity = "1";
      tiltReady = true;
    }, 3600);
  }
  for (let i = 0; i < N_DOTS; i++) {
    const d = document.createElement("div");
    d.className = "trailDot";
    const s = 12 - i * 1.05, o = 0.62 - i * 0.06;
    d.style.setProperty("--s", s.toFixed(1) + "px");
    d.style.setProperty("--o", Math.max(o, 0.08).toFixed(2));
    layer.appendChild(d);
    trailDots.push(d);
  }

  const hist = [];               // マウス軌跡の履歴
  const MAX_HIST = N_DOTS * 6;
  let mx = window.innerWidth * 0.62, my = window.innerHeight * 0.4;
  /* 操作できる物（扉・風鈴・ベル）。近づくと狐火が引き寄せられる */
  const LURE_R = 235;
  let lureTargets = null, lastLured = null;
  function lureEls() {
    if (!lureTargets) {
      lureTargets = [document.getElementById("door"),
                     document.getElementById("windchime"),
                     document.getElementById("bellFig")].filter(Boolean);
    }
    return lureTargets;
  }

  function follow(x, y) {
    mx = x; my = y;
    hist.unshift([x, y]);
    if (hist.length > MAX_HIST) hist.pop();
  }

  /* ゆっくり追いかける蒼い光（近くの操作対象へ「吸われる」） */
  let cx = mx, cy = my, hx = mx, hy = my, raf = null;
  function drawTail(at) {
    trailDots.forEach((d, i) => {
      if (at) {
        /* 狐火から対象へ伸びる引き寄せの尾 */
        const t = (N_DOTS - i) / N_DOTS;
        d.style.left = (cx + (at.x - cx) * t * at.pull) + "px";
        d.style.top  = (cy + (at.y - cy) * t * at.pull) + "px";
      } else {
        const p = hist[i * 6] || hist[hist.length - 1];
        if (p) { d.style.left = p[0] + "px"; d.style.top = p[1] + "px"; }
      }
    });
  }
  function tick() {
    /* --- 誘引：近くの操作対象があれば徐々に引き寄せる --- */
    let bestEl = null, bestD = 1e9, bcx = 0, bcy = 0;
    /* 扉は未着手の時だけ誘引する（警告後は“もう開きかけた扉”なので導かない） */
    const warned = document.body.classList.contains("warn")
                || document.body.classList.contains("cursed");
    const es = lureEls().filter(el => !el.classList.contains("locked") &&
      (el.id !== "door" || !warned));
    for (let i = 0; i < es.length; i++) {
      const el = es[i];
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width * 0.5;
      const ey = (el.id === "windchime") ? r.top + r.height * 0.22
                 : (el.id === "bellFig") ? r.top + r.height * 0.55
                                          : r.top + r.height * 0.5;
      const d = Math.hypot(mx - ex, my - ey);
      if (d < bestD) { bestD = d; bestEl = el; bcx = ex; bcy = ey; }
    }
    const pull = (bestEl && bestD < LURE_R) ? 1 - bestD / LURE_R : 0;
    const at = pull > 0 ? { x: bcx, y: bcy, pull: pull, el: bestEl } : null;
    if (at) {
      if (lastLured !== at.el) {
        if (lastLured) lastLured.classList.remove("lure");
        lastLured = at.el;
        lastLured.classList.add("lure");      /* 誘導の光 */
      }
    } else if (lastLured) {
      lastLured.classList.remove("lure");
      lastLured = null;
    }
    /* 狐火の目標点＝カーソルと対象の中間（近いほど対象寄り） */
    const fx = at ? mx + (at.x - mx) * 0.6 * at.pull : mx;
    const fy = at ? my + (at.y - my) * 0.6 * at.pull : my;
    const spd = 0.16 + (at ? 0.3 * at.pull : 0);
    cx += (fx - cx) * spd;
    cy += (fy - cy) * spd;
    hx += (mx - hx) * 0.055;
    hy += (my - hy) * 0.055;
    core.style.left = cx + "px";
    core.style.top  = cy + "px";
    halo.style.left = hx + "px";
    halo.style.top  = hy + "px";
    drawTail(at);
    /* 背景・タイトルの視差 */
    const nx = (mx / window.innerWidth  - 0.5) * 2;
    const ny = (my / window.innerHeight - 0.5) * 2;
    document.getElementById("bgScene").style.transform =
      "translate3d(" + (nx * -10).toFixed(2) + "px," + (ny * -7).toFixed(2) + "px,0)";
    /* 掛け軸もマウスに合わせて微かに傾く（呪縛後はやや敏感に） */
    if (tiltReady && kakejikuEl) {
      const amp = document.body.classList.contains("cursed") ? 1.5 : 1;
      kakejikuEl.style.transform =
        "perspective(1100px) rotateX(" + (-ny * 1.6 * amp).toFixed(2) +
        "deg) rotateY(" + (nx * 2.5 * amp).toFixed(2) + "deg)";
    }
    raf = requestAnimationFrame(tick);
  }
  if (reduced || coarse) {
    /* 静止位置に狐火を置くだけ */
    follow(mx, my);
    core.style.left = mx + "px"; core.style.top = my + "px";
    halo.style.left = mx + "px"; halo.style.top = my + "px";
    trailDots.forEach(d => { d.style.left = mx + "px"; d.style.top = my + "px"; });
  } else {
    window.addEventListener("mousemove", e => follow(e.clientX, e.clientY), { passive: true });
    raf = requestAnimationFrame(tick);
  }

  /* クリックで波紋（タッチでも反応） */
  function rippleAt(x, y) {
    ripp.style.left = x + "px";
    ripp.style.top  = y + "px";
    ripp.classList.remove("pop");
    void ripp.offsetWidth;               /* 再アニメーション用 */
    ripp.classList.add("pop");
  }
  window.addEventListener("click", e => rippleAt(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (t) rippleAt(t.clientX, t.clientY);
  }, { passive: true });

  /* ============================================================
     音響：The Last Bell（旧校舎のベル＋夜の空気音）
     WebAudio で全て合成（音源ファイル不要＝権利クリーン）
     ・常夜 … 無音（自動再生制限に配慮）
     ・1度目のクリック(warn) … 夜風が立ち、鈴が「気配」で微かに震える
     ・2度目のクリック(cursed)… 低い唸り＋心音＋扉の軋み、鈴の自鳴が増える
     ・00:00 … 「キーン・コーン」と終業の鐘が鳴り響く
  ============================================================ */
  let actx = null, masterG = null, noiseBuf = null;
  let wind = null, drone = null, droneG = null, heartTimer = null;
  let bellTimer = null;
  let chimeTimer = null;
  const bellFig = document.getElementById("bellFig");
  const AE = !reduced;                 /* 動きを減らす設定なら音も抑える */

  function ensureAudio() {
    if (!AE || actx) return !!actx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      masterG = actx.createGain();
      masterG.gain.value = 0.5;
      masterG.connect(actx.destination);
      const len = actx.sampleRate * 2;
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;   /* 茶色ノイズ＝風・軋みの素 */
        d[i] = last * 3.4;
      }
      noiseBuf = buf;
      if (actx.state === "suspended") actx.resume();
    } catch (e) { actx = null; masterG = null; noiseBuf = null; }
    return !!actx;
  }
  /* 基本音：サイン波＋任意の倍音 */
  function tone(freq, dur, vol, opt) {
    if (!actx) return;
    try {
      opt = opt || {};
      const t = actx.currentTime + (opt.delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = opt.type || "sine";
      o.frequency.setValueAtTime(freq, t);
      if (opt.glide) o.frequency.exponentialRampToValueAtTime(opt.glide, t + dur);
      o.connect(g); g.connect(masterG);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
      if (opt.harm) {                       /* 金属の倍音 */
        const o2 = actx.createOscillator(), g2 = actx.createGain();
        o2.type = "sine"; o2.frequency.value = freq * opt.harm;
        g2.gain.value = 0.22;
        o2.connect(g2); g2.connect(g);
        o2.start(t); o2.stop(t + dur + 0.05);
      }
    } catch (e) {}
  }
  /* 金属ベル音（倍音つき） */
  function bellTone(delay, freq, dur, peak) {
    tone(freq, dur, peak, { delay: delay, harm: 2.756 });
  }
  /* ノイズのワンショット（扉の軋みなど） */
  function noiseSweep(f0, f1, dur, vol) {
    if (!actx) return;
    try {
      const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const flt = actx.createBiquadFilter(); flt.type = "bandpass"; flt.Q.value = 1.1;
      const now = actx.currentTime;
      flt.frequency.setValueAtTime(Math.max(f0, 40), now);
      flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 40), now + dur);
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0002, now + dur);
      src.connect(flt); flt.connect(g); g.connect(masterG);
      src.start(); src.stop(now + dur + 0.1);
    } catch (e) {}
  }
  /* 夜風（低域のざわめき・ループ） */
  function windStart() {
    if (!actx || wind) return;
    try {
      const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const flt = actx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 300;
      const g = actx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.028, actx.currentTime + 4);
      src.connect(flt); flt.connect(g); g.connect(masterG);
      src.start();
      wind = { src: src, g: g };
    } catch (e) {}
  }
  /* 低い唸り（呪縛後のドローン） */
  function droneStart() {
    if (!actx || drone) return;
    try {
      const o = actx.createOscillator(); o.frequency.value = 33; o.type = "sine";
      const o3 = actx.createOscillator(); o3.frequency.value = 66; o3.type = "sine";
      const g = actx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, actx.currentTime + 5);
      o.connect(g); o3.connect(g); g.connect(masterG);
      o.start(); o3.start();
      drone = o; droneG = g;
    } catch (e) {}
  }
  function droneFade() {
    if (drone && droneG && actx) {
      try { droneG.gain.linearRampToValueAtTime(0.012, actx.currentTime + 6); } catch (e) {}
    }
  }
  /* 心音（二重の低い鼓動） */
  function heartStart() {
    if (!actx || heartTimer) return;
    const beat = () => {
      if (!actx) return;
      tone(58, 0.2, 0.38, {});
      tone(45, 0.34, 0.24, { delay: 0.17 });
    };
    beat();
    heartTimer = setInterval(beat, 1150);
  }
  function heartStop() {
    if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
  }
  /* 扉が開く（軋み＋鈍い衝撃） */
  function doorCreak() {
    noiseSweep(380, 65, 1.7, 0.28);
    tone(62, 0.9, 0.5, { delay: 0.35, glide: 40 });
  }
  /* 鈴の自鳴（小さく「チン」）と微振動 */
  function bellSoft() {
    bellTone(0, 1568 + Math.random() * 60, 0.9, 0.05);
  }
  function bellQuiver() {
    if (!bellFig) return;
    bellFig.classList.remove("quiver");
    void bellFig.offsetWidth;
    bellFig.classList.add("quiver");
    setTimeout(() => bellFig.classList.remove("quiver"), 700);
  }
  /* warn / cursed に応じて鈴が不規則に「気配」を出す */
  function scheduleBell(phase) {
    clearTimeout(bellTimer);
    if (!AE || !bellFig) return;
    const span = phase === "warn" ? 7000 + Math.random() * 5000
                                  : 3200 + Math.random() * 3400;
    bellTimer = setTimeout(() => {
      const active = phase === "warn" ? document.body.classList.contains("warn")
                                      : document.body.classList.contains("cursed");
      if (!active) return;
      bellQuiver();
      if (phase !== "warn") bellSoft();   /* 警告中は震えるだけ、呪縛後は鳴る */
      scheduleBell(phase);
    }, span);
  }
  function stopBellSchedule() { clearTimeout(bellTimer); bellTimer = null; }

  /* キーン・コーン――終業の鐘（00:00） */
  window.__bell = { ring: ringBell };    /* 動作確認用（開発時のみ） */
  function ringBell() {
    ensureAudio();
    stopBellSchedule();
    stopChimeSchedule();
    if (bellFig) {
      bellFig.classList.remove("ring");
      void bellFig.offsetWidth;
      bellFig.classList.add("ring");
      setTimeout(() => bellFig.classList.remove("ring"), 2600);
    }
    bellTone(0, 880, 1.5, 0.5);
    bellTone(0.92, 587, 2.0, 0.4);
    heartStop();
    droneFade();
  }

  /* ============================================================
     風鈴：掛け軸の右下に吊るした金属管
     ・ステージ1＝無風（静か）／ステージ2＝微風（怪しいほど小さく）
     ・ステージ3＝暴風（絶え間なくチリンチリン）
     ・触れると揺れて鳴る／マウスが近づくとそちらへ傾く
  ============================================================ */
  /* 左上ベル：将来メニューになる。今は押すと一鳴きするだけ */
  if (bellFig) {
    bellFig.addEventListener("click", () => {
      ensureAudio();
      bellTone(0, 220, 0.7, 0.16);
      bellTone(0.18, 175, 0.9, 0.12);
      bellQuiver();
    });
    bellFig.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        bellFig.click();
      }
    });
  }
  const wcEl = document.getElementById("windchime");
  function chimeNote(vol) {
    if (!actx) return;
    const f = [1046.5, 1318.5, 1568, 1760, 2093][Math.floor(Math.random() * 5)];
    tone(f, 0.5 + Math.random() * 0.45, vol, { harm: 3.05 });
  }
  function chimePoke() {
    if (!wcEl) return;
    wcEl.classList.remove("poke");
    void wcEl.offsetWidth;
    wcEl.classList.add("poke");
    setTimeout(() => wcEl.classList.remove("poke"), 1000);
  }
  function scheduleChime(phase) {
    clearTimeout(chimeTimer);
    if (!AE || !wcEl) return;
    const span = phase === "warn" ? 6500 + Math.random() * 4500
                                  : 1500 + Math.random() * 1900;
    chimeTimer = setTimeout(() => {
      const active = phase === "warn" ? document.body.classList.contains("warn")
                                      : document.body.classList.contains("cursed");
      if (!active) return;
      chimeNote(phase === "warn" ? 0.028 : 0.05);  /* 微風は小さく不気味に（揺れは風任せ） */
      scheduleChime(phase);
    }, span);
  }
  function stopChimeSchedule() { clearTimeout(chimeTimer); chimeTimer = null; }
  if (wcEl) {
    wcEl.addEventListener("click", () => {
      ensureAudio();
      chimeNote(0.06);
      chimePoke();
    });
    if (!coarse && !reduced) {
      window.addEventListener("pointermove", (e) => {
        const r = wcEl.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.1;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        if (Math.hypot(dx, dy) < 150) {   /* 近づいた時だけ、そっと傾く */
          wcEl.classList.add("grab");
          const b = wcEl.querySelector(".chimB");
          if (b) {
            const ang = Math.max(-9, Math.min(9, dx / 22));
            b.style.transform = "rotate(" + ang.toFixed(1) + "deg)";
          }
        } else {
          wcEl.classList.remove("grab");
          const b = wcEl.querySelector(".chimB");
          if (b) b.style.transform = "";
        }
      }, { passive: true });
    }
  }

  /* ============================================================
     扉の封印（2段階のインタラクション）
  ============================================================ */
  const door    = document.getElementById("door");
  const whisper = document.getElementById("whisper");
  const timerEl = document.getElementById("timer");
  const timerBox = document.getElementById("timerBox");
  const total = 15 * 60;               /* 15:00（分:秒）から始まる */
  let remain = total, opened = false, warnPhase = false, counting = false, tickId = null;
  let warnAt = 0;                       /* 警告演出の冷却：連打で飛ばせない */

  function fmt(n) {
    const s = String(n % 60).padStart(2, "0");
    const m = String(Math.floor(n / 60)).padStart(2, "0");
    return m + ":" + s;               /* 分:秒（15:00 → 00:00） */
  }

  const tateL = document.getElementById("tateL");
  const tateR = document.getElementById("tateR");
  const story = document.getElementById("story");

  door.addEventListener("click", () => {
    if (opened) return;

    /* 2度目のクリックは警告演出が一呼吸終わるまで受けない */
    if (warnPhase && Date.now() - warnAt < 850) return;

    /* 1度目のクリック：触れただけでも空気が変わる */
    if (!warnPhase) {
      warnPhase = true;
      warnAt = Date.now();
      document.body.classList.add("warn");   /* 画面が暖色に傾く */
      door.classList.add("danger");
      door.textContent = "…それでも開けるか？";
      whisper.textContent = "「その扉は、開けてはならない。」";
      whisper.classList.add("in");
      /* 怪談の端書きが囁き始める＋悪寒が走り始める */
      tateL.classList.add("in");
      tateR.classList.add("in");
      if (!reduced) startChill();
      /* 危険状態は開錠まで維持（消えずに“警告のボタン”として残る） */
      ensureAudio();
      if (AE) windStart();            /* 夜風が立ち始める */
      scheduleBell("warn");          /* 鈴が「気配」で震え始める */
      scheduleChime("warn");        /* 風鈴：微風で小さく鳴り始める */
      makeDrips(1);                  /* 天辺の血が少しずつ滴る */
      plateDrips(1);                 /* 掛け軸の下辺からも垂れ始める */
      return;
    }

    /* 2度目のクリック：扉が開き、呪いが解かれる */
    opened = true;
    warnPhase = false;
    door.classList.add("opened");
    door.classList.remove("danger");
    door.textContent = "封印、解錠済";
    document.body.classList.add("cursed");   /* 背景が血の色に染まる */
    document.body.classList.remove("warn");
    whisper.textContent = "扉は開かれた…呪いが、始まる。";
    timerBox.classList.add("in");
    timerEl.textContent = fmt(total);
    remain = total;
    counting = true;
    tickId = setInterval(() => {
      remain--;
      timerEl.textContent = fmt(Math.max(remain, 0));
      if (remain <= 60) timerBox.classList.add("urgent");  /* 残り1分から明滅が速くなる */
      if (remain <= 0) {
        clearInterval(tickId);
        counting = false;
        timerEl.textContent = "00:00";
        whisper.textContent = "時間切れ――最後のベルが鳴り響く。もう、逃げ道はない。";
        ringBell();
      }
    }, 1000);
    ensureAudio();                 /* ユーザー操作のついでに音声を有効化 */
    if (AE) {
      doorCreak();                 /* 扉が軋みながら開く */
      droneStart();                /* 低い唸りが床下から */
      heartStart();                /* 心音が早まる */
      scheduleBell("cursed");      /* 鈴がひとりでに鳴り出す */
      scheduleChime("cursed");      /* 風鈴：暴風に煽られて鳴り止まない */
    }
    makeDrips(2);                  /* 天辺の血の滴りが増える */
    plateDrips(2);                 /* 掛け軸の下辺の垂れ血も増える */
    /* 開いて初めて語られる物語 ＋ 解けた封印の紙吹雪 */
    story.classList.add("play");
    if (!reduced) startAmbient();
  });

  /* ============================================================
     タイトルの文字をゆっくり揺らめかせる（可読性を保つ穏やかな動き）
  ============================================================ */
  function startTitleSway() {
    const els = [];
    /* 揺らめくのは紙面の主文（The Last Bell）だけ。落款は静かに添える */
    h1.querySelectorAll(".cMain").forEach(el => {
      /* 登場アニメーションを外し、静的な表示に切り替えてから動かす */
      el.style.animation = "none";
      el.style.opacity = "1";
      el.style.filter = "none";
      els.push({
        el,
        ph: Math.random() * Math.PI * 2,     /* 字ごとに位相をずらす */
        ph2: Math.random() * Math.PI * 2
      });
    });
    if (!els.length) return;
    let rafId = null;
    const loop = (now) => {
      const t = now / 1000;
      for (const it of els) {
        const y = Math.sin(t * 0.85 + it.ph) * 1.3;            /* ほんの僅か上下へ */
        const r = Math.sin(t * 0.5 + it.ph2) * 0.5;            /* ほんの僅か回る */
        it.el.style.transform =
          "translateY(" + y.toFixed(2) + "px) rotate(" + r.toFixed(2) + "deg)";
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  /* ============================================================
     環境アニメ：光塵と符札の生成、悪寒フラッシュ
  ============================================================ */
  function startAmbient() {
    const env = document.getElementById("envLayer");
    if (!env) return;

    /* うっすらと立ちのぼる光塵（スマホでは控えめに） */
    const dustN = coarse ? 9 : 22;
    for (let i = 0; i < dustN; i++) {
      const d = document.createElement("span");
      d.className = "dust";
      const size = 2 + Math.random() * 3;
      d.style.width = d.style.height = size.toFixed(1) + "px";
      d.style.left = (Math.random() * 100).toFixed(2) + "%";
      d.style.setProperty("--dx", (Math.random() * 90 - 45).toFixed(0) + "px");
      d.style.animationDuration = (9 + Math.random() * 14).toFixed(1) + "s";
      d.style.animationDelay = (-Math.random() * 20).toFixed(1) + "s";
      env.appendChild(d);
    }

    /* はらはらと舞い落ちる封印のお札（スマホでは控えめに） */
    const ofudaN = coarse ? 3 : 7;
    for (let i = 0; i < ofudaN; i++) {
      const o = document.createElement("span");
      o.className = "ofuda";
      o.style.left = (Math.random() * 96).toFixed(1) + "%";
      o.style.setProperty("--rot", (90 + Math.random() * 200).toFixed(0) + "deg");
      o.style.animationDuration = (11 + Math.random() * 9).toFixed(1) + "s";
      o.style.animationDelay = (-Math.random() * 18).toFixed(1) + "s";
      env.appendChild(o);
    }
  }

  /* 一定間隔で悪寒（走査線フラッシュ）を走らせる */
  function startChill() {
    const chill = document.getElementById("chill");
    if (!chill) return;
    const go = () => {
      chill.classList.remove("go");
      void chill.offsetWidth;
      chill.classList.add("go");
    };
    /* スマホでは悪寒の間隔を長めに（動きを減らす） */
    const span = () => coarse ? 15000 + Math.random() * 10000 : 8500 + Math.random() * 7000;
    const loop = () => setTimeout(() => { go(); loop(); }, span());
    setTimeout(loop, coarse ? 16000 : 9000);
  }

  /* 天辺から血が滴り始める（warn=2、cursed=6の血源・段階に応じて増える） */
  function makeDrips(level) {
    if (reduced) return;
    let box = document.getElementById("bloodDrips");
    if (!box) {
      box = document.createElement("div");
      box.id = "bloodDrips";
      document.body.appendChild(box);
    }
    const have = +(box.dataset.lvl || 0);
    if (have >= level) return;
    box.dataset.lvl = String(level);
    /* 両端の縦書き端書きや本文を避けた位置に血源を作る */
    const xs = level === 1 ? [7, 93] : [5, 14, 23, 77, 86, 95];
    xs.forEach((x, i) => {
      if (i < have) return;
      const d = document.createElement("i");
      d.className = "bd";
      d.style.setProperty("--x", x + "%");
      d.style.setProperty("--h", (26 + Math.random() * 26).toFixed(0) + "px");
      d.style.setProperty("--n", (4.6 + Math.random() * 2.6).toFixed(1) + "s");
      d.style.setProperty("--d", (-Math.random() * 6).toFixed(1) + "s");
      box.appendChild(d);
    });
  }

  /* 掛け軸の下辺からの垂れ血（スマホでは上端の滴りに任せる） */
  function plateDrips(level) {
    if (reduced || coarse) return;
    const box = document.getElementById("plateDrips");
    if (!box) return;
    const have = +(box.dataset.lvl || 0);
    if (have >= level) return;
    box.dataset.lvl = String(level);
    /* 本文の両端（物語テキストが無い箇所）に血源を作る */
    /* 本文の両端（物語テキストが無い箇所）に血源を作る */
    const xs = level === 1 ? [8, 16, 84, 92] : [5, 10, 15, 85, 90, 95];
    xs.forEach((x, i) => {
      if (i < have) return;
      const d = document.createElement("i");
      d.className = "pd";
      d.style.setProperty("--px", x + "%");
      d.style.setProperty("--pl", (20 + Math.random() * 20).toFixed(0) + "px");
      d.style.setProperty("--fl", (28 + Math.random() * 30).toFixed(0) + "px");
      d.style.setProperty("--pd", (3.2 + Math.random() * 1.9).toFixed(1) + "s");
      d.style.setProperty("--dd", (-Math.random() * 5).toFixed(1) + "s");
      box.appendChild(d);
    });
  }

  /* 環境アニメは最初は出さない。
     1度目のクリックで「悪寒」、2度目で「符札と光塵」が解き放たれる */
})();
