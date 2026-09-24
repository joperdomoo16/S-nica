import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit, 
  documentId, 
  getDocs 
} from '../firebase.js';
import { icon } from '../icons.js';
import { formatRelativeTime, parseDate, getCachedUser } from '../utils.js';

export function renderSubscriptions(container) {
  const user = auth.currentUser;

  if (!user) {
    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 class="text-2xl font-black font-headline mb-4 uppercase italic">Inicia sesión</h2>
        <p class="text-on-surface-variant font-medium mb-8 max-w-xs">Inicia sesión para ver tus series suscritas y novedades de tus creadores favoritos.</p>
        <button 
          id="btn-sub-login"
          class="px-8 h-14 primary-gradient rounded-full text-sm font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform text-surface-dim cursor-pointer"
        >
          Iniciar Sesión
        </button>
      </div>
    `;
    document.getElementById('btn-sub-login')?.addEventListener('click', () => {
      window.location.hash = '#/login';
    });
    return;
  }

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
    </div>
  `;

  let librarySeries = [];
  let followedCreators = [];
  let novedades = [];
  let showAllSeries = false;
  let isLoading = true;

  let unsubLib = null;
  let unsubFollows = null;
  let unsubNovedades = null;

  function setup() {
    // 1. Consulta de biblioteca
    const qLib = query(
      collection(db, 'library'),
      where('userId', '==', user.uid),
      orderBy('savedAt', 'desc')
    );

    // 2. Consulta de seguidos
    const qFollows = query(
      collection(db, 'follows'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    unsubLib = onSnapshot(qLib, async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length === 0) {
        librarySeries = [];
        isLoading = false;
        render();
        return;
      }

      const seriesIds = list.map(item => item.seriesId);
      const chunks = [];
      for (let i = 0; i < seriesIds.length; i += 30) {
        chunks.push(seriesIds.slice(i, i + 30));
      }

      try {
        const validSeriesData = new Map();
        for (const chunk of chunks) {
          const qVerify = query(
            collection(db, 'series'),
            where(documentId(), 'in', chunk),
            where('status', '==', 'publicado')
          );
          const verifySnap = await getDocs(qVerify);
          verifySnap.docs.forEach(d => validSeriesData.set(d.id, d.data()));
        }

        librarySeries = list
          .filter(item => validSeriesData.has(item.seriesId))
          .map(item => {
            const actual = validSeriesData.get(item.seriesId);
            return {
              ...item,
              seriesThumbnail: actual?.thumbnail || actual?.coverUrl || item.seriesThumbnail,
              seriesTitle: actual?.title || item.seriesTitle
            };
          });
      } catch (err) {
        console.error("Library verify error:", err);
        librarySeries = list;
      }

      fetchNovedades();
      isLoading = false;
      render();
    });

    unsubFollows = onSnapshot(qFollows, async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Hidratar perfiles de creadores
      const hydrated = await Promise.all(list.map(async (f) => {
        const cData = await getCachedUser(f.creatorId);
        return {
          ...f,
          creatorName: cData?.displayName || 'Creador',
          creatorPhoto: cData?.photoURL || '/Avatar/21.png'
        };
      }));
      followedCreators = hydrated;
      render();
    });
  }

  function fetchNovedades() {
    if (unsubNovedades) unsubNovedades();
    if (librarySeries.length === 0) {
      novedades = [];
      return;
    }

    const seriesIds = librarySeries.map(s => s.seriesId).slice(0, 30);
    const qNovedades = query(
      collection(db, 'episodes'),
      where('seriesId', 'in', seriesIds),
      where('status', '==', 'publicado'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    unsubNovedades = onSnapshot(qNovedades, (snap) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      novedades = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ep => {
          if (!ep.createdAt) return false;
          const d = parseDate(ep.createdAt);
          return d >= sevenDaysAgo;
        });
      render();
    }, (err) => console.error("Novedades error:", err));
  }

  function renderCard(s, isGrid = false) {
    return `
      <div 
        data-series-card="${s.seriesId}"
        class="relative aspect-[10/12] rounded-[2rem] overflow-hidden group border border-white/5 active:scale-95 transition-transform shadow-xl cursor-pointer ${isGrid ? 'w-full' : 'w-[140px] shrink-0'}"
      >
        <img 
          src="${s.seriesThumbnail || '/Categorias/Ciencia Ficcion.png'}" 
          class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
          alt="${s.seriesTitle}" 
          referrerpolicy="no-referrer"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90"></div>
        <div class="absolute inset-0 p-4 flex flex-col justify-end">
          <h4 class="text-sm font-black font-headline leading-tight tracking-tight uppercase italic line-clamp-2">
            ${s.seriesTitle}
          </h4>
        </div>
      </div>
    `;
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

    if (showAllSeries) {
      container.innerHTML = `
        <div class="bg-surface-dim min-h-screen text-white pb-32">
          <div class="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-surface-dim/90 backdrop-blur-md z-10">
            <button id="btn-close-all-series" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
              ${icon('arrow-left', { size: 20 })}
            </button>
            <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Todas mis Series</h3>
          </div>
          <div class="px-6 grid grid-cols-2 gap-4 mt-4">
            ${librarySeries.map(s => renderCard(s, true)).join('')}
          </div>
        </div>
      `;
      document.getElementById('btn-close-all-series')?.addEventListener('click', () => {
        showAllSeries = false;
        render();
      });
      bindCardClicks();
      return;
    }

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32 overflow-x-hidden">
        <div class="px-6 space-y-16 pt-8">
          <!-- Series Suscritas -->
          <section>
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Series Suscritas</h3>
              ${librarySeries.length > 10 ? `
                <button id="btn-view-all-series" class="text-cyan-400 text-[10px] font-black uppercase tracking-widest hover:underline cursor-pointer">Ver todas</button>
              ` : ''}
            </div>
            
            <div class="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6">
              ${librarySeries.length > 0 ? librarySeries.slice(0, 10).map(s => renderCard(s, false)).join('') : `
                <div class="w-full py-12 flex flex-col items-center justify-center bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 opacity-40">
                  <p class="text-[10px] font-black uppercase tracking-[0.2em]">Tu biblioteca está vacía</p>
                </div>
              `}
            </div>
          </section>

          <!-- Creadores Favoritos -->
          <section>
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Creadores Favoritos</h3>
              <button class="text-cyan-400 text-[10px] font-black uppercase tracking-widest hover:underline cursor-pointer">Ver todos</button>
            </div>

            <div class="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
              ${followedCreators.length > 0 ? followedCreators.map(cr => `
                <div 
                  data-creator-card="${cr.creatorId}"
                  class="flex flex-col items-center gap-3 min-w-[90px] group cursor-pointer"
                >
                  <div class="relative p-1.5 rounded-full bg-surface-container-highest/50 group-hover:bg-primary/30 transition-all duration-500">
                    <div class="w-20 h-20 rounded-full overflow-hidden border-4 border-surface-dim">
                      <img src="${cr.creatorPhoto}" alt="${cr.creatorName}" class="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span class="text-[11px] font-black text-center line-clamp-1 uppercase tracking-widest opacity-80 group-hover:opacity-100 group-hover:text-primary transition-all">
                    ${cr.creatorName}
                  </span>
                </div>
              `).join('') : `
                <div class="w-full py-8 flex items-center justify-center bg-white/5 rounded-[2rem] border border-dashed border-white/10 opacity-40">
                  <p class="text-[10px] font-black uppercase tracking-[0.2em]">No sigues a ningún creador</p>
                </div>
              `}
            </div>
          </section>

          <!-- Novedades -->
          <section>
            <h3 class="text-2xl font-black font-headline tracking-tighter mb-8 uppercase italic">Novedades</h3>
            <div class="space-y-6">
              ${novedades.length > 0 ? novedades.map(item => {
                const parent = librarySeries.find(s => s.seriesId === item.seriesId);
                const resolvedImg = item.imageUrl || item.thumbnail || parent?.seriesThumbnail || '/logo.png';
                return `
                  <div
                    data-novedad-click="${item.id}"
                    class="bg-surface-container-high/30 backdrop-blur-xl rounded-[2rem] p-4 flex gap-4 border border-white/5 active:scale-[0.98] transition-all cursor-pointer group hover:bg-surface-container-high/50"
                  >
                    <div class="w-24 h-24 rounded-2xl overflow-hidden shadow-xl shrink-0 relative">
                      <img src="${resolvedImg}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="${item.title}" />
                      <div class="absolute inset-0 bg-black/20"></div>
                    </div>
                    <div class="flex-1 py-1 min-w-0">
                      <div class="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1 opacity-80">
                        ESTRENO
                      </div>
                      <h4 class="font-black text-lg leading-tight uppercase italic mb-2 line-clamp-1">
                        ${item.title}
                      </h4>
                      <div class="inline-flex items-center bg-surface-dim/80 px-3 py-1 rounded-lg border border-white/5 mb-2">
                        <span class="text-[10px] font-bold text-on-surface-variant">
                          ${formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p class="text-[11px] text-on-surface-variant font-medium opacity-60 line-clamp-1">
                        ${item.description || 'Nuevo episodio disponible.'}
                      </p>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="py-12 flex flex-col items-center justify-center bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 opacity-40">
                  <p class="text-[10px] font-black uppercase tracking-[0.2em]">No hay novedades por ahora</p>
                </div>
              `}
            </div>
          </section>
        </div>
      </div>
    `;

    document.getElementById('btn-view-all-series')?.addEventListener('click', () => {
      showAllSeries = true;
      render();
    });

    bindCardClicks();
  }

  function bindCardClicks() {
    container.querySelectorAll('[data-series-card]').forEach(el => {
      el.addEventListener('click', () => {
        const sId = el.getAttribute('data-series-card');
        window.location.hash = `#/series/${sId}`;
      });
    });

    container.querySelectorAll('[data-creator-card]').forEach(el => {
      el.addEventListener('click', () => {
        const cId = el.getAttribute('data-creator-card');
        window.location.hash = `#/creator-profile/${cId}`;
      });
    });

    container.querySelectorAll('[data-novedad-click]').forEach(el => {
      el.addEventListener('click', () => {
        const epId = el.getAttribute('data-novedad-click');
        window.location.hash = `#/player/${epId}`;
      });
    });
  }

  setup();

  return () => {
    if (unsubLib) unsubLib();
    if (unsubFollows) unsubFollows();
    if (unsubNovedades) unsubNovedades();
  };
}
