import { icon } from '../icons.js';
import { db, collection, query, where, orderBy, limit, onSnapshot, getDocs, doc, auth, documentId } from '../firebase.js';
import { calculateSeriesRating, getColombiaHoursElapsed } from '../utils.js';
import { playEpisode } from '../player.js';

export async function renderHome(container) {
  container.innerHTML = `
    <div class="min-h-[80vh] flex items-center justify-center">
      <div class="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  `;

  try {
    // 1. Fetch User History
    let validListeningHistory = [];
    if (auth.currentUser) {
      try {
        const uSnap = await getDocs(query(collection(db, 'users'), where(documentId(), '==', auth.currentUser.uid)));
        if (!uSnap.empty) {
          const rawHistory = uSnap.docs[0].data().listeningHistory || [];
          validListeningHistory = rawHistory.slice(0, 10);
        }
      } catch (e) {
        console.warn("Error fetching history:", e);
      }
    }

    // 2. Fetch Trending Series
    const qTrending = query(
      collection(db, 'series'),
      where('status', '==', 'publicado'),
      orderBy('views', 'desc'),
      limit(10)
    );
    const trendingSnaps = await getDocs(qTrending).catch(() => ({ docs: [] }));
    const trending = trendingSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Fetch Featured Series
    const qFeatured = query(
      collection(db, 'series'),
      where('status', '==', 'publicado'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const featSnaps = await getDocs(qFeatured).catch(() => ({ docs: [] }));
    const featured = featSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Fetch Trending Creators
    const qCreators = query(
      collection(db, 'users'),
      where('hasUploadedSeries', '==', true),
      orderBy('followersCount', 'desc'),
      limit(10)
    );
    const creatorSnaps = await getDocs(qCreators).catch(() => ({ docs: [] }));
    let creators = creatorSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fallback creators if empty
    if (creators.length === 0) {
      const allUserSnaps = await getDocs(query(collection(db, 'users'), limit(8))).catch(() => ({ docs: [] }));
      creators = allUserSnaps.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Process featured by tags (Original, Estreno, Destacado)
    const featuredWithBadges = featured.slice(0, 8).map((item, idx) => {
      const isOriginal = item.creatorEmail === 'sonicaoriginal@gmail.com';
      let badge = null;
      if (isOriginal) {
        badge = { type: 'ORIGINAL', color: 'bg-blue-900 border border-blue-700 text-white' };
      } else if (idx % 2 === 0) {
        badge = { type: 'ESTRENO', color: 'bg-primary shadow-[0_0_15px_rgba(0,229,255,0.6)] text-black' };
      } else {
        badge = { type: 'DESTACADO', color: 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] text-black' };
      }
      return { ...item, badge };
    });

    // Recommended pool
    const recommended = featured.length > 0 ? featured.slice(0, 6) : trending.slice(0, 6);

    container.innerHTML = `
      <div class="px-6 space-y-16 pb-20 pt-8">
        <!-- Continue Listening Section -->
        ${validListeningHistory.length > 0 ? `
          <section>
            <div class="flex items-center mb-8">
              <div class="flex items-center gap-3">
                <span class="text-primary">${icon('rotateCcw', { size: 24 })}</span>
                <h3 class="text-2xl font-black font-headline tracking-tight">Continuar escuchando</h3>
              </div>
            </div>
            <div class="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
              ${validListeningHistory.map(item => `
                <div class="group cursor-pointer w-[180px] min-w-[180px] md:w-[220px] md:min-w-[220px] flex-shrink-0 card-series-link" data-id="${item.seriesId}">
                  <div class="relative aspect-square rounded-3xl overflow-hidden mb-3 shadow-lg group-hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] border border-white/5 group-hover:border-primary/30 transition-all duration-300">
                    <img 
                      src="${item.thumbnail || '/logo.png'}" 
                      alt="${item.seriesTitle}"
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                    <div class="absolute bottom-3 left-3 right-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        class="h-full bg-primary shadow-[0_0_6px_rgba(0,229,255,0.5)] rounded-full"
                        style="width: ${item.progress || 0}%"
                      ></div>
                    </div>
                  </div>
                  <h4 class="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors uppercase italic tracking-tight">${item.seriesTitle}</h4>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Trending Section -->
        <section>
          <div class="flex items-center mb-8">
            <div class="flex items-center gap-3">
              <span class="text-primary">${icon('trendingUp', { size: 24 })}</span>
              <h3 class="text-2xl font-black font-headline tracking-tight">Tendencias</h3>
            </div>
          </div>
          
          <div class="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
            ${trending.length > 0 ? trending.map(item => `
              <div class="group cursor-pointer w-[180px] min-w-[180px] md:w-[220px] md:min-w-[220px] flex-shrink-0 card-series-link" data-id="${item.id}">
                <div class="relative aspect-square rounded-3xl overflow-hidden mb-3 shadow-lg group-hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] border border-white/5 group-hover:border-primary/30 transition-all duration-300">
                  <img 
                    src="${item.thumbnail || '/Categorias/Ciencia Ficcion.png'}" 
                    alt="${item.title}"
                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                  <div class="absolute bottom-3 right-3 bg-surface-dim/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold border border-white/5">
                    <span class="text-primary">${icon('play', { size: 10, fill: 'currentColor' })}</span>
                    ${item.views || 0}
                  </div>
                </div>
                <h4 class="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors uppercase italic tracking-tight">${item.title}</h4>
                <p class="text-on-surface-variant text-[10px] font-bold uppercase opacity-60 tracking-widest mt-0.5">
                  ${item.creatorName || 'Sónica'}
                </p>
              </div>
            `).join('') : `
              <p class="text-on-surface-variant/40 text-xs font-bold uppercase tracking-widest p-10 bg-surface-container-high/20 rounded-[2rem] w-full text-center border border-dashed border-outline-variant/20">
                No hay series en tendencia aún
              </p>
            `}
          </div>
        </section>

        <!-- Featured Podcasts Section -->
        <section>
          <div class="flex items-center mb-8">
            <div class="flex items-center gap-3">
              <span class="text-primary">${icon('award', { size: 24 })}</span>
              <h3 class="text-2xl font-black font-headline tracking-tight">Podcasts Destacados</h3>
            </div>
          </div>

          <div class="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
            ${featuredWithBadges.map(podcast => `
              <div class="group cursor-pointer w-[180px] min-w-[180px] md:w-[220px] md:min-w-[220px] flex-shrink-0 card-series-link" data-id="${podcast.id}">
                <div class="relative aspect-square rounded-3xl overflow-hidden mb-3 shadow-lg group-hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] border border-white/5 group-hover:border-primary/30 transition-all duration-300">
                  <img 
                    src="${podcast.thumbnail || '/Categorias/Ciencia Ficcion.png'}" 
                    alt="${podcast.title}"
                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                  
                  ${podcast.badge ? `
                    <div class="absolute top-3 left-3 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest z-20 shadow-lg ${podcast.badge.color}">
                      ${podcast.badge.type}
                    </div>
                  ` : ''}

                  <div class="absolute bottom-3 right-3 bg-surface-dim/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold border border-white/5">
                    <span class="text-primary">${icon('play', { size: 10, fill: 'currentColor' })}</span>
                    ${podcast.views || 0}
                  </div>
                </div>
                
                <h4 class="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors uppercase italic tracking-tight">${podcast.title}</h4>
                <p class="text-on-surface-variant text-[10px] font-bold uppercase opacity-60 tracking-widest mt-0.5">
                  ${podcast.creatorName || 'Sónica'}
                </p>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Trending Creators Section -->
        <section>
          <h3 class="text-2xl font-black font-headline tracking-tight mb-6 uppercase italic">Creadores en Tendencia</h3>
          <div class="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
            ${creators.length > 0 ? creators.map(creator => `
              <div class="flex flex-col items-center min-w-[120px] group cursor-pointer card-creator-link" data-creator-id="${creator.id}">
                <div class="relative p-1 rounded-full bg-gradient-to-tr from-primary to-secondary-container mb-3 group-hover:scale-105 transition-transform">
                  <div class="w-20 h-20 rounded-full overflow-hidden bg-surface-container-high shrink-0 border-4 border-surface-dim">
                    <img src="${creator.photoURL || '/Avatar/21.png'}" alt="${creator.displayName}" class="w-full h-full object-cover" />
                  </div>
                </div>
                <h4 class="font-bold text-sm text-center line-clamp-1 group-hover:text-primary transition-colors">
                  ${creator.displayName || 'Creador'}
                </h4>
                <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-60">
                  ${creator.followersCount || 0} Seguidores
                </p>
              </div>
            `).join('') : `
              <div class="flex items-center justify-center p-10 bg-surface-container-high/10 rounded-[2rem] border border-dashed border-white/5 w-full">
                <p class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">No hay creadores aún</p>
              </div>
            `}
          </div>
        </section>

        <!-- Recommended for You Section -->
        <section>
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-3">
              <span class="text-primary">${icon('sparkles', { size: 24 })}</span>
              <h3 class="text-2xl font-black font-headline tracking-tight">Recomendado para ti</h3>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${recommended.map(podcast => `
              <div class="flex items-center gap-4 bg-surface-container-low/40 backdrop-blur-md p-4 rounded-[2rem] border border-white/5 hover:border-primary/20 cursor-pointer group transition-all card-series-link" data-id="${podcast.id}">
                <div class="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                  <img src="${podcast.thumbnail || '/Categorias/Ciencia Ficcion.png'}" class="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-primary text-[9px] font-black uppercase tracking-widest mb-1">${podcast.category || 'PODCAST'}</p>
                  <h4 class="text-white font-black text-base line-clamp-1 uppercase italic tracking-tight">${podcast.title}</h4>
                  <div class="flex items-center gap-3 mt-1.5">
                    <div class="flex items-center gap-1 text-[10px] font-black text-yellow-400">
                      ${icon('star', { size: 12, fill: 'currentColor' })}
                      <span>${calculateSeriesRating(podcast)}</span>
                    </div>
                    <div class="w-1 h-1 rounded-full bg-white/20"></div>
                    <span class="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                      ${podcast.creatorName || 'Sónica'}
                    </span>
                  </div>
                </div>
                <div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-surface-dim transition-all active:scale-90 mr-2 btn-quick-play" data-podcast-id="${podcast.id}">
                  ${icon('play', { size: 18, fill: 'currentColor', className: 'ml-0.5' })}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;

    // Bind series clicks
    container.querySelectorAll('.card-series-link').forEach(el => {
      el.addEventListener('click', (e) => {
        // If clicking quick play
        if (e.target.closest('.btn-quick-play')) return;
        const id = el.getAttribute('data-id');
        if (id) window.location.hash = `#/series/${id}`;
      });
    });

    // Bind quick play buttons
    container.querySelectorAll('.btn-quick-play').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-podcast-id');
        const pod = recommended.find(p => p.id === id);
        if (!pod) return;

        // Fetch first episode
        const qEp = query(collection(db, 'episodes'), where('seriesId', '==', id), limit(1));
        const epSnaps = await getDocs(qEp);
        if (!epSnaps.empty) {
          const ep = { id: epSnaps.docs[0].id, ...epSnaps.docs[0].data() };
          playEpisode(ep, pod);
        } else {
          window.location.hash = `#/series/${id}`;
        }
      });
    });

    // Bind creator clicks
    container.querySelectorAll('.card-creator-link').forEach(el => {
      el.addEventListener('click', () => {
        const cId = el.getAttribute('data-creator-id');
        if (cId) window.location.hash = `#/creator-profile/${cId}`;
      });
    });

  } catch (err) {
    console.error("Home render error:", err);
  }
}
