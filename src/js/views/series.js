import { 
  db, 
  auth, 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  deleteDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  writeBatch, 
  getDocs, 
  addDoc, 
  getDoc 
} from '../firebase.js';
import { playEpisode, getPlayerState, togglePlay } from '../player.js';
import { icon } from '../icons.js';
import { cn, calculateSeriesRating, handleShare, formatDuration, getCachedUser } from '../utils.js';

export function renderSeries(container, seriesId) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader2', { size: 48 })}</div>
    </div>
  `;

  let seriesData = null;
  let episodes = [];
  let isSaved = false;
  let isFollowing = false;
  let isFollowLoading = false;
  let showFollowPrompt = false;
  let creatorData = null;
  let listeningHistory = [];

  let unsubSeries = null;
  let unsubEpisodes = null;
  let unsubFollow = null;
  let unsubLib = null;

  async function fetchUserListeningHistory() {
    if (auth.currentUser) {
      try {
        const uSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (uSnap.exists()) {
          listeningHistory = uSnap.data().listeningHistory || [];
        }
      } catch (e) {}
    }
  }

  function setupSubscriptions() {
    // 1. Documento de la serie
    unsubSeries = onSnapshot(doc(db, 'series', seriesId), async (snap) => {
      if (snap.exists()) {
        seriesData = { id: snap.id, ...snap.data() };
        if (seriesData.creatorId) {
          creatorData = await getCachedUser(seriesData.creatorId);
        }
        setupUserTracking();
        render();
      } else {
        container.innerHTML = `
          <div class="min-h-screen flex flex-col items-center justify-center bg-surface-dim px-6 text-center space-y-6">
            <h2 class="text-3xl font-black font-headline text-white uppercase italic">Serie no encontrada</h2>
            <button id="btn-back-home" class="px-8 py-3 bg-primary text-surface-dim font-black rounded-full uppercase tracking-widest">
              Volver al Inicio
            </button>
          </div>
        `;
        document.getElementById('btn-back-home')?.addEventListener('click', () => {
          window.location.hash = '#/';
        });
      }
    });

    // 2. Episodios
    const qEp = query(collection(db, 'episodes'), where('seriesId', '==', seriesId));
    unsubEpisodes = onSnapshot(qEp, (snap) => {
      episodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      episodes.sort((a, b) => String(a.number || '').localeCompare(String(b.number || '')));
      render();
    });
  }

  function setupUserTracking() {
    if (unsubFollow) unsubFollow();
    if (unsubLib) unsubLib();

    const user = auth.currentUser;
    if (!user || !seriesData?.creatorId || !seriesId) return;

    const followId = `${user.uid}_${seriesData.creatorId}`;
    unsubFollow = onSnapshot(doc(db, 'follows', followId), (snap) => {
      isFollowing = snap.exists();
      updateActionButtons();
    });

    const libId = `${user.uid}_${seriesId}`;
    unsubLib = onSnapshot(doc(db, 'library', libId), (snap) => {
      isSaved = snap.exists();
      updateActionButtons();
    });
  }

  async function handleLibraryToggle() {
    const user = auth.currentUser;
    if (!user) {
      window.location.hash = '#/login';
      return;
    }
    if (!seriesData || !seriesId || isFollowLoading) return;

    isFollowLoading = true;
    updateActionButtons();

    const libId = `${user.uid}_${seriesId}`;
    try {
      if (isSaved) {
        await deleteDoc(doc(db, 'library', libId));
      } else {
        await setDoc(doc(db, 'library', libId), {
          userId: user.uid,
          seriesId: seriesId,
          seriesTitle: seriesData.title,
          seriesThumbnail: seriesData.thumbnail,
          creatorId: seriesData.creatorId,
          savedAt: serverTimestamp()
        });

        if (!isFollowing && user.uid !== seriesData.creatorId) {
          showFollowPrompt = true;
          renderModal();
        }
      }
    } catch (err) {
      console.error('Library toggle error:', err);
    } finally {
      isFollowLoading = false;
      updateActionButtons();
    }
  }

  async function handleFollow() {
    const user = auth.currentUser;
    if (!user || !seriesData?.creatorId) return;

    isFollowLoading = true;
    const followId = `${user.uid}_${seriesData.creatorId}`;

    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followId));
        await updateDoc(doc(db, 'users', seriesData.creatorId), {
          followersCount: increment(-1)
        });
      } else {
        await setDoc(doc(db, 'follows', followId), {
          userId: user.uid,
          creatorId: seriesData.creatorId,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'users', seriesData.creatorId), {
          followersCount: increment(1)
        });

        await addDoc(collection(db, 'notifications'), {
          userId: seriesData.creatorId,
          title: '¡Nuevo Seguidor!',
          message: `${user.displayName || 'Un usuario'} ha comenzado a seguirte.`,
          type: 'follower',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      isFollowLoading = false;
      showFollowPrompt = false;
      renderModal();
      updateActionButtons();
    }
  }

  function updateActionButtons() {
    const libBtn = document.getElementById('series-lib-btn');
    if (!libBtn) return;

    libBtn.className = cn(
      "w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-xl border border-white/10 active:scale-95 transition-all cursor-pointer",
      isSaved ? "bg-primary text-surface-dim" : "bg-black/20 text-primary"
    );

    if (isFollowLoading) {
      libBtn.innerHTML = icon('loader2', { size: 24, className: 'animate-spin' });
    } else if (isSaved) {
      libBtn.innerHTML = icon('check', { size: 24, strokeWidth: 3 });
    } else {
      libBtn.innerHTML = icon('plus', { size: 24, strokeWidth: 3 });
    }
  }

  function renderModal() {
    const modalContainer = document.getElementById('series-modal-container');
    if (!modalContainer) return;

    if (!showFollowPrompt) {
      modalContainer.innerHTML = '';
      return;
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="modal-backdrop"></div>
        <div class="relative w-full max-w-sm bg-surface-container-highest rounded-[2.5rem] p-8 border border-white/5 shadow-2xl text-center space-y-6">
          <div class="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto text-primary">
            ${icon('star', { size: 32, fill: 'currentColor' })}
          </div>
          <div class="space-y-3">
            <h3 class="text-xl font-black font-headline text-white uppercase italic">¿Seguir al creador?</h3>
            <p class="text-sm text-on-surface-variant font-medium leading-relaxed">
              Te has suscrito a la serie. ¿Te gustaría seguir a ${creatorData?.displayName || seriesData?.creatorName || 'este creador'} para enterarte de sus novedades?
            </p>
          </div>
          <div class="flex flex-col gap-3 pt-2">
            <button id="btn-confirm-follow" class="w-full h-14 bg-primary text-surface-dim font-black uppercase tracking-widest rounded-full active:scale-[0.98] transition-all text-sm">
              Seguir Creador
            </button>
            <button id="btn-cancel-follow" class="w-full h-14 bg-white/5 text-on-surface-variant font-black uppercase tracking-widest rounded-full text-sm">
              Quizás más tarde
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-backdrop')?.addEventListener('click', () => {
      showFollowPrompt = false;
      renderModal();
    });
    document.getElementById('btn-cancel-follow')?.addEventListener('click', () => {
      showFollowPrompt = false;
      renderModal();
    });
    document.getElementById('btn-confirm-follow')?.addEventListener('click', handleFollow);
  }

  function render() {
    if (!seriesData) return;

    const averageRating = calculateSeriesRating(seriesData);
    const totalReviews = seriesData?.ratingCount || seriesData?.reviews || 0;
    const creatorName = creatorData?.displayName || seriesData.creatorName || 'Creador de Sónica';
    const creatorPhoto = creatorData?.photoURL || '/Avatar/21.png';

    const lastListened = listeningHistory.find(item => item.seriesId === seriesId);
    const playerState = getPlayerState();

    container.innerHTML = `
      <div class="pb-24">
        <!-- Imagen de Cabecera -->
        <div class="relative h-[480px] w-full overflow-hidden">
          <img 
            src="${seriesData.thumbnail || '/Categorias/Ciencia Ficcion.png'}" 
            alt="${seriesData.title}"
            class="w-full h-full object-cover"
            referrerpolicy="no-referrer"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-surface-dim via-surface-dim/20 to-transparent"></div>
          
          <!-- Acciones Superiores -->
          <div class="absolute top-0 left-0 w-full p-8 flex items-center justify-between z-20">
            <button 
              id="series-back-btn"
              class="w-12 h-12 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-xl text-primary border border-white/10 active:scale-95 transition-transform cursor-pointer"
            >
              ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
            </button>
            
            <div class="flex gap-4">
              <button 
                id="series-lib-btn"
                class="${cn(
                  "w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-xl border border-white/10 active:scale-95 transition-all cursor-pointer",
                  isSaved ? "bg-primary text-surface-dim" : "bg-black/20 text-primary"
                )}"
              >
                ${isFollowLoading 
                  ? icon('loader2', { size: 24, className: 'animate-spin' })
                  : (isSaved 
                    ? icon('check', { size: 24, strokeWidth: 3 }) 
                    : icon('plus', { size: 24, strokeWidth: 3 }))}
              </button>
              <button 
                id="series-share-btn"
                class="w-12 h-12 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-xl text-primary border border-white/10 active:scale-95 transition-transform cursor-pointer"
              >
                ${icon('share-2', { size: 24, strokeWidth: 3 })}
              </button>
            </div>
          </div>
        </div>

        <div class="px-6 -mt-32 relative z-10">
          <!-- Tarjeta de Información de la Serie -->
          <div class="bg-surface-container-low/80 backdrop-blur-2xl rounded-[3rem] p-12 border border-outline-variant/10 shadow-2xl">
            <div class="flex flex-col items-center text-center mb-10">
              <div class="flex items-center gap-4 mb-6 flex-wrap justify-center">
                <span class="bg-primary/20 text-primary text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.3em] border border-primary/30">
                  ${seriesData.category || 'PODCAST'}
                </span>
                <div class="flex items-center gap-1.5 text-yellow-400">
                  ${icon('star', { size: 16, fill: 'currentColor' })}
                  <span class="text-sm font-black tracking-widest">${averageRating}</span>
                  <span class="text-[10px] text-on-surface-variant/50 ml-1">(${totalReviews})</span>
                </div>
                <div class="w-1.5 h-1.5 rounded-full bg-white/20 mx-1"></div>
                <div class="flex items-center gap-1.5 text-primary">
                  ${icon('play', { size: 14, fill: 'currentColor' })}
                  <span class="text-sm font-black tracking-widest">${seriesData.views || 0}</span>
                </div>
              </div>

              <h1 class="text-5xl font-black font-headline text-white mb-6 leading-none tracking-tighter uppercase italic">
                ${seriesData.title}
              </h1>

              <div class="flex items-center justify-center gap-6 text-on-surface-variant relative flex-wrap">
                <a 
                  href="#/creator-profile/${seriesData.creatorId || ''}"
                  class="flex items-center gap-3 active:scale-95 transition-transform cursor-pointer group"
                >
                  <div class="w-8 h-8 rounded-full overflow-hidden border border-white/10 group-hover:scale-110 transition-transform">
                    <img src="${creatorPhoto}" alt="${creatorName}" class="w-full h-full object-cover" />
                  </div>
                  <span class="text-[11px] font-black uppercase tracking-[0.3em] opacity-80 decoration-primary/30 underline decoration-2 underline-offset-4 group-hover:text-primary transition-colors">
                    ${creatorName}
                  </span>
                </a>
                
                <div class="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                
                <button class="flex items-center gap-2 px-4 py-2 rounded-full text-cyan-400 hover:bg-cyan-400/10 transition-colors border border-cyan-400/30">
                  ${icon('globe', { size: 14 })}
                  <span class="text-[11px] font-black uppercase tracking-[0.3em]">${seriesData.language || 'Español'}</span>
                </button>
              </div>
            </div>

            <p class="text-on-surface-variant text-sm leading-relaxed mb-8 opacity-70 text-center font-medium italic">
              ${seriesData.description || 'Sin descripción disponible.'}
            </p>

            ${seriesData.tags && seriesData.tags.length > 0 ? `
              <div class="flex flex-wrap justify-center gap-2 mb-8">
                ${seriesData.tags.map(tag => `
                  <span class="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                    ${tag}
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Continuar escuchando esta serie -->
          ${lastListened ? `
            <section class="mt-12">
              <div class="flex items-center gap-3 mb-6 px-2">
                <span class="text-primary">${icon('rotate-ccw', { size: 20 })}</span>
                <h3 class="text-xl font-black font-headline tracking-tighter uppercase italic">Continuar escuchando</h3>
              </div>
              
              <div 
                id="btn-resume-series-ep"
                class="flex items-center gap-4 bg-surface-container-low/40 backdrop-blur-md p-4 pr-5 rounded-3xl border border-white/5 hover:border-primary/20 cursor-pointer group transition-all"
              >
                <div class="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                  <img src="${lastListened.thumbnail}" class="w-full h-full object-cover" alt="" />
                  <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
                    ${(playerState.currentEpisode?.id === lastListened.episodeId && playerState.isPlaying)
                      ? icon('pause', { size: 24, fill: 'white', className: 'text-white' })
                      : icon('play', { size: 24, fill: 'white', className: 'text-white ml-0.5' })}
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div 
                      class="h-full bg-primary shadow-[0_0_6px_rgba(0,229,255,0.5)]"
                      style="width: ${lastListened.progress || 0}%"
                    ></div>
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-white font-black text-base line-clamp-1 uppercase italic tracking-tight leading-tight group-hover:text-primary transition-colors">
                    ${lastListened.episodeTitle}
                  </h4>
                  <p class="text-on-surface-variant text-[11px] font-black uppercase tracking-widest mt-1 opacity-80 line-clamp-1">
                    Cap. ${lastListened.episodeNumber}
                  </p>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-white/30">${icon('clock', { size: 12 })}</span>
                    <span class="text-[10px] font-bold text-white/30 tracking-wider">
                      ${Math.floor(lastListened.currentTime / 60)}:${Math.floor(lastListened.currentTime % 60).toString().padStart(2, '0')} / ${Math.floor(lastListened.duration / 60)}:${Math.floor(lastListened.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
                <div class="text-xs font-black text-primary/60 tracking-wider">
                  ${lastListened.progress || 0}%
                </div>
              </div>
            </section>
          ` : ''}

          <!-- Sección de Lista de Episodios -->
          <section class="mt-16">
            <div class="flex items-center justify-between mb-8 px-2">
              <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Episodios</h3>
              <span class="text-on-surface-variant text-[11px] font-black uppercase tracking-[0.2em] opacity-40">${episodes.length} capítulos</span>
            </div>

            <div class="space-y-6">
              ${episodes.map(ep => `
                <div 
                  data-episode-click="${ep.id}"
                  class="group flex items-center gap-4 p-3 rounded-[2rem] bg-surface-container-high/20 hover:bg-surface-container-high border border-outline-variant/10 hover:border-primary/20 transition-all cursor-pointer"
                >
                  <div class="relative w-20 h-20 rounded-2xl overflow-hidden shadow-xl flex-shrink-0">
                    <img 
                      src="${ep.imageUrl || seriesData.thumbnail}" 
                      alt="${ep.title}" 
                      class="w-full h-full object-cover transition-transform group-hover:scale-110" 
                      referrerpolicy="no-referrer" 
                    />
                    <div class="absolute inset-0 bg-black/30 group-hover:bg-black/0 transition-colors"></div>
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div class="w-8 h-8 bg-primary/20 backdrop-blur-md rounded-full flex items-center justify-center border border-primary/40">
                        ${icon('play', { size: 16, fill: 'currentColor', className: 'text-primary ml-0.5' })}
                      </div>
                    </div>
                  </div>
                  <div class="flex-1 space-y-0.5 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-[9px] font-black text-primary/80 uppercase tracking-[0.2em] italic opacity-60">Cap. ${ep.number}</span>
                    </div>
                    <h4 class="font-black text-[13px] group-hover:text-primary transition-colors line-clamp-1 uppercase italic tracking-tight">${ep.title}</h4>
                    <div class="flex items-center gap-3 text-[9px] text-on-surface-variant/50 font-black uppercase tracking-widest mt-1">
                      <span class="flex items-center gap-1.5">${icon('clock', { size: 12 })} ${formatDuration(ep.actualDuration || ep.duration)}</span>
                    </div>
                  </div>
                  <div class="p-2 mr-1 rounded-full bg-surface-container-highest text-primary opacity-30 group-hover:opacity-100 transition-all active:scale-90 shadow-lg">
                    ${icon('download', { size: 14, strokeWidth: 3 })}
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <div id="series-modal-container"></div>
      </div>
    `;

    // Vinculación de Eventos
    document.getElementById('series-back-btn')?.addEventListener('click', () => {
      window.history.length > 1 ? window.history.back() : (window.location.hash = '#/');
    });

    document.getElementById('series-share-btn')?.addEventListener('click', () => {
      handleShare(seriesData.title, `Escucha ${seriesData.title} en Sónica`);
    });

    document.getElementById('series-lib-btn')?.addEventListener('click', handleLibraryToggle);

    if (lastListened) {
      document.getElementById('btn-resume-series-ep')?.addEventListener('click', () => {
        const ep = {
          id: lastListened.episodeId,
          title: lastListened.episodeTitle,
          number: lastListened.episodeNumber,
          seriesId: lastListened.seriesId,
          imageUrl: lastListened.thumbnail,
          audioUrl: lastListened.audioUrl,
        };
        const sr = {
          id: lastListened.seriesId,
          title: lastListened.seriesTitle,
          thumbnail: lastListened.thumbnail,
        };
        playEpisode(ep, sr);
      });
    }

    container.querySelectorAll('[data-episode-click]').forEach(card => {
      card.addEventListener('click', () => {
        const epId = card.getAttribute('data-episode-click');
        window.location.hash = `#/episode/${epId}`;
      });
    });
  }

  fetchUserListeningHistory().then(setupSubscriptions);

  return () => {
    if (unsubSeries) unsubSeries();
    if (unsubEpisodes) unsubEpisodes();
    if (unsubFollow) unsubFollow();
    if (unsubLib) unsubLib();
  };
}
