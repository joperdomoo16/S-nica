import { icon } from '../icons.js';
import { db, collection, query, where, getDocs, orderBy } from '../firebase.js';

const CATEGORIES = [
  { name: 'Ciencia Ficción', image: '/Categorias/Ciencia Ficcion.png' },
  { name: 'Terror', image: '/Categorias/Terror.png' },
  { name: 'Romance', image: '/Categorias/Romance.png' },
  { name: 'Fantasía', image: '/Categorias/Fantasia.png' },
  { name: 'Suspenso', image: '/Categorias/Suspenso.png' },
  { name: 'Comedia', image: '/Categorias/Comedia.png' },
  { name: 'Crimen', image: '/Categorias/Crimen.png' },
  { name: 'Cultura Geek', image: '/Categorias/Cultura Geek.png' },
  { name: 'Educación', image: '/Categorias/Educacion.png' },
  { name: 'Salud, Fitness y Bienestar', image: '/Categorias/Salud.png' },
  { name: 'Noticias y Actualidad', image: '/Categorias/Noticias.png' },
  { name: 'Negocios y Finanzas', image: '/Categorias/Negocios.png' },
  { name: 'Historia y Filosofía', image: '/Categorias/Historia.png' },
  { name: 'Arte y Entretenimiento', image: '/Categorias/Arte.png' },
  { name: 'Infantil', image: '/Categorias/Infantil.png' },
];

