import { 
  db, 
  auth, 
  doc, 
  onSnapshot, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  increment, 
  serverTimestamp 
} from '../firebase.js';
import { playEpisode } from '../player.js';
import { icon } from '../icons.js';
import { formatRelativeTime, getColombiaHoursElapsed } from '../utils.js';

export function renderEpisode(container, episodeId) {
  let episode = null;
  let series = null;
  let comments = [];
  let isLoading = true;
  let commentsLoading = true;

  let unsubEpisode = null;
  let unsubComments = null;

  container.innerHTML = `
    <div class="min-h-[60vh] flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
    </div>
  `;

  function isRecentEpisode() {
    if (!episode?.publishedAt) return false;
    try {
      const diffHours = getColombiaHoursElapsed(episode.publishedAt);
      return diffHours <= 72 && diffHours >= 0;
    } catch {
      return false;
    }
  }

  function setup() {
    unsubEpisode = onSnapshot(doc(db, 'episodes', episodeId), async (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        episode = data;

        if (data.seriesId) {
          try {
            const sSnap = await getDoc(doc(db, 'series', data.seriesId));
            if (sSnap.exists()) {
              series = { id: sSnap.id, ...sSnap.data() };
            }
          } catch (e) {
            console.error('Error fetching series for episode:', e);
          }
        }
      }
      isLoading = false;
      render();
    });

    const q = query(
      collection(db, 'comments'),
      where('episodeId', '==', episodeId),
      orderBy('createdAt', 'desc')
    );

    unsubComments = onSnapshot(q, (snapshot) => {
      comments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      commentsLoading = false;
      render();
    }, (err) => {
      console.error('Comments error:', err);
      commentsLoading = false;
      render();
    });
  }

  function render() {
    if (isLoading) {
      container.innerHTML = `
        <div class="min-h-[60vh] flex items-center justify-center bg-surface-dim">
          <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
        </div>
      `;
      return;
    }

    if (!episode) {
      container.innerHTML = `
        <div class="p-10 text-center bg-surface-dim min-h-screen">
          <h2 class="text-2xl font-black uppercase italic text-primary">Episodio no encontrado</h2>
          <button id="btn-ep-back-empty" class="mt-4 text-xs font-black uppercase tracking-widest opacity-40 cursor-pointer">Volver</button>
        </div>
      `;
      document.getElementById('btn-ep-back-empty')?.addEventListener('click', () => {
        window.history.length > 1 ? window.history.back() : (window.location.hash = '#/');
      });
      return;
    }

    const durationStr = episode.duration?.toString().toLowerCase().includes('min') || episode.duration?.toString().toLowerCase().endsWith('m')
      ? episode.duration
      : `${episode.duration || '0'} min`;

    container.innerHTML = `
      <div class="min-h-screen bg-surface-dim text-white pb-32">
        <!-- Episode Header Poster Section -->
        <div class="relative w-full aspect-[9/10] sm:aspect-video flex flex-col justify-end px-6 pb-8 overflow-hidden">
          <div class="absolute inset-0 z-0">
            <img 
              src="${episode.imageUrl || series?.thumbnail || '/logo.png'}" 
              alt="${episode.title}"
              class="w-full h-full object-cover scale-105"
              referrerpolicy="no-referrer"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-surface-dim via-surface-dim/50 to-transparent"></div>
            <div class="absolute inset-0" style="background: radial-gradient(circle at center, transparent 30%, rgba(18, 18, 18, 0.95) 90%);"></div>
          </div>

          <!-- Top Back Button -->
          <div class="absolute top-6 left-6 z-20">
            <button 
              id="btn-ep-back"
              class="w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl text-primary border border-white/10 active:scale-95 transition-transform cursor-pointer"
            >
              ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
            </button>
          </div>

          <!-- Floating Text Info -->
          <div class="relative z-10 space-y-4 max-w-xl mx-auto w-full text-center">
            ${isRecentEpisode() ? `
              <div class="inline-block mx-auto animate-pulse">
                <span class="px-4 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em]">
                  EPISODIO ESTRENO
                </span>
              </div>
            ` : ''}

            <h2 class="text-3xl sm:text-4xl font-headline font-black leading-tight uppercase italic tracking-tight drop-shadow-lg text-white">
              Capítulo ${episode.number}: ${episode.title}
            </h2>

            <div class="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant font-black tracking-widest opacity-80">
              <span class="text-cyan-400">${icon('clock', { size: 14 })}</span>
              <span>${durationStr}</span>
            </div>
          </div>
        </div>

        <!-- Floating Glass Series Card -->
        <div class="px-6 max-w-sm mx-auto -mt-4 relative z-20">
          <div class="bg-surface-container-high/40 backdrop-blur-2xl border border-white/5 p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-4">
            <div class="flex items-center gap-3">
              <img 
                src="${series?.thumbnail || '/logo.png'}" 
                alt="${series?.title || 'Serie'}"
                class="w-12 h-12 rounded-xl object-cover border border-white/5 flex-shrink-0"
                referrerpolicy="no-referrer"
              />
              <div class="space-y-0.5 min-w-0 flex-1">
                <span class="text-[9px] font-black text-cyan-400 tracking-[0.2em] uppercase">SERIE</span>
                <h3 class="text-sm font-black text-white leading-tight uppercase tracking-tight line-clamp-1">
                  <a href="#/series/${series?.id || ''}" class="hover:text-primary transition-colors">
                    ${series?.title || 'Sónica Original'}
                  </a>
                </h3>
              </div>
            </div>

            <button 
              id="btn-ep-listen-now"
              class="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-surface-dim font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              ${icon('play', { size: 14, fill: 'currentColor', className: 'ml-0.5' })}
              Escuchar ahora
            </button>
          </div>
        </div>

        <div class="max-w-md mx-auto px-6 mt-12 space-y-12">
          <!-- Introduction Section -->
          <section class="space-y-3">
            <h3 class="text-lg font-black font-headline uppercase tracking-wider italic text-white">
              Introducción
            </h3>
            <p class="text-sm font-medium text-on-surface-variant/70 leading-relaxed">
              ${episode.description || 'Sin descripción disponible.'}
            </p>
          </section>

          <!-- Community Reviews Section -->
          <section class="space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black font-headline uppercase tracking-wider italic text-white">
                Reseñas de la comunidad
              </h3>
              <span class="text-[10px] font-black text-cyan-400 uppercase tracking-widest cursor-pointer">
                Ver todas (${comments.length})
              </span>
            </div>

            <div class="space-y-4">
              ${commentsLoading ? `
                <div class="flex justify-center py-6">
                  <div class="text-cyan-400 animate-spin">${icon('loader2', { size: 24 })}</div>
                </div>
              ` : comments.length === 0 ? `
                <div class="text-center py-8 rounded-[2rem] bg-white/[0.01] border border-white/5">
                  <p class="text-xs text-on-surface-variant/40 font-black uppercase tracking-wider">
                    Aún no hay reseñas. ¡Sé el primero!
                  </p>
                </div>
              ` : comments.map(c => `
                <div class="bg-surface-container-high/30 backdrop-blur-xl border border-white/5 p-5 rounded-[2.5rem] space-y-3 shadow-lg">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <img 
                        src="${c.userPhoto || '/Avatar/21.png'}" 
                        alt="${c.userName || 'Usuario'}" 
                        class="w-8 h-8 rounded-full border border-white/5 object-cover flex-shrink-0"
                      />
                      <div class="space-y-0.5">
                        <h4 class="text-xs font-black text-white">${c.userName || 'Usuario'}</h4>
                        <span class="text-[9px] font-bold text-on-surface-variant/40 tracking-wider">
                          ${formatRelativeTime(c.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center gap-0.5">
                      ${[1, 2, 3, 4, 5].map(st => `
                        <span class="${c.rating >= st ? 'text-cyan-400' : 'text-white/10'}">
                          ${icon('star', { size: 11, fill: c.rating >= st ? '#00E5FF' : 'none' })}
                        </span>
                      `).join('')}
                    </div>
                  </div>

                  <p class="text-xs font-bold leading-relaxed text-on-surface-variant/80 italic">
                    "${c.content}"
                  </p>
                </div>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    `;

    document.getElementById('btn-ep-back')?.addEventListener('click', () => {
      window.history.length > 1 ? window.history.back() : (window.location.hash = `#/series/${episode.seriesId}`);
    });

    document.getElementById('btn-ep-listen-now')?.addEventListener('click', () => {
      playEpisode(episode, series);
      window.location.hash = `#/player/${episode.id}`;
    });
  }

  setup();

  return () => {
    if (unsubEpisode) unsubEpisode();
    if (unsubComments) unsubComments();
  };
}
