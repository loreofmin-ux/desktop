# Changelog

What changed in each release of Liner. Newest first.

## 0.2.10 (2026-10-24)

### New

- **YouTube Music library:** sign in to your YouTube account from Settings → YouTube (with a code shown on screen, like on a TV) to sync your YouTube Music library.
- **Playback:** Liner plays its own copy of a track first and falls back to YouTube when there is none.
- **SoundCloud:** open SoundCloud artists, albums, playlists, tracks and pasted links.
- **Windows 11:** native snap preview and window motion, drag the window to the top edge to maximize, restore and player buttons in the taskbar thumbnail.
- **Discord:** account card in the Discord settings. Presence now uses a light HTTP heartbeat instead of a WebSocket kept open.
- New login screen, display name fallback for accounts without one, and a search history action.
- Lyrics snap to the top of the view.

### Fixes

- You stay signed in when a single session refresh is rejected.
- The login session is stored by the main process (encrypted with the system keychain when available).
- Spotify imports: playlists past 100 tracks import fully, even when a page fails.
- SoundCloud tracks without artwork use the set's or the uploader's picture.
- Player: seeking no longer flashes the loading state, no endless reload when playback keeps failing at one spot, Windows media controls stay connected across track changes.
- Saved artists keep their name and picture.
- Downloads started before a cache clear no longer write the audio back.
- The overlay shows the first time Liner is minimized.
- Square, edge-to-edge corners when the window is maximized or fullscreen, including the login screen.
- No stale hover on the minimize button, and a styled error on the login form instead of the browser's email bubble.
- Daily mixes and recently played are kept per account.

### Security

- Web security (same-origin policy) is back on in the main window.
- API request signing remains enabled for general API requests.

### Translations

- Portuguese is complete for the newer screens.

### Build

- Windows builds compile a small native add-on for the snap preview, and CI checks that it loads.
- `oxlint` and `prettier` are available (`pnpm lint`, `pnpm format`).
