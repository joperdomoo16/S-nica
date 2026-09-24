import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot 
} from '../firebase.js';
import { icon } from '../icons.js';
import { calculateSeriesRating } from '../utils.js';

const CATEGORIES_IMG = {
  'Ciencia Ficción': '/Categorias/Ciencia Ficcion.png',
  'Terror': '/Categorias/Terror.png',
  'Romance': '/Categorias/Romance.png',
  'Fantasia': '/Categorias/Fantasia.png',
  'Suspenso': '/Categorias/Suspenso.png',
  'Comedia': '/Categorias/Comedia.png',
  'Crimen': '/Categorias/Crimen.png',
  'Cultura Geek': '/Categorias/Cultura Geek.png',
  'Educación': '/Categorias/Educacion.png',
  'Salud, Fitness y Bienestar': '/Categorias/Salud.png',
  'Noticias y Actualidad': '/Categorias/Noticias.png',
  'Negocios y Finanzas': '/Categorias/Negocios.png',
  'Historia y Filosofía': '/Categorias/Historia.png',
  'Arte y Entretenimiento': '/Categorias/Arte.png',
  'Infantil': '/Categorias/Infantil.png',
};

const normalize = (str) => 
  (str || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function renderCategory(container, categoryName) {
  const decodedCategory = decodeURIComponent(categoryName || '');
  let series = [];
  let isLoading = true;
  let searchQuery = '';

  const getHeroImage = () => {
    const key = Object.keys(CATEGORIES_IMG).find(k => normalize(k) === normalize(decodedCategory));
    if (key) return CATEGORIES_IMG[key];
    return '/Categorias/Ciencia Ficcion.png';
  };

  const heroImage = getHeroImage();

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
    </div>
  `;

  const q = query(
    collection(db, 'series'),
    where('status', '==', 'publicado')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    series = list.filter(s => {
      if (s.hasApprovedEpisodes !== true) return false;
      if (!s.category) return false;
      return normalize(s.category) === normalize(decodedCategory);
    });

    isLoading = false;
    render();
  }, (err) => {
    console.error("Category series fetch error:", err);
    isLoading = false;
    render();
  });

  function render() {
    const filtered = series.filter(s => 
      (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.creatorName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    container.innerHTML = `
      <div class="px-6 space-y-12 pb-24 pt-4">
        <!-- Header with Hero -->
        <div class="relative h-64 md:h-80 rounded-[3rem] overflow-hidden shadow-2xl">
          <img 
            src="${heroImage}" 
            alt="${decodedCategory}" 
            class="absolute inset-0 w-full h-full object-cover"
            referrerpolicy="no-referrer"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/40 to-transparent"></div>
          
          <div class="absolute inset-0 p-8 flex flex-col justify-end">
            <div class="space-y-1">
              <p class="text-[10px] font-black uppercase tracking-[0.5em] text-primary drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">Categoría</p>
              <h1 class="text-5xl md:text-6xl font-black text-white italic font-headline uppercase leading-none tracking-tighter">
                ${decodedCategory}
              </h1>
            </div>
          </div>
        </div>

        <!-- Search in Category -->
        <div class="relative group">
          <span class="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
            ${icon('search', { size: 20 })}
          </span>
          <input 
            type="text"
            id="cat-search-input"
            placeholder="Buscar en ${decodedCategory}..."
            value="${searchQuery}"
            class="w-full bg-surface-container-high border-none rounded-2xl py-5 pl-14 pr-14 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg font-medium"
          />
        </div>

        <!-- Results Section -->
        <section class="space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-black font-headline tracking-tighter uppercase italic text-white/40">
              ${filtered.length} Series Encontradas
            </h3>
            <div class="h-px flex-1 bg-white/5 ml-6"></div>
          </div>

          ${isLoading ? `
            <div class="flex justify-center py-20">
              <div class="animate-spin text-primary opacity-40">${icon('loader2', { size: 36 })}</div>
            </div>
          ` : filtered.length === 0 ? `
            <div class="p-20 rounded-[3rem] bg-surface-container-high/20 border border-white/5 text-center space-y-4">
              <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-white/20">
                ${icon('search', { size: 32 })}
              </div>
              <p class="text-on-surface-variant text-sm font-medium italic opacity-60">
                No se encontraron series en esta categoría.
              </p>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${filtered.map(s => `
                <div
                  data-cat-series="${s.id}"
                  class="group relative bg-surface-container-low/40 backdrop-blur-xl border border-white/5 hover:border-primary/20 rounded-[2.5rem] p-5 transition-all cursor-pointer shadow-xl overflow-hidden flex flex-col gap-6 h-full"
                >
                  <div class="aspect-square rounded-3xl overflow-hidden shadow-lg group-hover:shadow-primary/10 transition-all">
                    <img 
                      src="${s.thumbnail || heroImage}" 
                      class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      alt="${s.title}" 
                      referrerpolicy="no-referrer" 
                    />
                  </div>
                  
                  <div class="flex flex-col flex-1 gap-2">
                    <div class="flex items-start justify-between gap-2">
                      <h4 class="text-xl font-black text-white uppercase italic tracking-tight leading-[1.1] group-hover:text-primary transition-colors line-clamp-2">
                        ${s.title}
                      </h4>
                      <div class="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg border border-primary/20 text-primary flex-shrink-0">
                        ${icon('star', { size: 10, fill: 'currentColor' })}
                        <span class="text-[10px] font-black">${calculateSeriesRating(s)}</span>
                      </div>
                    </div>
                    
                    <p class="text-xs text-on-surface-variant/60 font-medium uppercase tracking-widest flex items-center gap-1">
                      por <span class="text-on-surface group-hover:text-primary transition-colors">${s.creatorName || 'Creador de Sónica'}</span>
                    </p>
                    
                    <p class="text-xs text-on-surface-variant/40 mt-2 line-clamp-2 italic leading-relaxed">
                      ${s.description || 'Sin descripción disponible.'}
                    </p>
                  </div>
                  
                  <div class="pt-4 border-t border-white/5 flex items-center justify-between">
                     <div class="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                        <span class="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase">Escuchando ahora</span>
                     </div>
                     <div class="flex -space-x-2">
                       <div class="w-6 h-6 rounded-full border-2 border-[#0a0a0b] bg-surface-container-highest overflow-hidden">
                         <img src="/Avatar/21.png" class="w-full h-full object-cover opacity-60" alt="" />
                       </div>
                       <div class="w-6 h-6 rounded-full border-2 border-[#0a0a0b] bg-surface-container-highest overflow-hidden">
                         <img src="/Avatar/15.png" class="w-full h-full object-cover opacity-60" alt="" />
                       </div>
                       <div class="w-6 h-6 rounded-full border-2 border-[#0a0a0b] bg-surface-container-highest overflow-hidden">
                         <img src="/Avatar/8.png" class="w-full h-full object-cover opacity-60" alt="" />
                       </div>
                     </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </section>
      </div>
    `;

    const sInput = document.getElementById('cat-search-input');
    if (sInput) {
      sInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render();
        // Restore focus
        const nextInput = document.getElementById('cat-search-input');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    container.querySelectorAll('[data-cat-series]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-cat-series');
        window.location.hash = `#/series/${id}`;
      });
    });
  }

  return () => unsubscribe();
}
