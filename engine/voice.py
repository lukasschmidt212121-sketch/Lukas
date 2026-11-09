#!/usr/bin/env python3
"""Erzeugt die KI-Stimme für jedes Segment und berechnet daraus die Zeitachse.

Aufruf:
  python3 engine/voice.py videos/<name>     Stimme + Zeitachse + Tonmischung
  python3 engine/voice.py --voices          verfügbare ElevenLabs-Stimmen auflisten

Anbieter (in script.json unter "tts"):
  {"provider": "elevenlabs", "voice_id": "...", "model": "eleven_multilingual_v2", ...}
  {"provider": "edge", "voice": "de-DE-FlorianMultilingualNeural", "rate": "-4%"}

Den ElevenLabs-Schlüssel liest das Skript aus ELEVENLABS_API_KEY. In der
Cloud-Umgebung setzt der Netzwerk-Proxy ihn automatisch ein.

Ergebnis in videos/<name>/build/:
  voice_XX_*.mp3   – ein Clip pro Segment (wird gecacht)
  timeline.json    – Start/Ende jedes Segments in Sekunden (für den Renderer)
  audio.wav        – Stimme + Hintergrund-Drone, fertig gemischt
"""
import asyncio, hashlib, json, os, ssl, subprocess, sys, urllib.request, urllib.error

FPS = 30
_CA = "/root/.ccr/ca-bundle.crt"           # HTTPS-Proxy-CA im Cloud-Container
SSL_CTX = ssl.create_default_context(cafile=_CA) if os.path.exists(_CA) else ssl.create_default_context()
EL_API = "https://api.elevenlabs.io/v1"
EL_KEY = os.environ.get("ELEVENLABS_API_KEY", "proxy-injected")


def duration(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path])
    return float(out)


