import { 
  db, 
  auth, 
  doc, 
  onSnapshot, 
  updateDoc, 
  increment, 
  getDoc, 
  query, 
  collection, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from '../firebase.js';
import { 
  playEpisode, 
  togglePlay, 
  seek, 
  getPlayerState, 
  onPlayerUpdate 
} from '../player.js';
import { icon } from '../icons.js';
import { cn, handleShare } from '../utils.js';

export function renderPlayerView(container, episodeId) {
  let episode = null;
  let series = null;
  let comments = [];
  let isLoading = true;
  let showCommentModal = false;
  let commentRating = 0;
  let commentText = '';
  let isSubmittingReview = false;

  const waveformBars = Array.from({ length: 40 }).map(() => Math.max(20, Math.random() * 100));

  let unsubEpisode = null;
  let unsubComments = null;
  let playerUnsub = null;

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-[#050506]">
      <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
    </div>
  `;

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function setup() {
    // 1. Fetch Comments
    const qComms = query(
      collection(db, 'comments'),
      where('episodeId', '==', episodeId),
      orderBy('createdAt', 'desc')
    );
    unsubComments = onSnapshot(qComms, (snap) => {
      comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    }, (err) => console.error("Comments error:", err));

    // 2. Fetch Episode
    unsubEpisode = onSnapshot(doc(db, 'episodes', episodeId), async (snap) => {
      if (snap.exists()) {
        const epData = { id: snap.id, ...snap.data() };
        episode = epData;

        // Fetch Series
        if (epData.seriesId) {
          try {
            const sSnap = await getDoc(doc(db, 'series', epData.seriesId));
            if (sSnap.exists()) {
              series = { id: sSnap.id, ...sSnap.data() };
              
              // If not playing, start it
              const state = getPlayerState();
              if (state.currentEpisode?.id !== epData.id) {
                playEpisode(epData, series);
              }
            }
          } catch (e) {
            console.error("Series fetch error:", e);
          }
        }
      }
      isLoading = false;
      render();
    }, (err) => {
      console.error("Episode snap error:", err);
      isLoading = false;
      render();
    });

    // 3. Listen to player updates for waveform & times
    playerUnsub = onPlayerUpdate(() => {
      updateWaveformUI();
    });
  }

  function updateWaveformUI() {
    const { currentTime, duration, isPlaying } = getPlayerState();

    const currEl = document.getElementById('player-curr-time');
    const durEl = document.getElementById('player-dur-time');
    if (currEl) currEl.textContent = formatTime(currentTime);
    if (durEl) durEl.textContent = formatTime(duration);

    const playBtn = document.getElementById('player-main-play-btn');
    if (playBtn) {
      playBtn.innerHTML = isPlaying 
        ? icon('pause', { size: 32, fill: 'currentColor' })
        : icon('play', { size: 32, fill: 'currentColor', className: 'ml-1.5' });
    }

    const prog = duration > 0 ? (currentTime / duration) * 40 : 0;
    const bars = document.querySelectorAll('.waveform-bar');
    bars.forEach((bar, i) => {
      const height = waveformBars[i] || 30;
      bar.style.height = isPlaying ? `${height}%` : `${Math.max(15, height / 2.5)}%`;
      if (i < prog) {
        bar.className = 'waveform-bar w-[4.5px] rounded-full transition-all duration-300 bg-primary shadow-[0_0_15px_rgba(0,229,255,0.8)]';
      } else {
        bar.className = 'waveform-bar w-[4.5px] rounded-full transition-all duration-300 bg-white/10';
      }
    });
  }

  async function handleSubmitReview() {
    const user = auth.currentUser;
    if (!user) {
      window.location.hash = '#/login';
      return;
    }
    if (!commentText.trim() || !commentRating || isSubmittingReview) return;

    isSubmittingReview = true;
    renderModal();

    try {
      let displayName = user.displayName || 'Usuario';
      let photoURL = user.photoURL || '';

      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        displayName = uData.displayName || displayName;
        photoURL = uData.photoURL || photoURL;
      }

      await addDoc(collection(db, 'comments'), {
        episodeId,
        seriesId: episode?.seriesId || '',
        userId: user.uid,
        userName: displayName,
        userPhoto: photoURL,
        content: commentText.trim(),
        rating: commentRating,
        createdAt: serverTimestamp()
      });

      if (episode?.seriesId) {
        await updateDoc(doc(db, 'series', episode.seriesId), {
          ratingSum: increment(commentRating),
          ratingCount: increment(1)
        });
      }

      commentText = '';
      commentRating = 0;
      showCommentModal = false;
    } catch (err) {
      console.error("Submit review error:", err);
      alert('Error al publicar comentario');
    } finally {
      isSubmittingReview = false;
      render();
    }
  }

  function renderModal() {
    const modalRoot = document.getElementById('player-modal-root');
    if (!modalRoot) return;

    if (!showCommentModal) {
      modalRoot.innerHTML = '';
      return;
    }

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-black/90 backdrop-blur-md z-[100]" id="player-modal-backdrop"></div>
      <div class="fixed inset-x-6 top-[15%] z-[101] bg-[#14161d] rounded-[3rem] p-10 border border-white/10 shadow-huge space-y-8 max-w-lg mx-auto">
        <div class="text-center">
          <h3 class="text-3xl font-black italic uppercase tracking-tighter text-white mb-2">Tu Opinión</h3>
          <p class="text-primary text-[10px] font-black uppercase tracking-widest opacity-60">Califica este episodio</p>
        </div>

        <div class="flex flex-col items-center space-y-6">
          <div class="flex gap-3">
            ${[1, 2, 3, 4, 5].map(star => `
              <button 
                data-star-pick="${star}"
                class="active:scale-90 transition-transform cursor-pointer"
              >
                ${icon('star', { 
                  size: 44, 
                  fill: star <= commentRating ? 'currentColor' : 'none',
                  className: star <= commentRating ? 'text-primary' : 'text-white/5'
                })}
              </button>
            `).join('')}
          </div>
        </div>

        <textarea
          id="player-comment-textarea"
          placeholder="Escribe algo increíble..."
          class="w-full h-40 bg-black/40 border border-white/5 rounded-[2rem] p-6 text-sm font-medium focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/10 resize-none text-white"
        >${commentText}</textarea>

        <div class="flex gap-4">
          <button 
            id="btn-cancel-comment"
            class="flex-1 py-5 rounded-full bg-white/5 text-white/40 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            id="btn-submit-comment"
            ${(!commentText.trim() || !commentRating || isSubmittingReview) ? 'disabled' : ''}
            class="flex-[2] primary-gradient text-surface-dim py-5 rounded-full font-black text-xs uppercase tracking-widest shadow-huge active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
          >
            ${isSubmittingReview ? icon('loader2', { size: 18, className: 'animate-spin' }) : 'Publicar'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('player-modal-backdrop')?.addEventListener('click', () => {
      showCommentModal = false;
      renderModal();
    });
    document.getElementById('btn-cancel-comment')?.addEventListener('click', () => {
      showCommentModal = false;
      renderModal();
    });
    document.getElementById('btn-submit-comment')?.addEventListener('click', handleSubmitReview);

    document.getElementById('player-comment-textarea')?.addEventListener('input', (e) => {
      commentText = e.target.value;
      const subBtn = document.getElementById('btn-submit-comment');
      if (subBtn) {
        subBtn.disabled = !commentText.trim() || !commentRating || isSubmittingReview;
      }
    });

    modalRoot.querySelectorAll('[data-star-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        commentRating = parseInt(btn.getAttribute('data-star-pick'), 10);
        renderModal();
      });
    });
  }

  function render() {
    if (isLoading) {
      container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-[#050506]">
          <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
        </div>
      `;
      return;
    }

    if (!episode) {
      container.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center bg-[#050506] text-white p-6 text-center">
          <h2 class="text-2xl font-black mb-4 uppercase italic text-primary">Episodio no encontrado</h2>
          <button id="player-back-empty" class="text-white/40 font-black uppercase tracking-widest text-[10px] cursor-pointer">Volver atrás</button>
        </div>
      `;
      document.getElementById('player-back-empty')?.addEventListener('click', () => {
        window.history.length > 1 ? window.history.back() : (window.location.hash = '#/');
      });
      return;
    }

    const { currentTime, duration, isPlaying } = getPlayerState();
    const artworkSrc = episode.imageUrl || episode.thumbnail || series?.thumbnail || '/logo.png';

    container.innerHTML = `
      <div class="bg-[#050506] min-h-screen pb-safe relative">
        <div class="atmosphere-bg opacity-40"></div>
        
        <!-- Header -->
        <header class="fixed top-0 w-full flex items-center justify-between px-6 h-20 z-50">
          <button 
            id="player-header-back"
            class="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-primary active:scale-95 transition-all backdrop-blur-xl cursor-pointer"
          >
            ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
          </button>
          <div class="flex-1 text-center">
            <p class="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">Reproduciendo</p>
          </div>
          <div class="w-12"></div>
        </header>

        <main class="pt-24 px-6 max-w-lg mx-auto flex flex-col items-center">
          <!-- Artwork -->
          <div class="w-64 h-64 sm:w-72 sm:h-72 max-w-[80vw] max-h-[80vw] aspect-square rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] border border-white/5 mb-6 relative group">
            <img 
              src="${artworkSrc}" 
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              alt="${episode.title}"
              referrerpolicy="no-referrer"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <!-- Title & Info -->
          <div class="text-center w-full mb-6">
            <h1 class="text-3xl font-black text-white font-headline tracking-tighter mb-1 uppercase italic leading-none">
              ${series?.title || 'Sónica Podcast'}
            </h1>
            <h2 class="text-primary text-xs font-black uppercase tracking-[0.2em] mb-3 opacity-80 line-clamp-1">
              ${episode.number ? `Cap. ${episode.number}: ` : ''}${episode.title}
            </h2>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
              <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              <p class="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">
                ${series?.category || 'AUDIO DRAMA'}
              </p>
            </div>
          </div>

          <!-- Waveform Visualizer -->
          <div class="w-full mb-6">
            <div 
              id="player-waveform-track"
              class="flex items-center justify-center gap-[3.5px] h-16 w-full px-4 overflow-hidden cursor-pointer group/waveform transition-all duration-500 hover:bg-white/[0.03] rounded-[1.5rem] touch-none select-none"
            >
              ${waveformBars.map((height, i) => {
                const prog = duration > 0 ? (currentTime / duration) * 40 : 0;
                return `
                  <div
                    class="waveform-bar w-[4.5px] rounded-full transition-all duration-300 ${i < prog ? 'bg-primary shadow-[0_0_15px_rgba(0,229,255,0.8)]' : 'bg-white/10'}"
                    style="height: ${isPlaying ? `${height}%` : `${Math.max(15, height / 2.5)}%`}; transition-delay: ${i * 5}ms;"
                  ></div>
                `;
              }).join('')}
            </div>

            <div class="flex justify-between items-center px-2 mt-2">
              <span id="player-curr-time" class="text-[10px] font-black text-primary tracking-widest">${formatTime(currentTime)}</span>
              <span id="player-dur-time" class="text-[10px] font-black text-white/20 tracking-widest">${formatTime(duration)}</span>
            </div>
          </div>

          <!-- Playback Controls -->
          <div class="flex items-center justify-between w-full px-4 mb-8">
            <button 
              id="btn-skip-backward"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-primary transition-colors relative cursor-pointer"
            >
              ${icon('rotate-ccw', { size: 18 })}
              <span class="absolute -bottom-1 -right-1 text-[7px] font-black text-primary">15</span>
            </button>
            
            <button class="text-white/40 hover:text-white transition-colors cursor-pointer" id="btn-prev-ep">
              ${icon('skip-back', { size: 24, fill: 'currentColor' })}
            </button>

            <button 
              id="player-main-play-btn"
              class="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.4)] active:scale-95 transition-all text-surface-dim cursor-pointer"
            >
              ${isPlaying 
                ? icon('pause', { size: 32, fill: 'currentColor' })
                : icon('play', { size: 32, fill: 'currentColor', className: 'ml-1.5' })}
            </button>

            <button class="text-white/40 hover:text-white transition-colors cursor-pointer" id="btn-next-ep">
              ${icon('skip-forward', { size: 24, fill: 'currentColor' })}
            </button>

            <button 
              id="btn-skip-forward"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-primary transition-colors relative cursor-pointer"
            >
              ${icon('rotate-cw', { size: 18 })}
              <span class="absolute -bottom-1 -right-1 text-[7px] font-black text-primary">15</span>
            </button>
          </div>

          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-4 w-full mb-8">
            <button 
              id="btn-open-comment"
              class="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            >
              ${icon('message-square', { size: 20 })}
              <span>COMENTAR</span>
            </button>
            <button 
              id="btn-share-player"
              class="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            >
              ${icon('share-2', { size: 20 })}
              <span>COMPARTIR</span>
            </button>
          </div>

          <!-- Community Reviews Mini Preview -->
          <div class="w-full space-y-6 mb-12">
            <div class="flex items-center justify-between px-2">
              <h3 class="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Reseñas (${comments.length})</h3>
            </div>
             
            <div class="space-y-4">
              ${comments.length > 0 ? `
                <div class="bg-white/[0.03] border border-white/5 rounded-3xl p-6">
                  <div class="flex items-center gap-3 mb-4">
                    <img src="${comments[0].userPhoto || '/Avatar/21.png'}" class="w-8 h-8 rounded-full object-cover" />
                    <div class="flex-1">
                      <p class="text-xs font-bold text-white">${comments[0].userName || 'Usuario'}</p>
                      <div class="flex gap-0.5 mt-0.5">
                        ${[1, 2, 3, 4, 5].map(st => `
                          <span class="${st <= (comments[0].rating || 5) ? 'text-primary' : 'text-white/10'}">
                            ${icon('star', { size: 8, fill: st <= (comments[0].rating || 5) ? 'currentColor' : 'none' })}
                          </span>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                  <p class="text-sm text-on-surface-variant/80 italic leading-relaxed">"${comments[0].content}"</p>
                </div>
              ` : `
                <p class="text-center text-[10px] font-bold text-white/20 uppercase tracking-widest py-8 border-2 border-dashed border-white/5 rounded-3xl">
                  Sin reseñas aún
                </p>
              `}
            </div>
          </div>
        </main>

        <div id="player-modal-root"></div>
      </div>
    `;

    // Event listeners
    document.getElementById('player-header-back')?.addEventListener('click', () => {
      window.history.length > 1 ? window.history.back() : (window.location.hash = `#/series/${episode.seriesId}`);
    });

    document.getElementById('player-main-play-btn')?.addEventListener('click', togglePlay);

    document.getElementById('btn-skip-backward')?.addEventListener('click', () => {
      const state = getPlayerState();
      seek(Math.max(0, state.currentTime - 15));
    });

    document.getElementById('btn-skip-forward')?.addEventListener('click', () => {
      const state = getPlayerState();
      seek(Math.min(state.duration, state.currentTime + 15));
    });

    document.getElementById('btn-share-player')?.addEventListener('click', () => {
      handleShare(episode.title, `Escucha "${episode.title}" de ${series?.title} en Sónica`);
    });

    document.getElementById('btn-open-comment')?.addEventListener('click', () => {
      showCommentModal = true;
      renderModal();
    });

    // Waveform scrubbing
    const track = document.getElementById('player-waveform-track');
    if (track) {
      const handleScrub = (clientX) => {
        const state = getPlayerState();
        if (state.duration <= 0) return;
        const rect = track.getBoundingClientRect();
        const x = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        seek(pct * state.duration);
      };

      track.addEventListener('click', (e) => handleScrub(e.clientX));

      let isDragging = false;
      track.addEventListener('touchstart', (e) => {
        isDragging = true;
        handleScrub(e.touches[0].clientX);
      }, { passive: true });
      track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        handleScrub(e.touches[0].clientX);
      }, { passive: true });
      track.addEventListener('touchend', () => { isDragging = false; });
    }
  }

  setup();

  return () => {
    if (unsubEpisode) unsubEpisode();
    if (unsubComments) unsubComments();
  };
}
