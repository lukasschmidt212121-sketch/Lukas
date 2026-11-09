/*
 * Szene: Lagerfeuer am Bergsee bei Nacht – feste Kamera.
 * Über Milliarden Jahre: Andromeda wächst, der See verdampft,
 * der Himmel brennt vor neuen Sternen, die Galaxien verschmelzen,
 * die Sonne wird zum Roten Riesen.
 *
 * Zustandsvariablen (aus script.json, jeweils 0..1 bzw. Skalierung):
 *  marker people fire lake life heat gal galB nebula drift
 *  cores spin merge giant fade
 */
window.makeScene = function (W, H) {
  // ---------- Hilfen ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const R = rng(42);
  const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const mix = (c1, c2, x) => [lerp(c1[0], c2[0], x), lerp(c1[1], c2[1], x), lerp(c1[2], c2[2], x)];
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const Y0 = 1185;                       // Horizont / Seeoberkante
  const PIV = [W / 2, 1500];             // Drehpunkt des Himmels
  const GAL = [W * 0.6, 560];            // Position Andromeda

  // ---------- Sternenhimmel + Milchstraße (vorgerendert) ----------
  const SKY = 3400, sky = mk(SKY, SKY), sc = sky.getContext('2d');
  (function () {
    const C = SKY / 2;
    // Milchstraßen-Band
    const ang = -1.15, ca = Math.cos(ang), sa = Math.sin(ang);
    const ox = C - 500, oy = C - 900;
    sc.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 260; i++) {
      const al = (R() - 0.5) * 3400, ac = gauss() * 140;
      const x = ox + al * ca - ac * sa, y = oy + al * sa + ac * ca, r = 60 + R() * 160;
      const g = sc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(150,160,210,${0.035 + R() * 0.03})`);
      g.addColorStop(1, 'rgba(150,160,210,0)');
      sc.fillStyle = g; sc.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 30000; i++) {
      const al = (R() - 0.5) * 3400, ac = gauss() * 120;
      const x = ox + al * ca - ac * sa, y = oy + al * sa + ac * ca;
      sc.fillStyle = `rgba(220,225,255,${0.12 + R() * 0.35})`;
      const s = 0.8 + R() * 1.1; sc.fillRect(x, y, s, s);
    }
    // Staubband
    sc.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2500; i++) {
      const al = (R() - 0.5) * 3400, ac = gauss() * 35 + Math.sin(al / 300) * 25;
      const x = ox + al * ca - ac * sa, y = oy + al * sa + ac * ca, r = 10 + R() * 30;
      sc.fillStyle = 'rgba(0,0,0,0.08)';
      sc.beginPath(); sc.arc(x, y, r, 0, 7); sc.fill();
    }
    sc.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4200; i++) {
      const x = R() * SKY, y = R() * SKY, m = Math.pow(R(), 3);
      const r = 0.6 + m * 1.7;
      const tint = R();
      const col = tint < 0.15 ? '255,215,180' : tint < 0.3 ? '190,210,255' : '255,255,255';
      sc.fillStyle = `rgba(${col},${0.35 + m * 0.65})`;
      sc.beginPath(); sc.arc(x, y, r, 0, 7); sc.fill();
      if (m > 0.75) {
        const g = sc.createRadialGradient(x, y, 0, x, y, r * 6);
        g.addColorStop(0, `rgba(${col},0.22)`); g.addColorStop(1, `rgba(${col},0)`);
        sc.fillStyle = g; sc.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      }
    }
  })();

  // ---------- Andromeda (Spiralgalaxie, frontal; Neigung beim Zeichnen) ----------
  const GS = 2048, gal = mk(GS, GS), gc = gal.getContext('2d');
  (function () {
    const C = GS / 2, Rr = GS * 0.47;
    gc.globalCompositeOperation = 'lighter';
    let g = gc.createRadialGradient(C, C, 0, C, C, Rr);
    g.addColorStop(0, 'rgba(255,235,210,0.55)');
    g.addColorStop(0.25, 'rgba(200,200,235,0.16)');
    g.addColorStop(0.7, 'rgba(140,160,230,0.05)');
    g.addColorStop(1, 'rgba(120,140,220,0)');
    gc.fillStyle = g; gc.fillRect(0, 0, GS, GS);
    const arm = (r, k) => k * Math.PI + r * 3.4 * Math.PI;
    for (let i = 0; i < 140000; i++) {
      const k = i & 1;
      const r = 0.03 + 0.97 * Math.pow(R(), 0.85);
      const inArm = R() < 0.65;
      const th = inArm ? arm(r, k) + gauss() * 0.28 * (1.1 - r * 0.5) : R() * Math.PI * 2;
      const rr = (r + gauss() * 0.025) * Rr;
      const x = C + rr * Math.cos(th), y = C + rr * Math.sin(th);
      let col;
      if (r < 0.22) col = '255,228,190';
      else if (inArm && R() < 0.025) col = '255,110,170';
      else col = R() < 0.6 ? '175,200,255' : '235,235,255';
      gc.fillStyle = `rgba(${col},${(0.12 + R() * 0.45) * (1.15 - r * 0.6)})`;
      const s = 1 + R() * 2.2; gc.fillRect(x, y, s, s);
    }
    // Staubbahnen
    gc.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) {
      const k = i & 1, r = 0.12 + 0.8 * R();
      const th = arm(r, k) - 0.32 + gauss() * 0.06;
      const x = C + r * Rr * Math.cos(th), y = C + r * Rr * Math.sin(th);
      gc.fillStyle = 'rgba(0,0,0,0.07)';
      gc.beginPath(); gc.arc(x, y, 6 + R() * 14, 0, 7); gc.fill();
    }
    gc.globalCompositeOperation = 'lighter';
    g = gc.createRadialGradient(C, C, 0, C, C, Rr * 0.2);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.3, 'rgba(255,230,190,0.6)');
    g.addColorStop(1, 'rgba(255,210,170,0)');
    gc.fillStyle = g; gc.fillRect(0, 0, GS, GS);
  })();

  // ---------- Sternentstehung (Nebel) ----------
  const NS = 1600, neb = mk(NS, NS), nc = neb.getContext('2d');
  (function () {
    nc.globalCompositeOperation = 'lighter';
    const cols = ['255,70,150', '255,110,190', '120,120,255', '80,170,255', '255,150,90', '200,80,255'];
    for (let i = 0; i < 420; i++) {
      const a = R() * Math.PI * 2, d = Math.pow(R(), 0.6) * NS * 0.46;
      const x = NS / 2 + Math.cos(a) * d, y = NS / 2 + Math.sin(a) * d, r = 30 + R() * 140;
      const g = nc.createRadialGradient(x, y, 0, x, y, r);
      const c = cols[(R() * cols.length) | 0];
      g.addColorStop(0, `rgba(${c},${0.06 + R() * 0.08})`);
      g.addColorStop(1, `rgba(${c},0)`);
      nc.fillStyle = g; nc.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 2600; i++) {
      const a = R() * Math.PI * 2, d = Math.pow(R(), 0.7) * NS * 0.47;
      const x = NS / 2 + Math.cos(a) * d, y = NS / 2 + Math.sin(a) * d, r = 0.8 + Math.pow(R(), 4) * 4;
      nc.fillStyle = `rgba(210,225,255,${0.5 + R() * 0.5})`;
      nc.beginPath(); nc.arc(x, y, r, 0, 7); nc.fill();
      if (r > 2.5) {
        const g = nc.createRadialGradient(x, y, 0, x, y, r * 7);
        g.addColorStop(0, 'rgba(190,215,255,0.5)'); g.addColorStop(1, 'rgba(190,215,255,0)');
        nc.fillStyle = g; nc.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
      }
    }
  })();

  // ---------- Elliptische Riesengalaxie ("Milchomeda") ----------
  const ES = 1800, ell = mk(ES, ES), ec = ell.getContext('2d');
  (function () {
    const C = ES / 2;
    ec.globalCompositeOperation = 'lighter';
    let g = ec.createRadialGradient(C, C, 0, C, C, C);
    g.addColorStop(0, 'rgba(255,248,230,1)');
    g.addColorStop(0.08, 'rgba(255,235,200,0.8)');
    g.addColorStop(0.3, 'rgba(255,215,170,0.28)');
    g.addColorStop(0.65, 'rgba(240,200,170,0.08)');
    g.addColorStop(1, 'rgba(230,200,170,0)');
    ec.fillStyle = g; ec.fillRect(0, 0, ES, ES);
    for (let i = 0; i < 50000; i++) {
      const x = C + gauss() * C * 0.28, y = C + gauss() * C * 0.28;
      ec.fillStyle = `rgba(255,${225 + R() * 30 | 0},${190 + R() * 60 | 0},${0.1 + R() * 0.4})`;
      const s = 1 + R() * 1.8; ec.fillRect(x, y, s, s);
    }
  })();

  // ---------- Landschaft (Geometrie vorab) ----------
  function ridge(x0, x1, step, base, amp, seed, peaks) {
    const r = rng(seed), pts = [];
    for (let x = x0; x <= x1; x += step) {
      let y = base;
      for (const p of peaks) y -= p[1] * Math.exp(-Math.pow((x - p[0]) / p[2], 2));
      y -= amp * (r() - 0.5);
      pts.push([x, y]);
    }
    return pts;
  }
  const farM = ridge(-60, W + 60, 18, Y0 + 2, 14, 7, [[160, 230, 180], [430, 150, 140], [760, 290, 200], [1020, 170, 140]]);
  const nearL = ridge(-60, 520, 14, Y0 + 30, 8, 9, [[-20, 210, 260], [260, 70, 160]]);
  const nearR = ridge(620, W + 60, 14, Y0 + 30, 8, 11, [[1080, 260, 260], [820, 60, 150]]);
  const shore = x => 1455 + 38 * Math.sin(x / 140) + 22 * Math.sin(x / 57 + 1);

  // Trockenrisse im Seeboden
  const crack = mk(W, 420), cc = crack.getContext('2d');
  (function () {
    cc.strokeStyle = 'rgba(30,18,12,0.9)';
    for (let i = 0; i < 160; i++) {
      let x = R() * W, y = R() * 420; cc.lineWidth = 0.8 + R() * 1.8;
      cc.beginPath(); cc.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 120; y += (R() - 0.5) * 28; cc.lineTo(x, y); }
      cc.stroke();
    }
  })();

  // Bäume
  const trees = [];
  (function () {
    const r = rng(77);
    for (let i = 0; i < 16; i++) trees.push({ x: -40 + r() * 290, y: 1470 + r() * 330, h: 300 + r() * 360, s: r() });
    for (let i = 0; i < 14; i++) trees.push({ x: 820 + r() * 300, y: 1480 + r() * 320, h: 300 + r() * 360, s: r() });
    for (let i = 0; i < 12; i++) trees.push({ x: 10 + r() * 1060, y: Y0 + 18 + r() * 30, h: 40 + r() * 50, s: r(), far: true });
    trees.sort((a, b) => a.y - b.y);
  })();

  const defaults = {
    marker: 0, people: 1, fire: 1, lake: 1, life: 1, heat: 0,
    gal: 0.055, galB: 0.85, nebula: 0, drift: 0, cores: 0, spin: 0,
    merge: 0, giant: 0, fade: 0,
  };

  // ---------- Himmel zeichnen ----------
  function skyColors(s) {
    let top = [3, 5, 16], mid = [9, 15, 36], hor = [28, 42, 78];
    top = mix(top, [10, 6, 14], s.heat * 0.6); mid = mix(mid, [26, 16, 28], s.heat); hor = mix(hor, [78, 52, 46], s.heat);
    mid = mix(mid, [40, 18, 46], s.nebula * 0.5); hor = mix(hor, [110, 50, 90], s.nebula * 0.4);
    mid = mix(mid, [40, 34, 34], s.merge * 0.4);
    top = mix(top, [40, 8, 6], s.giant); mid = mix(mid, [140, 36, 16], s.giant); hor = mix(hor, [255, 128, 50], s.giant);
    return { top, mid, hor };
  }

  function drawGalaxyObjects(ctx, t, s, alpha) {
    // Andromeda
    const gs = s.gal * 1.3;
    if (gs > 0.005 && s.galB > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * Math.min(1, s.galB) * (1 - 0.3 * clamp(s.gal - 0.5) - 0.3 * s.nebula);
      ctx.translate(GAL[0], GAL[1]);
      ctx.rotate(-0.62 + s.gal * 0.12);
      ctx.scale(gs, gs * (0.4 + 0.12 * Math.min(1, s.gal)));
      ctx.rotate(t * 0.004);
      ctx.drawImage(gal, -GS / 2, -GS / 2);
      ctx.restore();
    }
    // Sternentstehung
    if (s.nebula > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * s.nebula;
      ctx.translate(GAL[0] - 80, GAL[1] + 60);
      ctx.rotate(-0.5 + t * 0.003);
      ctx.scale(1.45, 0.85);
      ctx.drawImage(neb, -NS / 2, -NS / 2);
      ctx.rotate(1.9);
      ctx.globalAlpha = alpha * s.nebula * 0.7;
      ctx.drawImage(neb, -NS / 2 + 200, -NS / 2 - 100, NS * 0.8, NS * 0.8);
      ctx.restore();
    }
    // zwei Kerne, die einander umkreisen
    if (s.cores > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a0 = 0.6 + t * 0.05 + s.spin * s.spin * 9;
      const sep = 230 * (1 - 0.75 * s.spin);
      for (let k = 0; k < 2; k++) {
        const a = a0 + k * Math.PI;
        const x = GAL[0] - 40 + Math.cos(a) * sep, y = GAL[1] + 40 + Math.sin(a) * sep * 0.6;
        ctx.save();
        ctx.globalAlpha = alpha * s.cores * 0.85;
        ctx.translate(x, y); ctx.rotate(a + (k ? 0.8 : -0.4)); ctx.scale(0.42, 0.24);
        ctx.drawImage(gal, -GS / 2, -GS / 2);
        ctx.restore();
        const r = 120;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,245,225,${alpha * s.cores})`);
        g.addColorStop(0.25, `rgba(255,220,180,${alpha * s.cores * 0.5})`);
        g.addColorStop(1, 'rgba(255,200,160,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      ctx.restore();
    }
    // verschmolzene Riesengalaxie
    if (s.merge > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * s.merge;
      ctx.translate(GAL[0] - 40, GAL[1] + 40);
      ctx.rotate(-0.3);
      const k = 0.7 + 0.5 * s.merge;
      ctx.scale(k * 1.15, k * 0.8);
      ctx.drawImage(ell, -ES / 2, -ES / 2);
      ctx.restore();
    }
  }

  function drawSky(ctx, t, s) {
    const c = skyColors(s);
    const g = ctx.createLinearGradient(0, 0, 0, Y0);
    g.addColorStop(0, rgb(c.top)); g.addColorStop(0.6, rgb(c.mid)); g.addColorStop(1, rgb(c.hor));
    ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, Y0 + 400);

    ctx.save();
    const ang = -s.drift * 0.35 + t * 0.0015;
    ctx.translate(PIV[0], PIV[1]); ctx.rotate(ang); ctx.translate(-PIV[0], -PIV[1]);
    // Sterne verblassen, wenn der Himmel hell wird
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(1 - s.giant * 0.9 - s.heat * 0.15);
    ctx.drawImage(sky, PIV[0] - SKY / 2, PIV[1] - SKY / 2);
    ctx.globalAlpha = 1;
    drawGalaxyObjects(ctx, t, s, 1 - s.giant * 0.55);
    ctx.restore();

    // Markierung um Andromeda
    if (s.marker > 0.01) {
      ctx.save();
      ctx.globalAlpha = s.marker * (0.75 + 0.25 * Math.sin(t * 3));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(GAL[0], GAL[1], 120, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Roter Riese geht auf
    if (s.giant > 0.005) {
      const gx = W * 0.7, gr = 820, gy = Y0 + gr + 60 - s.giant * 760;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      let gg = ctx.createRadialGradient(gx, gy, gr * 0.8, gx, gy, gr * 1.8);
      gg.addColorStop(0, `rgba(255,110,40,${0.55 * s.giant})`);
      gg.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = gg; ctx.fillRect(-100, -100, W + 200, Y0 + 300);
      ctx.restore();
      gg = ctx.createRadialGradient(gx, gy - 80, 0, gx, gy, gr);
      gg.addColorStop(0, 'rgb(255,190,110)');
      gg.addColorStop(0.7, 'rgb(250,110,45)');
      gg.addColorStop(1, 'rgb(200,50,25)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
      // Granulation
      ctx.save();
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.clip();
      const r = rng(5);
      for (let i = 0; i < 140; i++) {
        const a = r() * 7, d = Math.sqrt(r()) * gr, x = gx + Math.cos(a) * d, y = gy + Math.sin(a) * d;
        const rad = 30 + r() * 80;
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const v = 0.12 + 0.08 * Math.sin(t * 0.8 + i);
        g2.addColorStop(0, i % 2 ? `rgba(255,220,140,${v})` : `rgba(140,30,10,${v})`);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2; ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
      }
      ctx.restore();
    }
  }

  // ---------- Landschaft zeichnen ----------
  function poly(ctx, pts, bottom) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], bottom);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); ctx.fill();
  }

  function pine(ctx, tr, s, t, col, deadCol) {
    const { x, y, h } = tr, w = h * 0.36;
    const sway = Math.sin(t * 0.7 + tr.s * 6) * h * 0.004;
    ctx.strokeStyle = rgb(deadCol); ctx.lineWidth = Math.max(2, h * 0.025);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway, y - h); ctx.stroke();
    if (s.life > 0.01) {
      ctx.fillStyle = rgb(col, Math.min(1, s.life * 1.3));
      const tiers = 6;
      for (let k = 0; k < tiers; k++) {
        const ty = y - h * 0.12 - k * h * 0.15, tw = w * (1 - k / tiers * 0.85);
        ctx.beginPath();
        ctx.moveTo(x - tw / 2 + sway * k / tiers, ty);
        ctx.lineTo(x + sway * (k + 1.6) / tiers, ty - h * 0.3);
        ctx.lineTo(x + tw / 2 + sway * k / tiers, ty);
        ctx.closePath(); ctx.fill();
      }
    }
    if (s.life < 0.99) {
      ctx.strokeStyle = rgb(deadCol, 1 - s.life);
      ctx.lineWidth = Math.max(1, h * 0.008);
      for (let k = 1; k < 7; k++) {
        const by = y - h * (0.2 + k * 0.11), bl = w * 0.45 * (1 - k / 8);
        ctx.beginPath(); ctx.moveTo(x - bl, by - bl * 0.3); ctx.lineTo(x, by); ctx.lineTo(x + bl, by - bl * 0.35); ctx.stroke();
      }
    }
  }

  function person(ctx, x, y, kind, a, t) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#07080c';
    if (kind === 'stand') {
      ctx.beginPath(); ctx.arc(x, y - 168, 17, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 20, y - 146); ctx.lineTo(x + 20, y - 146); ctx.lineTo(x + 16, y - 70);
      ctx.lineTo(x + 14, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y - 62); ctx.lineTo(x - 4, y);
      ctx.lineTo(x - 14, y); ctx.lineTo(x - 16, y - 70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#07080c'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      const la = Math.sin(t * 1.3) * 0.03;
      ctx.beginPath(); ctx.moveTo(x + 14, y - 140); ctx.lineTo(x + 50, y - 190 + la * 100); ctx.lineTo(x + 78, y - 238); ctx.stroke();
    } else {
      const d = kind === 'sitL' ? 1 : -1;
      ctx.beginPath(); ctx.arc(x, y - 92, 15, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 18, y - 74); ctx.lineTo(x + 18, y - 74); ctx.lineTo(x + 20, y - 18);
      ctx.lineTo(x + 46 * d, y - 22); ctx.lineTo(x + 50 * d, y); ctx.lineTo(x - 20 * d, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawLand(ctx, t, s) {
    const desert = clamp(s.heat * 1.1 - 0.1);
    // ferne Berge
    let far = mix([16, 22, 40], [62, 40, 36], desert);
    far = mix(far, [80, 26, 18], s.giant);
    ctx.fillStyle = rgb(far); poly(ctx, farM, Y0 + 40);
    // Horizontdunst
    const c = skyColors(s);
    const hz = ctx.createLinearGradient(0, Y0 - 160, 0, Y0 + 10);
    hz.addColorStop(0, rgb(c.hor, 0)); hz.addColorStop(1, rgb(c.hor, 0.55));
    ctx.fillStyle = hz; ctx.fillRect(0, Y0 - 160, W, 170);
    // nahe Hügel
    let nearC = mix([9, 13, 24], [48, 30, 24], desert);
    nearC = mix(nearC, [60, 18, 12], s.giant);
    ctx.fillStyle = rgb(nearC);
    poly(ctx, nearL, Y0 + 60); poly(ctx, nearR, Y0 + 60);
    // kleine ferne Bäume am Ufer
    for (const tr of trees) if (tr.far) pine(ctx, tr, s, t, mix([8, 14, 16], [30, 22, 18], desert), nearC);

    // --- See / Seeboden ---
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-50, Y0 + 20);
    ctx.lineTo(W + 50, Y0 + 20);
    for (let x = W + 50; x >= -50; x -= 20) ctx.lineTo(x, shore(x) + 10);
    ctx.closePath(); ctx.clip();
    // Seeboden (sichtbar, wenn Wasser verschwindet)
    let mud = mix([40, 34, 30], [120, 82, 56], desert); mud = mix(mud, [130, 50, 30], s.giant);
    ctx.fillStyle = rgb(mud); ctx.fillRect(-50, Y0, W + 100, 400);
    ctx.globalAlpha = clamp(1 - s.lake * 1.5);
    ctx.drawImage(crack, 0, Y0 + 20);
    ctx.globalAlpha = 1;
    // Wasser
    if (s.lake > 0.01) {
      const L = s.lake;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(W / 2 + 40, Y0 + 130, 80 + 900 * L, 20 + 260 * L, 0, 0, Math.PI * 2); ctx.clip();
      const wg = ctx.createLinearGradient(0, Y0, 0, Y0 + 300);
      wg.addColorStop(0, rgb(mix(c.hor, [0, 0, 0], 0.25))); wg.addColorStop(1, rgb(mix(c.mid, [0, 0, 0], 0.55)));
      ctx.fillStyle = wg; ctx.fillRect(-50, Y0, W + 100, 400);
      // Spiegelung
      ctx.save();
      ctx.translate(0, Y0 * 2 + 30); ctx.scale(1, -1);
      ctx.globalAlpha = 0.35;
      ctx.save();
      ctx.translate(PIV[0], PIV[1]); ctx.rotate(-s.drift * 0.35 + t * 0.0015); ctx.translate(-PIV[0], -PIV[1]);
      drawGalaxyObjects(ctx, t, s, 0.5);
      ctx.restore();
      ctx.restore();
      // Wellenglanz
      ctx.strokeStyle = 'rgba(200,215,255,0.10)'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const y = Y0 + 14 + i * 11, off = (t * 18 + i * 53) % 220;
        ctx.beginPath();
        for (let x = -220 + off; x < W; x += 220) { ctx.moveTo(x, y); ctx.lineTo(x + 60 + (i % 3) * 20, y); }
        ctx.stroke();
      }
      ctx.restore();
      // Dampf, während der See verdampft
      const steam = s.heat * L * 2.2;
      if (steam > 0.02) {
        for (let i = 0; i < 18; i++) {
          const x = (i * 97 + t * 14) % (W + 200) - 100, y = Y0 + 40 - ((t * 22 + i * 37) % 160);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
          g.addColorStop(0, `rgba(200,190,190,${0.12 * Math.min(1, steam)})`); g.addColorStop(1, 'rgba(200,190,190,0)');
          ctx.fillStyle = g; ctx.fillRect(x - 120, y - 120, 240, 240);
        }
      }
    }
    ctx.restore();

    // --- Vordergrund ---
    let ground = mix([12, 15, 18], [62, 40, 28], desert); ground = mix(ground, [90, 34, 20], s.giant);
    const gg = ctx.createLinearGradient(0, 1420, 0, H);
    gg.addColorStop(0, rgb(ground)); gg.addColorStop(1, rgb(mix(ground, [0, 0, 0], 0.7)));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.moveTo(-50, H + 50);
    for (let x = -50; x <= W + 50; x += 20) ctx.lineTo(x, shore(x));
    ctx.lineTo(W + 50, H + 50); ctx.closePath(); ctx.fill();
    // Gras
    const grass = mix(mix([20, 36, 22], [110, 80, 46], 1 - s.life), [70, 30, 18], s.giant);
    ctx.strokeStyle = rgb(grass, 0.25 + 0.75 * s.life); ctx.lineWidth = 2.5;
    const gr = rng(3);
    ctx.beginPath();
    for (let i = 0; i < 260; i++) {
      const x = gr() * W, y = shore(x) + 8 + gr() * 420, h = (8 + gr() * 26) * (0.35 + 0.65 * s.life);
      const sw = Math.sin(t * 1.2 + x * 0.05) * 3 * s.life;
      ctx.moveTo(x, y); ctx.lineTo(x + sw, y - h);
    }
    ctx.stroke();

    // Zelt
    ctx.fillStyle = rgb(mix([28, 50, 70], [70, 50, 40], desert));
    ctx.globalAlpha = clamp(s.people * 1.5);
    ctx.beginPath(); ctx.moveTo(650, 1640); ctx.lineTo(760, 1505); ctx.lineTo(880, 1640); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,170,80,${0.5 * s.fire})`;
    ctx.beginPath(); ctx.moveTo(735, 1640); ctx.lineTo(760, 1560); ctx.lineTo(788, 1640); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // Lagerfeuer
    const fx = 520, fy = 1700;
    ctx.fillStyle = rgb(mix([30, 22, 18], [60, 40, 30], desert));
    ctx.beginPath(); ctx.ellipse(fx, fy + 6, 70, 16, 0, 0, 7); ctx.fill();
    if (s.fire > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
      let g = ctx.createRadialGradient(fx, fy - 30, 0, fx, fy - 30, 420);
      g.addColorStop(0, `rgba(255,150,60,${0.42 * s.fire * fl})`); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.fillRect(fx - 420, fy - 450, 840, 840);
      for (let k = 0; k < 5; k++) {
        const ph = t * (6 + k) + k * 2, hh = (70 + 40 * Math.sin(ph)) * s.fire, ww = 22 + 6 * Math.sin(ph * 1.3);
        const ox = (k - 2) * 12 + Math.sin(ph * 0.7) * 6;
        g = ctx.createLinearGradient(0, fy, 0, fy - hh);
        g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(fx + ox - ww, fy);
        ctx.quadraticCurveTo(fx + ox - ww * 0.4, fy - hh * 0.6, fx + ox + Math.sin(ph) * 8, fy - hh);
        ctx.quadraticCurveTo(fx + ox + ww * 0.4, fy - hh * 0.6, fx + ox + ww, fy);
        ctx.closePath(); ctx.fill();
      }
      // Funken
      for (let i = 0; i < 14; i++) {
        const p = ((t * 0.6 + i * 0.137) % 1);
        const x = fx + Math.sin(i * 3 + t * 2) * 30 * p, y = fy - 60 - p * 260;
        ctx.fillStyle = `rgba(255,190,90,${(1 - p) * 0.9 * s.fire})`;
        ctx.fillRect(x, y, 3, 3);
      }
      ctx.restore();
    }
    // Holzscheite
    ctx.strokeStyle = '#1a120c'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx - 50, fy + 6); ctx.lineTo(fx + 40, fy - 6); ctx.moveTo(fx + 50, fy + 8); ctx.lineTo(fx - 36, fy - 8); ctx.stroke();

    // Menschen
    if (s.people > 0.01) {
      person(ctx, 400, 1712, 'sitL', s.people, t);
      person(ctx, 640, 1716, 'sitR', s.people, t);
      person(ctx, 300, 1760, 'stand', s.people, t);
    }

    // Bäume im Vordergrund
    const pc = mix([10, 20, 18], [40, 46, 30], 1 - s.life), dc = mix([20, 16, 14], [50, 34, 24], desert);
    for (const tr of trees) {
      if (tr.far) continue;
      // nur ein Teil der Bäume bleibt als toter Stamm stehen
      ctx.globalAlpha = tr.s < 0.6 ? clamp(s.life * 2) : 1;
      if (ctx.globalAlpha > 0.01) pine(ctx, tr, s, t, pc, dc);
      ctx.globalAlpha = 1;
    }

    // Lichtstimmung von oben (Galaxie, Nebel, Riese)
    const lights = [
      [[120, 140, 220], 0.07 * Math.min(1, s.gal) * s.galB],
      [[230, 90, 170], 0.09 * s.nebula],
      [[255, 230, 200], 0.09 * s.merge + 0.05 * s.cores],
      [[255, 90, 30], 0.22 * s.giant],
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const [col, a] of lights) {
      if (a < 0.005) continue;
      const lg = ctx.createLinearGradient(0, Y0 - 100, 0, Y0 + 600);
      lg.addColorStop(0, rgb(col, a)); lg.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = lg; ctx.fillRect(-100, Y0 - 100, W + 200, H);
    }
    ctx.restore();

    // Hitzeflimmern / Asche beim Roten Riesen
    if (s.giant > 0.05) {
      for (let i = 0; i < 70; i++) {
        const p = (t * 0.08 + i * 0.0731) % 1;
        const x = (i * 157.3 + Math.sin(t + i) * 40) % W, y = H - p * (H - 300);
        ctx.fillStyle = `rgba(255,${140 + (i % 5) * 20},80,${s.giant * (1 - p) * 0.7})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  }

  return {
    defaults,
    draw(ctx, t, s) {
      drawSky(ctx, t, s);
      drawLand(ctx, t, s);
      // Vignette
      const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = v; ctx.fillRect(-100, -100, W + 200, H + 200);
      if (s.fade > 0.005) { ctx.fillStyle = `rgba(0,0,0,${0.45 * s.fade})`; ctx.fillRect(-100, -100, W + 200, H + 200); }
    },
  };
};