def el_request(path, body=None):
    req = urllib.request.Request(
        EL_API + path, data=json.dumps(body).encode() if body else None,
        headers={"xi-api-key": EL_KEY, "Content-Type": "application/json"},
        method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs-Fehler {e.code}: {e.read().decode()[:300]}")


def synth_elevenlabs(tts, text, prev_text, next_text, out):
    body = {
        "text": text,
        "model_id": tts.get("model", "eleven_multilingual_v2"),
        "language_code": tts.get("language", "de"),
        "previous_text": prev_text or None,
        "next_text": next_text or None,
        "voice_settings": {
            "stability": tts.get("stability", 0.45),
            "similarity_boost": tts.get("similarity", 0.8),
            "style": tts.get("style", 0.15),
            "use_speaker_boost": True,
            "speed": tts.get("speed", 1.0),
        },
    }
    if body["model_id"] == "eleven_multilingual_v2":
        body.pop("language_code")           # v2 erkennt die Sprache selbst
    audio = el_request(f"/text-to-speech/{tts['voice_id']}?output_format=mp3_44100_192", body)
    open(out, "wb").write(audio)


def synth_edge(tts, text, out):
    import edge_tts, edge_tts.communicate as comm
    comm._SSL_CTX = SSL_CTX
    asyncio.run(edge_tts.Communicate(text, tts["voice"], rate=tts.get("rate", "+0%")).save(out))


def list_voices():
    data = json.loads(el_request("/voices"))
    for v in data["voices"]:
        lab = v.get("labels") or {}
        print(f"{v['voice_id']}  {v['name']:<28} {lab.get('gender', ''):<7} "
              f"{lab.get('accent', ''):<12} {lab.get('description', '') or lab.get('use_case', '')}")


def main(vdir):
    script = json.load(open(os.path.join(vdir, "script.json"), encoding="utf-8"))
    build = os.path.join(vdir, "build")
    os.makedirs(build, exist_ok=True)
    tts = script["tts"]
    gap = script.get("gap", 0.4)

    lines = [s["voice"] for s in script["segments"]]
    end = script.get("endCard")
    if end and end.get("voice"):
        lines.append(end["voice"])

    clips = []
    for i, text in enumerate(lines):
        prev_t = lines[i - 1] if i > 0 else ""
        next_t = lines[i + 1] if i + 1 < len(lines) else ""
        key = hashlib.sha1(json.dumps([tts, text, prev_t, next_t], sort_keys=True).encode()).hexdigest()[:10]
        path = os.path.join(build, f"voice_{i:02d}_{key}.mp3")
        if not os.path.exists(path):
            print(f"  Stimme {i + 1}/{len(lines)}: {text}")
            if tts["provider"] == "elevenlabs":
                synth_elevenlabs(tts, text, prev_t, next_t, path)
            else:
                synth_edge(tts, text, path)
        clips.append((path, duration(path)))

    t = script.get("leadIn", 0.6)
    segs = []
    for i, seg in enumerate(script["segments"]):
        d = clips[i][1]
        segs.append({"start": round(t, 3), "voiceEnd": round(t + d, 3)})
        t += d + seg.get("pause", gap)
    for i, s in enumerate(segs):
        s["end"] = segs[i + 1]["start"] if i + 1 < len(segs) else round(t, 3)

    timeline = {"fps": FPS, "segments": segs}
    if end:
        es = t + 0.3
        ed = clips[-1][1] if end.get("voice") else 0
        timeline["endCard"] = {"start": round(es, 3), "voiceStart": round(es + 1.0, 3),
                               "end": round(es + 1.0 + ed + end.get("duration", 3), 3)}
        total = timeline["endCard"]["end"]
    else:
        total = t + 0.5
    timeline["total"] = round(total, 3)
    json.dump(timeline, open(os.path.join(build, "timeline.json"), "w"), indent=2)

    # --- Mischung: alle Clips an ihre Startzeit + leise Ambient-Drone ---------
    starts = [s["start"] for s in segs]
    if end and end.get("voice"):
        starts.append(timeline["endCard"]["voiceStart"])
    inputs, filters = [], []
    for i, ((path, _), st) in enumerate(zip(clips, starts)):
        inputs += ["-i", path]
        ms = int(st * 1000)
        filters.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,"
                       f"adelay={ms}|{ms},apad[v{i}]")
    n = len(clips)
    # Drone: tiefe, langsam schwebende Akkorde + gefiltertes Rauschen
    drone = ("aevalsrc='0.10*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.05*t))"
             "+0.07*sin(2*PI*82.4*t)*(0.6+0.4*sin(2*PI*0.071*t+1))"
             "+0.05*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.043*t+2))"
             "+0.035*sin(2*PI*164.8*t)*(0.5+0.5*sin(2*PI*0.09*t+3))"
             f"|0.10*sin(2*PI*55.3*t)*(0.6+0.4*sin(2*PI*0.053*t))"
             "+0.07*sin(2*PI*82.1*t)*(0.6+0.4*sin(2*PI*0.067*t+2))"
             "+0.05*sin(2*PI*110.4*t)*(0.5+0.5*sin(2*PI*0.047*t+1))"
             "+0.035*sin(2*PI*165.3*t)*(0.5+0.5*sin(2*PI*0.08*t+4))'"
             f":s=48000:d={total}")
    filters.append(f"{drone},lowpass=f=900,volume=0.55,"
                   f"afade=t=in:d=2,afade=t=out:st={total - 3:.2f}:d=3[m]")
    mix_in = "".join(f"[v{i}]" for i in range(n)) + "[m]"
    filters.append(f"{mix_in}amix=inputs={n + 1}:normalize=0:duration=longest,"
                   f"atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]")
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *inputs,
                           "-filter_complex", ";".join(filters), "-map", "[out]",
                           os.path.join(build, "audio.wav")])
    print(f"Zeitachse: {len(segs)} Segmente, {total:.1f} s")


if __name__ == "__main__":
    if sys.argv[1] == "--voices":
        list_voices()
    else:
        main(sys.argv[1])
