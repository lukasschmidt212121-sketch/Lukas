# Erklärvideos – „Was wäre, wenn …?“

Animierte Hochformat-Videos (1080×1920, TikTok/Reels/Shorts) mit KI-Stimme,
komplett aus Code erzeugt. Feste Kamera auf eine Szene, Datenfeld mit
laufenden Zahlen, kursive Untertitel, Endkarte mit Fakt.

## Videos

| Video | Datei |
|---|---|
| Was wäre, wenn Andromeda zu uns kommt? | [`videos/andromeda/andromeda.mp4`](videos/andromeda/andromeda.mp4) |

## So entsteht ein Video

```
videos/<name>/script.json   Text, Datenfeld (HUD) und Szenen-Zustände pro Satz
videos/<name>/scene.js      die gezeichnete Szene (Canvas), gesteuert über Zustände
engine/voice.py             KI-Stimme (Microsoft Edge Neural TTS) + Zeitachse + Tonmischung
engine/player.html          Titel, HUD, Untertitel, Endkarte, Interpolation
engine/render.mjs           rendert jedes Bild in Chromium und baut die MP4 mit ffmpeg
```

```bash
pip install edge-tts
python3 engine/voice.py videos/andromeda                 # Stimme + timeline.json + audio.wav
node engine/render.mjs videos/andromeda --stills 5,40    # Vorschaubilder
node engine/render.mjs videos/andromeda                  # komplettes Video -> build/andromeda.mp4
```

Benötigt: Python 3, Node 18+, Playwright mit Chromium, ffmpeg.

### script.json

Jedes Segment ist ein gesprochener Satz:

- `voice` – was die Stimme sagt; `sub` – optional abweichender Untertitel
- `hud` – Datenfeld: `{label, value}` fest, `{label, from, to}` zählt hoch,
  `{label, text}` für Wörter; weglassen = vorheriges behalten; `null` = ausblenden
- `state` – Zielwerte der Szene, die während des Satzes erreicht werden
- `pause` – Pause danach in Sekunden

Stimme: unter `tts` – ElevenLabs (`provider: "elevenlabs"`, `voice_id`, `speed`,
`stability`, `style`) oder kostenlos Edge (`provider: "edge"`, `voice`, `rate`).
Stimmen auflisten: `python3 engine/voice.py --voices`. Edge-Beispiele: `de-DE-FlorianMultilingualNeural`,
`de-DE-SeraphinaMultilingualNeural`, `de-DE-KatjaNeural`.

> Hinweis: Die Edge-Stimmen sind kostenlos, aber kein offizielles API-Produkt.
> Für kommerzielle Nutzung lieber ElevenLabs oder OpenAI TTS einbinden.
