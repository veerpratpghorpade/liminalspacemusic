'use strict';

/* ============================================================
   DarkBeat Music App
   ============================================================ */

const App = {
  audio: null,
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  shuffle: false,
  repeat: false,
  likedTracks: new Set(),
  playlists: [],
  recentlyPlayed: [],
  tracks: [],
  currentPage: 'homePage',
  searchResults: [],
  stats: null,  // { trackPlays: {}, artistPlays: {}, totalSeconds: 0, yearData: {} }
  lastStatsUpdate: 0,
  currentSessionSeconds: 0,

  init() {
    this.audio = document.getElementById('audioPlayer');
    this.loadData();
    this.bindEvents();
    this.setupAudioEvents();
    this.renderHome();
    this.renderLibrary();
    this.setGreeting();
    this.registerSW();

    // Hide splash after animation
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      const appLoading = document.getElementById('appLoading');
      if (appLoading) appLoading.style.display = 'none';
    }, 2700);
  },

  // ---- Data & Storage ----
  loadData() {
    try {
      this.playlists = JSON.parse(localStorage.getItem('db_playlists')) || [
        { id: 'liked', name: 'Liked Songs', tracks: [], cover: '' },
        { id: 'favorites', name: 'Favorites', tracks: [], cover: '' }
      ];
      this.likedTracks = new Set(JSON.parse(localStorage.getItem('db_liked')) || []);
      this.recentlyPlayed = JSON.parse(localStorage.getItem('db_recent')) || [];
      this.stats = JSON.parse(localStorage.getItem('db_stats')) || {
        trackPlays: {},
        artistPlays: {},
        totalSeconds: 0,
        yearData: {},
        firstListen: new Date().toISOString()
      };
    } catch { /* ignore */ }
  },

  saveData() {
    localStorage.setItem('db_playlists', JSON.stringify(this.playlists));
    localStorage.setItem('db_liked', JSON.stringify([...this.likedTracks]));
    localStorage.setItem('db_recent', JSON.stringify(this.recentlyPlayed.slice(0, 50)));
    localStorage.setItem('db_stats', JSON.stringify(this.stats));
  },

  // ---- Events ----
  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) this.navigateTo(page);
        if (btn.id === 'playerNavBtn') this.openFullPlayer();
      });
    });

    // Search
    document.getElementById('searchBtn').onclick = () => this.openSearch();
    document.getElementById('closeSearch').onclick = () => this.closeSearch();
    document.getElementById('clearSearch').onclick = () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchResults').innerHTML = '';
    };
    document.getElementById('searchInput').addEventListener('input', e => this.handleSearch(e.target.value));

    // Player controls
    document.getElementById('npPlay').onclick = () => this.togglePlay();
    document.getElementById('fpPlay').onclick = () => this.togglePlay();
    document.getElementById('npPrev').onclick = () => this.prevTrack();
    document.getElementById('fpPrev').onclick = () => this.prevTrack();
    document.getElementById('npNext').onclick = () => this.nextTrack();
    document.getElementById('fpNext').onclick = () => this.nextTrack();
    document.getElementById('npInfo').onclick = () => this.openFullPlayer();

    document.getElementById('closeFullPlayer').onclick = () => this.closeFullPlayer();

    // Progress bars
    document.getElementById('progressContainer').onclick = e => this.seek(e, 'progressBar');
    document.getElementById('fpProgressContainer').onclick = e => this.seek(e, 'fpProgressBar');

    // Shuffle / Repeat
    document.getElementById('fpShuffle').onclick = () => this.toggleShuffle();
    document.getElementById('fpRepeat').onclick = () => this.toggleRepeat();

    // Like
    document.getElementById('npLike').onclick = () => this.toggleLike();
    document.getElementById('fpLike').onclick = () => this.toggleLike();

    // Add to playlist
    document.getElementById('fpAdd').onclick = () => this.openAddToPlaylist();

    // Library tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => this.switchLibraryTab(btn.dataset.tab);
    });

    // New playlist
    document.getElementById('newPlaylistBtn').onclick = () => this.openNewPlaylistModal();
    document.getElementById('closeNewPlaylistModal').onclick = () => this.closeModal('newPlaylistModal');
    document.getElementById('createPlaylistConfirm').onclick = () => this.createPlaylist();

    // Import Spotify
    document.getElementById('importSpotifyBtn').onclick = () => this.openImportModal();
    document.getElementById('closeImportModal').onclick = () => this.closeModal('importModal');
    document.getElementById('importSpotifyConfirm').onclick = () => this.importSpotifyPlaylist();

    // Add to playlist modal
    document.getElementById('closeAddToPlaylistModal').onclick = () => this.closeModal('addToPlaylistModal');
  },

  setupAudioEvents() {
    const a = this.audio;
    a.addEventListener('timeupdate', () => { this.updateProgress(); this.recordListeningTime(); });
    a.addEventListener('ended', () => this.onTrackEnd());
    a.addEventListener('loadedmetadata', () => this.updateDuration());
    a.addEventListener('error', () => this.showToast('Playback error. Trying next track...') || this.nextTrack());
  },

  // ---- Navigation ----
  navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-page="${pageId}"]`)?.classList.add('active');
    this.currentPage = pageId;
    const titles = { homePage: 'Home', libraryPage: 'Library', playlistDetailPage: 'Playlist', wrappedPage: 'Wrapped' };
    document.getElementById('pageTitle').textContent = titles[pageId] || 'DarkBeat';
    if (pageId === 'wrappedPage') this.renderWrapped();
  },

  // ---- Home ----
  setGreeting() {
    const h = new Date().getHours();
    let g = 'Good evening';
    if (h < 12) g = 'Good morning';
    else if (h < 17) g = 'Good afternoon';
    document.getElementById('greeting').textContent = g;
  },

  async renderHome() {
    // Load some tracks from Jamendo
    const tracks = await this.fetchJamendoTracks('pop', 20);
    this.tracks = tracks;

    // Quick picks
    const qp = document.getElementById('quickPicks');
    qp.innerHTML = tracks.slice(0, 6).map(t => `
      <div class="quick-pick-item" onclick="App.playTrackById('${t.id}')">
        <img src="${t.image}" loading="lazy" alt="">
        <span>${this.escape(t.name)}</span>
      </div>
    `).join('');

    // Render smart recommendations
    this.renderRecommendations();

    // Trending
    const tn = document.getElementById('trendingNow');
    tn.innerHTML = this.generateCards(tracks.slice(12, 18), 'Trending');

    // Recently played
    this.renderRecentlyPlayed();
  },

  renderRecentlyPlayed() {
    const rp = document.getElementById('recentlyPlayed');
    if (this.recentlyPlayed.length === 0) {
      rp.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No recent tracks yet. Start listening!</p>';
      return;
    }
    rp.innerHTML = this.generateCards(this.recentlyPlayed.slice(0, 10), '');
  },

  generateCards(items, subtitlePrefix) {
    return items.map((t, i) => `
      <div class="card" onclick="App.playTrackById('${t.id}')">
        <div class="card-cover">
          <img src="${t.image || 'https://via.placeholder.com/140/1db954/121212?text=' + encodeURIComponent(t.name?.[0] || 'M')}" loading="lazy" alt="">
          <div class="play-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="card-title">${this.escape(t.name)}</div>
        <div class="card-sub">${this.escape(t.artist_name || subtitlePrefix + ' ' + (i+1))}</div>
      </div>
    `).join('');
  },

  // ---- Search ----
  openSearch() {
    document.getElementById('searchOverlay').classList.remove('hidden');
    document.getElementById('searchInput').focus();
  },

  closeSearch() {
    document.getElementById('searchOverlay').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
  },

  async handleSearch(query) {
    if (!query.trim()) { document.getElementById('searchResults').innerHTML = ''; return; }
    const results = await this.fetchJamendoTracks(query, 20);
    this.searchResults = results;
    // Merge into main tracks pool so they are playable
    results.forEach(r => { if (!this.tracks.find(t => t.id === r.id)) this.tracks.push(r); });
    const el = document.getElementById('searchResults');
    if (!results.length) { el.innerHTML = '<p style="color:var(--text-muted);padding:20px;">No results found.</p>'; return; }
    el.innerHTML = results.map(t => `
      <div class="search-result-item" onclick="App.playTrackById('${t.id}')">
        <img src="${t.image}" loading="lazy" alt="">
        <div class="search-result-info">
          <div class="search-result-title">${this.escape(t.name)}</div>
          <div class="search-result-artist">${this.escape(t.artist_name)}</div>
        </div>
      </div>
    `).join('');
  },

  // ---- Jamendo API ----
  async fetchJamendoTracks(query, limit = 20) {
    try {
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=8c2c0947&format=json&limit=${limit}&search=${encodeURIComponent(query)}&audioformat=mp32&include=stats`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.results || []).map(t => ({
        id: 'jam_' + t.id,
        name: t.name,
        artist_name: t.artist_name,
        audio: t.audio,
        image: t.image || `https://via.placeholder.com/300/282828/1db954?text=${encodeURIComponent(t.name[0] || 'M')}`,
        duration: t.duration,
        album_name: t.album_name
      }));
    } catch (e) {
      console.error('Jamendo fetch error:', e);
      return this.getFallbackTracks();
    }
  },

  getFallbackTracks() {
    return [
      { id: 'f1', name: 'Chill Vibes', artist_name: 'Unknown Artist', audio: '', image: 'https://via.placeholder.com/300/282828/1db954?text=C', duration: 180 },
      { id: 'f2', name: 'Night Drive', artist_name: 'Synthwave', audio: '', image: 'https://via.placeholder.com/300/282828/1db954?text=N', duration: 210 },
      { id: 'f3', name: 'Deep Focus', artist_name: 'Ambient', audio: '', image: 'https://via.placeholder.com/300/282828/1db954?text=D', duration: 240 },
      { id: 'f4', name: 'Workout Energy', artist_name: 'Beats', audio: '', image: 'https://via.placeholder.com/300/282828/1db954?text=W', duration: 195 },
      { id: 'f5', name: 'Lo-Fi Study', artist_name: 'Lo-Fi', audio: '', image: 'https://via.placeholder.com/300/282828/1db954?text=L', duration: 220 }
    ];
  },

  // ---- Playback ----
  playTrackById(id) {
    const track = this.tracks.find(t => t.id === id) 
      || this.recentlyPlayed.find(t => t.id === id)
      || this.searchResults.find(t => t.id === id);
    if (!track) return;
    this.playTrack(track);
  },

  playTrack(track) {
    if (!track.audio) { this.showToast('No audio available for this track'); return; }
    this.currentTrack = track;
    this.audio.src = track.audio;
    this.audio.play().catch(() => this.showToast('Playback failed'));
    this.isPlaying = true;
    this.updatePlayerUI();
    this.addToRecentlyPlayed(track);
    this.recordPlay(track);
    this.saveData();
    // Build queue for next/prev
    this.queue = [track, ...this.recentlyPlayed.filter(t => t.id !== track.id)];
    this.queueIndex = 0;
  },

  // ---- Listening Stats ----
  recordPlay(track) {
    const now = Date.now();
    const year = new Date().getFullYear().toString();
    if (!this.stats) this.stats = { trackPlays: {}, artistPlays: {}, totalSeconds: 0, yearData: {}, firstListen: new Date().toISOString() };

    // Track play count
    this.stats.trackPlays[track.id] = (this.stats.trackPlays[track.id] || 0) + 1;

    // Artist play count
    const artist = track.artist_name || 'Unknown';
    this.stats.artistPlays[artist] = (this.stats.artistPlays[artist] || 0) + 1;

    // Yearly data
    if (!this.stats.yearData[year]) {
      this.stats.yearData[year] = { trackPlays: {}, artistPlays: {}, totalSeconds: 0, monthData: {} };
    }
    this.stats.yearData[year].trackPlays[track.id] = (this.stats.yearData[year].trackPlays[track.id] || 0) + 1;
    this.stats.yearData[year].artistPlays[artist] = (this.stats.yearData[year].artistPlays[artist] || 0) + 1;

    this.lastStatsUpdate = now;
  },

  recordListeningTime() {
    if (!this.isPlaying || !this.audio.currentTime) return;
    const now = Date.now();
    const delta = Math.min((now - this.lastStatsUpdate) / 1000, 2); // cap at 2s per update
    this.currentSessionSeconds += delta;
    this.stats.totalSeconds += delta;
    const year = new Date().getFullYear().toString();
    if (this.stats.yearData[year]) {
      this.stats.yearData[year].totalSeconds = (this.stats.yearData[year].totalSeconds || 0) + delta;
    }
    this.lastStatsUpdate = now;
  },

  togglePlay() {
    if (!this.audio.src) return;
    if (this.isPlaying) { this.audio.pause(); this.isPlaying = false; }
    else { this.audio.play().catch(() => {}); this.isPlaying = true; }
    this.updatePlayerUI();
  },

  prevTrack() {
    if (!this.queue.length) return;
    this.queueIndex = Math.max(0, this.queueIndex - 1);
    this.playTrack(this.queue[this.queueIndex]);
  },

  nextTrack() {
    if (!this.queue.length) return;
    if (this.shuffle) {
      this.queueIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    }
    this.playTrack(this.queue[this.queueIndex]);
  },

  onTrackEnd() {
    if (this.repeat) { this.audio.currentTime = 0; this.audio.play(); }
    else { this.nextTrack(); }
  },

  seek(e, barId) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (this.audio.duration) {
      this.audio.currentTime = pct * this.audio.duration;
      document.getElementById(barId).style.width = (pct * 100) + '%';
    }
  },

  updateProgress() {
    const pct = this.audio.duration ? (this.audio.currentTime / this.audio.duration) : 0;
    document.getElementById('progressBar').style.width = (pct * 100) + '%';
    document.getElementById('fpProgressBar').style.width = (pct * 100) + '%';
    document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
    document.getElementById('fpCurrentTime').textContent = this.formatTime(this.audio.currentTime);
  },

  updateDuration() {
    document.getElementById('totalTime').textContent = this.formatTime(this.audio.duration || 0);
    document.getElementById('fpTotalTime').textContent = this.formatTime(this.audio.duration || 0);
  },

  updatePlayerUI() {
    const t = this.currentTrack;
    if (!t) return;

    // Mini bar
    document.getElementById('npTitle').textContent = this.escape(t.name);
    document.getElementById('npArtist').textContent = this.escape(t.artist_name);
    document.getElementById('npCover').style.backgroundImage = `url('${t.image}')`;
    document.getElementById('playIcon').classList.toggle('hidden', this.isPlaying);
    document.getElementById('pauseIcon').classList.toggle('hidden', !this.isPlaying);

    // Full player
    document.getElementById('fpTitle').textContent = this.escape(t.name);
    document.getElementById('fpArtist').textContent = this.escape(t.artist_name);
    document.getElementById('fpCover').style.backgroundImage = `url('${t.image}')`;
    document.getElementById('fpBg').style.backgroundImage = `url('${t.image}')`;
    document.getElementById('fpPlayIcon').classList.toggle('hidden', this.isPlaying);
    document.getElementById('fpPauseIcon').classList.toggle('hidden', !this.isPlaying);

    // Like state
    const isLiked = this.likedTracks.has(t.id);
    document.getElementById('npLike').classList.toggle('liked', isLiked);
    document.getElementById('fpLike').classList.toggle('liked', isLiked);
  },

  openFullPlayer() {
    if (!this.currentTrack) return;
    document.getElementById('fullPlayer').classList.remove('hidden');
  },

  closeFullPlayer() {
    document.getElementById('fullPlayer').classList.add('hidden');
  },

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    document.getElementById('fpShuffle').style.color = this.shuffle ? 'var(--accent)' : '';
    this.showToast(this.shuffle ? 'Shuffle On' : 'Shuffle Off');
  },

  toggleRepeat() {
    this.repeat = !this.repeat;
    document.getElementById('fpRepeat').style.color = this.repeat ? 'var(--accent)' : '';
    this.showToast(this.repeat ? 'Repeat On' : 'Repeat Off');
  },

  toggleLike() {
    if (!this.currentTrack) return;
    const id = this.currentTrack.id;
    if (this.likedTracks.has(id)) {
      this.likedTracks.delete(id);
      this.showToast('Removed from Liked Songs');
    } else {
      this.likedTracks.add(id);
      this.showToast('Added to Liked Songs');
      // Add to liked playlist
      const liked = this.playlists.find(p => p.id === 'liked');
      if (liked && !liked.tracks.find(t => t.id === id)) liked.tracks.push(this.currentTrack);
    }
    this.updatePlayerUI();
    this.saveData();
  },

  addToRecentlyPlayed(track) {
    this.recentlyPlayed = [track, ...this.recentlyPlayed.filter(t => t.id !== track.id)].slice(0, 50);
    this.renderRecentlyPlayed();
  },

  // ---- Library ----
  renderLibrary() {
    this.renderPlaylistList();
  },

  renderPlaylistList() {
    const el = document.getElementById('playlistList');
    el.innerHTML = this.playlists.map(p => `
      <div class="playlist-item" onclick="App.openPlaylist('${p.id}')">
        <img src="${p.cover || p.tracks[0]?.image || 'https://via.placeholder.com/56/282828/1db954?text=' + encodeURIComponent(p.name[0])}" alt="">
        <div class="playlist-info">
          <div class="playlist-info-name">${this.escape(p.name)}</div>
          <div class="playlist-info-count">${p.tracks.length} songs</div>
        </div>
      </div>
    `).join('');
  },

  switchLibraryTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    ['playlistList', 'artistList', 'albumList'].forEach(id => document.getElementById(id).classList.add('hidden'));
    if (tab === 'playlists') document.getElementById('playlistList').classList.remove('hidden');
    if (tab === 'artists') { document.getElementById('artistList').classList.remove('hidden'); this.renderArtists(); }
    if (tab === 'albums') { document.getElementById('albumList').classList.remove('hidden'); this.renderAlbums(); }
  },

  renderArtists() {
    const artists = [...new Set(this.tracks.map(t => t.artist_name).filter(Boolean))];
    document.getElementById('artistList').innerHTML = artists.slice(0, 20).map(a => `
      <div class="playlist-item">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;">${a[0]}</div>
        <div class="playlist-info"><div class="playlist-info-name">${this.escape(a)}</div></div>
      </div>
    `).join('') || '<p style="color:var(--text-muted);padding:20px;">No artists yet.</p>';
  },

  renderAlbums() {
    document.getElementById('albumList').innerHTML = '<p style="color:var(--text-muted);padding:20px;">Albums feature coming soon!</p>';
  },

  // ---- WRAPPED (Yearly Stats) ----
  getWrappedData(year) {
    const y = (year || new Date().getFullYear()).toString();
    const yearStats = this.stats?.yearData?.[y];
    if (!yearStats) return null;

    // Top tracks for year
    const topTracks = Object.entries(yearStats.trackPlays || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const t = this.recentlyPlayed.find(tr => tr.id === id) || this.tracks.find(tr => tr.id === id);
        return { track: t, plays: count };
      }).filter(x => x.track);

    // Top artists for year
    const topArtists = Object.entries(yearStats.artistPlays || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, plays: count }));

    // Total listening time
    const totalHours = Math.round((yearStats.totalSeconds || 0) / 3600 * 10) / 10;
    const totalMinutes = Math.floor((yearStats.totalSeconds || 0) / 60);

    // Total tracks played
    const totalPlays = Object.values(yearStats.trackPlays || {}).reduce((a, b) => a + b, 0);

    // Unique tracks
    const uniqueTracks = Object.keys(yearStats.trackPlays || {}).length;

    // Unique artists
    const uniqueArtists = Object.keys(yearStats.artistPlays || {}).length;

    // Top genre (estimated from top artists)
    const favoriteArtist = topArtists[0]?.name || 'Unknown';

    return { year: y, topTracks, topArtists, totalHours, totalMinutes, totalPlays, uniqueTracks, uniqueArtists, favoriteArtist };
  },

  renderWrapped() {
    const data = this.getWrappedData();
    const container = document.getElementById('wrappedContent');

    if (!data || data.totalPlays === 0) {
      container.innerHTML = `
        <div class="wrapped-empty">
          <div class="wrapped-icon">
            <svg viewBox="0 0 100 100" width="80" height="80"><circle cx="50" cy="50" r="40" fill="#1db954"/><circle cx="50" cy="50" r="25" fill="#121212"/><path d="M50 35a15 15 0 0 1 15 15" stroke="#1db954" stroke-width="4" fill="none" stroke-linecap="round"/></svg>
          </div>
          <h2>Your Year in Music</h2>
          <p>Start listening to tracks and come back here to see your personal Wrapped stats!</p>
        </div>
      `;
      return;
    }

    let topTracksHtml = data.topTracks.map((t, i) => `
      <div class="wrapped-track-item" onclick="App.playTrackById('${t.track.id}')">
        <div class="wrapped-rank">${i + 1}</div>
        <img src="${t.track.image}" alt="" loading="lazy">
        <div class="wrapped-track-info">
          <div class="wrapped-track-name">${this.escape(t.track.name)}</div>
          <div class="wrapped-track-artist">${this.escape(t.track.artist_name)}</div>
        </div>
        <div class="wrapped-plays">${t.plays} plays</div>
      </div>
    `).join('');

    let topArtistsHtml = data.topArtists.map((a, i) => `
      <div class="wrapped-artist-item">
        <div class="wrapped-artist-rank">${i + 1}</div>
        <div class="wrapped-artist-avatar">${a.name[0]}</div>
        <div class="wrapped-artist-info">
          <div class="wrapped-artist-name">${this.escape(a.name)}</div>
          <div class="wrapped-artist-plays">${a.plays} plays</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="wrapped-hero">
        <div class="wrapped-year-badge">${data.year}</div>
        <h1>Your Year<br>in Music</h1>
        <p class="wrapped-subtitle">Personal listening stats</p>
      </div>

      <div class="wrapped-stats-grid">
        <div class="wrapped-stat-card">
          <div class="wrapped-stat-value">${data.totalHours}</div>
          <div class="wrapped-stat-label">Hours listened</div>
        </div>
        <div class="wrapped-stat-card">
          <div class="wrapped-stat-value">${data.totalPlays}</div>
          <div class="wrapped-stat-label">Total plays</div>
        </div>
        <div class="wrapped-stat-card">
          <div class="wrapped-stat-value">${data.uniqueTracks}</div>
          <div class="wrapped-stat-label">Unique tracks</div>
        </div>
        <div class="wrapped-stat-card">
          <div class="wrapped-stat-value">${data.uniqueArtists}</div>
          <div class="wrapped-stat-label">Unique artists</div>
        </div>
      </div>

      <div class="wrapped-section">
        <div class="wrapped-section-header">
          <h2>Top Song${data.topTracks.length > 1 ? 's' : ''}</h2>
        </div>
        <div class="wrapped-tracks">${topTracksHtml}</div>
      </div>

      <div class="wrapped-section">
        <div class="wrapped-section-header">
          <h2>Top Artist${data.topArtists.length > 1 ? 's' : ''}</h2>
        </div>
        <div class="wrapped-artists">${topArtistsHtml}</div>
      </div>

      <div class="wrapped-section">
        <div class="wrapped-section-header">
          <h2>Listening Personality</h2>
        </div>
        <div class="wrapped-personality">
          <div class="personality-card">
            <div class="personality-title">Your #1 Fan</div>
            <div class="personality-value">${this.escape(data.favoriteArtist)}</div>
            <div class="personality-desc">You played them the most this year</div>
          </div>
          <div class="personality-card">
            <div class="personality-title">Explorer Score</div>
            <div class="personality-value">${data.uniqueArtists > 50 ? 'High' : data.uniqueArtists > 20 ? 'Medium' : 'Curious'}</div>
            <div class="personality-desc">You discovered ${data.uniqueArtists} different artists</div>
          </div>
        </div>
      </div>

      <div class="wrapped-share">
        <button class="btn-primary" onclick="App.shareWrapped()">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor"/></svg>
          Share Wrapped
        </button>
      </div>
    `;
  },

  shareWrapped() {
    const data = this.getWrappedData();
    if (!data) return;
    const text = `My ${data.year} DarkBeat Wrapped!\n\n` +
      `Hours listened: ${data.totalHours}\n` +
      `Top song: ${data.topTracks[0]?.track?.name || 'None'}\n` +
      `Top artist: ${data.favoriteArtist}\n` +
      `Unique tracks: ${data.uniqueTracks}\n\n` +
      `#DarkBeatWrapped`;
    if (navigator.share) {
      navigator.share({ title: 'My DarkBeat Wrapped', text });
    } else {
      navigator.clipboard.writeText(text).then(() => this.showToast('Copied to clipboard!'));
    }
  },

  // ---- SMART RECOMMENDATIONS ----
  async getRecommendations() {
    // Get top artists from stats
    const topArtists = Object.entries(this.stats?.artistPlays || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const topGenres = ['pop', 'rock', 'electronic', 'hiphop', 'jazz', 'indie', 'classical', 'reggae'];
    const likedGenres = [];

    // Also use recently played to infer taste
    const recentArtists = [...new Set(this.recentlyPlayed.slice(0, 10).map(t => t.artist_name))].filter(Boolean);

    const searchTerms = [...topArtists, ...recentArtists].slice(0, 3);
    if (searchTerms.length === 0) searchTerms.push('pop', 'trending');

    // Fetch recommendations from multiple queries
    const recs = [];
    for (const term of searchTerms) {
      const tracks = await this.fetchJamendoTracks(term, 10);
      // Filter out already played tracks
      const newTracks = tracks.filter(t => !this.recentlyPlayed.some(r => r.id === t.id));
      recs.push(...newTracks);
    }

    // Deduplicate and shuffle
    const seen = new Set();
    const uniqueRecs = [];
    for (const t of recs) {
      if (!seen.has(t.id)) { seen.add(t.id); uniqueRecs.push(t); }
    }
    // Shuffle
    for (let i = uniqueRecs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueRecs[i], uniqueRecs[j]] = [uniqueRecs[j], uniqueRecs[i]];
    }
    return uniqueRecs.slice(0, 15);
  },

  async renderRecommendations() {
    const el = document.getElementById('recommendations');
    if (!el) return;

    // Show loading state
    el.innerHTML = '<div class="rec-loading">Finding songs for you...</div>';

    const recs = await this.getRecommendations();
    if (!recs.length) {
      el.innerHTML = '<p style="color:var(--text-muted);padding:12px 0;">Play some songs to get recommendations!</p>';
      return;
    }

    // Add to track pool so they're playable
    recs.forEach(r => { if (!this.tracks.find(t => t.id === r.id)) this.tracks.push(r); });

    el.innerHTML = `
      <div class="rec-header">
        <h2>Made For You</h2>
        <span class="rec-sub">Based on your listening</span>
      </div>
      <div class="horizontal-scroll">
        ${recs.map(t => `
          <div class="card" onclick="App.playTrackById('${t.id}')">
            <div class="card-cover">
              <img src="${t.image}" loading="lazy" alt="">
              <div class="play-overlay">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
            <div class="card-title">${this.escape(t.name)}</div>
            <div class="card-sub">${this.escape(t.artist_name)}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  openPlaylist(id) {
    const p = this.playlists.find(pl => pl.id === id);
    if (!p) return;
    this.navigateTo('playlistDetailPage');

    const header = document.getElementById('playlistHeader');
    header.innerHTML = `
      <img src="${p.cover || p.tracks[0]?.image || 'https://via.placeholder.com/180/282828/1db954?text=' + encodeURIComponent(p.name[0])}" alt="">
      <h1>${this.escape(p.name)}</h1>
      <p>${p.tracks.length} songs</p>
    `;

    const trackList = document.getElementById('trackList');
    trackList.innerHTML = p.tracks.map((t, i) => `
      <div class="track-item ${this.currentTrack?.id === t.id ? 'playing' : ''}" onclick="App.playPlaylistTrack('${p.id}', ${i})">
        <div class="track-number">${i + 1}</div>
        <img src="${t.image || 'https://via.placeholder.com/56/282828/1db954?text=' + encodeURIComponent(t.name[0])}" alt="">
        <div class="track-info">
          <div class="track-title">${this.escape(t.name)}</div>
          <div class="track-artist">${this.escape(t.artist_name)}</div>
        </div>
        <div class="track-duration">${this.formatTime(t.duration || 0)}</div>
      </div>
    `).join('');

    document.getElementById('playlistPlayBtn').onclick = () => {
      if (p.tracks.length) {
        this.queue = [...p.tracks];
        this.queueIndex = 0;
        this.playTrack(p.tracks[0]);
      }
    };
    document.getElementById('shufflePlaylistBtn').onclick = () => {
      this.shuffle = true;
      if (p.tracks.length) {
        this.queue = [...p.tracks];
        this.queueIndex = Math.floor(Math.random() * p.tracks.length);
        this.playTrack(p.tracks[this.queueIndex]);
      }
    };
  },

  playPlaylistTrack(playlistId, index) {
    const p = this.playlists.find(pl => pl.id === playlistId);
    if (!p || !p.tracks[index]) return;
    this.queue = [...p.tracks];
    this.queueIndex = index;
    this.playTrack(p.tracks[index]);
  },

  // ---- Playlist CRUD ----
  openNewPlaylistModal() {
    document.getElementById('newPlaylistModal').classList.remove('hidden');
    document.getElementById('newPlaylistName').value = '';
    document.getElementById('newPlaylistName').focus();
  },

  createPlaylist() {
    const name = document.getElementById('newPlaylistName').value.trim();
    if (!name) { this.showToast('Enter a playlist name'); return; }
    const id = 'pl_' + Date.now();
    this.playlists.push({ id, name, tracks: [], cover: '' });
    this.saveData();
    this.renderPlaylistList();
    this.closeModal('newPlaylistModal');
    this.showToast('Playlist created!');
  },

  openAddToPlaylist() {
    if (!this.currentTrack) return;
    const list = document.getElementById('addToPlaylistList');
    list.innerHTML = this.playlists.map(p => `
      <div class="add-to-playlist-item" onclick="App.addToPlaylist('${p.id}')">
        <img src="${p.cover || p.tracks[0]?.image || 'https://via.placeholder.com/40/282828/1db954?text=' + encodeURIComponent(p.name[0])}" alt="">
        <span>${this.escape(p.name)}</span>
      </div>
    `).join('');
    document.getElementById('addToPlaylistModal').classList.remove('hidden');
  },

  addToPlaylist(playlistId) {
    const p = this.playlists.find(pl => pl.id === playlistId);
    if (!p || !this.currentTrack) return;
    if (!p.tracks.find(t => t.id === this.currentTrack.id)) {
      p.tracks.push(this.currentTrack);
      this.saveData();
      this.showToast('Added to ' + p.name);
    } else {
      this.showToast('Already in playlist');
    }
    this.closeModal('addToPlaylistModal');
  },

  // ---- Spotify Import ----
  openImportModal() {
    document.getElementById('importModal').classList.remove('hidden');
    document.getElementById('spotifyPlaylistUrl').value = '';
    document.getElementById('importStatus').innerHTML = '';
  },

  async importSpotifyPlaylist() {
    const url = document.getElementById('spotifyPlaylistUrl').value.trim();
    if (!url) { this.showToast('Enter a Spotify URL'); return; }

    const status = document.getElementById('importStatus');
    status.innerHTML = '<p style="color:var(--text-muted);margin-top:12px;">Importing...</p>';

    // Extract playlist ID
    const match = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
    if (!match) {
      status.innerHTML = '<p style="color:#ff5555;margin-top:12px;">Invalid Spotify URL. Use format: https://open.spotify.com/playlist/...</p>';
      return;
    }
    const playlistId = match[1];

    try {
      // Try to fetch via Spotify's public API (no auth needed for basic metadata)
      const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.items(track(name,artists(name),album(images)))`, {
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        const data = await res.json();
        const tracks = (data.tracks?.items || []).map(item => ({
          id: 'sp_' + (item.track?.id || Math.random()),
          name: item.track?.name || 'Unknown Track',
          artist_name: item.track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
          image: item.track?.album?.images?.[0]?.url || '',
          audio: '',
          duration: 0
        }));

        const newPl = {
          id: 'pl_' + Date.now(),
          name: data.name || 'Imported Playlist',
          tracks,
          cover: tracks[0]?.image || ''
        };
        this.playlists.push(newPl);
        this.saveData();
        this.renderPlaylistList();
        this.closeModal('importModal');
        this.showToast(`Imported "${data.name}" with ${tracks.length} tracks!`);
      } else {
        // Fallback: try to use a simple text-based approach or inform user
        // Spotify API now requires auth for most endpoints. We try to inform user.
        status.innerHTML = `
          <p style="color:#ff5555;margin-top:12px;">
            Spotify API requires authentication. <br>
            However, you can manually add tracks to your playlist here.
          </p>
        `;
        // Create a placeholder playlist with the URL as reference
        setTimeout(() => {
          const newPl = {
            id: 'pl_' + Date.now(),
            name: 'Imported Playlist (' + playlistId.slice(0, 8) + ')',
            tracks: [],
            cover: ''
          };
          this.playlists.push(newPl);
          this.saveData();
          this.renderPlaylistList();
          this.closeModal('importModal');
          this.showToast('Playlist created! Add tracks by searching.');
        }, 2000);
      }
    } catch (e) {
      status.innerHTML = '<p style="color:#ff5555;margin-top:12px;">Error: ' + this.escape(e.message) + '</p>';
    }
  },

  // ---- Service Worker ----
  async registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('sw.js');
      } catch (e) { console.log('SW registration failed:', e); }
    }
  },

  // ---- Utilities ----
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },

  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Prevent accidental reload while playing
window.addEventListener('beforeunload', e => {
  if (App.isPlaying) {
    e.preventDefault();
    e.returnValue = '';
  }
});
