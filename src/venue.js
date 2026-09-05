/* ============================================================
   venue.js — 会場案内（完整版）
   上：俯視マップ。LEVELMAP の「段」で各棟の実階を切替表示。
   下：棟ごとの展開図（各階の部屋を横に並べる）。
   渡廊下は棟と棟の間だけに現れる短い接続（部屋セルの下に描き、両端は建物に隠れる）。
   ★＝一年三組(A2F 高1-3)。
   ============================================================ */
(() => {
  "use strict";
  const svg = document.getElementById("planSvg");
  const floorSel = document.getElementById("planFloor");
  const exPanel = document.getElementById("exPanel");
  if (!svg) return;

  const XMIN = -72, XMAX = 118, ZMIN = -158, ZMAX = 26, S = 4.0;
  const FIELD = [[-66, -84], [18, -84], [18, 10], [-20, 10], [-66, -40]];

  const BLOCKS = [
    { id: "G", name: "体育館", fill: "#b8bfd0", x0: -66, x1: 4, z0: -148, z1: -124, floors: 1, plain: true },
    { id: "D", name: "D棟（総合）", fill: "#e6dcef", x0: 44, x1: 78, z0: -150, z1: -120, floors: 4, axis: "z" },
    { id: "A", name: "A棟（高校）", fill: "#e5d7cf", x0: 42, x1: 56, z0: -102, z1: -2, floors: 3, axis: "z" },
    { id: "B", name: "B棟（中高）", fill: "#dfe6f6", x0: 68, x1: 82, z0: -102, z1: -2, floors: 2, axis: "z" },
    { id: "C", name: "C棟（中学）", fill: "#fbe9c8", x0: 94, x1: 108, z0: -102, z1: -2, floors: 1, axis: "z" }
  ];
  /* 部屋：各階を北→南の並びで列挙 */
  const ROOMS = {
    A: {
      1: ["階段室", "保健室", "多機能トイレ", "A棟職員室", "応接室2", "応接室1", "校長室", "事務室", "入口ホール／階段室", "応接室3"],
      2: ["階段室", "高1-1教室", "高1-2", "高1-3", "高1-4", "高1-5", "高1-6", "階段室／トイレ", "会議室"],
      3: ["階段室", "A3教室", "高3-1", "高3-2", "高3-3", "高3-4", "高3-5", "階段室／トイレ", "GS室"]
    },
    B: {
      1: ["階段室", "書道教室", "調理教室", "美術・技術教室", "理科教室", "倉庫／準備室", "階段室", "B1教室"],
      2: ["階段室", "B棟職員室", "多目的教室", "金庫／準備室", "ACT室", "探究室", "階段室", "B2教室"]
    },
    C: { 1: ["茶室（独立）", "C棟職員室", "中1-1", "中1-2", "中2-1", "中2-2", "中3-1", "中3-2", "男女トイレ"] },
    D: {
      1: ["階段室", "昇降口"],
      2: ["階段室", "D1教室", "高2-5", "高2-4", "高2-3", "男女トイレ・多機能"],
      3: ["階段室", "図書室", "高2-2", "高2-1", "進路指導室"],
      4: ["器具庫(小)", "武道場", "器具庫(大)", "更衣室", "生徒相談室", "階段室", "男女トイレ"]
    }
  };
  /* D棟の部屋グリッド（内部が複雑なので正方形に近いマスで表示。空きマスは共用空間） */
  const DGRID = { 1: { c: 2, r: 1 }, 2: { c: 3, r: 2 }, 3: { c: 3, r: 2 }, 4: { c: 3, r: 3 } };
  /* 高さの段（各棟の実階。null＝その高さには無い） */
  const LEVELMAP = [
    { band: 4, title: "4段：D4F（武道場）", A: null, B: null, C: null, D: 4 },
    { band: 3, title: "3段：A3F＝B2F＝D3F＝C1F", A: 3, B: 2, C: 1, D: 3 },
    { band: 2, title: "2段：A2F＝B1F＝D2F", A: 2, B: 1, C: null, D: 2 },
    { band: 1, title: "1段：A1F＝D1F", A: 1, B: null, C: null, D: 1 }
  ];
  /* 渡廊下：棟と棟の間を「短くつなぐ」だけの接続（長い帯は使わない）。
     z は各棟の端部（階段室側）の高さ帯に合わせ、x は棟端へ数m差し込む。
     部屋セルの下（先）に描くので、見えているのは建物と建物の間の部分だけ。
     bands＝その接続が存在する「段」（D2F⇄B1F の渡廊は2段だけ等） */
  const CORR = [
    { kind: "rail", x0: 52, x1: 72, z0: -101, z1: -92, label: "渡廊下", bands: [2, 3] },   /* 北側 A⇄B */
    { kind: "rail", x0: 78, x1: 98, z0: -101, z1: -92, label: "渡廊下", bands: [3] },      /* 北側 B⇄C */
    { kind: "rail", x0: 52, x1: 72, z0: -26, z1: -17, label: "渡廊下", bands: [2, 3] },   /* 南側 A⇄B（南側の階段室帯） */
    { kind: "link", x0: 68, x1: 78, z0: -124, z1: -98, label: "渡廊下", bands: [2, 3] }    /* D⇄B 縦の渡廊（各段の高さ） */
  ];
  /* 道路（グランドの東側・校舎の西側を南北に通す） */
  const ROAD = { x0: 25, x1: 37, z0: -140, z1: 12 };
  /* 夜空の星（毎回の再描画で位置が変わらないよう、初回に固定生成） */
  const STARS = [];
  {
    let s = 987654321;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) STARS.push({ x: XMIN - 6 + rnd() * (XMAX - XMIN + 12), z: ZMIN - 4 + rnd() * (ZMAX - ZMIN + 8), r: .7 + rnd() * 2.2, o: .35 + rnd() * .55 });
  }
  const HEAD = { A: ["#e5d7cf", "#5c2f2a"], B: ["#dfe6f6", "#2e3b5c"], C: ["#fbe9c8", "#6b4a1e"], D: ["#e6dcef", "#4a3560"] };
  const MX = (x) => (x - XMIN) * S;
  const MY = (z) => (z - ZMIN) * S;
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function roomKey(bid, f, nm) { return bid + "|" + f + "|" + nm; }
  function poly(pts) { return pts.map(p => MX(p[0]) + "," + MY(p[1])).join(" "); }
  /* ---- 部屋名テキスト：セルに収まるよう自動縮小・折返し（はみ出さない） ---- */
  function textFit(t, cellW, cellH) {
    const L = t.length;
    const cap = (f) => Math.max(1, Math.floor((cellW - 6) / (f * 1.12)));
    let fs = 7, cpl = 1, one = false;
    for (let f = 18; f >= 10; f--) {            /* 1行優先（ある程度の大きさで） */
      if (cap(f) >= L && f * 1.16 <= cellH - 4) { fs = f; cpl = L; one = true; break; }
    }
    if (!one) {
      for (let f = 18; f >= 7; f--) {
        const c = cap(f), need = Math.ceil(L / c), maxL = Math.max(1, Math.floor((cellH - 4) / (f * 1.16)));
        if (need <= maxL) { fs = f; cpl = c; break; }
      }
    }
    if (cpl >= L) return { fs: fs, lines: [t] };
    const out = [], sep = /[・／（()\-－]/;
    let s = t;
    while (s.length) {
      if (s.length <= cpl) { out.push(s); break; }
      let cut = cpl;
      while (cut > 1 && s.length - cut < 2) cut--;
      for (let k = cut - 1; k > 0; k--) if (sep.test(s[k])) { cut = k + 1; break; }
      out.push(s.slice(0, cut));
      s = s.slice(cut);
    }
    return { fs: fs, lines: out };
  }
  function pushRoomText(p, cellX, cellY, cellW, cellH, nm, fill) {
    const t = String(nm || "");
    if (!t) return;
    const fit = textFit(t, cellW, cellH);
    let fs = Math.max(7, fit.fs), lines = fit.lines.slice();
    const maxAt = Math.max(1, Math.floor((cellH - 4) / (fs * 1.16)));
    const clipped = lines.length > maxAt;
    while (lines.length > maxAt) lines.pop();
    if (!lines.length) return;
    if (clipped || lines.join("").length < t.length) {
      const last = lines.pop() || "";
      lines.push((last.length > 1 ? last.slice(0, -1) : "") + "…");
    }
    const lh = fs * 1.16;
    const cx = cellX + cellW / 2;
    const top = cellY + Math.max(1, (cellH - ((lines.length - 1) * lh + fs)) / 2);
    let o = '<text x="' + cx.toFixed(1) + '" y="' + (top + fs * .84).toFixed(1) + '" fill="' + fill +
      '" font-size="' + fs + '" text-anchor="middle" font-family="Yuji Syuku,serif">';
    lines.forEach((ln, i) => o += '<tspan x="' + cx.toFixed(1) + '" dy="' + (i ? lh : 0) + '">' + esc(ln) + '</tspan>');
    p.push(o + '</text>');
  }
  /* 部屋セル（色＋部屋名） */
  function pushCell(p, key, x, y, w, h, isOne, nm) {
    const cls = (sel === key ? "room sel" : "room") + (isOne ? " star" : "");
    p.push('<rect class="' + cls + '" data-key="' + esc(key) + '" x="' + x.toFixed(1) +
      '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
      '" fill="' + (isOne ? "#c0392b" : "#fbfaf5") + '" stroke="' + (isOne ? "#8e2118" : "#a8adbd") + '" stroke-width="1"/>');
    pushRoomText(p, x, y, w, h, nm, isOne ? "#fff4e2" : "#333b55");
  }
  /* 渡廊下の1接続部を描く（部屋セルの下に置かれる想定：両端は建物に隠れる） */
  function pushCorr(p, c) {
    const zA = Math.min(c.z0, c.z1), zB = Math.max(c.z0, c.z1);
    const x = MX(c.x0), y = MY(zA), w = (c.x1 - c.x0) * S, h = (zB - zA) * S;
    const rail = c.kind === "rail";
    p.push('<rect class="corr" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
      '" fill="#cdd6e8" stroke="#3a4466" stroke-width="1.8" rx="1"/>');
    p.push('<rect x="' + (x + 2.5).toFixed(1) + '" y="' + (y + 2.5).toFixed(1) + '" width="' + (w - 5).toFixed(1) + '" height="' + (h - 5).toFixed(1) +
      '" fill="none" stroke="#97a3c2" stroke-width=".7" stroke-dasharray="2.5 2.5"/>');
    if (rail) { for (let px = x + 5; px < x + w - 5; px += 11) p.push('<line x1="' + px.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (px + 5).toFixed(1) + '" y2="' + (y + h).toFixed(1) + '" stroke="#7f8bb0" stroke-width="1.2"/>'); }
    else { for (let py = y + 5; py < y + h - 5; py += 11) p.push('<line x1="' + x.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + (x + w).toFixed(1) + '" y2="' + (py + 5).toFixed(1) + '" stroke="#7f8bb0" stroke-width="1.2"/>'); }
    const lbl = c.label || "";
    if (rail) {
      p.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + 3).toFixed(1) + '" fill="#39456e" font-size="8.5" text-anchor="middle" letter-spacing="1" font-family="DotGothic16,monospace">' + esc(lbl) + '</text>');
    } else {
      const chs = lbl.split("");
      let o = '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 - (chs.length - 1) * 5.5 - 1).toFixed(1) +
        '" fill="#39456e" font-size="10" text-anchor="middle" font-family="DotGothic16,monospace">';
      chs.forEach((ch, i) => o += '<tspan x="' + (x + w / 2).toFixed(1) + '" dy="' + (i ? 10 : 0) + '">' + esc(ch) + '</tspan>');
      p.push(o + '</text>');
    }
  }
  let curLevel = 3, sel = null;

  function draw() {
    svg.setAttribute("viewBox", "0 0 " + Math.ceil((XMAX - XMIN) * S + 16) + " " + Math.ceil((ZMAX - ZMIN) * S + 16));
    const p = [];
    p.push('<defs><radialGradient id="skyGrad" cx="50%" cy="30%" r="85%">' +
      '<stop offset="0%" stop-color="#141a36"/><stop offset="55%" stop-color="#0b0f26"/><stop offset="100%" stop-color="#060813"/>' +
      '</radialGradient></defs>');
    p.push('<rect width="100%" height="100%" fill="url(#skyGrad)"/>');
    STARS.forEach(st => p.push('<circle cx="' + MX(st.x).toFixed(1) + '" cy="' + MY(st.z).toFixed(1) +
      '" r="' + st.r.toFixed(2) + '" fill="#c6cfec" opacity="' + st.o.toFixed(2) + '"/>'));
    p.push('<polygon points="' + poly(FIELD) + '" fill="#465043" stroke="#76895f" stroke-width="1.5"/>');
    p.push('<text x="' + MX(-34).toFixed(1) + '" y="' + MY(-60).toFixed(1) + '" fill="#d9e3c2" font-size="21" letter-spacing="6" font-family="Kaisei Tokumin,serif">グランド</text>');
    /* 道路：グランドと校舎の間を南北に通す（両脇の白線＋センターライン） */
    p.push('<rect x="' + MX(ROAD.x0).toFixed(1) + '" y="' + MY(ROAD.z0).toFixed(1) + '" width="' + ((ROAD.x1 - ROAD.x0) * S).toFixed(1) + '" height="' + ((ROAD.z1 - ROAD.z0) * S).toFixed(1) + '" fill="#22283d" stroke="#55607f" stroke-width="1.2"/>');
    p.push('<line x1="' + MX(ROAD.x0).toFixed(1) + '" y1="' + (MY(ROAD.z0) + 4).toFixed(1) + '" x2="' + MX(ROAD.x0).toFixed(1) + '" y2="' + (MY(ROAD.z1) - 4).toFixed(1) + '" stroke="#7b86a4" stroke-width="1"/>');
    p.push('<line x1="' + MX(ROAD.x1).toFixed(1) + '" y1="' + (MY(ROAD.z0) + 4).toFixed(1) + '" x2="' + MX(ROAD.x1).toFixed(1) + '" y2="' + (MY(ROAD.z1) - 4).toFixed(1) + '" stroke="#7b86a4" stroke-width="1"/>');
    p.push('<line x1="' + MX((ROAD.x0 + ROAD.x1) / 2).toFixed(1) + '" y1="' + MY(ROAD.z0).toFixed(1) + '" x2="' + MX((ROAD.x0 + ROAD.x1) / 2).toFixed(1) + '" y2="' + MY(ROAD.z1).toFixed(1) + '" stroke="#98a3bd" stroke-width="1.4" stroke-dasharray="10 9"/>');
    p.push('<text x="' + MX((ROAD.x0 + ROAD.x1) / 2).toFixed(1) + '" y="' + MY(-58).toFixed(1) + '" fill="#aeb7cc" font-size="12" text-anchor="middle" font-family="DotGothic16,monospace">道路</text>');

    const lvl = LEVELMAP.find(l => l.band === curLevel);
    BLOCKS.forEach(b => {
      const fl = lvl ? lvl[b.id] : null;
      const has = !!fl;
      const w = (b.x1 - b.x0) * S, h = (b.z1 - b.z0) * S;
      p.push('<rect x="' + MX(b.x0).toFixed(1) + '" y="' + MY(b.z0).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
        '" rx="1" fill="' + b.fill + '" stroke="#0a0d18" stroke-width="2.2" opacity="' + (has ? 1 : .32) + '"/>');
      /* ラベル：D/G（上側の余地が狭く部屋に被るので1行）と A/B/C（下側の空き地、2行）で分ける */
      const cxL = MX((b.x0 + b.x1) / 2).toFixed(1);
      if (b.id === "D" || b.id === "G") {
        const yy = MY((b.id === "G" ? b.z0 - 8 : b.z0 - 8));
        p.push('<text x="' + cxL + '" y="' + (yy + 16).toFixed(1) + '" fill="#f4eeda" font-size="' + (has ? 13 : 12) +
          '" text-anchor="middle" font-weight="bold" font-family="Kaisei Tokumin,serif">' + esc(b.name) + (has ? '　' + fl + 'F' : '') + '</text>');
      } else {
        const yy = MY(Math.min(b.z1 + 17, ZMAX - 5));
        p.push('<text x="' + cxL + '" y="' + (yy + 14).toFixed(1) + '" fill="#f4eeda" font-size="15" text-anchor="middle" font-weight="bold" font-family="Kaisei Tokumin,serif">' + esc(b.name) + '</text>');
        p.push('<text x="' + cxL + '" y="' + (yy + 27).toFixed(1) +
          '" fill="' + (has ? "#ffe9c9" : "#66708a") + '" font-size="10" text-anchor="middle" font-family="DotGothic16,monospace">' + (has ? "この高さ： " + fl + "F" : "（無し）") + '</text>');
      }
    });

    /* 渡廊下：部屋セルより下に描く（両端は建物に隠れ、建物と建物の間だけが見える） */
    if (lvl) {
      CORR.forEach(c => { if (c.bands.indexOf(curLevel) >= 0) pushCorr(p, c); });
    }

    /* フロアの部屋：A/B/C は南北の帯に等分。D は内部が複雑なので正方形グリッドで並べる */
    if (lvl) {
      BLOCKS.forEach(b => {
        if (b.plain) return;
        const fl = lvl[b.id];
        if (!fl) return;
        const names = ROOMS[b.id] && ROOMS[b.id][fl];
        if (!names || !names.length) return;
        const x0 = MX(b.x0), y0 = MY(Math.min(b.z0, b.z1));
        const wpx = (b.x1 - b.x0) * S, hpx = Math.abs(b.z1 - b.z0) * S;
        if (b.id !== "D") {
          const c = hpx / names.length;
          names.forEach((nm, i) => {
            pushCell(p, roomKey(b.id, fl, nm), x0, y0 + c * i, wpx, c, nm === "高1-3", nm);
          });
        } else {
          const g = DGRID[fl] || { c: 3, r: 3 };
          const cw = wpx / g.c, ch = hpx / g.r;
          let idx = 0;
          for (let r = 0; r < g.r; r++) {
            for (let col = 0; col < g.c; col++) {
              if (idx >= names.length) continue;  /* 空きマス＝内部の共用空間として何も描かない */
              const nm = names[idx++];
              pushCell(p, roomKey(b.id, fl, nm), x0 + col * cw, y0 + r * ch, cw, ch, nm === "高1-3", nm);
            }
          }
        }
      });
    }
    svg.innerHTML = p.join("");
  }

  function rebuildLevels() {
    floorSel.textContent = "";
    LEVELMAP.forEach(l => {
      const o = document.createElement("option");
      o.value = l.band; o.textContent = "段 " + l.band + "　" + l.title;
      if (l.band === curLevel) o.selected = true;
      floorSel.appendChild(o);
    });
  }
  svg.addEventListener("click", (e) => {
    const r = e.target.closest(".room");
    sel = r ? (sel === r.getAttribute("data-key") ? null : r.getAttribute("data-key")) : null;
    draw();
  });
  floorSel.addEventListener("change", () => {
    curLevel = parseInt(floorSel.value, 10) || 3; sel = null; draw();
    const w = document.getElementById("planSvgWrap");
    if (w) { w.classList.remove("fx"); void w.offsetWidth; w.classList.add("fx"); }
  });

  function renderExploded() {
    if (!exPanel) return;
    const order = ["D", "A", "B", "C"];
    const note = {
      A: '<span class="exCorr">★ 一年三組＝A棟2F「高1-3」（The Last Bell 会場）</span>',
      B: '<span class="exCorr">渡廊下で D2F ⇄ B1F と接続（西高台+5m≒1層差）</span>',
      D: '<span class="exCorr">渡廊下で B1F 側（A寄り）と接続</span>'
    };
    const html = order.map(bid => {
      const b = BLOCKS.find(x => x.id === bid);
      const rows = [];
      const fs = Object.keys(ROOMS[bid] || {}).map(Number).sort((a, c) => c - a);
      fs.forEach(f => {
        const chips = ROOMS[bid][f].map(nm => {
          const star = nm === "高1-3";
          const cls = star ? "star" : (nm.indexOf("階段") >= 0 || nm.indexOf("トイレ") >= 0 ? "wc st" : "");
          return '<span class="exRoom ' + cls + '" data-key="' + esc(roomKey(bid, f, nm)) + '">' + esc(nm) + '</span>';
        }).join("");
        rows.push('<div class="exFloor"><span class="fl">' + f + 'F</span><span class="rooms">' + chips + '</span></div>');
      });
      return '<div class="exBldg" style="border-color:' + HEAD[bid][1] + '">' +
        '<div class="exName" style="background:' + HEAD[bid][0] + ';color:' + HEAD[bid][1] + '">' + esc(b.name) + '</div>' +
        rows.join("") +
        (note[bid] ? '<div class="exFloor"><span class="fl"></span><span class="rooms">' + note[bid] + '</span></div>' : '') +
        '</div>';
    }).join("");
    exPanel.innerHTML = html;
  }

  rebuildLevels();
  draw();
  renderExploded();

  /* ==================== 検索：自動ジャンプ＋ハイライト ==================== */
  const sInp = document.getElementById("planSearch");
  const sBtn = document.getElementById("planSearchBtn");
  const sMsg = document.getElementById("searchMsg");
  const pickSel = document.getElementById("searchPick");
  const BNAME = { A: "A棟", B: "B棟", C: "C棟", D: "D棟" };
  let hits = [], hitIdx = 0;
  function nodeByKey(cls, key) {
    const all = document.querySelectorAll(cls);
    for (let i = 0; i < all.length; i++) if (all[i].getAttribute("data-key") === key) return all[i];
    return null;
  }
  function clearHits() {
    document.querySelectorAll("#planSvg rect.hit, .exRoom.hit").forEach(el => el.classList.remove("hit"));
  }
  function norm(s) {
    let t = String(s).toLowerCase();
    t = t.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    t = t.replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    t = t.replace(/[\sー・／\/\-－−―‐–]/g, "");   /* 全角・各種ハイフンも除去 */
    return t;
  }
  function subseq(q, t) {            /* 順番どおりに含まれるか（fuzzy） */
    let i = 0;
    for (let j = 0; j < t.length && i < q.length; j++) if (q[i] === t[j]) i++;
    return i === q.length;
  }
  function editDist(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; for (let j = 1; j <= n; j++) d[i][j] = 0; }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    }
    return d[m][n];
  }
  function jumpTo(hit) {
    if (!hit) return;
    const lvl = LEVELMAP.find(l => l[hit.bid] === hit.f && hit.f != null);
    if (lvl) { curLevel = lvl.band; if (floorSel.value != lvl.band) floorSel.value = lvl.band; }
    draw();
    const key = roomKey(hit.bid, hit.f, hit.nm);
    const r = nodeByKey("#planSvg rect", key);
    if (r) {
      r.classList.add("hit");
      try { r.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); } catch (e) {}
    }
    const c = nodeByKey(".exRoom", key);
    if (c) {
      c.classList.add("hit");
      try { c.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    }
  }
  /* 別名（★一年三組などは実際の部屋名が違うので別名で検索可能に） */
  const ALIAS = {
    "高1-3": ["一年三組", "三組", "出し物", "the last bell", "ラストベル", "last bell"],
    "入口ホール／階段室": ["エントランス", "入口"],
    "昇降口": ["玄関"]
  };
  /* あいまい検索：含む→前方一致→順序どおり含む→軽い誤字 の順でスコア */
  function runSearch(q) {
    q = (q || "").trim();
    clearHits();
    if (!q) { hits = []; hitIdx = 0; if (sMsg) sMsg.textContent = ""; return; }
    const qn = norm(q);
    const scored = [];
    ["A", "B", "C", "D"].forEach(bid => {
      const floors = ROOMS[bid] || {};
      Object.keys(floors).map(Number).sort((a, c) => c - a).forEach(f => {
        floors[f].forEach(nm => {
          const targets = [nm].concat(ALIAS[nm] || []);
          let score = Infinity;
          targets.forEach(t => {
            const nn = norm(t);
            if (nn.indexOf(qn) >= 0) score = Math.min(score, 0);
            else if (nn.indexOf(qn) === 0) score = Math.min(score, 0.5);
            else if (subseq(qn, nn)) score = Math.min(score, 1);
            else { const d = editDist(qn, nn); if (d <= Math.max(1, Math.floor(nn.length * .4))) score = Math.min(score, 2 + d / 10); }
          });
          if (isFinite(score)) scored.push({ bid: bid, f: f, nm: nm, s: score });
        });
      });
    });
    scored.sort((a, b) => a.s - b.s);
    hits = scored.map(h => ({ bid: h.bid, f: h.f, nm: h.nm }));
    if (!hits.length) { if (sMsg) sMsg.textContent = "「" + q + "」は見つかりません"; return; }
    hitIdx = 0;
    if (hits.length === 1) {
      if (pickSel) pickSel.style.display = "none";
      if (sMsg) sMsg.textContent = "1件 → ジャンプ： " + (BNAME[hits[0].bid] || hits[0].bid) + " " + hits[0].f + "F・" + hits[0].nm;
      jumpTo(hits[0]);
      return;
    }
    /* あいまい（複数候補）：選択してからジャンプ */
    if (pickSel) {
      pickSel.textContent = "";
      hits.forEach((h, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = (BNAME[h.bid] || h.bid) + "　" + h.f + "F：" + h.nm;
        pickSel.appendChild(o);
      });
      pickSel.style.display = "";
    }
    if (sMsg) sMsg.textContent = hits.length + "件見つかりました → 選択してください（Enterで先頭）";
  }
  function nextHit() {
    if (!hits.length) return;
    hitIdx = (hitIdx + 1) % hits.length;
    if (sMsg) sMsg.textContent = hits.length + "件 → " + (hitIdx + 1) + "件目";
    jumpTo(hits[hitIdx]);
  }
  function pickAndJump(i) {
    if (!hits.length || i < 0 || i >= hits.length) return;
    hitIdx = i;
    if (pickSel) pickSel.style.display = "none";
    if (sMsg) sMsg.textContent = (BNAME[hits[i].bid] || hits[i].bid) + " " + hits[i].f + "F・" + hits[i].nm + " にジャンプ";
    jumpTo(hits[i]);
  }
  if (sInp) {
    sInp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        if (e.shiftKey) nextHit();
        else if (pickSel && pickSel.style.display !== "none" && hits.length) pickAndJump(0);
        else runSearch(sInp.value);
      }
    });
    sInp.addEventListener("compositionend", () => { sInp.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  if (sBtn) sBtn.addEventListener("click", () => runSearch(sInp ? sInp.value : ""));
  if (pickSel) pickSel.addEventListener("change", () => { const v = parseInt(pickSel.value, 10); if (!isNaN(v)) pickAndJump(v); });
  window.__plan = { rooms: () => svg.querySelectorAll(".room").length };
})();
