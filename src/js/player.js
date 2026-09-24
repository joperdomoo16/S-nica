import { icon } from './icons.js';
import { db, auth, doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from './firebase.js';

let audio = null;
let currentEpisode = null;
let currentSeries = null;
let isPlaying = false;
let duration = 0;
let currentTime = 0;
let showMiniPlayer = false;
let progressSyncTimer = null;
let viewLoggedFor = null;

const listeners = [];

export function onPlayerUpdate(cb) {
  listeners.push(cb);
  cb({ currentEpisode, currentSeries, isPlaying, currentTime, duration });
}

function notify() {
  listeners.forEach(cb => {
    try {
      cb({ currentEpisode, currentSeries, isPlaying, currentTime, duration });
    } catch (e) {}
  });
}

export function initPlayer() {
  audio = new Audio();

  audio.addEventListener('timeupdate', () => {
    currentTime = audio.currentTime;
    updateMiniProgress();
    notify();
  });

  audio.addEventListener('loadedmetadata', () => {
    duration = audio.duration;
    notify();
  });

  audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayIcons();
    notify();

    if (!progressSyncTimer) {
      progressSyncTimer = setInterval(syncHistory, 5000);
    }
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayIcons();
    notify();

    if (progressSyncTimer) {
      clearInterval(progressSyncTimer);
      progressSyncTimer = null;
    }
    syncHistory();
  });

  audio.addEventListener('ended', () => {
    isPlaying = false;
    updatePlayIcons();
    notify();
  });

  bindMiniPlayer();
}

function bindMiniPlayer() {
  const toggleBtn = document.getElementById('mini-toggle-play');
  const closeBtn = document.getElementById('mini-close');
  const trackClick = document.getElementById('mini-track-click');

  if (toggleBtn) {
    toggleBtn.innerHTML = icon('play', { size: 20, fill: 'currentColor' });
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });
  }

  if (closeBtn) {
    closeBtn.innerHTML = icon('x', { size: 16, strokeWidth: 3 });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMiniPlayer();
    });
  }

  if (trackClick) {
    trackClick.addEventListener('click', () => {
      if (currentEpisode) {
        window.location.hash = `#/player/${currentEpisode.id}`;
      }
    });
  }
}

export function playEpisode(episode, series = null) {
  if (!audio) initPlayer();
  if (!episode || !episode.audioUrl) return;

  const isSame = currentEpisode?.id === episode.id;
  if (isSame) {
    togglePlay();
    return;
  }

  currentEpisode = episode;
  currentSeries = series || currentSeries;
  viewLoggedFor = null;

  audio.src = episode.audioUrl;
  audio.load();

  audio.play().then(() => {
    logView(currentEpisode, currentSeries);
  }).catch(console.warn);

  showMiniPlayer = true;
  updateMiniPlayerUI();
}

export function togglePlay() {
  if (!audio || !audio.src) return;
  if (audio.paused) {
    audio.play().catch(console.warn);
  } else {
    audio.pause();
  }
}

export function seek(seconds) {
  if (!audio) return;
  audio.currentTime = Math.max(0, Math.min(seconds, duration || 0));
}

export function closeMiniPlayer() {
  showMiniPlayer = false;
  if (audio) audio.pause();
  const mini = document.getElementById('mini-player');
  if (mini) mini.classList.add('hidden');
}

function updateMiniPlayerUI() {
  const mini = document.getElementById('mini-player');
  const rawHash = window.location.hash.slice(1) || '/';
  const isPlayerPage = rawHash.startsWith('/player/');

  if (!mini) return;

  if (showMiniPlayer && currentEpisode && !isPlayerPage) {
    mini.classList.remove('hidden');

    const artwork = document.getElementById('mini-artwork');
    const title = document.getElementById('mini-title');
    const seriesEl = document.getElementById('mini-series');

    if (artwork) artwork.src = currentEpisode.imageUrl || currentEpisode.thumbnail || currentSeries?.thumbnail || '/logo.png';
    if (title) title.textContent = currentEpisode.title;
    if (seriesEl) seriesEl.textContent = currentSeries?.title || 'Sónica Podcast';
    updatePlayIcons();
  } else {
    mini.classList.add('hidden');
  }
}

function updateMiniProgress() {
  const bar = document.getElementById('mini-progress-fill');
  if (bar && duration > 0) {
    bar.style.width = `${(currentTime / duration) * 100}%`;
  }
}

function updatePlayIcons() {
  const toggleBtn = document.getElementById('mini-toggle-play');
  if (toggleBtn) {
    toggleBtn.innerHTML = isPlaying 
      ? icon('pause', { size: 20, fill: 'currentColor' })
      : icon('play', { size: 20, fill: 'currentColor', className: 'ml-0.5' });
  }
}

async function logView(episode, series) {
  if (!episode || viewLoggedFor === episode.id) return;
  viewLoggedFor = episode.id;

  const creatorId = episode.creatorId || series?.creatorId;
  if (!creatorId) return;

  try {
    await addDoc(collection(db, 'view_logs'), {
      episodeId: episode.id,
      seriesId: series?.id || episode.seriesId || '',
      creatorId,
      userId: auth.currentUser?.uid || '',
      category: series?.category || null,
      timestamp: serverTimestamp()
    });
  } catch (e) {}
}

async function syncHistory() {
  if (!auth.currentUser || !currentEpisode || !duration || duration <= 0) return;
  const progress = Math.round((currentTime / duration) * 100);
  if (progress >= 95) return;

  const item = {
    episodeId: currentEpisode.id,
    seriesId: currentEpisode.seriesId || currentSeries?.id || '',
    episodeTitle: currentEpisode.title || '',
    seriesTitle: currentSeries?.title || '',
    episodeNumber: currentEpisode.number || 1,
    thumbnail: currentEpisode.imageUrl || currentEpisode.thumbnail || currentSeries?.thumbnail || '/logo.png',
    audioUrl: currentEpisode.audioUrl || '',
    currentTime,
    duration,
    progress,
    lastPlayedAt: Date.now()
  };

  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      let hist = snap.data().listeningHistory || [];
      hist = hist.filter(h => h.episodeId !== item.episodeId);
      hist.unshift(item);
      hist = hist.slice(0, 10);
      await updateDoc(userRef, { listeningHistory: hist });
    }
  } catch (e) {}
}

// React to route changes to show/hide mini player on /player/
window.addEventListener('hashchange', () => {
  updateMiniPlayerUI();
});

export function getPlayerState() {
  return { currentEpisode, currentSeries, isPlaying, currentTime, duration, showMiniPlayer };
}
