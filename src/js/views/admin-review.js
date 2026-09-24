import { 
  db, 
  auth, 
  doc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  addDoc 
} from '../firebase.js';
import { isCurrentUserAdmin } from '../auth.js';
import { icon } from '../icons.js';
import { showToast } from '../components/toast.js';

export function renderAdminSeriesReview(container, seriesId) {
  if (!isCurrentUserAdmin()) {
    window.location.hash = '#/';
    return;
  }

  let series = null;
  let isLoading = true;
  let unsub = null;

  function init() {
    unsub = onSnapshot(doc(db, 'series', seriesId), (snap) => {
      if (snap.exists()) {
        series = { id: snap.id, ...snap.data() };
      } else {
        window.location.hash = '#/admin';
      }
      isLoading = false;
      render();
    });
  }

  async function handleApprove() {
    try {
      await updateDoc(doc(db, 'series', series.id), {
        status: 'publicado',
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: series.creatorId,
        title: 'Â¡Serie Aprobada!',
        message: `Tu serie "${series.title}" ha sido aprobada y ya está disponible.`,
        type: 'success',
        read: false,
        createdAt: serverTimestamp(),
        link: `#/series/${series.id}`
      });

      showToast('Serie aprobada y publicada.', 'success');
      window.location.hash = '#/admin';
    } catch (e) {
      console.error(e);
      showToast('Error al aprobar serie.', 'error');
    }
  }

  async function handleReject() {
    const reason = prompt('Motivo de rechazo para el creador:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'series', series.id), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: series.creatorId,
        title: 'Serie Rechazada',
        message: `Tu serie "${series.title}" fue rechazada. Motivo: ${reason}`,
        type: 'error',
        read: false,
        createdAt: serverTimestamp(),
        link: `#/creator`
      });

      showToast('Serie rechazada.', 'info');
      window.location.hash = '#/admin';
    } catch (e) {
      console.error(e);
      showToast('Error al rechazar serie.', 'error');
    }
  }

  function render() {
    if (isLoading) {
      container.innerHTML = `<div class="min-h-screen flex items-center justify-center text-primary animate-spin">${icon('loader2', { size: 40 })}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32">
        <div class="px-6 pt-8 max-w-2xl mx-auto space-y-8">
          <div class="flex items-center gap-4">
            <button id="btn-back" class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-primary active:scale-95 transition-all">
              ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
            </button>
            <h1 class="text-2xl font-black uppercase italic">Revisión de Serie</h1>
          </div>

          <div class="bg-surface-container-high/40 rounded-[2rem] p-6 border border-white/5 space-y-6">
            <div class="flex gap-6">
              <div class="w-32 h-32 rounded-2xl overflow-hidden shrink-0">
                <img src="${series.thumbnail}" class="w-full h-full object-cover" />
              </div>
              <div class="space-y-2">
                <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em]">${series.category}</span>
                <h2 class="text-2xl font-black italic uppercase leading-none">${series.title}</h2>
                <p class="text-xs text-on-surface-variant font-medium">Por: ${series.creatorName || series.creatorEmail}</p>
                <div class="flex gap-2 flex-wrap pt-2">
                  ${(series.tags || []).map(t => `<span class="bg-white/5 px-2 py-1 rounded text-[10px] text-cyan-400 font-bold">${t}</span>`).join('')}
                </div>
              </div>
            </div>

            <div>
              <h3 class="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Sinopsis</h3>
              <p class="text-sm text-white/80">${series.description}</p>
            </div>

            <div class="flex gap-4 pt-4 border-t border-white/10">
              <button id="btn-approve" class="flex-1 bg-primary text-surface-dim font-black uppercase tracking-widest py-4 rounded-full active:scale-95 transition-all">
                Aprobar Serie
              </button>
              <button id="btn-reject" class="flex-1 bg-red-500/10 text-red-500 font-black uppercase tracking-widest py-4 rounded-full active:scale-95 transition-all">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-back')?.addEventListener('click', () => window.history.back());
    document.getElementById('btn-approve')?.addEventListener('click', handleApprove);
    document.getElementById('btn-reject')?.addEventListener('click', handleReject);
  }

  init();
  return () => { if(unsub) unsub(); };
}

export function renderAdminEpisodeReview(container, episodeId) {
  if (!isCurrentUserAdmin()) {
    window.location.hash = '#/';
    return;
  }

  let episode = null;
  let isLoading = true;
  let unsub = null;

  function init() {
    unsub = onSnapshot(doc(db, 'episodes', episodeId), (snap) => {
      if (snap.exists()) {
        episode = { id: snap.id, ...snap.data() };
      } else {
        window.location.hash = '#/admin';
      }
      isLoading = false;
      render();
    });
  }

  async function handleApprove() {
    try {
      await updateDoc(doc(db, 'episodes', episode.id), {
        status: 'published',
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: episode.creatorId,
        title: 'Â¡Capítulo Aprobado!',
        message: `El capítulo "${episode.title}" ha sido publicado.`,
        type: 'success',
        read: false,
        createdAt: serverTimestamp(),
        link: `#/episode/${episode.id}`
      });

      showToast('Capítulo aprobado.', 'success');
      window.location.hash = '#/admin';
    } catch (e) {
      console.error(e);
      showToast('Error al aprobar capítulo.', 'error');
    }
  }

  async function handleReject() {
    const reason = prompt('Motivo de rechazo:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'episodes', episode.id), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: episode.creatorId,
        title: 'Capítulo Rechazado',
        message: `El capítulo "${episode.title}" fue rechazado. Motivo: ${reason}`,
        type: 'error',
        read: false,
        createdAt: serverTimestamp(),
        link: `#/creator/manage/${episode.seriesId}`
      });

      showToast('Capítulo rechazado.', 'info');
      window.location.hash = '#/admin';
    } catch (e) {
      console.error(e);
      showToast('Error al rechazar capítulo.', 'error');
    }
  }

  function render() {
    if (isLoading) {
      container.innerHTML = `<div class="min-h-screen flex items-center justify-center text-primary animate-spin">${icon('loader2', { size: 40 })}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32">
        <div class="px-6 pt-8 max-w-2xl mx-auto space-y-8">
          <div class="flex items-center gap-4">
            <button id="btn-back" class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-primary active:scale-95 transition-all">
              ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
            </button>
            <h1 class="text-2xl font-black uppercase italic">Revisión de Capítulo</h1>
          </div>

          <div class="bg-surface-container-high/40 rounded-[2rem] p-6 border border-white/5 space-y-6">
            <h2 class="text-2xl font-black italic uppercase leading-none">${episode.title}</h2>
            
            <div class="bg-black/20 p-4 rounded-xl border border-white/5">
              <p class="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-2">Audio a revisar</p>
              <audio controls class="w-full" src="${episode.audioUrl}"></audio>
            </div>

            <div class="flex gap-4 pt-4 border-t border-white/10">
              <button id="btn-approve" class="flex-1 bg-primary text-surface-dim font-black uppercase tracking-widest py-4 rounded-full active:scale-95 transition-all">
                Aprobar Audio
              </button>
              <button id="btn-reject" class="flex-1 bg-red-500/10 text-red-500 font-black uppercase tracking-widest py-4 rounded-full active:scale-95 transition-all">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-back')?.addEventListener('click', () => window.history.back());
    document.getElementById('btn-approve')?.addEventListener('click', handleApprove);
    document.getElementById('btn-reject')?.addEventListener('click', handleReject);
  }

  init();
  return () => { if(unsub) unsub(); };
}
