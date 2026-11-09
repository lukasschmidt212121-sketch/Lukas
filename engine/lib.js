/*
 * Gemeinsame Zeichen-Helfer für Szenen (window.V).
 * Alles deterministisch (eigener Zufallsgenerator), damit jedes Bild
 * beim Rendern identisch ausfällt.
 */
window.V = (function () {
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const gaussFrom = R => () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const mix = (c1, c2, x) => [lerp(c1[0], c2[0], x), lerp(c1[1], c2[1], x), lerp(c1[2], c2[2], x)];
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Pseudo-Rauschen (glatt, 1D) für Flackern und Wackeln
  const wobble = (t, s = 0) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.3 + s * 0.7) * 0.2;

  /** Weicher Rauchballen mit unregelmäßigem Rand. */
  function puff(color, size = 256, seed = 1, density = 26) {
    const c = mk(size, size), x = c.getContext('2d'), R = rng(seed), h = size / 2;
    for (let i = 0; i < density; i++) {
      const a = R() * Math.PI * 2, d = Math.pow(R(), 0.7) * h * 0.5;
      const px = h + Math.cos(a) * d, py = h + Math.sin(a) * d, r = h * (0.25 + R() * 0.3);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, rgb(color, 0.22 + R() * 0.12));
      g.addColorStop(0.6, rgb(color, 0.1));
      g.addColorStop(1, rgb(color, 0));
      x.fillStyle = g; x.fillRect(0, 0, size, size);
    }
    return c;
  }

  /** Radialer Lichtschein. */
  function glow(ctx, x, y, r, col, a) {
    if (a <= 0.002) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgb(col, a)); g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  /**
   * Skyline-Ebene: liefert {lit, dark, blocks}. lit = Fenster beleuchtet,
   * dark = Fenster aus; blocks = Gebäude-Rechtecke (für schrittweisen Stromausfall).
   */
  function skyline(w, h, opt) {
    const R = rng(opt.seed || 1);
    const lit = mk(w, h), dark = mk(w, h), a = lit.getContext('2d'), b = dark.getContext('2d');
    const blocks = [];
    let x = -20;
    while (x < w) {
      const bw = opt.minW + R() * (opt.maxW - opt.minW);
      const bh = opt.minH + Math.pow(R(), 1.6) * (opt.maxH - opt.minH);
      const top = h - bh;
      for (const c of [a, b]) {
        c.fillStyle = rgb(opt.color);
        c.fillRect(x, top, bw, bh);
        if (R() < 0.3) c.fillRect(x + bw * 0.2, top - bh * 0.08, bw * 0.6, bh * 0.08 + 1);
        if (R() < 0.15) c.fillRect(x + bw * 0.5 - 2, top - 70, 4, 70);
      }
      const ww = opt.win, gx = ww * 1.9, gy = ww * 2.3;
      const litP = opt.lit ?? 0.45;
      for (let yy = top + ww * 1.5; yy < h - ww * 2; yy += gy) {
        for (let xx = x + ww; xx < x + bw - ww * 1.4; xx += gx) {
          if (R() < litP) {
            const warm = R();
            a.fillStyle = warm < 0.7 ? `rgba(255,${200 + R() * 30 | 0},${120 + R() * 50 | 0},${0.6 + R() * 0.4})` : `rgba(170,200,255,${0.5 + R() * 0.4})`;
            a.fillRect(xx, yy, ww, ww * 1.3);
          }
          b.fillStyle = 'rgba(255,255,255,0.025)';
          b.fillRect(xx, yy, ww, ww * 1.3);
        }
      }
      blocks.push({ x, w: bw, top, t: R() });
      x += bw + R() * opt.gap;
    }
    return { lit, dark, blocks, w, h };
  }

  /** Partikel, die zyklisch neu entstehen: f(k, age 0..1) zeichnet Partikel k. */
  function particles(n, life, lt, f, seed = 3) {
    const R = rng(seed);
    for (let k = 0; k < n; k++) {
      const off = R() * life;
      const age = ((lt + off) % life) / life;
      f(k, age, R);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  return { rng, gaussFrom, lerp, mix, rgb, clamp, smooth, mk, wobble, puff, glow, skyline, particles, roundRect };
})();
