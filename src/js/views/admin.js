import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp 
} from '../firebase.js';
import { isCurrentUserAdmin } from '../auth.js';
import { showToast } from '../components/toast.js';

export async function renderAdmin(container) {
  if (!auth.currentUser || !isCurrentUserAdmin()) {
    container.innerHTML = `
      <div class="view-container" style="text-align: center; padding: 5rem 1rem;">
        <h2 style="color: var(--accent-red); margin-bottom: 0.75rem;">Acceso Restringido</h2>
        <p class="text-muted" style="margin-bottom: 1.5rem;">Se requieren privilegios de administrador para acceder a esta área de moderación.</p>
        <a href="#/" class="btn btn-primary">Volver al Inicio</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="view-loading-spinner">
      <div class="loader-disc">
        <img src="/logo.png" alt="Sónica" class="loader-logo">
      </div>
      <p class="loader-text">Cargando cola de moderación...</p>
    </div>
  `;

  try {
    // 1. Pending Series
    const qSeries = query(collection(db, 'series'), where('status', '==', 'pending'));
    const sSnaps = await getDocs(qSeries).catch(() => ({ docs: [] }));
    const pendingSeries = sSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Pending Episodes
    const qEpisodes = query(collection(db, 'episodes'), where('status', '==', 'pending'));
    const epSnaps = await getDocs(qEpisodes).catch(() => ({ docs: [] }));
    const pendingEpisodes = epSnaps.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div class="view-container">
        <div class="section-header">
          <div>
            <h1 class="section-title" style="font-size: 1.8rem; color: #f87171;">
              <span class="section-title-dot" style="background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
              Panel de Moderación
            </h1>
            <p class="text-muted">Revisión de contenidos pendientes de publicación</p>
          </div>
        </div>

        <!-- Pending Series Queue -->
        <section>
          <div class="section-header">
            <h2 class="section-title" style="font-size: 1.25rem;">
              Series Pendientes de Aprobación (${pendingSeries.length})
            </h2>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${pendingSeries.length > 0 ? pendingSeries.map(s => `
              <div class="card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 250px;">
                  <img src="${s.thumbnail || '/Categorias/Ciencia Ficcion.png'}" style="width: 64px; height: 64px; border-radius: var(--radius-md); object-fit: cover;">
                  <div>
                    <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 2px;">${s.title}</h3>
                    <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">Por: ${s.creatorName || s.creatorEmail || 'Creador'}</p>
                    <span class="badge badge-amber">${s.category || 'Podcast'}</span>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <button class="btn btn-primary btn-sm btn-review-series" data-id="${s.id}">
                    Revisar Serie
                  </button>
                </div>
              </div>
            `).join('') : `
              <div class="card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                No hay series pendientes en la cola de moderación.
              </div>
            `}
          </div>
        </section>

        <!-- Pending Episodes Queue -->
        <section>
          <div class="section-header">
            <h2 class="section-title" style="font-size: 1.25rem;">
              Episodios Pendientes de Aprobación (${pendingEpisodes.length})
            </h2>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${pendingEpisodes.length > 0 ? pendingEpisodes.map(ep => `
              <div class="card" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                  <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 3px;">${ep.title}</h3>
                  <p style="font-size: 0.8rem; color: var(--text-muted);">Episodio #${ep.number || 1} • Creador: ${ep.creatorId}</p>
                  ${ep.audioUrl ? `
                    <audio controls src="${ep.audioUrl}" style="margin-top: 0.65rem; height: 32px; width: 100%; max-width: 320px;"></audio>
                  ` : ''}
                </div>

                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <button class="btn btn-primary btn-sm btn-review-episode" data-id="${ep.id}">
                    Revisar Capítulo
                  </button>
                </div>
              </div>
            `).join('') : `
              <div class="card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                No hay episodios pendientes de revisión.
              </div>
            `}
          </div>
        </section>
      </div>
    `;

    // Series Review
    container.querySelectorAll('.btn-review-series').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.location.hash = `#/admin/review/${id}`;
      });
    });

    // Episode Review
    container.querySelectorAll('.btn-review-episode').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.location.hash = `#/admin/review-episode/${id}`;
      });
    });

  } catch (err) {
    console.error("Admin view error:", err);
  }
}
