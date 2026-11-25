# Xtream Player for LG webOS

A remote-friendly Xtream Codes player (Live TV, Movies, Series) built as a plain webOS web app: no build step, no dependencies.

## Try Demo

The login screen has a **Try Demo** button. It loads made-up sample data (fake channels, movies and series, with generated placeholder artwork) so you can see how the app looks and behaves **without any provider account or real content**. Nothing is saved in demo mode.

- All demo data lives in `demo.js`; the real code path is untouched.
- Demo playback uses public sample streams: the Blender Foundation open movies (Big Buck Bunny, Sintel, Tears of Steel, Elephants Dream, CC-licensed) plus Mux and Apple HLS test streams. The TV needs internet access for the video to play.
- Any resemblance of demo titles to real ones is coincidental; the app provides no content of its own.

## Disclaimer

This is a generic player for Xtream Codes-compatible servers. It ships with **no channels, playlists, accounts or media**, and is not affiliated with any IPTV provider. You are responsible for only using it with content you have the right to access.

## Install on your TV

1. On the TV: install **Developer Mode** from the LG Content Store, open it, turn on *Dev Mode Status* and *Key Server*. Note the TV's IP and passphrase.
2. On your PC: install Node.js, then the webOS CLI: `npm i -g @webos-tools/cli`
3. Register the TV and pair it:
   ```
   ares-setup-device --add tv --info "{'host':'TV_IP','port':'9922','username':'prisoner'}"
   ares-novacom --device tv --getkey      # enter the passphrase shown in Developer Mode
   ```
4. Package and install (run from the folder that contains `xtream-webos/`):
   ```
   ares-package xtream-webos
   ares-install --device tv com.example.xtreamplayer_1.0.0_all.ipk
   ares-launch  --device tv com.example.xtreamplayer
   ```
   (Developer Mode apps expire after ~50 hours unless you press *Extend* in the Developer Mode app.)

## Remote control

| Key | Action |
| --- | --- |
| Arrows / OK | Navigate / open / play |
| Back | Go up one level (player → list → categories → tabs → exit) |
| Yellow | Toggle favourite on the highlighted item |
| Live: Up/Down or CH+/CH- | Previous / next channel |
| Movies & series: Left/Right (or RW/FF) | Seek ±10 s; Up/Down ±60 s |
| OK / Play / Pause | Pause or resume |

Playback position is remembered for movies and episodes, and episodes auto-play the next one.

## Notes

- Live uses `.m3u8` (HLS) first and falls back to `.ts` if that fails.
- Movies/series play the container the server reports (mp4/mkv). Support for mkv or some audio codecs depends on your TV model.
- If sign-in fails with a network error on a server that works in other apps, the server probably blocks cross-origin requests from apps; a proxy is the usual workaround.
