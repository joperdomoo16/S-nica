import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  serverTimestamp 
} from '../firebase.js';
import { icon } from '../icons.js';
import { optimizeImage } from '../utils.js';

const CATEGORIES = [
  'Ciencia Ficción', 'Terror', 'Romance', 'Fantasia', 'Suspenso',
  'Comedia', 'Crimen', 'Cultura Geek', 'Educación', 'Salud, Fitness y Bienestar',
  'Noticias y Actualidad', 'Negocios y Finanzas', 'Historia y Filosofía',
  'Arte y Entretenimiento', 'Infantil'
];

const POPULAR_TAGS = [
  '#Suspenso', '#Misterio', '#CienciaFicción', '#Terror', '#Drama',
  '#Aventura', '#Fantasía', '#Comedia', '#Crimen', '#Historia'
];

export function renderNewSeries(container) {
  const user = auth.currentUser;
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  let title = '';
  let description = '';
  let language = 'Español';
  let category = 'Ciencia Ficción';
  let coverImage = null;
  let selectedTags = ['#Suspenso'];
  let newTagInput = '';
  let isSubmitting = false;
  let showConfirmModal = false;
  let imageError = null;

  function render() {
    const isFormValid = title.trim() !== '' && 
                        description.trim() !== '' && 
                        coverImage !== null && 
                        selectedTags.length > 0;

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32">
        <div class="px-6 pt-8 max-w-lg mx-auto space-y-8">
          <!-- Top Header -->
          <div class="flex items-center gap-4">
            <button id="btn-back-creator" class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-primary active:scale-95 transition-all cursor-pointer">
              ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
            </button>
            <h1 class="text-2xl font-black font-headline uppercase italic">Crear Nueva Serie</h1>
          </div>

          <!-- Cover Image Uploader -->
          <div class="flex flex-col items-center space-y-3">
            <label class="relative w-48 h-48 rounded-[2.5rem] overflow-hidden border-2 ${imageError ? 'border-red-500' : 'border-dashed border-white/20 hover:border-primary'} transition-colors cursor-pointer group flex items-center justify-center bg-surface-container-high/40">
              <input type="file" id="input-series-cover" accept="image/*" class="hidden" />
              ${coverImage ? `
                <img src="${coverImage}" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-white">${icon('camera', { size: 32 })}</span>
                </div>
              ` : `
                <div class="flex flex-col items-center space-y-2 text-center p-4">
                  <span class="text-primary">${icon('camera', { size: 32 })}</span>
                  <p class="text-[10px] font-black uppercase tracking-wider text-white/50">Subir Portada (1024x1024)</p>
                </div>
              `}
            </label>
            ${imageError ? `<p class="text-xs text-red-400 font-bold">${imageError}</p>` : ''}
          </div>

          <!-- Title -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Título de la Serie</label>
            <input 
              type="text" 
              id="input-series-title" 
              value="${title}" 
              placeholder="Ej. Crónicas del Cosmos"
              class="w-full bg-surface-container-high rounded-2xl px-5 py-4 text-white font-medium outline-none focus:ring-2 focus:ring-primary/40 border border-white/5"
            />
          </div>

          <!-- Language & Category -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Idioma</label>
              <select id="select-series-lang" class="w-full bg-surface-container-high rounded-2xl px-4 py-4 text-white font-medium outline-none border border-white/5">
                <option value="Español" ${language === 'Español' ? 'selected' : ''}>Español</option>
                <option value="Inglés" ${language === 'Inglés' ? 'selected' : ''}>Inglés</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Categoría</label>
              <select id="select-series-category" class="w-full bg-surface-container-high rounded-2xl px-4 py-4 text-white font-medium outline-none border border-white/5">
                ${CATEGORIES.map(cat => `
                  <option value="${cat}" ${category === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Sinopsis / Descripción</label>
              <span class="text-[10px] font-bold text-white/30">${description.length}/300</span>
            </div>
            <textarea 
              id="textarea-series-desc" 
              maxlength="300" 
              rows="4" 
              placeholder="Cuenta de qué trata tu historia..."
              class="w-full bg-surface-container-high rounded-2xl p-5 text-white font-medium outline-none focus:ring-2 focus:ring-primary/40 border border-white/5 resize-none"
            >${description}</textarea>
          </div>

          <!-- Tags -->
          <div class="space-y-3">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Etiquetas (Tags)</label>
            <div class="flex flex-wrap gap-2">
              ${POPULAR_TAGS.map(tag => `
                <button 
                  data-toggle-tag="${tag}"
                  class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedTags.includes(tag) 
                      ? 'bg-primary text-surface-dim font-black' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }"
                >
                  ${tag}
                </button>
              `).join('')}
            </div>

            <!-- Custom Tag input -->
            <div class="flex gap-2 pt-2">
              <input 
                type="text" 
                id="input-custom-tag" 
                placeholder="Añadir otra etiqueta..." 
                value="${newTagInput}"
                class="flex-1 bg-surface-container-high rounded-xl px-4 py-3 text-xs text-white outline-none border border-white/5"
              />
              <button id="btn-add-custom-tag" class="px-5 bg-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-primary cursor-pointer">
                +
              </button>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="flex flex-col gap-3 pt-6">
            <button 
              id="btn-submit-review"
              ${!isFormValid || isSubmitting ? 'disabled' : ''}
              class="w-full py-5 primary-gradient rounded-full font-black text-sm uppercase tracking-widest text-surface-dim shadow-xl active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
            >
              ${isSubmitting ? icon('loader2', { size: 20, className: 'animate-spin mx-auto' }) : 'Enviar a Revisión'}
            </button>
            <button 
              id="btn-save-draft"
              ${title.trim() === '' || isSubmitting ? 'disabled' : ''}
              class="w-full py-4 bg-white/5 hover:bg-white/10 rounded-full font-black text-xs uppercase tracking-widest text-white/50 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Guardar Borrador
            </button>
          </div>
        </div>

        <!-- Confirm Review Modal -->
        ${showConfirmModal ? `
          <div class="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="confirm-modal-backdrop"></div>
            <div class="relative w-full max-w-sm bg-surface-container-highest rounded-[2.5rem] p-8 border border-white/5 shadow-2xl text-center space-y-6">
              <div class="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto text-primary">
                ${icon('sparkles', { size: 32 })}
              </div>
              <div class="space-y-2">
                <h3 class="text-xl font-black font-headline uppercase italic text-white">¿Enviar a Revisión?</h3>
                <p class="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Tu serie entrará en proceso de revisión editorial. Una vez aprobada, se publicará en el catálogo general de Sónica.
                </p>
              </div>
              <div class="flex flex-col gap-3 pt-2">
                <button id="btn-modal-confirm-submit" class="w-full py-4 primary-gradient text-surface-dim font-black uppercase tracking-widest rounded-full text-xs shadow-lg active:scale-95 transition-all cursor-pointer">
                  Confirmar Envío
                </button>
                <button id="btn-modal-cancel-submit" class="w-full py-4 bg-white/5 text-white/40 font-black uppercase tracking-widest rounded-full text-xs cursor-pointer">
                  Revisar Datos
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Event listeners
    document.getElementById('btn-back-creator')?.addEventListener('click', () => {
      window.location.hash = '#/creator';
    });

    document.getElementById('input-series-title')?.addEventListener('input', (e) => {
      title = e.target.value;
    });

    document.getElementById('select-series-lang')?.addEventListener('change', (e) => {
      language = e.target.value;
    });

    document.getElementById('select-series-category')?.addEventListener('change', (e) => {
      category = e.target.value;
    });

    document.getElementById('textarea-series-desc')?.addEventListener('input', (e) => {
      description = e.target.value;
      const cnt = container.querySelector('.text-white\\/30');
      if (cnt) cnt.textContent = `${description.length}/300`;
    });

    document.getElementById('input-series-cover')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      imageError = null;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        try {
          const opt = await optimizeImage(base64, 1024, 1024, 0.85);
          coverImage = opt;
          render();
        } catch (err) {
          imageError = 'Error al procesar la imagen.';
          render();
        }
      };
      reader.readAsDataURL(file);
    });

    container.querySelectorAll('[data-toggle-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-toggle-tag');
        if (selectedTags.includes(tag)) {
          selectedTags = selectedTags.filter(t => t !== tag);
        } else {
          selectedTags.push(tag);
        }
        render();
      });
    });

    document.getElementById('input-custom-tag')?.addEventListener('input', (e) => {
      newTagInput = e.target.value;
    });

    document.getElementById('btn-add-custom-tag')?.addEventListener('click', () => {
      if (!newTagInput.trim()) return;
      const tag = newTagInput.startsWith('#') ? newTagInput.trim() : `#${newTagInput.trim()}`;
      if (!selectedTags.includes(tag)) selectedTags.push(tag);
      newTagInput = '';
      render();
    });

    document.getElementById('btn-submit-review')?.addEventListener('click', () => {
      showConfirmModal = true;
      render();
    });

    document.getElementById('confirm-modal-backdrop')?.addEventListener('click', () => {
      showConfirmModal = false;
      render();
    });
    document.getElementById('btn-modal-cancel-submit')?.addEventListener('click', () => {
      showConfirmModal = false;
      render();
    });
    document.getElementById('btn-modal-confirm-submit')?.addEventListener('click', () => {
      showConfirmModal = false;
      saveSeries('in_review');
    });

    document.getElementById('btn-save-draft')?.addEventListener('click', () => {
      saveSeries('draft');
    });
  }

  async function saveSeries(status) {
    if (isSubmitting) return;
    isSubmitting = true;
    render();

    try {
      const docData = {
        title: title.trim(),
        description: description.trim(),
        language,
        thumbnail: coverImage || '',
        category,
        tags: selectedTags,
        creatorId: user.uid,
        creatorName: user.displayName || 'Creador de Sónica',
        creatorEmail: user.email || '',
        status,
        createdAt: serverTimestamp(),
        views: 0,
        ratingCount: 0,
        ratingSum: 0
      };

      await addDoc(collection(db, 'series'), docData);
      alert(status === 'in_review' ? '¡Serie enviada a revisión con éxito!' : '¡Borrador guardado!');
      window.location.hash = '#/creator';
    } catch (e) {
      console.error("Save series error:", e);
      alert("Hubo un error al guardar la serie.");
      isSubmitting = false;
      render();
    }
  }

  render();
}
