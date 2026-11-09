/*
 * "Was wäre, wenn der 3. Weltkrieg ausbricht?" – viele kurze Einstellungen.
 * Jede Szene ist eine Funktion (ctx, t, s, lt): t = Videozeit, s = Zustand,
 * lt = Zeit seit Beginn dieser Einstellung.
 */
window.makeScene = function (W, H) {
  const { rng, gaussFrom, lerp, mix, rgb, clamp, smooth, mk, wobble, puff, glow, skyline, particles, roundRect } = window.V;
  const SANS = '"Inter", Helvetica, Arial, sans-serif';
  const MONO = '"DejaVu Sans Mono", "Liberation Mono", monospace';

  // ---------- gemeinsame Assets ----------
  const smokeDark = puff([38, 36, 36], 256, 11);
  const smokeGrey = puff([120, 116, 112], 256, 12);
  const smokeLight = puff([220, 216, 210], 256, 13);
  const smokeFire = puff([255, 140, 50], 256, 14);
  const dustP = puff([140, 110, 82], 256, 15);

  const far = skyline(W + 300, 520, { seed: 1, color: [70, 62, 100], minW: 50, maxW: 120, minH: 150, maxH: 420, win: 5, gap: 10, lit: 0.35 });
  const midL = skyline(W + 300, 760, { seed: 2, color: [38, 34, 62], minW: 70, maxW: 170, minH: 250, maxH: 660, win: 7, gap: 22, lit: 0.45 });
  const near = skyline(W + 300, 900, { seed: 3, color: [17, 16, 28], minW: 130, maxW: 260, minH: 320, maxH: 820, win: 10, gap: 34, lit: 0.5 });

  const stars = [];
  (function () { const R = rng(9); for (let i = 0; i < 260; i++) stars.push([R() * W, R() * 1300, 0.6 + R() * 1.6, R()]); })();

  function sprite(ctx, img, x, y, size, alpha, rot = 0) {
    if (alpha <= 0.003) return;
    ctx.globalAlpha = Math.min(1, alpha);
    if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore(); }
    else ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function vignette(ctx, a = 0.6) {
    const v = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = v; ctx.fillRect(-60, -60, W + 120, H + 120);
  }

  function wrapText(ctx, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const t2 = line ? line + ' ' + w : w; if (ctx.measureText(t2).width > maxW && line) { lines.push(line); line = w; } else line = t2; }
    if (line) lines.push(line); return lines;
  }

  // =====================================================================
  // STADT (Abend / Nacht / Stromausfall)
  // =====================================================================
  function layer(ctx, L, x, y, darkP, darkSeed) {
    if (darkP <= 0) { ctx.drawImage(L.lit, x, y); return; }
    ctx.drawImage(L.dark, x, y);
    if (darkP >= 1) return;
    for (const b of L.blocks) {
      const bt = (b.t + darkSeed) % 1;
      if (bt >= darkP) ctx.drawImage(L.lit, b.x, 0, b.w + 1, L.h, x + b.x, y, b.w + 1, L.h);
    }
  }

  function drawCity(ctx, t, lt, o) {
    const night = o.night || 0, darkP = o.darkP || 0;
    const top = mix([18, 22, 58], [3, 5, 14], night), mid = mix([88, 58, 112], [12, 16, 36], night), hor = mix([246, 146, 96], [44, 40, 66], night);
    const g = ctx.createLinearGradient(0, 0, 0, 1500);
    g.addColorStop(0, rgb(top)); g.addColorStop(0.55, rgb(mid)); g.addColorStop(1, rgb(hor));
    ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, 1600);
    if (night > 0.1) for (const st of stars) {
      ctx.fillStyle = `rgba(255,255,255,${(0.3 + 0.5 * st[3]) * night * (0.75 + 0.25 * Math.sin(t * 2 + st[3] * 9))})`;
      ctx.fillRect(st[0], st[1], st[2], st[2]);
    }
    glow(ctx, 720, 1330, 700, [255, 170, 100], 0.5 * (1 - night));
    // Wolken
    for (let i = 0; i < 6; i++) {
      const x = ((i * 230 + lt * 12) % (W + 500)) - 250, y = 300 + (i % 3) * 170;
      sprite(ctx, smokeLight, x, y, 460 + (i % 2) * 200, 0.25 * (1 - night * 0.7));
      ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
    }
    // Ebenen mit Parallaxe
    layer(ctx, far, -150 + lt * 3, 1330 - far.h, darkP, 0.0);
    let hz = ctx.createLinearGradient(0, 1100, 0, 1340);
    hz.addColorStop(0, rgb(hor, 0)); hz.addColorStop(1, rgb(hor, 0.45));
    ctx.fillStyle = hz; ctx.fillRect(-60, 1100, W + 120, 240);
    layer(ctx, midL, -150 + lt * 6, 1450 - midL.h, darkP, 0.33);
    hz = ctx.createLinearGradient(0, 1250, 0, 1460);
    hz.addColorStop(0, rgb(hor, 0)); hz.addColorStop(1, rgb(hor, 0.25));
    ctx.fillStyle = hz; ctx.fillRect(-60, 1250, W + 120, 210);
    layer(ctx, near, -150 + lt * 10, 1590 - near.h, darkP, 0.66);
    if (o.extraSky) o.extraSky(ctx);
    // Straße
    ctx.fillStyle = '#121218'; ctx.fillRect(-60, 1590, W + 120, 170);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = -((lt * 120) % 160); x < W; x += 160) ctx.fillRect(x, 1672, 70, 5);
    // Laternen
    for (let i = 0; i < 7; i++) {
      const x = i * 180 + 40, on = (i * 0.37) % 1 >= darkP;
      ctx.fillStyle = '#0b0b10'; ctx.fillRect(x, 1500, 6, 95); ctx.fillRect(x, 1500, 34, 5);
      if (on) { glow(ctx, x + 30, 1508, 120, [255, 200, 130], 0.55); glow(ctx, x + 30, 1600, 90, [255, 200, 130], 0.2); }
    }
    // Autos
    for (let k = 0; k < 7; k++) {
      const x1 = ((k * 290 + lt * 240) % (W + 500)) - 250;
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(x1 - 60, 1628, 120, 30);
      glow(ctx, x1 + 66, 1645, 70, [255, 245, 220], 0.7); ctx.fillStyle = '#fff8e0'; ctx.fillRect(x1 + 58, 1640, 8, 6);
      const x2 = W + 250 - ((k * 330 + lt * 200) % (W + 500));
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(x2 - 60, 1690, 120, 32);
      glow(ctx, x2 + 64, 1708, 50, [255, 40, 30], 0.6); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x2 + 56, 1703, 8, 6);
    }
    // Balkongeländer im Vordergrund
    ctx.fillStyle = '#07070a';
    ctx.fillRect(-60, 1770, W + 120, 16); ctx.fillRect(-60, 1900, W + 120, 30);
    for (let x = 10; x < W; x += 58) ctx.fillRect(x, 1770, 7, 150);
    // Pflanze
    ctx.fillStyle = '#07070a';
    ctx.beginPath(); ctx.moveTo(60, 1920); ctx.lineTo(80, 1800); ctx.lineTo(190, 1800); ctx.lineTo(210, 1920); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = -2.6 + i * 0.25 + Math.sin(t * 0.8 + i) * 0.04;
      ctx.beginPath(); ctx.ellipse(135 + Math.cos(a) * 90, 1790 + Math.sin(a) * 110, 60, 16, a, 0, 7); ctx.fill();
    }
    vignette(ctx, 0.55);
  }

  // =====================================================================
  // HANDY AUF DEM TISCH
  // =====================================================================
  const wood = mk(W, H);
  (function () {
    const c = wood.getContext('2d'), R = rng(21);
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5a3a26'); g.addColorStop(1, '#2e1d13');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      const x = R() * W; c.strokeStyle = `rgba(${R() < 0.5 ? '20,10,5' : '120,80,50'},${0.05 + R() * 0.12})`;
      c.lineWidth = 1 + R() * 3; c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= H; y += 60) c.lineTo(x + Math.sin(y / 180 + x) * 10, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,0.5)';
    for (let x = 200; x < W; x += 270) c.fillRect(x, 0, 4, H);
  })();

  const notes = [
    { at: 0.45, app: 'WARN-APP', color: '#e0342b', title: '⚠ Extreme Gefahr', body: 'Suchen Sie sofort Schutz in einem Gebäude. Folgen Sie den Anweisungen der Behörden.' },
    { at: 1.55, app: 'NACHRICHTEN', color: '#2f6fe0', title: 'Eilmeldung', body: 'Militärische Eskalation – Lage unübersichtlich' },
    { at: 2.45, app: 'MAMA', color: '#33b357', title: 'Mama', body: 'Wo bist du gerade?? Ruf bitte sofort an!' },
    { at: 3.35, app: 'NACHRICHTEN', color: '#2f6fe0', title: 'Eilmeldung', body: 'Regierung ruft den Notstand aus' },
  ];

  function drawPhone(ctx, t, s, lt) {
    ctx.drawImage(wood, 0, 0);
    glow(ctx, 250, 200, 1100, [255, 190, 120], 0.25);
    // Tasse
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = 20; ctx.shadowOffsetY = 25;
    ctx.fillStyle = '#e4ded4'; ctx.beginPath(); ctx.arc(190, 330, 120, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#e4ded4'; ctx.fillRect(300, 310, 70, 40);
    ctx.fillStyle = '#3a2216'; ctx.beginPath(); ctx.arc(190, 330, 95, 0, 7); ctx.fill();
    const ripple = Math.max(0, ...notes.map(n => lt > n.at ? Math.exp(-(lt - n.at) * 4) : 0));
    ctx.strokeStyle = `rgba(255,230,200,${0.08 + 0.25 * ripple})`; ctx.lineWidth = 2;
    for (let r = 20; r < 95; r += 18) { ctx.beginPath(); ctx.arc(190, 330, r + ripple * 6 * Math.sin(lt * 40 + r), 0, 7); ctx.stroke(); }
    glow(ctx, 160, 300, 40, [255, 255, 255], 0.2);
    // Schlüssel
    ctx.strokeStyle = '#9a9aa2'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(880, 1560, 46, 0, 7); ctx.stroke();
    ctx.fillStyle = '#a7a7af';
    ctx.save(); ctx.translate(880, 1560); ctx.rotate(0.7); ctx.fillRect(40, -14, 150, 28); ctx.fillRect(160, 14, 16, 18); ctx.fillRect(130, 14, 12, 12); ctx.restore();
    ctx.save(); ctx.translate(880, 1560); ctx.rotate(1.6); ctx.fillStyle = '#c8a24a'; ctx.fillRect(40, -12, 130, 24); ctx.restore();

    // Handy
    const jit = ripple * 7;
    const px = 540 + Math.sin(lt * 90) * jit, py = 1000 + Math.cos(lt * 77) * jit;
    const PW = 580, PH = 1180;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(-0.06 + ripple * 0.01 * Math.sin(lt * 60));
    ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 60; ctx.shadowOffsetX = 25; ctx.shadowOffsetY = 35;
    ctx.fillStyle = '#121216'; roundRect(ctx, -PW / 2, -PH / 2, PW, PH, 80); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 4; roundRect(ctx, -PW / 2 + 2, -PH / 2 + 2, PW - 4, PH - 4, 78); ctx.stroke();
    // Bildschirm
    const SX = -PW / 2 + 20, SY = -PH / 2 + 20, SW = PW - 40, SH = PH - 40;
    ctx.save(); roundRect(ctx, SX, SY, SW, SH, 62); ctx.clip();
    const sg = ctx.createLinearGradient(0, SY, 0, SY + SH);
    sg.addColorStop(0, '#1b2a5e'); sg.addColorStop(1, '#5a2a6e');
    ctx.fillStyle = sg; ctx.fillRect(SX, SY, SW, SH);
    // roter Alarm-Schein
    const alarm = lt > notes[0].at ? 0.35 + 0.25 * Math.sin(lt * 9) : 0;
    const rg = ctx.createRadialGradient(0, 0, SW * 0.3, 0, 0, SH * 0.7);
    rg.addColorStop(0, 'rgba(255,40,30,0)'); rg.addColorStop(1, `rgba(255,40,30,${alarm})`);
    ctx.fillStyle = rg; ctx.fillRect(SX, SY, SW, SH);
    // Kamera-Insel + Statusleiste
    ctx.fillStyle = '#000'; roundRect(ctx, -70, SY + 22, 140, 40, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `600 26px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText('21:47', SX + 48, SY + 52);
    ctx.textAlign = 'right'; ctx.fillText('●●●  ▮▮▮', SX + SW - 44, SY + 52);
    ctx.textAlign = 'center';
    ctx.font = `500 30px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('Montag, 9. November', 0, SY + 160);
    ctx.font = `600 150px ${SANS}`; ctx.fillStyle = '#fff'; ctx.fillText('21:47', 0, SY + 310);
    // Benachrichtigungen (neueste oben)
    const shown = notes.filter(n => lt > n.at);
    shown.forEach((n, idx) => {
      const pos = shown.length - 1 - idx;
      const age = lt - n.at, slide = 1 - Math.pow(1 - clamp(age / 0.35), 3);
      const later = shown.slice(idx + 1).reduce((acc, m) => acc + (1 - Math.pow(1 - clamp((lt - m.at) / 0.35), 3)), 0);
      const y = SY + 380 + later * 200 - (1 - slide) * 260;
      const a = clamp(age / 0.25) * (pos > 2 ? 0 : 1);
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a;
      const CX = SX + 22, CW = SW - 44, CH = 185;
      ctx.fillStyle = 'rgba(242,242,247,0.9)'; roundRect(ctx, CX, y, CW, CH, 32); ctx.fill();
      ctx.fillStyle = n.color; roundRect(ctx, CX + 22, y + 22, 44, 44, 11); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#6b6b70'; ctx.font = `600 21px ${SANS}`;
      ctx.fillText(n.app, CX + 80, y + 52); ctx.textAlign = 'right'; ctx.fillText('jetzt', CX + CW - 24, y + 52);
      ctx.textAlign = 'left'; ctx.fillStyle = '#111'; ctx.font = `600 30px ${SANS}`; ctx.fillText(n.title, CX + 24, y + 102);
      ctx.font = `500 25px ${SANS}`; ctx.fillStyle = '#222';
      wrapText(ctx, n.body, CW - 50).slice(0, 2).forEach((l, k) => ctx.fillText(l, CX + 24, y + 140 + k * 31));
      ctx.restore();
    });
    ctx.restore();
    ctx.restore();
    // Bildschirmlicht auf dem Tisch
    glow(ctx, px, py, 700, [120, 120, 255], 0.12 + alarm * 0.25);
    vignette(ctx, 0.7);
  }

  // =====================================================================
  // RADAR
  // =====================================================================
  const scan = mk(W, H);
  (function () { const c = scan.getContext('2d'); c.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2); })();
  const blips = [];
  (function () {
    const R = rng(31);
    for (let i = 0; i < 26; i++) blips.push({ r: 0.72 + R() * 0.26, a: -2.5 + R() * 1.1, v: 0.012 + R() * 0.01, id: 1000 + (R() * 8999 | 0) });
  })();
  const log = ['> SYSTEMPRÜFUNG ........ OK', '> SENSOR 4: KONTAKT', '> OBJEKTE: 26   KURS 041', '> GESCHW.: 24.000 KM/H', '> BEWERTUNG: BALLISTISCH', '> MELDUNG AN KOMMANDO ...'];

  function drawRadar(ctx, t, s, lt) {
    ctx.fillStyle = '#030b07'; ctx.fillRect(-60, -60, W + 120, H + 120);
    const cx = 540, cy = 540, R = 380;
    glow(ctx, cx, cy, R * 1.4, [30, 255, 120], 0.07);
    ctx.fillStyle = '#04150c'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(70,255,150,0.28)'; ctx.lineWidth = 2;
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 4, 0, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    for (let d = 0; d < 360; d += 10) {
      const a = d * Math.PI / 180, l = d % 30 ? 10 : 22;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); ctx.stroke();
    }
    // Sweep mit Nachleuchten
    const ang = lt * 2.1 - Math.PI / 2;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    const cg = ctx.createConicGradient(ang - 1.3, cx, cy);
    cg.addColorStop(0, 'rgba(60,255,140,0)'); cg.addColorStop(1.3 / (2 * Math.PI), 'rgba(60,255,140,0.42)');
    cg.addColorStop(1.3 / (2 * Math.PI) + 0.002, 'rgba(60,255,140,0)'); cg.addColorStop(1, 'rgba(60,255,140,0)');
    ctx.fillStyle = cg; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();
    ctx.strokeStyle = 'rgba(160,255,200,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
    // Ziele
    const n = Math.floor(clamp(s.blips) * blips.length);
    ctx.font = `600 17px ${MONO}`; ctx.textAlign = 'left';
    for (let i = 0; i < n; i++) {
      const b = blips[i], r = (b.r - b.v * lt) * R, x = cx + Math.cos(b.a) * r, y = cy + Math.sin(b.a) * r;
      let d = (ang - b.a) % (2 * Math.PI); if (d < 0) d += 2 * Math.PI;
      const br = 0.25 + 0.75 * Math.exp(-d * 1.1);
      const col = s.alarm > 0.5 ? [255, 90, 70] : [120, 255, 170];
      glow(ctx, x, y, 26, col, 0.5 * br);
      ctx.fillStyle = rgb(col, br); ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      if (i < 7) { ctx.fillStyle = rgb(col, 0.7 * br); ctx.fillText('TRK ' + b.id, x + 12, y - 10); }
    }
    ctx.strokeStyle = 'rgba(70,255,150,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    // Konsole
    ctx.font = `500 30px ${MONO}`; ctx.fillStyle = 'rgba(110,255,170,0.9)';
    log.forEach((line, i) => {
      const nch = Math.floor((lt - i * 0.85) * 32);
      if (nch > 0) ctx.fillText(line.slice(0, nch) + (nch < line.length && Math.sin(lt * 20) > 0 ? '█' : ''), 80, 1390 + i * 52);
    });
    // Alarm
    if (s.alarm > 0.02) {
      const on = Math.sin(lt * 7) > -0.2;
      ctx.fillStyle = `rgba(200,20,20,${(on ? 0.85 : 0.35) * s.alarm})`; ctx.fillRect(0, 1040, W, 90);
      ctx.font = `700 40px ${MONO}`; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,255,255,${s.alarm})`;
      ctx.fillText('WARNUNG · STARTS ERKANNT', W / 2, 1100);
      const rv = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      rv.addColorStop(0, 'rgba(255,0,0,0)'); rv.addColorStop(1, `rgba(255,0,0,${(0.25 + 0.15 * Math.sin(lt * 7)) * s.alarm})`);
      ctx.fillStyle = rv; ctx.fillRect(-60, -60, W + 120, H + 120);
    }
    ctx.drawImage(scan, 0, 0);
    ctx.fillStyle = `rgba(120,255,170,${0.02 + 0.02 * Math.sin(t * 50)})`; ctx.fillRect(-60, -60, W + 120, H + 120);
    vignette(ctx, 0.8);
  }

  // =====================================================================
  // SILO / START
  // =====================================================================
  const treeline = [];
  (function () { const R = rng(41); for (let x = -40; x < W + 40; x += 14) treeline.push([x, 1170 - R() * 70 - (R() < 0.2 ? 40 : 0)]); })();

  function siloEnv(ctx, t, lt, open, launchLight) {
    const g = ctx.createLinearGradient(0, 0, 0, 1200);
    g.addColorStop(0, '#04070f'); g.addColorStop(0.7, '#13213a'); g.addColorStop(1, '#2d3b52');
    ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, 1300);
    for (const st of stars) { ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.4 * st[3]})`; ctx.fillRect(st[0], st[1] * 0.85, st[2], st[2]); }
    glow(ctx, 540, 1200, 900, [255, 160, 80], launchLight * 0.6);
    // Baumreihe
    ctx.fillStyle = rgb(mix([8, 12, 16], [60, 34, 20], launchLight * 0.6));
    ctx.beginPath(); ctx.moveTo(-60, 1250);
    for (const p of treeline) { ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0] + 7, p[1] - 25); }
    ctx.lineTo(W + 60, 1250); ctx.fill();
    // Boden
    const gg = ctx.createLinearGradient(0, 1180, 0, H);
    gg.addColorStop(0, rgb(mix([18, 22, 24], [90, 55, 30], launchLight))); gg.addColorStop(1, rgb(mix([6, 8, 8], [40, 24, 14], launchLight)));
    ctx.fillStyle = gg; ctx.fillRect(-60, 1180, W + 120, H);
    // Zaun
    ctx.strokeStyle = 'rgba(20,24,28,0.9)'; ctx.lineWidth = 4;
    for (let x = -20; x < W + 40; x += 70) { ctx.beginPath(); ctx.moveTo(x, 1300); ctx.lineTo(x, 1220); ctx.stroke(); }
    ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-20, 1230 + k * 20); ctx.lineTo(W + 40, 1230 + k * 20); ctx.stroke(); }
    // Betonplatte
    ctx.fillStyle = rgb(mix([58, 60, 62], [160, 120, 90], launchLight));
    ctx.beginPath(); ctx.moveTo(150, 1560); ctx.lineTo(320, 1340); ctx.lineTo(760, 1340); ctx.lineTo(930, 1560); ctx.fill();
    // Schacht
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(540, 1430, 210, 62, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(540, 1430, 210, 62, 0, 0, 7); ctx.clip();
    glow(ctx, 540, 1450, 220, [255, 140, 60], 0.25 * open + launchLight);
    ctx.restore();
    // Deckel gleitet zur Seite
    ctx.fillStyle = '#3d4044';
    const dx = open * 400;
    ctx.beginPath(); ctx.ellipse(540 + dx, 1424, 222, 66, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2c30'; ctx.fillRect(330 + dx, 1424, 420, 26);
    ctx.strokeStyle = 'rgba(255,220,0,0.6)'; ctx.lineWidth = 6;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(540 + dx + k * 50 - 20, 1400); ctx.lineTo(540 + dx + k * 50 + 20, 1445); ctx.stroke(); }
    // Warnleuchten
    for (const [x, ph] of [[230, 0], [850, 1.6]]) {
      ctx.fillStyle = '#111'; ctx.fillRect(x - 5, 1250, 10, 160);
      const p = 0.5 + 0.5 * Math.sin(lt * 9 + ph);
      glow(ctx, x, 1245, 260, [255, 40, 20], 0.55 * p);
      ctx.fillStyle = `rgba(255,${60 + p * 80},40,1)`; ctx.beginPath(); ctx.arc(x, 1245, 13, 0, 7); ctx.fill();
    }
    // Dampf
    particles(14, 2.6, lt, (k, age, R) => {
      const x = 540 + (R() - 0.5) * 300 + age * (R() - 0.5) * 200, y = 1420 - age * 420;
      sprite(ctx, smokeLight, x, y, 160 + age * 360, 0.35 * open * Math.sin(age * Math.PI));
    }, 44);
  }

  function drawSilo(ctx, t, s, lt) {
    siloEnv(ctx, t, lt, smooth(0.5, 3.2, lt), 0);
    vignette(ctx, 0.65);
  }

  function drawLaunch(ctx, t, s, lt) {
    const m = Math.max(0, lt - 0.25);
    const baseY = 1440 - m * m * 300 - m * 120;     // Raketenboden
    const light = clamp(lt * 3) * 0.9;
    siloEnv(ctx, t, lt, 1, light * 0.5);
    // ferne Starts am Horizont
    [[140, 0.5], [820, 1.0], [990, 1.5], [330, 1.9]].forEach(([x, st]) => {
      const a = lt - st; if (a <= 0) return;
      const y = 1170 - a * a * 160 - a * 90;
      const tg = ctx.createLinearGradient(0, 1170, 0, y);
      tg.addColorStop(0, 'rgba(230,220,210,0.05)'); tg.addColorStop(1, 'rgba(240,230,220,0.6)');
      ctx.strokeStyle = tg; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, 1170); ctx.quadraticCurveTo(x, (1170 + y) / 2, x + a * 12, y); ctx.stroke();
      glow(ctx, x + a * 12, y, 60, [255, 210, 140], 0.9);
    });
    // Rauchsäule entlang der Bahn
    ctx.save();
    for (let k = 0; k < 26; k++) {
      const y = 1430 - k * 70; if (y < baseY + 40) break;
      const age = clamp((y - baseY) / 1400);
      sprite(ctx, smokeLight, 540 + Math.sin(k * 1.7 + lt) * 16 * age, y, 150 + age * 260, 0.85 - age * 0.3, k);
      ctx.globalCompositeOperation = 'lighter';
      sprite(ctx, smokeFire, 540, y, 140 + age * 200, 0.55 * (1 - age * 1.5));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // Rakete (nur oberhalb der Schachtöffnung sichtbar)
    ctx.save();
    ctx.beginPath(); ctx.rect(-60, -2000, W + 120, 1430 + 2000); ctx.clip();
    const L = 560, Wd = 74;
    const bg = ctx.createLinearGradient(540 - Wd / 2, 0, 540 + Wd / 2, 0);
    bg.addColorStop(0, '#9da0a4'); bg.addColorStop(0.4, '#f2f2f0'); bg.addColorStop(1, '#6f7276');
    ctx.fillStyle = bg; ctx.fillRect(540 - Wd / 2, baseY - L, Wd, L);
    ctx.beginPath(); ctx.moveTo(540 - Wd / 2, baseY - L); ctx.quadraticCurveTo(540, baseY - L - 170, 540 + Wd / 2, baseY - L); ctx.fill();
    ctx.fillStyle = '#2b2d30'; ctx.fillRect(540 - Wd / 2, baseY - L * 0.55, Wd, 14); ctx.fillRect(540 - Wd / 2, baseY - 30, Wd, 30);
    ctx.restore();
    // Triebwerksflamme
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = 1 + 0.12 * Math.sin(lt * 50);
    const fg = ctx.createLinearGradient(0, baseY, 0, baseY + 340 * fl);
    fg.addColorStop(0, 'rgba(255,255,240,1)'); fg.addColorStop(0.3, 'rgba(255,200,90,0.9)'); fg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(540 - 34, baseY); ctx.quadraticCurveTo(540, baseY + 420 * fl, 540 + 34, baseY); ctx.fill();
    glow(ctx, 540, baseY + 60, 420, [255, 190, 110], 0.8);
    ctx.restore();
    // Rauch, der am Boden aus dem Schacht quillt
    particles(40, 2.2, lt, (k, age, R) => {
      const dir = R() < 0.5 ? -1 : 1, sp = 260 + R() * 420;
      const x = 540 + dir * age * sp, y = 1440 - age * (60 + R() * 240) + R() * 40;
      const sz = 200 + age * 520;
      sprite(ctx, smokeGrey, x, y, sz, 0.8 * Math.min(1, lt * 2) * (1 - age * 0.6), R() * 6);
      ctx.globalCompositeOperation = 'lighter';
      sprite(ctx, smokeFire, x, y, sz * 0.9, 0.45 * (1 - age) * light);
      ctx.globalCompositeOperation = 'source-over';
    }, 45);
    vignette(ctx, 0.6);
  }

  // =====================================================================
  // ANFLUG ÜBER DER STADT
  // =====================================================================
  const rv = [];
  (function () { const R = rng(51); for (let i = 0; i < 8; i++) rv.push({ st: i * 0.55 + R() * 0.3, x0: 120 + R() * 900, x1: 100 + R() * 880, dur: 2.6 + R() * 1.2 }); })();

  function drawIncoming(ctx, t, s, lt) {
    drawCity(ctx, t, lt, {
      night: 1, darkP: 0.75,
      extraSky: c => {},
    });
    // Suchscheinwerfer
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[180, 0], [560, 2], [930, 4]].forEach(([x, ph]) => {
      const a = -Math.PI / 2 + Math.sin(lt * 0.7 + ph) * 0.5;
      const len = 1700, wdt = 0.06;
      const g = ctx.createLinearGradient(x, 1500, x + Math.cos(a) * len, 1500 + Math.sin(a) * len);
      g.addColorStop(0, 'rgba(200,215,255,0.22)'); g.addColorStop(1, 'rgba(200,215,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 1500);
      ctx.lineTo(x + Math.cos(a - wdt) * len, 1500 + Math.sin(a - wdt) * len);
      ctx.lineTo(x + Math.cos(a + wdt) * len, 1500 + Math.sin(a + wdt) * len); ctx.fill();
    });
    // Wiedereintritts-Streifen
    for (const r of rv) {
      const p = (lt - r.st) / r.dur; if (p <= 0 || p > 1.05) continue;
      const pe = Math.min(p, 1);
      const x = lerp(r.x0, r.x1, pe), y = lerp(-150, 1250, pe);
      const tx = lerp(r.x0, r.x1, Math.max(0, pe - 0.28)), ty = lerp(-150, 1250, Math.max(0, pe - 0.28));
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(255,170,90,0)'); g.addColorStop(1, 'rgba(255,230,190,0.9)');
      ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      glow(ctx, x, y, 90, [255, 220, 170], 0.9);
      glow(ctx, x, y, 22, [255, 255, 255], 1);
    }
    ctx.restore();
    glow(ctx, 540, 1350, 900, [255, 120, 60], 0.08 + 0.04 * Math.sin(lt * 3));
  }

  // =====================================================================
  // DETONATION (aus sicherer Entfernung, von einem Hügel aus)
  // =====================================================================
  const BX = 610, GY = 1250;
  const stemR = rng(61), capPuffs = [];
  for (let i = 0; i < 46; i++) capPuffs.push({ a: stemR() * Math.PI * 2, r: 0.6 + stemR() * 0.5, s: 0.5 + stemR() * 0.6, y: (stemR() - 0.5) * 0.5 });

  function drawBlast(ctx, t, s, lt) {
    const b = Math.exp(-lt * 0.5);                       // Helligkeit des Feuerballs
    const rise = smooth(0, 7, lt);
    const fy = GY - 80 - rise * 520, fr = 80 + 150 * (1 - Math.exp(-lt * 1.1));
    // Himmel
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, rgb(mix([6, 8, 18], [70, 30, 20], b * 0.8))); sky.addColorStop(1, rgb(mix([30, 26, 40], [255, 150, 70], b)));
    ctx.fillStyle = sky; ctx.fillRect(-60, -60, W + 120, GY + 80);
    glow(ctx, BX, fy, 1300, [255, 150, 70], 0.55 * b + 0.15);
    // ferne Stadt (dunkel, angestrahlt)
    ctx.save(); ctx.filter = `brightness(${0.25 + 0.35 * b}) sepia(0.6)`; ctx.drawImage(far.dark, -150, GY + 20 - far.h, far.w, far.h); ctx.restore();
    // Staubfuß
    for (let i = 0; i < 16; i++) {
      const x = BX + (i - 7.5) * (30 + lt * 34), y = GY + 10 - Math.abs(i - 7.5) * 4;
      sprite(ctx, dustP, x, y - 20, 180 + lt * 60, 0.75 * clamp(lt), i);
    }
    // Stiel
    if (lt > 0.6) {
      const top = fy + fr * 0.6, sw = 40 + lt * 26;
      for (let y = GY - 20; y > top; y -= 34) {
        const k = (GY - y) / (GY - top);
        sprite(ctx, smokeGrey, BX + Math.sin(y * 0.03 + lt) * 6, y, sw * (1.6 - k * 0.5) + 60, 0.85 * smooth(0.6, 2, lt), y);
        ctx.globalCompositeOperation = 'lighter';
        sprite(ctx, smokeFire, BX, y, sw * 1.4, 0.35 * b * k);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // Pilzhut (rollender Ring)
    const capW = fr * (1.35 + 0.22 * lt), capH = fr * (0.75 + 0.05 * lt);
    for (const p of capPuffs) {
      const a = p.a + lt * 0.5;
      const x = BX + Math.cos(a) * capW * p.r, y = fy + p.y * capH + Math.sin(a) * capH * 0.35 - capH * 0.15;
      const front = Math.sin(a) > 0;
      sprite(ctx, front ? smokeGrey : smokeDark, x, y, fr * p.s * 2.0 + 90, smooth(0.3, 1.6, lt), a);
      ctx.globalCompositeOperation = 'lighter';
      sprite(ctx, smokeFire, x, y, fr * p.s * 1.5, 0.55 * b);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Feuerball
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(BX, fy, 0, BX, fy, fr);
    fg.addColorStop(0, rgb(mix([255, 120, 40], [255, 255, 240], b), 1));
    fg.addColorStop(0.55, rgb(mix([200, 60, 20], [255, 200, 90], b), 0.95));
    fg.addColorStop(1, 'rgba(180,40,10,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(BX, fy, fr, 0, 7); ctx.fill();
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + lt * 0.9;
      sprite(ctx, smokeFire, BX + Math.cos(a) * fr * 0.7, fy + Math.sin(a) * fr * 0.5, fr * 1.1, 0.5 * (0.4 + b));
    }
    ctx.restore();
    // Druckwelle: Kondensationsglocke + Staubwand, die auf uns zurollt
    const R0 = lt * 340;
    if (lt < 4) {
      ctx.save(); ctx.globalAlpha = clamp(1 - lt / 4) * 0.5;
      ctx.strokeStyle = 'rgba(255,240,230,0.9)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(BX, GY, R0, R0 * 0.55, 0, Math.PI, 2 * Math.PI); ctx.stroke();
      ctx.restore();
    }
    // Boden
    const front = GY + 670 * Math.pow(clamp((lt - 0.4) / 4.3), 1.6);
    const gg = ctx.createLinearGradient(0, GY, 0, H);
    gg.addColorStop(0, rgb(mix([20, 18, 20], [130, 70, 40], b))); gg.addColorStop(1, rgb(mix([5, 5, 6], [40, 20, 12], b)));
    ctx.fillStyle = gg; ctx.fillRect(-60, GY, W + 120, H - GY + 60);
    if (lt > 0.4) {
      ctx.fillStyle = 'rgba(120,85,55,0.55)'; ctx.fillRect(-60, GY, W + 120, front - GY);
      for (let i = 0; i < 18; i++) {
        const x = -40 + i * 66 + Math.sin(i * 3 + lt) * 20;
        const sz = 160 + (front - GY) * 0.55;
        sprite(ctx, dustP, x, front - sz * 0.25, sz, 0.85, i + lt * 0.3);
      }
    }
    // Vordergrund-Hügel mit Bäumen, die sich biegen
    const hit = smooth(4.3, 4.8, lt), bend = -0.45 * hit + Math.sin(lt * 9) * 0.06 * hit;
    ctx.fillStyle = rgb(mix([5, 5, 7], [45, 25, 15], b * 0.6));
    ctx.beginPath(); ctx.moveTo(-60, H + 60); ctx.lineTo(-60, 1700);
    ctx.quadraticCurveTo(300, 1620, 620, 1720); ctx.quadraticCurveTo(900, 1800, W + 60, 1760); ctx.lineTo(W + 60, H + 60); ctx.fill();
    for (const [x, y, h] of [[150, 1680, 380], [260, 1665, 300], [930, 1780, 340]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(bend * (h / 380));
      ctx.fillStyle = ctx.strokeStyle = rgb(mix([5, 5, 7], [45, 25, 15], b * 0.6));
      ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.stroke();
      for (let k = 0; k < 5; k++) {
        const ty = -h * 0.3 - k * h * 0.14, tw = h * 0.35 * (1 - k / 6);
        ctx.beginPath(); ctx.moveTo(-tw / 2, ty); ctx.lineTo(0, ty - h * 0.25); ctx.lineTo(tw / 2, ty); ctx.fill();
      }
      ctx.restore();
    }
    // Trümmer und Staub nach dem Eintreffen der Welle
    if (hit > 0) {
      ctx.fillStyle = `rgba(110,80,55,${0.55 * hit})`; ctx.fillRect(-60, -60, W + 120, H + 120);
      particles(60, 0.9, lt, (k, age, R) => {
        const x = W * R() + age * 900 - 450, y = 1300 + R() * 600 - age * 200;
        ctx.fillStyle = `rgba(40,28,20,${hit * (1 - age)})`; ctx.fillRect(x, y, 4 + R() * 10, 3 + R() * 6);
      }, 66);
      for (let i = 0; i < 8; i++) sprite(ctx, dustP, (i * 170 + lt * 500) % (W + 400) - 200, 1500 + (i % 3) * 140, 520, 0.7 * hit, i);
    }
    vignette(ctx, 0.55);
  }

  // =====================================================================
  // ERDE AUS DEM ALL – Ruß verdunkelt die Atmosphäre
  // =====================================================================
  const tex = mk(2400, 1100);
  (function () {
    const c = tex.getContext('2d'), R = rng(71);
    c.fillStyle = '#123a78'; c.fillRect(0, 0, 2400, 1100);
    for (let k = 0; k < 9; k++) {
      const cx = R() * 2400, cy = 150 + R() * 800, n = 160;
      for (let i = 0; i < n; i++) {
        const r = 30 + R() * 90, x = cx + (R() - 0.5) * 520 * (R() + 0.3), y = cy + (R() - 0.5) * 360 * (R() + 0.3);
        c.fillStyle = R() < 0.6 ? `rgba(${60 + R() * 30 | 0},${100 + R() * 30 | 0},${50 + R() * 20 | 0},0.6)` : `rgba(${150 + R() * 40 | 0},${130 + R() * 30 | 0},${80 + R() * 20 | 0},0.5)`;
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
    }
    for (let i = 0; i < 160; i++) {
      const x = R() * 2400, y = R() * 1100, s = 120 + R() * 280;
      c.save(); c.translate(x, y); c.scale(1.8, 0.6); c.globalAlpha = 0.55; c.drawImage(smokeLight, -s / 2, -s / 2, s, s); c.restore();
    }
  })();
  const fires = [];
  (function () { const R = rng(73); for (let i = 0; i < 16; i++) fires.push([60 + R() * 960, 1000 + R() * 780, R()]); })();
  const ER = 1700, EX = 540, EY = 900 + ER;

  function drawSpace(ctx, t, s, lt) {
    ctx.fillStyle = '#000'; ctx.fillRect(-60, -60, W + 120, H + 120);
    for (const st of stars) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * st[3]})`; ctx.fillRect(st[0], st[1] * 0.7, st[2], st[2]); }
    glow(ctx, 980, 160, 520, [255, 240, 210], 0.55); glow(ctx, 980, 160, 70, [255, 255, 255], 1);
    // Atmosphärensaum
    const atm = mix([110, 170, 255], [120, 90, 70], s.soot);
    ctx.save();
    ctx.shadowColor = rgb(atm, 0.9 - s.soot * 0.5); ctx.shadowBlur = 70;
    ctx.strokeStyle = rgb(atm, 0.75 - s.soot * 0.35); ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(EX, EY, ER + 12, 0, 7); ctx.stroke();
    ctx.restore();
    // Erdoberfläche
    ctx.save(); ctx.beginPath(); ctx.arc(EX, EY, ER, 0, 7); ctx.clip();
    const off = (lt * 14) % 1200;
    ctx.drawImage(tex, -600 - off, 880, 2400, 1100);
    // Tag-Nacht-Grenze (links Nacht)
    const tg = ctx.createLinearGradient(0, 0, W, 0);
    tg.addColorStop(0, 'rgba(0,0,8,0.9)'); tg.addColorStop(0.25, 'rgba(0,0,8,0.5)'); tg.addColorStop(0.45, 'rgba(0,0,8,0)');
    ctx.fillStyle = tg; ctx.fillRect(-60, 800, W + 120, H);
    // Stadtlichter auf der Nachtseite
    const R = rng(77);
    for (let i = 0; i < 260; i++) {
      const x = (R() * 1100 - off * 0.9 + 1200) % 1200 - 60, y = 950 + R() * 950;
      if (x > 330) continue;
      ctx.fillStyle = `rgba(255,210,130,${(0.5 + R() * 0.5) * (1 - s.soot) * (1 - x / 330)})`; ctx.fillRect(x, y, 2.5, 2.5);
    }
    // Brände
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fires) glow(ctx, f[0], f[1], 34 + 10 * wobble(t * 4, f[2] * 9), [255, 120, 40], 0.9 * clamp(s.soot * 3 + 0.4));
    ctx.globalCompositeOperation = 'source-over';
    // Rauchfahnen, die sich ausbreiten
    for (const f of fires) {
      for (let k = 0; k < 4; k++) {
        const h = (k + 1) / 4, sz = 90 + 260 * s.soot * h;
        sprite(ctx, smokeDark, f[0] + Math.sin(f[2] * 9 + k) * 40 * h, f[1] - h * 120 * s.soot, sz, 0.55 * clamp(s.soot * 2), k + f[2]);
      }
    }
    // globale Rußschicht
    ctx.fillStyle = `rgba(40,32,26,${0.6 * s.soot})`; ctx.fillRect(-60, 800, W + 120, H);
    for (let i = 0; i < 14; i++) sprite(ctx, smokeDark, (i * 160 + lt * 25) % (W + 300) - 150, 1000 + (i % 4) * 230, 700, 0.5 * s.soot, i);
    // Kugel-Schattierung
    const sh = ctx.createRadialGradient(EX + 300, EY - ER + 300, ER * 0.2, EX, EY, ER);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = sh; ctx.fillRect(-60, 800, W + 120, H);
    ctx.restore();
    vignette(ctx, 0.5);
  }

  // =====================================================================
  // NUKLEARER WINTER – Kornfeld im Sommer, Schnee fällt
  // =====================================================================
  const VP = [540, 1150];
  const stalks = [];
  (function () {
    const R = rng(81);
    for (let i = 0; i < 2600; i++) {
      const d = Math.pow(R(), 1.8);                  // 0 = fern, 1 = nah
      const y = 1160 + d * 820, x = (R() - 0.5) * (W + 200) * (0.6 + d * 1.6) + 540;
      stalks.push({ x, y, h: 14 + d * 210, d, s: R() });
    }
    stalks.sort((a, b) => a.y - b.y);
  })();
  const flakes = [];
  (function () { const R = rng(83); for (let i = 0; i < 500; i++) flakes.push({ x: R() * W, y: R() * H, z: 0.3 + R() * 0.7, s: R() }); })();

  function drawWinter(ctx, t, s, lt) {
    const sn = clamp(s.snow);
    const sky = ctx.createLinearGradient(0, 0, 0, 1160);
    sky.addColorStop(0, rgb(mix([105, 108, 116], [52, 54, 60], sn))); sky.addColorStop(1, rgb(mix([178, 172, 165], [120, 122, 128], sn)));
    ctx.fillStyle = sky; ctx.fillRect(-60, -60, W + 120, 1240);
    glow(ctx, 760, 560, 230, [255, 245, 220], 0.35 * (1 - sn * 0.7));
    ctx.fillStyle = `rgba(255,250,235,${0.35 * (1 - sn * 0.8)})`; ctx.beginPath(); ctx.arc(760, 560, 52, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) sprite(ctx, smokeGrey, (i * 260 + lt * 20) % (W + 400) - 200, 300 + (i % 3) * 180, 700, 0.35);
    // Horizont: Waldrand, Hof, Strommasten
    const hc = mix([70, 72, 78], [88, 92, 100], sn);
    ctx.fillStyle = rgb(hc);
    ctx.beginPath(); ctx.moveTo(-60, 1175);
    for (let x = -60; x <= W + 60; x += 16) ctx.lineTo(x, 1150 - 26 * Math.abs(Math.sin(x * 0.07)) - 14 * Math.sin(x * 0.013));
    ctx.lineTo(W + 60, 1175); ctx.fill();
    ctx.fillRect(760, 1060, 140, 100); ctx.beginPath(); ctx.moveTo(745, 1065); ctx.lineTo(830, 1005); ctx.lineTo(915, 1065); ctx.fill();
    ctx.fillRect(900, 1090, 90, 70);
    ctx.fillStyle = `rgba(240,242,246,${sn})`; ctx.beginPath(); ctx.moveTo(752, 1062); ctx.lineTo(830, 1008); ctx.lineTo(908, 1062); ctx.lineTo(900, 1068); ctx.lineTo(830, 1022); ctx.lineTo(760, 1068); ctx.fill();
    ctx.strokeStyle = rgb(hc); ctx.lineWidth = 4;
    const poles = [[120, 1175, 260], [330, 1165, 150], [450, 1160, 90], [520, 1158, 55]];
    for (const [x, y, h] of poles) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.moveTo(x - h * 0.18, y - h * 0.9); ctx.lineTo(x + h * 0.18, y - h * 0.9); ctx.stroke(); }
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < poles.length - 1; i++) { const [x1, y1, h1] = poles[i], [x2, y2, h2] = poles[i + 1]; ctx.moveTo(x1, y1 - h1 * 0.9); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 - h1 * 0.9 + y2 - h2 * 0.9) / 2 + 20, x2, y2 - h2 * 0.9); }
    ctx.stroke();
    // Boden
    const gc = mix([150, 120, 60], [210, 212, 216], sn);
    const gg = ctx.createLinearGradient(0, 1160, 0, H);
    gg.addColorStop(0, rgb(mix(gc, [150, 150, 155], 0.3))); gg.addColorStop(1, rgb(mix(gc, [60, 50, 30], 0.5 * (1 - sn))));
    ctx.fillStyle = gg; ctx.fillRect(-60, 1160, W + 120, H);
    // Halme
    const stalkC = mix([196, 160, 80], [170, 172, 168], sn), headC = mix([215, 180, 95], [225, 228, 232], sn);
    const wind = 0.15 + sn * 0.25;
    for (const st of stalks) {
      const sway = (Math.sin(t * 1.6 + st.x * 0.01 + st.s * 3) * 0.5 + 0.5) * wind * st.h * 0.4 + wind * st.h * 0.2;
      ctx.strokeStyle = rgb(mix(stalkC, [40, 36, 30], (1 - st.d) * 0.25)); ctx.lineWidth = 0.6 + st.d * 3.2;
      ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.quadraticCurveTo(st.x + sway * 0.3, st.y - st.h * 0.6, st.x + sway, st.y - st.h); ctx.stroke();
      if (st.d > 0.15) { ctx.fillStyle = rgb(headC); ctx.beginPath(); ctx.ellipse(st.x + sway, st.y - st.h - st.h * 0.08, 1 + st.d * 5, st.h * 0.1, sway * 0.01, 0, 7); ctx.fill(); }
    }
    // einsame Gestalt
    const px = 330, py = 1395;
    ctx.fillStyle = '#26262b';
    ctx.beginPath(); ctx.arc(px, py - 118, 11, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - 17, py - 104); ctx.lineTo(px + 17, py - 104); ctx.lineTo(px + 21, py - 40); ctx.lineTo(px + 10, py); ctx.lineTo(px - 10, py); ctx.lineTo(px - 21, py - 40); ctx.fill();
    // Schnee auf dem Feld
    ctx.fillStyle = `rgba(235,238,242,${0.45 * sn})`; ctx.fillRect(-60, 1160, W + 120, H);
    // Schneefall
    const n = Math.floor(flakes.length * clamp(sn * 1.2));
    for (let i = 0; i < n; i++) {
      const f = flakes[i];
      const y = (f.y + lt * 120 * f.z * 2) % (H + 40) - 20, x = (f.x + lt * 90 * f.z + Math.sin(lt * 2 + f.s * 9) * 20) % (W + 40) - 20;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * f.z})`; ctx.beginPath(); ctx.arc(x, y, 1.5 + f.z * 4.5, 0, 7); ctx.fill();
    }
    // Frost am Rand
    const fr = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.75);
    fr.addColorStop(0, 'rgba(220,235,255,0)'); fr.addColorStop(1, `rgba(220,235,255,${0.45 * sn})`);
    ctx.fillStyle = fr; ctx.fillRect(-60, -60, W + 120, H + 120);
    vignette(ctx, 0.45);
  }

  return {
    defaults: { shake: 0, dark: 0, blips: 0, alarm: 0, launch: 0, blast: 0, soot: 0, snow: 0 },
    scenes: {
      city: (ctx, t, s, lt) => drawCity(ctx, t, lt, { night: 0 }),
      phone: drawPhone,
      blackout: (ctx, t, s, lt) => drawCity(ctx, t, lt, { night: 0.85, darkP: smooth(0.4, 4.2, lt) }),
      radar: drawRadar,
      silo: drawSilo,
      launch: drawLaunch,
      incoming: drawIncoming,
      blast: drawBlast,
      space: drawSpace,
      winter: drawWinter,
    },
  };
};
