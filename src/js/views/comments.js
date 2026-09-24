import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc 
} from '../firebase.js';
import { icon } from '../icons.js';
import { formatRelativeTime } from '../utils.js';

export function renderComments(container) {
  const user = auth.currentUser;

  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  let series = [];
  let selectedId = null;
  let followersCount = 0;
  let episodes = {};
  let comments = [];
  let isLoading = true;

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
    </div>
  `;

  // 1. User doc for followers count
  const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
    if (snap.exists()) {
      followersCount = snap.data().followersCount || 0;
      render();
    }
  });

  // 2. Series query
  const qSeries = query(collection(db, 'series'), where('creatorId', '==', user.uid));
  const unsubSeries = onSnapshot(qSeries, (snap) => {
    series = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (series.length > 0 && !selectedId) {
      selectedId = series[0].id;
      fetchSelectedSeriesData();
    }
    isLoading = false;
    render();
  }, (err) => {
    console.error("Comments series error:", err);
    isLoading = false;
    render();
  });

  let unsubEpisodes = null;
  let unsubComments = null;

  function fetchSelectedSeriesData() {
    if (unsubEpisodes) unsubEpisodes();
    if (unsubComments) unsubComments();

    if (!selectedId) {
      episodes = {};
      comments = [];
      render();
      return;
    }

    const qEp = query(collection(db, 'episodes'), where('seriesId', '==', selectedId));
    unsubEpisodes = onSnapshot(qEp, (snap) => {
      const epMap = {};
      snap.docs.forEach(d => { epMap[d.id] = { id: d.id, ...d.data() }; });
      episodes = epMap;
      render();
    });

    const qComm = query(
      collection(db, 'comments'), 
      where('seriesId', '==', selectedId), 
      orderBy('createdAt', 'desc')
    );
    unsubComments = onSnapshot(qComm, (snap) => {
      comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });
  }

  function render() {
    if (isLoading) {
      container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-surface-dim">
          <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
        </div>
      `;
      return;
    }

    let totalReviews = 0;
    let totalRatingSum = 0;
    series.forEach(s => {
      totalReviews += (s.ratingCount || 0);
      totalRatingSum += (s.ratingSum || 0);
    });
    const avgRating = totalReviews > 0 ? (totalRatingSum / totalReviews).toFixed(1) : '0.0';

    const selectedSerie = series.find(s => s.id === selectedId);

    // Group comments by episode
    const groups = {};
    comments.forEach(c => {
      const epId = c.episodeId || 'general';
      if (!groups[epId]) groups[epId] = [];
      groups[epId].push(c);
    });

    container.innerHTML = `
      <div class="pb-24 pt-8 px-6 space-y-16">
        <!-- RENDIMIENTO GLOBAL Card -->
        <div>
          <div class="bg-surface-container-high/20 backdrop-blur-2xl rounded-[3rem] p-10 border border-white/5 text-center relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent"></div>
            
            <h2 class="text-[38px] leading-tight font-black font-headline text-cyan-400 tracking-tighter uppercase italic mb-1">
              Rendimiento Global
            </h2>
            <p class="text-on-surface-variant text-sm font-medium opacity-60 mb-10 italic">
              Promedio de satisfacción y comunidad
            </p>

            <div class="grid grid-cols-3 gap-4">
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-4xl font-black text-white tracking-tighter">${avgRating}</span>
                  <span class="text-cyan-400">${icon('star', { size: 20, fill: 'currentColor' })}</span>
                </div>
                <span class="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] leading-tight text-center">
                  Calificación General
                </span>
              </div>

              <div class="flex flex-col items-center">
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-4xl font-black text-white tracking-tighter">${followersCount}</span>
                </div>
                <span class="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] leading-tight text-center">
                  Seguidores
                </span>
              </div>

              <div class="flex flex-col items-center">
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-4xl font-black text-white tracking-tighter">${totalReviews}</span>
                </div>
                <span class="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] leading-tight text-center">
                  Reseñas Totales
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tus Series Section -->
        <div>
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-2xl font-black font-headline text-white tracking-tighter uppercase italic">Tus Series</h3>
            <span class="text-cyan-400 text-[10px] font-black uppercase tracking-widest">${series.length} creadas</span>
          </div>

          <div class="space-y-4">
            ${series.length === 0 ? `
              <div class="p-8 text-center bg-white/5 rounded-3xl border border-white/5 text-white/40 text-xs font-bold uppercase">
                No tienes series creadas
              </div>
            ` : series.map(s => {
              const ratingStr = s.ratingCount > 0 ? (s.ratingSum / s.ratingCount).toFixed(1) : '0.0';
              const isSelected = s.id === selectedId;
              return `
                <div 
                  data-select-serie="${s.id}"
                  class="bg-surface-container-high/40 rounded-[2.5rem] p-5 border border-white/5 flex items-center gap-5 relative overflow-hidden group cursor-pointer active:scale-[0.99] transition-all ${isSelected ? 'shadow-[inset_4px_0_0_0_#22d3ee]' : ''}"
                >
                  <div class="w-20 h-20 rounded-3xl overflow-hidden flex-shrink-0 shadow-xl">
                    <img src="${s.thumbnail || '/Categorias/Ciencia Ficcion.png'}" class="w-full h-full object-cover" alt="" referrerpolicy="no-referrer" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="text-lg font-black text-white mb-1 line-clamp-1">${s.title}</h4>
                    <div class="flex items-center gap-3 mb-3">
                      <div class="flex items-center gap-1 text-cyan-400">
                        ${icon('star', { size: 12, fill: 'currentColor' })}
                        <span class="text-xs font-black">${ratingStr}</span>
                      </div>
                      <span class="text-[10px] text-on-surface-variant/50 font-medium">${s.ratingCount || 0} reseñas</span>
                    </div>
                    <div class="flex gap-2 overflow-hidden flex-wrap">
                      ${(s.tags || []).slice(0, 3).map(tag => `
                        <span class="bg-white/5 text-[9px] font-black px-3 py-1 rounded-full text-on-surface-variant/60 tracking-widest uppercase">
                          ${tag}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                  <div class="p-2 opacity-40 group-hover:opacity-100 transition-opacity text-white">
                    ${icon('chevron-right', { size: 20 })}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Feed Header & Reviews List -->
        ${selectedSerie ? `
          <div>
            <p class="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">
              VIENDO RESEÑAS DE
            </p>
            <h3 class="text-[34px] leading-tight font-black font-headline text-white tracking-tighter mb-8 uppercase italic line-clamp-1">
              ${selectedSerie.title}
            </h3>

            <div class="space-y-6">
              ${comments.length === 0 ? `
                <div class="p-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem] space-y-2">
                  <p class="text-xs font-black uppercase tracking-widest text-white/40">Sin comentarios aún en esta serie</p>
                </div>
              ` : Object.entries(groups).map(([epId, comms]) => {
                const ep = episodes[epId] || { number: '?', title: 'Episodio' };
                return `
                  <div class="space-y-4">
                    <div class="flex items-center gap-2 px-2">
                      <span class="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Cap. ${ep.number}: ${ep.title}</span>
                      <span class="text-[10px] font-bold text-white/20">(${comms.length})</span>
                    </div>

                    ${comms.map(c => `
                      <div class="bg-surface-container-high/30 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] space-y-3">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3">
                            <img src="${c.userPhoto || '/Avatar/21.png'}" class="w-8 h-8 rounded-full object-cover" />
                            <div>
                              <p class="text-xs font-bold text-white">${c.userName || 'Usuario'}</p>
                              <span class="text-[9px] font-bold text-white/30">${formatRelativeTime(c.createdAt)}</span>
                            </div>
                          </div>
                          <div class="flex gap-0.5 text-cyan-400">
                            ${[1, 2, 3, 4, 5].map(st => `
                              <span class="${c.rating >= st ? 'text-cyan-400' : 'text-white/10'}">
                                ${icon('star', { size: 10, fill: c.rating >= st ? 'currentColor' : 'none' })}
                              </span>
                            `).join('')}
                          </div>
                        </div>
                        <p class="text-xs text-on-surface-variant/80 italic font-medium leading-relaxed">"${c.content}"</p>
                      </div>
                    `).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('[data-select-serie]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedId = btn.getAttribute('data-select-serie');
        fetchSelectedSeriesData();
        render();
      });
    });
  }

  return () => {
    if (unsubUser) unsubUser();
    if (unsubSeries) unsubSeries();
    if (unsubEpisodes) unsubEpisodes();
    if (unsubComments) unsubComments();
  };
}
