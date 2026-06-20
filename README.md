# DarkBeat Music - Installation Guide

## What You Get

- Spotify-like dark UI with premium look
- Real music streaming from Jamendo (100% free & legal)
- Create and manage playlists
- Import playlists from Spotify (requires public URL)
- Works offline once installed
- **Zero ads** forever
- Works on Android, iOS, and desktop

## Files Included

| File | Purpose |
|------|---------|
| `index.html` | Main app |
| `app.css` | Styling (dark theme) |
| `app.js` | Music player & logic |
| `sw.js` | Offline caching |
| `manifest.json` | PWA manifest |
| `start_server.py` | Local server script |

## Step 1: Start the Server (on your PC)

1. Make sure you have **Python** installed on your PC
2. Open a terminal in this folder
3. Run:

```bash
python start_server.py
```

4. Note the IP address shown (e.g., `http://192.168.1.5:8080`)

## Step 2: Install on Android

### Option A: Same WiFi Network
1. Make sure your phone and PC are on the **same WiFi**
2. Open Chrome on your Android phone
3. Go to: `http://<your-pc-ip>:8080` (replace with your PC's IP)
4. Tap the **3-dot menu** → **Add to Home screen**
5. Name it "DarkBeat" and tap **Add**
6. The app icon will appear on your home screen!

### Option B: Copy Files to Phone
1. Copy all files to your phone's storage
2. Open Chrome and go to `file:///sdcard/path/to/index.html`
3. Add to home screen as above

### Option C: Host Online (Free)
Upload these files to any free static host:
- **Netlify Drop** (drag & drop)
- **GitHub Pages**
- **Vercel**
- **Surge.sh**

Then open the URL on your phone and add to home screen.

## New Features Added

### Smart Recommendations (Made For You)
The app analyzes your listening history to suggest new songs. It looks at your top artists and recently played tracks, then fetches fresh music from Jamendo that matches your taste. Every time you open the app, you'll get new personalized recommendations.

### Yearly Wrapped
DarkBeat automatically tracks every song you play and builds your personal year-in-review:
- **Top 5 Songs** — Your most played tracks of the year
- **Top 5 Artists** — Your favorites ranked by play count
- **Total Hours** — How much time you've spent listening
- **Unique Tracks & Artists** — How diverse your music taste is
- **Explorer Score** — Rates how adventurous your listening is
- **Listening Personality** — Your #1 fan artist and more
- **Share** — Tap "Share Wrapped" to share your stats with friends

Go to the **Wrapped** tab in the bottom navigation to see your stats.

## Step 3: Using the App

| Feature | How To |
|---------|--------|
| **Play Music** | Tap any track on the Home screen or search |
| **Search** | Tap the magnifying glass icon, type any song or artist |
| **Get Recommendations** | Scroll down on Home to "Made For You" section |
| **See Your Wrapped** | Tap the **Wrapped** tab in bottom navigation |
| **Create Playlist** | Go to Library → New Playlist |
| **Add to Playlist** | While playing, tap the "+" button in full player |
| **Like Song** | Tap the heart icon while playing |
| **Import Spotify** | Go to Library → Import from Spotify, paste playlist URL |
| **Full Player** | Tap the mini player bar at the bottom |
| **Shuffle** | Tap the shuffle icon in full player |
| **Repeat** | Tap the repeat icon in full player |
| **Share Wrapped** | Go to Wrapped tab → tap Share Wrapped button |

## Important Notes

- **Music Source**: This app streams from Jamendo, a free legal music platform. It has thousands of real tracks but not the full Spotify catalog.
- **Spotify Import**: Due to Spotify's API restrictions, importing playlists requires the playlist to be public. Tracks will be imported as a list; you may need to search for Jamendo equivalents to play them.
- **Offline**: After installing the PWA, the app will cache itself for offline use. Audio streaming requires internet.
- **No Ads**: This app is completely ad-free and open.

## Troubleshooting

**"Add to Home Screen" not showing?**
- Make sure you're using Chrome on Android
- The page must be served over HTTPS or localhost (use the Python server)

**Music not playing?**
- Check your internet connection
- Some tracks may not have audio available
- Try searching for different tracks

**Server won't start?**
- Make sure Python is installed: `python --version`
- Try `python3 start_server.py` if `python` doesn't work

## Enjoy Your Music! 🎵