export async function renderExplore(container, initialQuery = '') {
  let searchQuery = initialQuery || '';
  let allSeries = [];
  let allCreators = [];

  container.innerHTML = `
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  `;

  try {
    const qSeries = query(collection(db, 'series'), where('status', '==', 'publicado'), orderBy('createdAt', 'desc'));
    const seriesSnaps = await getDocs(qSeries).catch(() => ({ docs: [] }));
    allSeries = seriesSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    const qUsers = query(collection(db, 'users'));
    const userSnaps = await getDocs(qUsers).catch(() => ({ docs: [] }));
    allCreators = userSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    render();
  } catch (err) {
    console.error("Explore fetch error:", err);
  }

  function render() {
    const queryClean = searchQuery.trim().toLowerCase().replace(/^@/, '');

    const matchedCreators = queryClean ? allCreators.filter(c => {
      const nameMatch = c.displayName?.toLowerCase().includes(queryClean);
      const usernameMatch = c.username?.toLowerCase().includes(queryClean);
      const idMatch = c.sonicaId?.toLowerCase().includes(queryClean);
      return nameMatch || usernameMatch || idMatch;
    }) : [];

    const matchedSeries = queryClean ? allSeries.filter(series => {
      const titleMatch = series.title?.toLowerCase().includes(queryClean);
      const creatorNameMatch = series.creatorName?.toLowerCase().includes(queryClean);
      const creatorMatch = matchedCreators.some(c => c.id === series.creatorId);
      return titleMatch || creatorNameMatch || creatorMatch;
    }) : [];

    container.innerHTML = `
      <div class="px-6 space-y-12 pb-24 pt-8">
        <!-- Search Bar -->
        <div class="relative group">
          <span class="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
            ${icon('search', { size: 20 })}
          </span>
          <input 
            id="explore-input"
            type="text"
            placeholder="Buscar por título, creador o tema..."
            value="${searchQuery}"
            class="w-full bg-surface-container-high border-none rounded-2xl py-5 pl-14 pr-14 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg font-medium"
          />
          <button class="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-surface-container-highest rounded-xl transition-colors">
            <span class="text-primary">${icon('filter', { size: 20 })}</span>
          </button>
        </div>

        ${searchQuery.trim() !== '' ? `
          <div class="space-y-8 pb-20">
            <!-- Matched Creators -->
            ${matchedCreators.length > 0 ? `
              <section class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-black text-primary uppercase tracking-widest">Creadores (${matchedCreators.length})</h3>
                  <div class="h-px flex-1 bg-white/5 ml-4"></div>
                </div>
                <div class="flex flex-row gap-4 overflow-x-auto pb-4 scrollbar-none">
                  ${matchedCreators.map(c => `
                    <div class="flex flex-col items-center space-y-2 p-4 bg-surface-container-high/40 border border-white/5 rounded-3xl min-w-[130px] text-center cursor-pointer hover:border-primary/25 transition-all shadow-md creator-result-card" data-id="${c.id}">
                      <div class="w-16 h-16 rounded-full overflow-hidden border border-white/10 shadow-lg">
                        <img src="${c.photoURL || '/Avatar/21.png'}" alt="${c.displayName}" class="w-full h-full object-cover" />
                      </div>
                      <div class="space-y-0.5">
                        <h4 class="text-xs font-bold text-white line-clamp-1 max-w-[110px]">${c.displayName || 'Creador'}</h4>
                        <p class="text-[10px] text-primary font-black uppercase tracking-wider">@${c.username || 'usuario'}</p>
                        ${c.sonicaId ? `<p class="text-[8px] text-on-surface-variant opacity-60">ID: ${c.sonicaId}</p>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </section>
            ` : ''}

            <!-- Matched Series -->
            <section class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-black text-primary uppercase tracking-widest">Series (${matchedSeries.length})</h3>
                <div class="h-px flex-1 bg-white/5 ml-4"></div>
              </div>
              ${matchedSeries.length > 0 ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  ${matchedSeries.map(s => `
                    <div class="flex gap-4 p-4 bg-surface-container-high/40 border border-white/5 rounded-3xl cursor-pointer hover:border-primary/20 transition-all shadow-md series-result-card" data-id="${s.id}">
                      <div class="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-surface-container-highest border border-white/5">
                        <img src="${s.thumbnail || '/Categorias/Ciencia Ficcion.png'}" alt="${s.title}" class="w-full h-full object-cover" />
                      </div>
                      <div class="flex flex-col justify-center min-w-0">
                        <span class="text-[9px] font-black text-primary uppercase tracking-widest leading-none mb-1.5">${s.category || 'Podcast'}</span>
                        <h4 class="text-sm font-extrabold text-white line-clamp-1 mb-1">${s.title}</h4>
                        <p class="text-[10px] text-on-surface-variant opacity-80 leading-none">
                          Por <span class="text-white font-bold">${s.creatorName || 'Sónica'}</span>
                        </p>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div class="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center text-on-surface-variant/40">
                    ${icon('search', { size: 32 })}
                  </div>
                  <div>
                    <h4 class="font-extrabold text-white text-base">Sin resultados</h4>
                    <p class="text-xs text-on-surface-variant/60 max-w-xs mt-1">No se encontraron creadores o series que coincidan con tu búsqueda.</p>
                  </div>
                </div>
              `}
            </section>
          </div>
        ` : `
          <!-- Categorias Populares Grid -->
          <section class="pb-20">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Categorías Populares</h3>
              <div class="h-px flex-1 bg-white/5 ml-6"></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              ${CATEGORIES.map(cat => `
                <div class="aspect-square rounded-3xl relative overflow-hidden cursor-pointer group active:scale-95 transition-all shadow-lg hover:scale-[1.05] category-card-trigger" data-cat="${encodeURIComponent(cat.name)}">
                  <img src="${cat.image}" alt="${cat.name}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div class="absolute inset-0 p-4 flex flex-col justify-end">
                    <h4 class="text-sm font-black text-white relative z-10 leading-tight uppercase italic">${cat.name}</h4>
                  </div>
                  <div class="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              `).join('')}
            </div>
          </section>
        `}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const input = document.getElementById('explore-input');
    input?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
      const nextInput = document.getElementById('explore-input');
      nextInput?.focus();
      nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
    });

    container.querySelectorAll('.category-card-trigger').forEach(el => {
      el.addEventListener('click', () => {
        const cat = el.getAttribute('data-cat');
        window.location.hash = `#/explore/category/${cat}`;
      });
    });

    container.querySelectorAll('.series-result-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        window.location.hash = `#/series/${id}`;
      });
    });

    container.querySelectorAll('.creator-result-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        window.location.hash = `#/creator-profile/${id}`;
      });
    });
  }
}
