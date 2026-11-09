// Rendert ein Video Bild für Bild mit Chromium (Playwright) und ffmpeg.
//
//   node engine/render.mjs videos/<name>                 -> build/<name>.mp4
//   node engine/render.mjs videos/<name> --stills 3,40   -> build/still_3.png, …
//   node engine/render.mjs videos/<name> --from 30 --to 40 (Ausschnitt testen)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Playwright ist global installiert (CommonJS) – daher per require laden.
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const vdir = path.resolve(args[0]);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const name = path.basename(vdir);
const build = path.join(vdir, 'build');

const script = JSON.parse(fs.readFileSync(path.join(vdir, 'script.json'), 'utf8'));
const timeline = JSON.parse(fs.readFileSync(path.join(build, 'timeline.json'), 'utf8'));
const f = file => fs.readFileSync(path.join(here, 'fonts', file)).toString('base64');
const fonts = [
  { family: 'EB Garamond', style: 'normal', weight: '400', data: f('eb-garamond-latin-400-normal.woff2') },
  { family: 'EB Garamond', style: 'normal', weight: '500', data: f('eb-garamond-latin-500-normal.woff2') },
  { family: 'EB Garamond', style: 'italic', weight: '400', data: f('eb-garamond-latin-400-italic.woff2') },
  { family: 'EB Garamond', style: 'italic', weight: '500', data: f('eb-garamond-latin-500-italic.woff2') },
  { family: 'Inter', style: 'normal', weight: '500', data: f('Inter-Medium.otf') },
  { family: 'Inter', style: 'normal', weight: '600', data: f('Inter-SemiBold.otf') },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
page.on('pageerror', e => { console.error('Seitenfehler:', e); process.exit(1); });
await page.goto(pathToFileURL(path.join(here, 'player.html')).href);
await page.addScriptTag({ path: path.join(vdir, 'scene.js') });
await page.evaluate(([s, t, fo]) => window.init(s, t, fo), [script, timeline, fonts]);

const stills = opt('--stills');
if (stills) {
  for (const t of stills.split(',').map(Number)) {
    const b64 = await page.evaluate(t => window.grab(t, 0.9), t);
    const out = path.join(build, `still_${t}.jpg`);
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(out);
  }
  await browser.close();
  process.exit(0);
}

const fps = timeline.fps;
const t0 = Number(opt('--from') ?? 0);
const t1 = Number(opt('--to') ?? timeline.total);
const frames = Math.round((t1 - t0) * fps);
const out = path.join(build, opt('--out') ?? `${name}.mp4`);
const ff = spawn('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-ss', String(t0), '-t', String(t1 - t0), '-i', path.join(build, 'audio.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const started = Date.now();
for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate(t => window.grab(t, 0.94), t0 + i / fps);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 150 === 0) {
    const el = (Date.now() - started) / 1000;
    console.log(`Bild ${i}/${frames}  (${el.toFixed(0)} s)`);
  }
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('Fertig:', out);
