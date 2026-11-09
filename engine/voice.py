#!/usr/bin/env python3
"""Erzeugt die KI-Stimme für jedes Segment und berechnet daraus die Zeitachse.

Aufruf: python3 engine/voice.py videos/<name>

Ergebnis in videos/<name>/build/:
  voice_XX.mp3     – ein Clip pro Segment (wird gecacht)
  timeline.json    – Start/Ende jedes Segments in Sekunden (für den Renderer)
  audio.wav        – Stimme + Hintergrund-Drone, fertig gemischt
"""
import asyncio, hashlib, json, os, ssl, subprocess, sys

import edge_tts
import edge_tts.communicate as _comm

# Im Cloud-Container läuft HTTPS über einen Proxy mit eigener CA.
_CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(_CA):
    _comm._SSL_CTX = ssl.create_default_context(cafile=_CA)

FPS = 30


def duration(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path])
    return float(out)


async def synth(text, voice, rate, out):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)


def main(vdir):
    script = json.load(open(os.path.join(vdir, "script.json"), encoding="utf-8"))
    build = os.path.join(vdir, "build")
    os.makedirs(build, exist_ok=True)
    voice, rate = script["voice"], script.get("rate", "+0%")
    gap = script.get("gap", 0.4)

    lines = [s["voice"] for s in script["segments"]]
    end = script.get("endCard")
    if end and end.get("voice"):
        lines.append(end["voice"])

    clips = []
    for i, text in enumerate(lines):
        key = hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest()[:10]
        path = os.path.join(build, f"voice_{i:02d}_{key}.mp3")
        if not os.path.exists(path):
            print(f"  Stimme {i + 1}/{len(lines)}: {text}")
            asyncio.run(synth(text, voice, rate, path))
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
    main(sys.argv[1])
