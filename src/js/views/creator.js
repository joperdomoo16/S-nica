import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  writeBatch, 
  getDocs,
  addDoc,
  serverTimestamp
} from '../firebase.js';
import { icon } from '../icons.js';
import { cn } from '../utils.js';

export function renderCreatorDashboard(container) {
  const user = auth.currentUser;

  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  let series = [];
  let isLoading = true;
  let seriesToDelete = null;
  let isDeleting = false;
  let activeLangMenuId = null;
  let cardLanguages = {};
  let isCreatingLanguageDraft = null;

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
    </div>
  `;

  const q = query(
    collection(db, 'series'),
    where('creatorId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    series = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    isLoading = false;
    render();
  }, (err) => {
    console.error("Creator series snap error:", err);
    isLoading = false;
    render();
  });

  async function handleDeleteSeries() {
    if (!seriesToDelete || isDeleting) return;
    isDeleting = true;
    render();

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'series', seriesToDelete.id));

      const qEp = query(
        collection(db, 'episodes'), 
        where('seriesId', '==', seriesToDelete.id), 
        where('creatorId', '==', user.uid)
      );
      const epSnap = await getDocs(qEp);
      epSnap.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      seriesToDelete = null;
    } catch (e) {
      console.error("Error deleting series:", e);
      alert("Hubo un error al intentar eliminar la serie.");
    } finally {
      isDeleting = false;
      render();
    }
  }

  async function handlePublishInLanguage(originalSeries, targetLang) {
    if (isCreatingLanguageDraft === originalSeries.id) return;
    isCreatingLanguageDraft = originalSeries.id;
    render();

    try {
      const newSeriesData = {
        title: `${originalSeries.title} (${targetLang})`,
        description: originalSeries.description,
        thumbnail: originalSeries.thumbnail,
        language: targetLang,
        originalSeriesId: originalSeries.id,
        creatorId: user.uid,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'series'), newSeriesData);
      isCreatingLanguageDraft = null;
      window.location.hash = `#/creator/edit/${docRef.id}`;
    } catch (e) {
      console.error("Error creating language draft:", e);
      alert("Error al preparar la serie en otro idioma.");
      isCreatingLanguageDraft = null;
      render();
    }
  }

  function render() {
    const allOriginals = series.filter(s => !s.originalSeriesId);
    const allTranslations = series.filter(s => !!s.originalSeriesId);

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32">
        <div class="px-6 space-y-12 pt-10">
          <!-- Main Title Section -->
          <div class="space-y-1 text-center relative">
            <p class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-1">
              GESTIÓN DE CONTENIDO
            </p>
            <h1 class="text-[35px] font-black font-headline tracking-tighter uppercase italic leading-[32.6px]">
              Panel del<br />Creador
            </h1>
          </div>

          <!-- Create Series Button -->
          <div class="relative group">
            <div class="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <button 
              id="btn-creator-new-series"
              class="relative w-full py-5 bg-gradient-to-r from-[#00A3FF] to-[#00E5FF] rounded-[2rem] flex items-center justify-center gap-3 font-black text-surface-dim shadow-2xl active:scale-[0.98] transition-all cursor-pointer"
            >
              <div class="bg-surface-dim/20 p-1 rounded-full">
                ${icon('plus', { size: 20, strokeWidth: 4 })}
              </div>
              <span class="text-lg">Crear nueva serie</span>
            </button>
          </div>

          <!-- List Section -->
          <section class="space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Series creadas</h3>
              <button class="p-3 bg-surface-container-high/40 rounded-2xl text-on-surface-variant active:scale-95 transition-transform cursor-pointer">
                ${icon('filter', { size: 20 })}
              </button>
            </div>

            <div class="space-y-8">
              ${isLoading ? `
                <div class="flex flex-col items-center justify-center py-20 opacity-60">
                  <div class="animate-spin text-primary mb-3">${icon('loader2', { size: 32 })}</div>
                  <p class="text-xs uppercase font-black tracking-widest text-primary">Cargando Series...</p>
                </div>
              ` : allOriginals.length === 0 ? `
                <div class="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem] space-y-4">
                  <p class="text-xs font-black uppercase tracking-widest text-white/40">No tienes series creadas todavía</p>
                </div>
              ` : allOriginals.map(item => {
                const activeLang = cardLanguages[item.id] || item.language || 'Español';
                const translationDoc = activeLang === (item.language || 'Español')
                  ? item
                  : allTranslations.find(t => t.originalSeriesId === item.id && t.language === activeLang);
                
                if (!translationDoc) {
                  // Draft Creation Placeholder
                  let label = 'Agregar serie en Español';
                  if (activeLang === 'Inglés') label = 'Add series in English';
                  
                  return `
                    <div class="relative bg-surface-container-high/20 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/5 shadow-xl transition-all duration-300 overflow-hidden min-h-[350px] flex flex-col justify-between">
                      <button
                        data-publish-lang="${item.id}" data-publish-target="${activeLang}"
                        class="w-full flex-1 flex flex-col items-center justify-center text-center p-8 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] border border-dashed border-primary/30 rounded-[2rem] space-y-6 cursor-pointer transition-all min-h-[250px]"
                      >
                        ${isCreatingLanguageDraft === item.id ? `
                          <div class="flex flex-col items-center space-y-4">
                            ${icon('loader2', { size: 36, className: 'animate-spin text-primary' })}
                            <span class="text-xs text-primary/85 uppercase font-black tracking-widest">Creando borrador...</span>
                          </div>
                        ` : `
                          <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/5">
                            ${icon('plus', { size: 32, className: 'text-primary animate-pulse', strokeWidth: 3 })}
                          </div>
                          <span class="text-base sm:text-lg font-black font-headline text-white uppercase italic tracking-tight leading-snug">${label}</span>
                        `}
                      </button>
                      <div class="pt-4 border-t border-white/5 flex justify-end">
                        <button 
                          data-cancel-lang="${item.id}"
                          class="text-xs text-red-400 hover:text-red-300 uppercase font-black tracking-wider cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  `;
                }

                // Normal Document View (Original or Translation)
                const isPub = (translationDoc.status || '').toLowerCase() === 'publicado' || (translationDoc.status || '').toLowerCase() === 'publicada';
                const isInRev = (translationDoc.status || '').toLowerCase() === 'in_review' || (translationDoc.status || '').toLowerCase() === 'en revisión';
                const isRej = (translationDoc.status || '').toLowerCase() === 'rejected' || (translationDoc.status || '').toLowerCase() === 'rechazado';

                return `
                  <div class="bg-surface-container-low/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 space-y-6 relative overflow-hidden shadow-xl">
                    <!-- Globe button -->
                    <div class="absolute top-4 right-4 z-30">
                      <button 
                        data-globe-btn="${item.id}"
                        class="${cn(
                          "p-3 bg-black/60 hover:bg-black/80 active:scale-90 backdrop-blur-md rounded-2xl text-primary border transition-all cursor-pointer shadow-lg",
                          activeLangMenuId === item.id ? "border-primary/60 scale-105" : "border-white/10"
                        )}"
                        title="Publicar en otro idioma"
                      >
                        ${icon('globe', { size: 18 })}
                      </button>

                      ${activeLangMenuId === item.id ? `
                        <div class="absolute right-0 mt-2 w-48 bg-surface-container-highest/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl z-30">
                          <div class="px-3 py-1.5 text-[9px] font-black text-on-surface-variant/40 uppercase tracking-wider border-b border-white/5 mb-1">
                            Publicar en otro idioma
                          </div>
                          ${['Español', 'Inglés'].map(lang => {
                            const isCurrent = activeLang === lang;
                            return `
                              <button
                                data-lang-select="${item.id}" data-lang="${lang}"
                                ${isCurrent ? 'disabled' : ''}
                                class="${cn(
                                  "w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors",
                                  isCurrent ? "text-primary/40 cursor-default" : "text-white hover:bg-white/5 hover:text-primary cursor-pointer"
                                )}"
                              >
                                <span>${lang}</span>
                                ${isCurrent ? '<span class="text-[8px] px-2 py-0.5 bg-primary/10 rounded text-primary">Actual</span>' : ''}
                              </button>
                            `;
                          }).join('')}
                        </div>
                      ` : ''}
                    </div>

                    <!-- Thumbnail -->
                    <div class="relative aspect-video rounded-[2.2rem] overflow-hidden shadow-2xl">
                      <img 
                        src="${translationDoc.thumbnail || '/Categorias/Ciencia Ficcion.png'}" 
                        class="w-full h-full object-cover" 
                        alt="${translationDoc.title}"
                        referrerpolicy="no-referrer"
                      />
                      <div class="absolute inset-0 bg-black/10"></div>
                    </div>

                    <!-- Content -->
                    <div class="space-y-4 flex-1 flex flex-col justify-between">
                      <div class="space-y-4">
                        <div class="flex flex-wrap gap-2">
                          <span class="px-4 py-1.5 bg-[#1A3A4A] text-primary text-[10px] font-black rounded-xl uppercase tracking-widest">
                            ${translationDoc.category || 'PODCAST'}
                          </span>
                          <span class="${cn(
                            "px-4 py-1.5 text-[10px] font-black rounded-xl uppercase tracking-widest",
                            isPub && "bg-green-500/10 text-green-500 border border-green-500/20",
                            isInRev && "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20",
                            isRej && "bg-red-500/10 text-red-500 border border-red-500/20",
                            (!isPub && !isInRev && !isRej) && "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                          )}">
                            ${isPub ? 'PUBLICADO' : (isInRev ? 'EN REVISIÓN' : (isRej ? 'RECHAZADO' : 'BORRADOR'))}
                          </span>
                        </div>

                        <div class="space-y-2">
                          <h4 class="text-[25px] font-black font-headline leading-none uppercase tracking-tight">
                            ${translationDoc.title}
                          </h4>
                          <p class="text-sm text-on-surface-variant font-medium opacity-60 line-clamp-2">
                            ${translationDoc.description || 'Sin descripción disponible.'}
                          </p>
                        </div>
                      </div>

                      <!-- Actions -->
                      <div class="pt-2 flex flex-col gap-2">
                        <div class="flex gap-2">
                          <button 
                            data-manage-series="${translationDoc.id}"
                            ${!isPub ? 'disabled' : ''}
                            class="${cn(
                              "flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.2rem] font-black text-xs uppercase tracking-[0.15em] transition-all",
                              isPub ? "bg-white/5 hover:bg-white/10 text-primary shadow-lg shadow-primary/5 active:scale-[0.98] cursor-pointer border border-white/5" : "bg-white/[0.02] text-white/10 cursor-not-allowed border border-white/5"
                            )}"
                          >
                            ${isPub ? `${icon('list', { size: 18, strokeWidth: 3 })} ADMINISTRAR` : `${icon('lock', { size: 16, strokeWidth: 3, className: 'text-white/20' })} ESPERANDO APROBACIÓN`}
                          </button>
                        </div>

                        <div class="flex gap-2">
                          ${(!isPub) ? `
                            <button 
                              data-edit-series="${translationDoc.id}"
                              class="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-[1rem] text-primary transition-all active:scale-[0.98] border border-white/5 cursor-pointer text-[10px] font-black uppercase tracking-widest"
                              title="Editar Serie"
                            >
                              ${icon('edit3', { size: 18, strokeWidth: 3 })}
                              EDITAR SERIE
                            </button>
                          ` : ''}

                          <button 
                            data-delete-series="${translationDoc.id}"
                            class="${cn(
                              "flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 py-3 rounded-[1rem] text-red-500 transition-all active:scale-[0.98] border border-red-500/10 cursor-pointer text-[10px] font-black uppercase tracking-widest",
                              isPub ? "w-full" : "px-5"
                            )}"
                            title="Eliminar Serie"
                          >
                            ${icon('trash2', { size: 18, strokeWidth: 3 })}
                            ${isPub ? 'ELIMINAR SERIE' : ''}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>
        </div>

        <!-- Delete Modal -->
        ${seriesToDelete ? `
          <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20">
            <div class="absolute inset-0 bg-black/80 backdrop-blur-md" id="delete-modal-backdrop"></div>
            <div class="relative w-full max-w-sm bg-surface-container-highest rounded-[3rem] p-8 border border-white/5 shadow-2xl text-center space-y-6 overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
              
              <div class="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 relative">
                <div class="absolute inset-0 bg-red-500/20 blur-xl rounded-full"></div>
                ${icon('alertTriangle', { size: 40, className: 'text-red-500 relative z-10' })}
              </div>

              <div class="space-y-2">
                <h3 class="text-2xl font-black font-headline uppercase italic text-white tracking-tight">¿Eliminar Serie?</h3>
                <p class="text-xs text-on-surface-variant font-medium leading-relaxed opacity-70">
                  Esta acción eliminará permanentemente la serie <strong class="text-white font-bold">"${seriesToDelete.title}"</strong> y todos sus episodios asociados.
                </p>
              </div>

              <div class="flex flex-col gap-3 pt-2">
                <button 
                  id="btn-confirm-delete-series"
                  class="w-full py-4 bg-red-500 text-white font-black uppercase tracking-widest text-xs rounded-full active:scale-95 transition-all shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  ${isDeleting ? icon('loader2', { size: 16, className: 'animate-spin mx-auto' }) : 'Eliminar permanentemente'}
                </button>
                <button 
                  id="btn-cancel-delete-series"
                  class="w-full py-4 bg-white/5 text-white/40 font-black uppercase tracking-widest text-xs rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('btn-creator-new-series')?.addEventListener('click', () => {
      window.location.hash = '#/creator/new-series';
    });

    document.getElementById('delete-modal-backdrop')?.addEventListener('click', () => {
      seriesToDelete = null;
      render();
    });
    document.getElementById('btn-cancel-delete-series')?.addEventListener('click', () => {
      seriesToDelete = null;
      render();
    });
    document.getElementById('btn-confirm-delete-series')?.addEventListener('click', handleDeleteSeries);

    container.querySelectorAll('[data-delete-series]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-series');
        seriesToDelete = series.find(s => s.id === id);
        render();
      });
    });

    container.querySelectorAll('[data-manage-series]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-manage-series');
        window.location.hash = `#/creator/manage/${id}`;
      });
    });

    container.querySelectorAll('[data-edit-series]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-series');
        window.location.hash = `#/creator/edit/${id}`;
      });
    });

    // Globe Button
    container.querySelectorAll('[data-globe-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-globe-btn');
        activeLangMenuId = activeLangMenuId === id ? null : id;
        render();
      });
    });

    // Lang Menu Item
    container.querySelectorAll('[data-lang-select]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-lang-select');
        const lang = btn.getAttribute('data-lang');
        cardLanguages[id] = lang;
        activeLangMenuId = null;
        render();
      });
    });

    // Click outside to close language menu
    container.addEventListener('click', () => {
      if (activeLangMenuId) {
        activeLangMenuId = null;
        render();
      }
    }, { once: true });

    // Cancel draft creation
    container.querySelectorAll('[data-cancel-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cancel-lang');
        const s = allOriginals.find(o => o.id === id);
        if (s) {
          cardLanguages[id] = s.language || 'Español';
          render();
        }
      });
    });

    // Handle Publish in Language
    container.querySelectorAll('[data-publish-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-publish-lang');
        const targetLang = btn.getAttribute('data-publish-target');
        const s = allOriginals.find(o => o.id === id);
        if (s) {
          handlePublishInLanguage(s, targetLang);
        }
      });
    });
  }

  return () => unsubscribe();
}
