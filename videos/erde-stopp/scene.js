/*
 * "Was wäre, wenn die Erde aufhört, sich zu drehen?"
 * Szenen: globe, street, ocean, sun, split, migrate, magnet.
 * Der Globus wird pro Pixel berechnet (orthografische Projektion) aus
 * echten Landflächen (window.LAND aus data.js).
 */
window.makeScene = function (W, H) {
  const { rng, lerp, mix, rgb, clamp, smooth, mk, wobble, puff, glow, particles, roundRect } = window.V;
  const D = Math.PI / 180;

  const smokeLight = puff([235, 232, 228], 256, 13);
  const smokeGrey = puff([150, 145, 140], 256, 12);
  const dustP = puff([170, 140, 105], 256, 15);
  const foam = puff([245, 250, 255], 256, 17);

  const stars = [];
  (function () { const R = rng(9); for (let i = 0; i < 320; i++) stars.push([R() * W, R() * H, 0.6 + R() * 1.7, R()]); })();

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
  function space(ctx, t) {
    ctx.fillStyle = '#02030a'; ctx.fillRect(-60, -60, W + 120, H + 120);
    for (const s of stars) { ctx.fillStyle = `rgba(255,255,255,${(0.3 + 0.6 * s[3]) * (0.8 + 0.2 * Math.sin(t * 2 + s[3] * 20))})`; ctx.fillRect(s[0], s[1], s[2], s[2]); }
  }

  // =====================================================================
  // ERDTEXTUR (equirektangular, 2048 × 1024)
  // =====================================================================
  const TW = 2048, TH = 1024;
  const maskC = mk(TW, TH), mc = maskC.getContext('2d');
  mc.fillStyle = '#000'; mc.fillRect(0, 0, TW, TH); mc.fillStyle = '#fff';
  // LAND = Liste von Polygonen, jedes Polygon = [Außenring, Löcher …]
  // Ringe über die Datumsgrenze werden "entfaltet" und dreifach versetzt gezeichnet.
  for (const poly of window.LAND) {
    for (const off of [-360, 0, 360]) {
      mc.beginPath();
      for (const ring of poly) {
        let prev = null, shift = 0;
        ring.forEach(([lo, la], i) => {
          if (prev !== null && Math.abs(lo - prev) > 180) shift += lo < prev ? 360 : -360;
          prev = lo;
          const x = (lo + shift + off + 180) / 360 * TW, y = (90 - la) / 180 * TH;
          i ? mc.lineTo(x, y) : mc.moveTo(x, y);
        });
        mc.closePath();
      }
      mc.fill('evenodd');
    }
  }
  mc.fillRect(0, TH - TH * 6 / 180, TW, TH);      // Antarktis bis zum Pol
  const landMask = new Uint8Array(TW * TH);
  { const d = mc.getImageData(0, 0, TW, TH).data; for (let i = 0; i < TW * TH; i++) landMask[i] = d[i * 4] > 127 ? 1 : 0; }

  // Landfarben nach Breitengrad + etwas Struktur
  const landCol = new Uint8ClampedArray(TW * TH * 3);
  const cloud = new Uint8Array(TW * TH);
  (function () {
    const R = rng(5);
    const c = mk(TW, TH), x = c.getContext('2d');
    for (let y = 0; y < TH; y++) {
      const la = Math.abs(90 - y / TH * 180);
      let col;
      if (la > 66) col = [235, 238, 242];
      else if (la > 55) col = [96, 110, 80];
      else if (la > 38) col = [88, 118, 62];
      else if (la > 16) col = [178, 150, 98];
      else col = [52, 104, 46];
      x.fillStyle = rgb(col); x.fillRect(0, y, TW, 1);
    }
    for (let i = 0; i < 9000; i++) {
      const px = R() * TW, py = R() * TH, r = 4 + R() * 26;
      x.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,240,200,0.07)';
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    const d = x.getImageData(0, 0, TW, TH).data;
    for (let i = 0; i < TW * TH; i++) { landCol[i * 3] = d[i * 4]; landCol[i * 3 + 1] = d[i * 4 + 1]; landCol[i * 3 + 2] = d[i * 4 + 2]; }
    // Wolken
    const cc = mk(TW, TH), y2 = cc.getContext('2d');
    for (let i = 0; i < 170; i++) {
      const px = R() * TW, py = TH * (0.12 + R() * 0.76), s = 20 + R() * 70;
      for (const off of [-TW, 0, TW]) {
        y2.save(); y2.translate(px + off, py); y2.scale(2.6, 0.6); y2.globalAlpha = 0.4; y2.drawImage(smokeLight, -s, -s, 2 * s, 2 * s); y2.restore();
      }
    }
    const cd = y2.getImageData(0, 0, TW, TH).data;
    for (let i = 0; i < TW * TH; i++) cloud[i] = cd[i * 4 + 3];
  })();

  // =====================================================================
  // GLOBUS (pro Pixel)
  // =====================================================================
  function makeGlobe(r, viewLat, tilt) {
    const S = r * 2, c = mk(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
    const n = S * S, lat = new Float32Array(n), dlon = new Float32Array(n), shade = new Float32Array(n), inside = new Float32Array(n);
    const sp = Math.sin(viewLat * D), cp = Math.cos(viewLat * D), ct = Math.cos(tilt * D), st = Math.sin(tilt * D);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const k = j * S + i;
      let x = (i + 0.5 - r) / r, y = -(j + 0.5 - r) / r;
      const rho = Math.hypot(x, y);
      if (rho > 1.004) { inside[k] = 0; continue; }
      inside[k] = clamp((1.004 - rho) * r);
      const xr = x * ct + y * st, yr = -x * st + y * ct;           // Achsneigung
      const rr = Math.min(1, rho), cc = Math.asin(rr), sc = Math.sin(cc), ccos = Math.cos(cc);
      lat[k] = rr < 1e-6 ? viewLat : Math.asin(ccos * sp + (yr * sc * cp) / rr) / D;
      dlon[k] = Math.atan2(xr * sc, rr * ccos * cp - yr * sc * sp) / D;
      const z = Math.sqrt(Math.max(0, 1 - rho * rho));
      shade[k] = clamp(0.25 + 0.95 * (x * 0.45 + y * 0.35 + z * 0.82));  // Licht von rechts oben
    }
    function project(lon, la, lon0) {
      const l = (lon - lon0) * D, p = la * D;
      const cosc = sp * Math.sin(p) + cp * Math.cos(p) * Math.cos(l);
      const xr = Math.cos(p) * Math.sin(l), yr = cp * Math.sin(p) - sp * Math.cos(p) * Math.cos(l);
      const x = xr * ct - yr * st, y = xr * st + yr * ct;
      return { x: x * r, y: -y * r, vis: cosc > 0 };
    }
    function render(lon0, water) {
      const d = img.data;
      const polT = lerp(90, 40, water), eqB = lerp(-1, 30, water);
      for (let k = 0; k < n; k++) {
        const a = inside[k];
        if (!a) { d[k * 4 + 3] = 0; continue; }
        const la = lat[k];
        let lo = dlon[k] + lon0; lo = ((lo + 180) % 360 + 360) % 360;
        const u = Math.min(TW - 1, lo / 360 * TW | 0), v = Math.min(TH - 1, Math.max(0, (90 - la) / 180 * TH | 0));
        const ti = v * TW + u;
        let land = landMask[ti], r0, g0, b0;
        const al = Math.abs(la);
        let flooded = false, exposed = false;
        if (water > 0) {
          if (al > polT && land) { land = 0; flooded = true; }
          else if (al < eqB && !land) { land = 1; exposed = true; }
        }
        if (land) {
          if (exposed) { r0 = 168; g0 = 140; b0 = 100; }
          else { r0 = landCol[ti * 3]; g0 = landCol[ti * 3 + 1]; b0 = landCol[ti * 3 + 2]; }
        } else if (flooded) { r0 = 40; g0 = 96; b0 = 150; }
        else { const dpt = 1 - al / 90; r0 = 14 + 10 * dpt; g0 = 50 + 30 * dpt; b0 = 110 + 40 * dpt; }
        const cl = water > 0 ? cloud[ti] * (1 - water * 0.6) : cloud[ti];
        const cw = cl / 255 * 0.7;
        r0 += (245 - r0) * cw; g0 += (248 - g0) * cw; b0 += (252 - b0) * cw;
        const s = shade[k];
        d[k * 4] = r0 * s; d[k * 4 + 1] = g0 * s; d[k * 4 + 2] = b0 * s; d[k * 4 + 3] = 255 * a;
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    return { r, render, project };
  }

  const bigGlobe = makeGlobe(430, 22, -12);
  const smallGlobe = makeGlobe(250, 18, -12);

  function drawGlobeAt(ctx, G, cx, cy, lon0, water) {
    // Atmosphäre
    const r = G.r;
    const ag = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.18);
    ag.addColorStop(0, 'rgba(120,180,255,0.55)'); ag.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, 7); ctx.fill();
    ctx.drawImage(G.render(lon0, water), cx - r, cy - r);
    const rim = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.5, cx, cy, r);
    rim.addColorStop(0, 'rgba(140,190,255,0)'); rim.addColorStop(1, 'rgba(140,190,255,0.28)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  }

  function marker(ctx, G, cx, cy, lon0, lon, lat, label, a) {
    if (a <= 0.01) return;
    const p = G.project(lon, lat, lon0); if (!p.vis) return;
    const x = cx + p.x, y = cy + p.y;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 14 + 4 * Math.sin(Date.now ? 0 : 0), 0, 7); ctx.stroke();
    ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 12, y - 12); ctx.lineTo(x + 70, y - 70); ctx.lineTo(x + 100, y - 70); ctx.stroke();
    ctx.font = '600 30px "Inter", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 10;
    ctx.fillText(label, x + 108, y - 60);
    ctx.restore();
  }

  function equator(ctx, G, cx, cy, lon0, a, lt) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,220,120,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
    ctx.beginPath(); let started = false;
    for (let lo = -180; lo <= 180; lo += 3) {
      const p = G.project(lon0 + lo, 0, lon0);
      if (!p.vis) { started = false; continue; }
      started ? ctx.lineTo(cx + p.x, cy + p.y) : ctx.moveTo(cx + p.x, cy + p.y); started = true;
    }
    ctx.stroke(); ctx.setLineDash([]);
    // Pfeile in Drehrichtung
    for (let k = 0; k < 4; k++) {
      const lo = -70 + ((lt * 30 + k * 40) % 160);
      const p = G.project(lon0 + lo, 0, lon0), q = G.project(lon0 + lo + 4, 0, lon0);
      if (!p.vis) continue;
      const ang = Math.atan2(q.y - p.y, q.x - p.x), x = cx + p.x, y = cy + p.y;
      ctx.fillStyle = 'rgba(255,220,120,0.95)';
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * 18, y + Math.sin(ang) * 18);
      ctx.lineTo(x + Math.cos(ang + 2.5) * 14, y + Math.sin(ang + 2.5) * 14);
      ctx.lineTo(x + Math.cos(ang - 2.5) * 14, y + Math.sin(ang - 2.5) * 14); ctx.fill();
    }
    ctx.restore();
  }

  // Drehwinkel: Am Anfang dreht sich die Erde, dann stoppt sie abrupt.
  function globeLon(t, s, lt) {
    const segs = (typeof TL !== 'undefined' && TL) ? TL.segments : null;
    const W0 = 10;                                   // Grad pro Sekunde (sichtbar beschleunigt)
    if (segs && t < segs[3].start) {
      const stopAt = segs[2].start + 1.0;            // "… bleibt sie stehen" → kurz danach Stillstand
      const tt = Math.min(t, stopAt);
      let lon = 125 - tt * W0;
      if (t > stopAt) lon -= W0 * 0.25 * (1 - Math.exp(-(t - stopAt) * 8));   // kurzes Nachrucken
      return { lon, stopped: t > stopAt, since: t - stopAt };
    }
    return { lon: 15 - lt * 10 * s.spin, stopped: false, since: 0 };
  }

  function drawGlobe(ctx, t, s, lt) {
    space(ctx, t);
    glow(ctx, 1020, 140, 600, [255, 245, 220], 0.35);
    const g = globeLon(t, s, lt);
    const cx = 540, cy = 1060;
    drawGlobeAt(ctx, bigGlobe, cx, cy, g.lon, 0);
    equator(ctx, bigGlobe, cx, cy, g.lon, s.marker * (g.stopped ? 0 : 1), lt);
    marker(ctx, bigGlobe, cx, cy, g.lon, 10, 51, 'Deutschland', s.marker);
    if (g.stopped && g.since < 1.6) {
      // roter Stopp-Ring
      const a = clamp(1 - g.since / 1.6);
      ctx.strokeStyle = `rgba(255,70,50,${a})`; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, 440 + g.since * 120, 0, 7); ctx.stroke();
    }
    vignette(ctx, 0.5);
  }

  // =====================================================================
  // STRASSE IN DEUTSCHLAND – Orkan mit über 1.000 km/h
  // =====================================================================
  const houses = [];
  (function () {
    const R = rng(23); let x = -40;
    const cols = [[226, 214, 190], [196, 120, 96], [232, 228, 220], [150, 170, 160], [214, 186, 120], [180, 150, 140]];
    while (x < W + 40) {
      const w = 190 + R() * 90, h = 420 + R() * 200;
      houses.push({ x, w, h, col: cols[(R() * cols.length) | 0], roof: R() < 0.5 ? [150, 60, 45] : [80, 70, 72], s: R() });
      x += w + 6;
    }
  })();
  const GROUND = 1520;
  const cars = [{ x: 120, c: [40, 90, 160], s: 0.1 }, { x: 560, c: [200, 200, 205], s: 0.5 }, { x: 900, c: [170, 40, 40], s: 0.8 }];
  const trees = [{ x: 330, h: 430 }, { x: 770, h: 470 }];
  const debris = [];
  (function () { const R = rng(29); for (let i = 0; i < 260; i++) debris.push({ y: R() * H, sp: 1200 + R() * 2200, s: R(), k: R() < 0.5 ? 0 : R() < 0.6 ? 1 : 2, ph: R() * 10 }); })();

  function drawStreet(ctx, t, s, lt) {
    const blast = smooth(0.05, 0.9, lt);              // Wind kommt an
    const dust = clamp(lt / 8);
    // Himmel
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, rgb(mix([96, 150, 210], [120, 105, 90], dust))); sky.addColorStop(1, rgb(mix([200, 220, 235], [170, 150, 125], dust)));
    ctx.fillStyle = sky; ctx.fillRect(-60, -60, W + 120, GROUND + 60);
    for (let i = 0; i < 7; i++) sprite(ctx, smokeLight, ((i * 230 + lt * (40 + blast * 1500)) % (W + 600)) - 300, 220 + (i % 3) * 140, 520, 0.6);
    // Häuser
    for (const h of houses) {
      const top = GROUND - h.h;
      ctx.fillStyle = rgb(h.col); ctx.fillRect(h.x, top, h.w, h.h);
      // Fenster
      for (let fy = top + 70; fy < GROUND - 140; fy += 120) for (let fx = h.x + 30; fx < h.x + h.w - 60; fx += 80) {
        const broken = lt > 1.4 + h.s * 2 + fx * 0.0005;
        ctx.fillStyle = broken ? '#1c1c22' : rgb(mix([150, 190, 220], [120, 110, 100], dust * 0.6));
        ctx.fillRect(fx, fy, 46, 72);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(fx - 4, fy + 72, 54, 6);
      }
      ctx.fillStyle = '#3a2a22'; ctx.fillRect(h.x + h.w / 2 - 30, GROUND - 130, 60, 130);
      // Dach, das Ziegel verliert
      const lost = clamp((lt - 1.0 - h.s * 1.5) / 4);
      ctx.fillStyle = rgb(h.roof);
      ctx.beginPath(); ctx.moveTo(h.x - 10, top); ctx.lineTo(h.x + h.w / 2, top - 150); ctx.lineTo(h.x + h.w + 10, top); ctx.fill();
      ctx.fillStyle = '#2a211c';
      const R = rng((h.x | 0) + 7);
      for (let k = 0; k < 40; k++) {
        const u = R(), v = R();
        if (R() > lost) continue;
        const yy = top - 150 * (1 - v) + 10, half = (h.w / 2 + 10) * v;
        ctx.fillRect(h.x + h.w / 2 - half + u * half * 2 - 12, yy, 24, 14);
      }
    }
    // Gehweg + Straße
    ctx.fillStyle = rgb(mix([150, 148, 140], [140, 120, 95], dust)); ctx.fillRect(-60, GROUND, W + 120, 70);
    ctx.fillStyle = rgb(mix([58, 60, 64], [90, 78, 62], dust)); ctx.fillRect(-60, GROUND + 70, W + 120, H);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let x = 0; x < W; x += 180) ctx.fillRect(x, 1745, 90, 10);
    // Bäume (biegen sich, Kronen reißen ab)
    for (const tr of trees) {
      const bend = blast * (0.35 + 0.08 * Math.sin(lt * 11 + tr.x)) + (lt > 4 ? 0.15 : 0);
      ctx.save(); ctx.translate(tr.x, GROUND + 20);
      ctx.strokeStyle = '#4a3424'; ctx.lineWidth = 26; ctx.lineCap = 'round';
      const tx = Math.sin(bend) * tr.h, ty = -Math.cos(bend) * tr.h;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0, -tr.h * 0.5, tx, ty); ctx.stroke();
      const torn = smooth(3.0, 3.4, lt + (tr.x > 500 ? 0.6 : 0));
      const fly = Math.max(0, lt - 3.0 - (tr.x > 500 ? -0.6 : 0));
      const crownX = tx + fly * fly * 900 * torn, crownY = ty - fly * 260 * torn;
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2;
        ctx.fillStyle = k % 2 ? '#3f7a34' : '#2f6428';
        ctx.beginPath(); ctx.arc(crownX + Math.cos(a) * 80 + 40 * blast, crownY + Math.sin(a) * 60, 95, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // Autos rutschen und überschlagen sich
    for (const c of cars) {
      const st = 1.6 + c.s * 1.2, a = Math.max(0, lt - st);
      const x = c.x + a * a * 380, rot = a > 0.6 ? (a - 0.6) * (a - 0.6) * 2.2 : 0, lift = a > 0.6 ? (a - 0.6) * 160 : 0;
      ctx.save(); ctx.translate(x + 110, 1660 - lift); ctx.rotate(rot);
      ctx.fillStyle = rgb(c.c); roundRect(ctx, -110, -40, 220, 60, 16); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-70, -40); ctx.lineTo(-40, -85); ctx.lineTo(50, -85); ctx.lineTo(80, -40); ctx.fill();
      ctx.fillStyle = 'rgba(170,200,220,0.9)'; ctx.fillRect(-36, -78, 40, 34); ctx.fillRect(10, -78, 38, 34);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-62, 20, 26, 0, 7); ctx.arc(62, 20, 26, 0, 7); ctx.fill();
      ctx.restore();
    }
    // Mülltonnen, Fahrräder, Schilder fliegen zuerst
    for (let k = 0; k < 5; k++) {
      const st = 0.7 + k * 0.25, a = Math.max(0, lt - st);
      const x = 60 + k * 210 + a * a * 900 + a * 300, y = 1560 - a * (200 + k * 60) + a * a * 40;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * (3 + k));
      ctx.fillStyle = ['#2d6b3a', '#333', '#1f4fa0', '#7a5', '#c8a000'][k];
      if (k % 2) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(-40, 0, 30, 0, 7); ctx.arc(40, 0, 30, 0, 7); ctx.moveTo(-40, 0); ctx.lineTo(0, -40); ctx.lineTo(40, 0); ctx.stroke(); }
      else { ctx.fillRect(-35, -55, 70, 110); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-38, -62, 76, 12); }
      ctx.restore();
    }
    // Staubwand + fliegender Kleinkram
    if (lt < 1.4) {
      const fx = -400 + smooth(0, 1.2, lt) * 1900;
      for (let i = 0; i < 14; i++) sprite(ctx, dustP, fx - (i % 4) * 160, 200 + i * 130, 700, 0.85, i);
    }
    for (const d of debris) {
      const x = ((d.ph * 300 + lt * d.sp) % (W + 400)) - 200, y = d.y + Math.sin(lt * 6 + d.ph) * 30;
      const a = blast * (0.4 + 0.6 * d.s);
      if (d.k === 0) { ctx.strokeStyle = `rgba(90,70,50,${a * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 80 - d.s * 160, y); ctx.stroke(); }
      else if (d.k === 1) { ctx.fillStyle = `rgba(${60 + d.s * 60 | 0},${110 + d.s * 50 | 0},40,${a})`; ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 10 + d.ph); ctx.fillRect(-9, -5, 18, 10); ctx.restore(); }
      else { ctx.fillStyle = `rgba(240,240,235,${a})`; ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 6 + d.ph); ctx.fillRect(-14, -10, 28, 20); ctx.restore(); }
    }
    ctx.fillStyle = `rgba(150,125,95,${0.15 + 0.35 * dust * blast})`; ctx.fillRect(-60, -60, W + 120, H + 120);
    vignette(ctx, 0.5);
  }

  // =====================================================================
  // OZEAN – die Welle
  // =====================================================================
  function drawOcean(ctx, t, s, lt) {
    const HZ = 1040;
    const sky = ctx.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, '#3a4450'); sky.addColorStop(1, '#8d97a0');
    ctx.fillStyle = sky; ctx.fillRect(-60, -60, W + 120, HZ + 60);
    for (let i = 0; i < 8; i++) sprite(ctx, smokeGrey, ((i * 200 + lt * 160) % (W + 600)) - 300, 160 + (i % 4) * 150, 640, 0.7);
    // Meer
    const sea = ctx.createLinearGradient(0, HZ, 0, 1500);
    sea.addColorStop(0, '#2d4c5c'); sea.addColorStop(1, '#4f7c86');
    ctx.fillStyle = sea; ctx.fillRect(-60, HZ, W + 120, 500);
    // Strand: Wasser zieht sich vor der Welle zurück
    const draw = smooth(0, 1.5, lt);
    const shore = 1460 - draw * 260;
    ctx.fillStyle = '#c9b48a'; ctx.fillRect(-60, shore, W + 120, H);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-60, shore - 6, W + 120, 8);
    ctx.fillStyle = '#a8946c'; ctx.fillRect(-60, 1700, W + 120, H);
    // Promenade + Leuchtturm
    ctx.fillStyle = '#5b5148'; ctx.fillRect(-60, 1690, W + 120, 30);
    ctx.fillStyle = '#4b4540'; ctx.beginPath(); ctx.moveTo(760, 1690); ctx.lineTo(1100, 1690); ctx.lineTo(1100, 1560); ctx.lineTo(880, 1590); ctx.fill();
    ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.moveTo(900, 1590); ctx.lineTo(925, 1230); ctx.lineTo(985, 1230); ctx.lineTo(1010, 1590); ctx.fill();
    ctx.fillStyle = '#c0392b'; for (let k = 0; k < 3; k++) ctx.fillRect(905 + k * 4, 1300 + k * 100, 100 - k * 8, 40);
    ctx.fillStyle = '#333'; ctx.fillRect(915, 1190, 80, 44);
    glow(ctx, 955, 1210, 140, [255, 240, 180], 0.6 + 0.4 * Math.sin(lt * 4));
    // Welle
    const p = smooth(0.6, 4.9, lt);
    const base = lerp(HZ, 2050, p), height = lerp(40, 1700, Math.pow(p, 0.9));
    const top = base - height;
    const wg = ctx.createLinearGradient(0, top, 0, base);
    wg.addColorStop(0, 'rgba(150,200,205,0.95)'); wg.addColorStop(0.25, '#2f6f78'); wg.addColorStop(1, '#16343e');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.moveTo(-60, base + 40);
    for (let x = -60; x <= W + 60; x += 30) ctx.lineTo(x, top + 40 * Math.sin(x * 0.012 + lt * 2) + 25 * Math.sin(x * 0.031 - lt * 3));
    ctx.lineTo(W + 60, base + 40); ctx.fill();
    // Lichtstreifen auf der Wasserwand
    ctx.strokeStyle = 'rgba(200,240,240,0.18)'; ctx.lineWidth = 3;
    for (let k = 0; k < 14; k++) { const y = top + (k + 0.5) / 14 * height; ctx.beginPath(); ctx.moveTo(-60, y + Math.sin(k + lt) * 10); ctx.bezierCurveTo(300, y - 20, 700, y + 20, W + 60, y); ctx.stroke(); }
    // Gischt an der Krone
    for (let i = 0; i < 22; i++) {
      const x = -40 + i * 54, y = top + 40 * Math.sin(x * 0.012 + lt * 2) - 10;
      sprite(ctx, foam, x + Math.sin(lt * 3 + i) * 20, y - 30 - (i % 3) * 20, 180 + p * 260, 0.85, i + lt);
    }
    // Regen
    ctx.strokeStyle = 'rgba(220,230,240,0.35)'; ctx.lineWidth = 2;
    particles(160, 0.5, lt, (k, age, R) => { const x = R() * (W + 400) - 200 + age * 300, y = age * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 30, y - 70); ctx.stroke(); }, 31);
    vignette(ctx, 0.55);
  }

  // =====================================================================
  // SONNE BLEIBT STEHEN – Zeitraffer
  // =====================================================================
  function drawSun(ctx, t, s, lt) {
    const heat = clamp(lt / 7);
    const sky = ctx.createLinearGradient(0, 0, 0, 1250);
    sky.addColorStop(0, rgb(mix([60, 120, 200], [150, 120, 90], heat * 0.6))); sky.addColorStop(1, rgb(mix([190, 215, 235], [240, 200, 150], heat)));
    ctx.fillStyle = sky; ctx.fillRect(-60, -60, W + 120, 1320);
    // die Sonne steht fest
    glow(ctx, 700, 430, 520, [255, 240, 200], 0.6 + heat * 0.3);
    ctx.fillStyle = '#fffdf2'; ctx.beginPath(); ctx.arc(700, 430, 70, 0, 7); ctx.fill();
    // Wolken rasen im Zeitraffer
    for (let i = 0; i < 10; i++) sprite(ctx, smokeLight, ((i * 190 + lt * 900) % (W + 800)) - 400, 200 + (i % 4) * 160, 420 + (i % 3) * 120, 0.75 * (1 - heat * 0.6));
    // Hügel
    ctx.fillStyle = rgb(mix([90, 130, 70], [150, 130, 70], heat));
    ctx.beginPath(); ctx.moveTo(-60, 1300); for (let x = -60; x <= W + 60; x += 20) ctx.lineTo(x, 1200 - 60 * Math.sin(x * 0.006 + 1) - 30 * Math.sin(x * 0.017)); ctx.lineTo(W + 60, 1300); ctx.fill();
    // Kirche
    ctx.fillStyle = rgb(mix([230, 225, 210], [220, 200, 170], heat));
    ctx.fillRect(760, 1060, 160, 120); ctx.fillRect(700, 960, 60, 220);
    ctx.fillStyle = '#7a3e30'; ctx.beginPath(); ctx.moveTo(696, 962); ctx.lineTo(730, 860); ctx.lineTo(764, 962); ctx.fill();
    ctx.beginPath(); ctx.moveTo(752, 1062); ctx.lineTo(840, 1000); ctx.lineTo(928, 1062); ctx.fill();
    // Feld
    const fg = ctx.createLinearGradient(0, 1200, 0, H);
    fg.addColorStop(0, rgb(mix([110, 150, 70], [190, 160, 90], heat))); fg.addColorStop(1, rgb(mix([60, 100, 40], [150, 110, 60], heat)));
    ctx.fillStyle = fg; ctx.fillRect(-60, 1220, W + 120, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 3;
    for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(540 + k * 30, 1230); ctx.lineTo(540 + k * 260, H); ctx.stroke(); }
    // Baum mit fest stehendem Schatten
    ctx.fillStyle = 'rgba(20,30,10,0.35)'; ctx.beginPath(); ctx.ellipse(170, 1720, 230, 50, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3424'; ctx.fillRect(300, 1400, 34, 330);
    ctx.fillStyle = rgb(mix([50, 100, 40], [110, 100, 40], heat));
    for (let k = 0; k < 8; k++) { const a = k / 8 * 7; ctx.beginPath(); ctx.arc(317 + Math.cos(a) * 110, 1340 + Math.sin(a) * 80, 120, 0, 7); ctx.fill(); }
    // Wolkenschatten huschen über das Feld
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(((i * 380 + lt * 1100) % (W + 900)) - 450, 1450 + i * 110, 320, 60, 0, 0, 7); ctx.fill(); }
    // Hitzeflimmern
    ctx.fillStyle = `rgba(255,170,80,${0.12 * heat})`; ctx.fillRect(-60, -60, W + 120, H + 120);
    vignette(ctx, 0.45);
  }

  // =====================================================================
  // GETEILTE ERDE – oben endloser Tag, unten endlose Nacht
  // =====================================================================
  function drawSplit(ctx, t, s, lt) {
    const SPL = 1000;
    // Tagseite
    let g = ctx.createLinearGradient(0, 0, 0, SPL);
    g.addColorStop(0, '#e7b56a'); g.addColorStop(1, '#ffe6b0');
    ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, SPL + 60);
    glow(ctx, 760, 260, 650, [255, 250, 220], 0.9);
    ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(760, 260, 110, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8783e'; ctx.beginPath(); ctx.moveTo(-60, 820);
    for (let x = -60; x <= W + 60; x += 20) ctx.lineTo(x, 760 - 40 * Math.sin(x * 0.008 + 2)); ctx.lineTo(W + 60, SPL); ctx.lineTo(-60, SPL); ctx.fill();
    ctx.fillStyle = '#d9a361'; ctx.fillRect(-60, 850, W + 120, SPL - 850);
    ctx.strokeStyle = 'rgba(90,50,20,0.55)'; ctx.lineWidth = 2;
    const R = rng(91);
    for (let i = 0; i < 70; i++) { let x = R() * W, y = 860 + R() * 130; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 90; y += (R() - 0.5) * 20; ctx.lineTo(x, Math.min(SPL - 4, y)); } ctx.stroke(); }
    // Hitzeflimmern
    ctx.fillStyle = `rgba(255,140,40,${0.15 + 0.05 * Math.sin(lt * 5)})`; ctx.fillRect(-60, -60, W + 120, SPL + 60);
    // Nachtseite
    g = ctx.createLinearGradient(0, SPL, 0, H);
    g.addColorStop(0, '#0d1a33'); g.addColorStop(1, '#02050c');
    ctx.fillStyle = g; ctx.fillRect(-60, SPL, W + 120, H - SPL + 60);
    for (const st of stars) if (st[1] > SPL && st[1] < 1600) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * st[3]})`; ctx.fillRect(st[0], st[1], st[2], st[2]); }
    ctx.fillStyle = '#9fb3cc'; ctx.beginPath(); ctx.moveTo(-60, 1700);
    for (let x = -60; x <= W + 60; x += 20) ctx.lineTo(x, 1640 - 50 * Math.abs(Math.sin(x * 0.009))); ctx.lineTo(W + 60, H + 60); ctx.lineTo(-60, H + 60); ctx.fill();
    ctx.fillStyle = '#cfdcec'; ctx.fillRect(-60, 1760, W + 120, H);
    // Eiskristalle wehen
    particles(90, 3, lt, (k, age, R2) => { ctx.fillStyle = `rgba(220,235,255,${0.8 * Math.sin(age * Math.PI)})`; ctx.fillRect(R2() * W + age * 200, SPL + 40 + R2() * 860, 3, 3); }, 92);
    // Dämmerungsstreifen
    g = ctx.createLinearGradient(0, SPL - 70, 0, SPL + 70);
    g.addColorStop(0, 'rgba(255,120,60,0)'); g.addColorStop(0.5, 'rgba(255,120,80,0.9)'); g.addColorStop(1, 'rgba(60,40,120,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, SPL - 70, W + 120, 140);
    ctx.font = '600 26px "Inter", sans-serif'; ctx.letterSpacing = '6px'; ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(80,40,10,0.85)'; ctx.fillText('TAGSEITE', W - 60, 90);
    ctx.fillStyle = 'rgba(200,220,255,0.9)'; ctx.fillText('NACHTSEITE', W - 60, SPL + 90);
    ctx.letterSpacing = '0px';
    vignette(ctx, 0.45);
  }

  // =====================================================================
  // WASSER WANDERT ZU DEN POLEN
  // =====================================================================
  function drawMigrate(ctx, t, s, lt) {
    space(ctx, t);
    glow(ctx, 1020, 140, 600, [255, 245, 220], 0.3);
    const lon0 = 20 - lt * 4, cx = 540, cy = 1060;
    drawGlobeAt(ctx, bigGlobe, cx, cy, lon0, clamp(s.water));
    marker(ctx, bigGlobe, cx, cy, lon0, 10, 51, 'Deutschland', s.marker);
    vignette(ctx, 0.5);
  }

  // =====================================================================
  // MAGNETFELD + SONNENWIND
  // =====================================================================
  function drawMagnet(ctx, t, s, lt) {
    space(ctx, t);
    const cx = 640, cy = 1080, f = clamp(s.field);
    glow(ctx, -150, cy, 900, [255, 230, 170], 0.75);
    // Feldlinien (Dipol)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.2);
    for (const L of [1.5, 2.0, 2.7, 3.6, 4.8]) {
      ctx.strokeStyle = `rgba(110,190,255,${0.55 * f})`; ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let th = 0.05; th < Math.PI - 0.05; th += 0.03) {
          const r = L * 250 * Math.sin(th) * Math.sin(th);
          const x = side * r * Math.sin(th) * (side < 0 ? 0.75 : 1.25), y = -r * Math.cos(th);
          th < 0.06 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    // Sonnenwind: wird bei starkem Feld abgelenkt, bei schwachem trifft er die Erde
    const bow = 250 + 520 * f;
    particles(160, 1.6, lt, (k, age, R) => {
      const y0 = cy + (R() - 0.5) * 1500;
      let x = -100 + age * 1400, y = y0;
      const dx = x - (cx - bow);
      if (dx > 0) { const off = y0 - cy; const push = Math.sign(off || 1) * Math.min(600, dx * 0.9) * f; y = y0 + push; }
      const hit = Math.hypot(x - cx, y - cy) < 255;
      if (hit) return;
      ctx.fillStyle = `rgba(255,220,150,${0.75 * Math.sin(age * Math.PI)})`;
      ctx.fillRect(x, y, 14, 2.5);
    }, 101);
    smallGlobe && drawGlobeAt(ctx, smallGlobe, cx, cy, 30 - lt * 6, 0);
    // Polarlichter / Treffer, wenn das Feld schwach wird
    const weak = 1 - f;
    particles(40, 0.6, lt, (k, age, R) => {
      const a = Math.PI + (R() - 0.5) * 2.2, x = cx + Math.cos(a) * 248, y = cy + Math.sin(a) * 248;
      glow(ctx, x, y, 30, [255, 200, 120], weak * 0.9 * Math.sin(age * Math.PI));
    }, 103);
    for (const sg of [-1, 1]) glow(ctx, cx + sg * 40, cy + sg * -240, 120, [80, 255, 160], 0.35 * (0.5 + 0.5 * Math.sin(lt * 3)) * (0.3 + weak));
    vignette(ctx, 0.5);
  }

  return {
    defaults: { shake: 0, spin: 1, marker: 0, water: 0, field: 1 },
    scenes: { globe: drawGlobe, street: drawStreet, ocean: drawOcean, sun: drawSun, split: drawSplit, migrate: drawMigrate, magnet: drawMagnet },
  };
};
