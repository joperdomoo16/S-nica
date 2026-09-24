import { 
  db, 
  auth, 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  writeBatch, 
  getDocs, 
  updateDoc, 
  storage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from '../firebase.js';
import { icon } from '../icons.js';
import { optimizeImage } from '../utils.js';

export function renderManageEpisodes(container, seriesId) {
  const user = auth.currentUser;
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  let seriesData = null;
  let episodes = [];
  let isLoading = true;

  let episodeToDelete = null;
  let showDeleteModal = false;

  let episodeToEdit = null;
  let editTitle = '';
  let editDescription = '';
  let editImageFile = null;
  let editImagePreview = null;
  let isEditing = false;

  let unsubSeries = null;
  let unsubEpisodes = null;

  function init() {
    unsubSeries = onSnapshot(doc(db, 'series', seriesId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.creatorId !== user.uid) {
          window.location.hash = '#/creator';
          return;
        }
        seriesData = { id: snapshot.id, ...data };
      } else {
        window.location.hash = '#/creator';
        return;
      }
      render();
    }, (error) => {
      console.warn("ManageEpisodes series snap error:", error);
      window.location.hash = '#/creator';
    });

    const q = query(
      collection(db, 'episodes'),
      where('seriesId', '==', seriesId)
    );

    unsubEpisodes = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Ordenar en memoria para evitar requerir un índice compuesto en Firestore
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      episodes = list;
      isLoading = false;
      render();
    }, (error) => {
      console.warn("ManageEpisodes episodes snap error:", error);
      isLoading = false;
      render();
    });
  }

  function getStatusStyle(status) {
    const s = (status || '').toLowerCase();
    if (s === 'in_review' || s === 'en revisión') {
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    }
    if (s === 'rejected' || s === 'rechazado') {
      return "bg-red-500/10 text-red-500 border-red-500/20";
    }
    if (s === 'draft' || s === 'borrador') {
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
    return "bg-cyan-400/10 text-cyan-400 border-cyan-400/20";
  }

  function getStatusLabel(status) {
    const s = (status || '').toLowerCase();
    if (s === 'publicado' || s === 'publicada') return 'PUBLICADO';
    if (s === 'in_review' || s === 'en revisión') return 'EN REVISIÓN';
    if (s === 'draft' || s === 'borrador') return 'BORRADOR';
    return (status || 'PUBLICADO').toUpperCase();
  }

  async function confirmDelete() {
    if (episodeToDelete) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'episodes', episodeToDelete));

        const qComments = query(collection(db, 'comments'), where('episodeId', '==', episodeToDelete));
        const commentsSnap = await getDocs(qComments);
        commentsSnap.docs.forEach(d => {
          batch.delete(d.ref);
        });

        await batch.commit();
        showDeleteModal = false;
        episodeToDelete = null;
        render();
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  }

  async function confirmEdit() {
    if (episodeToEdit) {
      isEditing = true;
      render();

      try {
        let finalImageUrl = episodeToEdit.imageUrl || '';
        
        if (editImageFile) {
           const reader = new FileReader();
           const base64 = await new Promise((resolve, reject) => {
             reader.onload = () => resolve(reader.result);
             reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
             reader.readAsDataURL(editImageFile);
           });
           
           const optimizedBase64 = await optimizeImage(base64, 800, 800, 0.7);
           const arr = optimizedBase64.split(',');
           const mimeMatch = arr[0].match(/:(.*?);/);
           const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
           const bstr = atob(arr[1]);
           let n = bstr.length;
           const u8arr = new Uint8Array(n);
           while (n--) {
             u8arr[n] = bstr.charCodeAt(n);
           }
           const blob = new Blob([u8arr], { type: mime });
           
           const ext = mime === 'image/png' ? 'png' : 'jpg';
           const imagePath = `episodes/${user.uid}/${seriesId}/${Date.now()}_cover.${ext}`;
           const imageRef = ref(storage, imagePath);
           const metadata = { contentType: mime, cacheControl: 'public, max-age=300' };
           const uploadTask = uploadBytesResumable(imageRef, blob, metadata);
           await uploadTask;
           finalImageUrl = await getDownloadURL(imageRef);
        }

        const updateData = {
          title: editTitle,
          description: editDescription,
        };
        
        let needsReview = false;
        
        if (editImageFile) {
          updateData.imageUrl = finalImageUrl;
          updateData.thumbnail = finalImageUrl;
          needsReview = true;
        }
        
        if (episodeToEdit.title !== editTitle || episodeToEdit.description !== editDescription) {
          needsReview = true;
        }

        if (episodeToEdit.status === 'publicado' && needsReview) {
          updateData.status = 'in_review';
        }

        await updateDoc(doc(db, 'episodes', episodeToEdit.id), updateData);
        
        if (updateData.status === 'in_review' && episodeToEdit.status === 'publicado') {
          alert("Los cambios se han guardado. Al haber modificado la información, el capítulo ha sido enviado nuevamente a moderación. Volverá a ser público cuando sea aprobado.");
        }
        
        episodeToEdit = null;
      } catch (error) {
        alert("Error al guardar: " + (error.message || "Error desconocido"));
        console.error("Edit Error:", error);
      } finally {
        isEditing = false;
        render();
      }
    }
  }

  function render() {
    if (isLoading || !seriesData) {
      container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-surface-dim">
          <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
        </div>
      `;
      return;
    }

    const nextEpisodeNumber = (episodes.reduce((max, ep) => {
      const num = parseInt(ep.number);
      return !isNaN(num) && num > max ? num : max;
    }, 0) + 1).toString().padStart(2, '0');

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-24 pt-8 px-6 space-y-16">
        
        <!-- Header con botón volver -->
        <div class="fixed top-0 left-0 w-full h-20 bg-surface-dim/80 backdrop-blur-md z-40 flex items-center px-6">
           <button id="btn-back-manage" class="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-primary active:scale-95 transition-all cursor-pointer">
             ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
           </button>
        </div>

        <div class="pt-8"></div>

        <!-- Series Hero Section -->
        <div class="mb-0">
          <div class="relative rounded-[3rem] overflow-hidden p-10 min-h-[340px] flex flex-col justify-end border border-white/5 shadow-2xl">
            <!-- Background Image with Overlay -->
            <div class="absolute inset-0 z-0">
              <img 
                src="${seriesData.thumbnail || '/Categorias/Ciencia Ficcion.png'}" 
                alt="" 
                class="w-full h-full object-cover opacity-30 blur-sm scale-110"
                referrerpolicy="no-referrer"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
            </div>

            <div class="relative z-10 space-y-6">
              <div class="space-y-1">
                <p class="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] opacity-80">
                  ${getStatusLabel(seriesData.status)}
                </p>
                <h1 class="text-3xl font-black font-headline text-white tracking-tighter uppercase italic leading-tight line-clamp-2">
                  ${seriesData.title}
                </h1>
              </div>

              <p class="text-on-surface-variant text-xs font-medium opacity-70 leading-relaxed max-w-[260px] line-clamp-3">
                ${seriesData.description || 'Sin descripción disponible.'}
              </p>

              <div class="flex flex-col gap-3 pt-4">
                <button 
                  id="btn-add-episode"
                  class="w-full py-4 primary-gradient rounded-full flex items-center justify-center gap-2 font-black text-surface-dim shadow-xl active:scale-95 transition-transform text-xs uppercase tracking-widest cursor-pointer shadow-cyan-400/20"
                >
                  ${icon('plus', { size: 18, strokeWidth: 3 })}
                  Agregar Nuevo Capítulo
                </button>
                
                <button class="w-full py-4 bg-surface-container-high/40 border border-white/10 rounded-full flex items-center justify-center gap-2 font-black text-white active:scale-95 transition-transform backdrop-blur-md text-xs uppercase tracking-widest cursor-pointer">
                  ${icon('checkCircle2', { size: 16, className: 'text-cyan-400' })}
                  Finalizar Temporada
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Published Episodes Header -->
        <div class="px-2 mb-8 flex items-end justify-between">
          <h2 class="text-2xl leading-tight font-black font-headline text-white tracking-tighter uppercase italic">
            Episodios<br />Publicados
          </h2>
        </div>

        <!-- Episodes List -->
        <div class="space-y-6">
          ${episodes.length === 0 ? `
            <div class="text-center py-10 opacity-40 italic">
              No hay episodios todavía en esta serie.
            </div>
          ` : ''}
          
          ${episodes.map((episode) => `
            <div class="bg-surface-container-high/20 rounded-[2.5rem] p-8 border border-white/5 relative group transition-all">
              <!-- Top Info -->
              <div class="flex items-start justify-between mb-4 gap-4">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                  <div class="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/5 flex-shrink-0 shadow-lg">
                    <img 
                      src="${episode.imageUrl || seriesData.thumbnail}" 
                      alt="" 
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                    />
                  </div>
                  <div class="space-y-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        CAPÍTULO ${episode.number}
                      </span>
                      <span class="text-[10px] text-on-surface-variant/40 font-black tracking-widest truncate max-w-[100px]">
                        ${episode.duration || ''}
                      </span>
                    </div>
                    <h3 class="text-xl font-black font-headline text-white uppercase italic tracking-tight truncate">
                      ${episode.title}
                    </h3>
                  </div>
                </div>

                <div class="flex gap-2 shrink-0">
                  <button data-edit-id="${episode.id}" class="btn-edit p-3 bg-white/5 rounded-2xl text-on-surface-variant/60 hover:text-primary transition-colors hover:bg-white/10 active:scale-95 cursor-pointer">
                    ${icon('edit3', { size: 16 })}
                  </button>
                  <button data-delete-id="${episode.id}" class="btn-delete p-3 bg-white/5 rounded-2xl text-on-surface-variant/60 hover:text-red-500 transition-colors hover:bg-white/10 active:scale-95 cursor-pointer">
                    ${icon('trash2', { size: 16 })}
                  </button>
                </div>
              </div>

              <p class="text-xs text-on-surface-variant/70 leading-relaxed font-medium mb-8 line-clamp-2">
                ${episode.description || 'Sin descripción'}
              </p>

              <!-- Footer -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-on-surface-variant/40">
                  ${icon('calendar', { size: 12 })}
                  <span class="text-[9px] font-black tracking-widest">
                    ${episode.createdAt && episode.createdAt.toDate ? episode.createdAt.toDate().toLocaleDateString() : 'Pendiente'}
                  </span>
                </div>
                <span class="text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border ${getStatusStyle(episode.status)}">
                  ${getStatusLabel(episode.status)}
                </span>
              </div>
            </div>
          `).join('')}

          <!-- Empty State / Create Next Episode -->
          <div id="btn-create-next" class="border-2 border-dashed border-cyan-400/30 hover:border-cyan-400 bg-surface-container-high/20 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group mt-8">
            <div class="w-16 h-16 rounded-full bg-cyan-400/10 flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-black transition-all text-cyan-400 shadow-lg shadow-cyan-400/10">
              ${icon('plusCircle', { size: 28, strokeWidth: 2.5 })}
            </div>
            <div class="text-center space-y-1">
              <h4 class="text-base font-black text-white uppercase italic tracking-tight">
                Crear Capítulo ${nextEpisodeNumber}
              </h4>
              <p class="text-[10px] text-cyan-400 font-black uppercase tracking-widest">
                ${icon('sparkles', { size: 12, className: 'inline mr-1' })} Con Voz IA o archivo de audio
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Contenedor de Modales
    let modalsHTML = '';

    if (showDeleteModal) {
      modalsHTML += `
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20">
          <div id="modal-bg-delete" class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
          <div class="relative w-full max-w-sm bg-[#1c1d21] rounded-[2.5rem] p-8 border border-white/10 shadow-2xl text-center space-y-6">
            <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              ${icon('alert-circle', { size: 40, className: 'text-red-500' })}
            </div>
            <div class="space-y-4">
              <h3 class="text-2xl font-black font-headline text-white tracking-tight uppercase italic">
                ¿Eliminar Capítulo?
              </h3>
              <div class="space-y-3">
                <p class="text-sm text-on-surface-variant leading-relaxed font-medium">
                  Â¿Seguro que desea eliminar? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-3 pt-4">
              <button id="btn-confirm-delete" class="w-full h-14 bg-red-500 text-white text-sm font-black uppercase tracking-widest rounded-full active:scale-95 transition-all shadow-lg shadow-red-500/20 cursor-pointer">
                Aceptar
              </button>
              <button id="btn-cancel-delete" class="w-full h-14 bg-white/5 text-white/60 text-sm font-black uppercase tracking-widest rounded-full active:scale-95 hover:bg-white/10 transition-all border border-white/5 cursor-pointer">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (episodeToEdit && !showDeleteModal) {
      modalsHTML += `
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20">
          <div id="modal-bg-edit" class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
          <div class="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-surface-container-highest rounded-[2.5rem] p-8 border border-white/10 shadow-2xl space-y-6">
            <h3 class="text-2xl font-black font-headline text-white tracking-tight uppercase italic text-center">
              Editar Capítulo
            </h3>
            
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-4">
                  Título del Capítulo
                </label>
                <input type="text" id="edit-title" value="${editTitle}" class="w-full h-14 bg-black/20 border border-white/5 rounded-2xl px-4 text-sm font-medium text-white focus:outline-none focus:border-primary/50 transition-colors" />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-4">
                  Portada (Opcional)
                </label>
                <label class="w-full h-40 rounded-2xl bg-black/20 border border-white/5 flex flex-col items-center justify-center cursor-pointer group overflow-hidden relative transition-colors hover:border-primary/50">
                  <input type="file" id="edit-image-upload" accept="image/*" class="hidden" />
                  ${editImagePreview ? `
                    <img src="${editImagePreview}" alt="Preview" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
                  ` : `
                    <div class="flex flex-col items-center justify-center text-on-surface-variant/40 group-hover:text-primary/60 transition-colors">
                      ${icon('image-plus', { size: 28, className: 'mb-3' })}
                      <span class="text-[10px] font-black uppercase tracking-widest">Cambiar Imagen</span>
                    </div>
                  `}
                </label>
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-4">
                  Descripción
                </label>
                <textarea id="edit-desc" class="w-full h-32 bg-black/20 border border-white/5 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:border-primary/50 transition-colors resize-none">${editDescription}</textarea>
              </div>
            </div>

            <div class="flex flex-col gap-3 pt-6 border-t border-white/5">
              <button id="btn-cancel-edit" class="w-full py-4 rounded-full bg-white/5 text-white/40 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors active:scale-95 cursor-pointer">
                Cancelar
              </button>
              <button id="btn-confirm-edit" ${isEditing ? 'disabled' : ''} class="w-full py-4 rounded-full primary-gradient text-surface-dim font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                ${isEditing ? icon('loader2', { size: 16, className: 'animate-spin' }) : icon('check-circle2', { size: 16 })}
                ${isEditing ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (modalsHTML) {
      const modalWrapper = document.createElement('div');
      modalWrapper.innerHTML = modalsHTML;
      container.appendChild(modalWrapper);
    }

    bindEvents();
  }

  function bindEvents() {
    // Acciones de la barra superior
    const btnBack = document.getElementById('btn-back-manage');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.location.hash = '#/creator';
      });
    }

    // Acciones de Nuevo Episodio
    const btnAdd = document.getElementById('btn-add-episode');
    const btnCreateNext = document.getElementById('btn-create-next');
    const goToUpload = () => { window.location.hash = `#/creator/upload/${seriesId}`; };
    
    if (btnAdd) btnAdd.addEventListener('click', goToUpload);
    if (btnCreateNext) btnCreateNext.addEventListener('click', goToUpload);

    // Acciones de la lista
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-delete-id');
        episodeToDelete = id;
        showDeleteModal = true;
        render();
      });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-edit-id');
        const ep = episodes.find(e => e.id === id);
        if (ep) {
          episodeToEdit = ep;
          editTitle = ep.title || '';
          editDescription = ep.description || '';
          editImageFile = null;
          editImagePreview = ep.imageUrl || seriesData?.thumbnail || null;
          render();
        }
      });
    });

    // Modal de Eliminación
    if (showDeleteModal) {
      document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
        showDeleteModal = false;
        episodeToDelete = null;
        render();
      });
      document.getElementById('modal-bg-delete')?.addEventListener('click', () => {
        showDeleteModal = false;
        episodeToDelete = null;
        render();
      });
      document.getElementById('btn-confirm-delete')?.addEventListener('click', confirmDelete);
    }

    // Modal de Edición
    if (episodeToEdit && !showDeleteModal) {
      document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
        episodeToEdit = null;
        render();
      });
      document.getElementById('modal-bg-edit')?.addEventListener('click', () => {
        episodeToEdit = null;
        render();
      });
      
      const titleInput = document.getElementById('edit-title');
      const descInput = document.getElementById('edit-desc');
      const imgUpload = document.getElementById('edit-image-upload');

      if (titleInput) titleInput.addEventListener('input', (e) => editTitle = e.target.value);
      if (descInput) descInput.addEventListener('input', (e) => editDescription = e.target.value);
      
      if (imgUpload) {
        imgUpload.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) {
            editImageFile = file;
            const reader = new FileReader();
            reader.onloadend = () => {
              editImagePreview = reader.result;
              render(); // Volver a renderizar para mostrar la vista previa
            };
            reader.readAsDataURL(file);
          }
        });
      }

      document.getElementById('btn-confirm-edit')?.addEventListener('click', confirmEdit);
    }
  }

  init();

  return () => {
    if (unsubSeries) unsubSeries();
    if (unsubEpisodes) unsubEpisodes();
  };
}

