import { db, auth, collection, query, where, getDocs, doc, getDoc } from '../firebase.js';
import { openAuthModal } from '../components/auth-modal.js';
import { playEpisode } from '../player.js';

export async function renderLibrary(container) {
  if (!auth.currentUser) {
    container.innerHTML = `
      <div class="view-container" style="text-align: center; padding: 5rem 1rem;">
        <h2 style="font-family: var(--font-heading); font-size: 1.8rem; margin-bottom: 0.75rem;">Tu Biblioteca Personal</h2>
        <p class="text-muted" style="max-width: 460px; margin: 0 auto 1.75rem;">Inicia sesión para guardar tus series favoritas, retomar tus episodios pendientes y seguir a creadores de podcasts.</p>
        <button class="btn btn-primary btn-lg" id="lib-login-btn">
          Iniciar Sesión
        </button>
      </div>
    `;

    document.getElementById('lib-login-btn')?.addEventListener('click', () => {
      openAuthModal('login');
    });
    return;
  }

  container.innerHTML = `
    <div class="view-loading-spinner">
      <div class="loader-disc">
        <img src="/logo.png" alt="Sónica" class="loader-logo">
      </div>
      <p class="loader-text">Cargando tu biblioteca...</p>
    </div>
  `;

  try {
    // 1. Fetch saved library series
    const qLib = query(collection(db, 'library'), where('userId', '==', auth.currentUser.uid));
    const libSnaps = await getDocs(qLib);
    const seriesIds = libSnaps.docs.map(d => d.data().seriesId).filter(Boolean);

    let savedSeries = [];
    if (seriesIds.length > 0) {
      const seriesPromises = seriesIds.map(id => getDoc(doc(db, 'series', id)));
      const seriesDocs = await Promise.all(seriesPromises);
      savedSeries = seriesDocs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
    }

    // 2. Fetch listening history
    let history = [];
    const uSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (uSnap.exists()) {
      history = uSnap.data().listeningHistory || [];
    }

    container.innerHTML = `
      <div class="view-container">
        <div class="section-header">
          <div>
            <h1 class="section-title" style="font-size: 1.8rem;">
              <span class="section-title-dot"></span>
              Mi Biblioteca
            </h1>
            <p class="text-muted">Tus podcasts, historias guardadas y progreso de escucha</p>
          </div>
        </div>

        <!-- Listening History -->
        ${history.length > 0 ? `
          <section>
            <h2 class="section-title" style="font-size: 1.2rem; margin-bottom: 1rem;">Historial de Reproducción</h2>
            <div class="horizontal-scroll">
              ${history.map(item => `
                <div class="history-card" data-episode-id="${item.episodeId}" data-series-id="${item.seriesId}">
                  <img src="${item.thumbnail || '/logo.png'}" class="history-thumb">
                  <div class="history-info">
                    <h4 class="history-title">${item.episodeTitle}</h4>
                    <p class="history-series">${item.seriesTitle}</p>
                    <div class="history-progress">
                      <div class="history-progress-bar" style="width: ${item.progress || 0}%"></div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Saved Series -->
        <section>
          <h2 class="section-title" style="font-size: 1.2rem; margin-bottom: 1rem;">Series Guardadas (${savedSeries.length})</h2>
          <div class="series-grid">
            ${savedSeries.length > 0 ? savedSeries.map(s => `
              <div class="series-card" data-series-id="${s.id}">
                <div class="series-thumb-wrap">
                  <img src="${s.thumbnail || '/Categorias/Ciencia Ficcion.png'}" alt="${s.title}" class="series-thumb">
                  <div class="series-card-play-overlay">
                    <div class="series-play-btn-circle">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </div>
                  </div>
                </div>
                <div class="series-body">
                  <h3 class="series-card-title">${s.title}</h3>
                  <p class="series-card-author">${s.creatorName || 'Sónica Creador'}</p>
                  <div class="series-card-footer">
                    <span class="series-rating">★ ${s.rating ? s.rating.toFixed(1) : '5.0'}</span>
                    <span>${s.views || 0} vistas</span>
                  </div>
                </div>
              </div>
            `).join('') : `
              <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
                <p class="text-muted" style="margin-bottom: 1rem;">Aún no has guardado ninguna serie en tu biblioteca.</p>
                <a href="#/explore" class="btn btn-secondary btn-sm">Explorar Catálogo</a>
              </div>
            `}
          </div>
        </section>
      </div>
    `;

    // Bind series clicks
    container.querySelectorAll('.series-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-series-id');
        if (id) window.location.hash = `#/series/${id}`;
      });
    });

    // Bind history clicks
    container.querySelectorAll('.history-card').forEach(card => {
      card.addEventListener('click', () => {
        const epId = card.getAttribute('data-episode-id');
        const item = history.find(h => h.episodeId === epId);
        if (item) {
          playEpisode({
            id: item.episodeId,
            title: item.episodeTitle,
            audioUrl: item.audioUrl,
            imageUrl: item.thumbnail,
            seriesId: item.seriesId
          }, {
            id: item.seriesId,
            title: item.seriesTitle,
            thumbnail: item.thumbnail
          });
        }
      });
    });

  } catch (err) {
    console.error("Library render error:", err);
  }
}
