import { renderHome } from './views/home.js';
import { renderExplore } from './views/explore.js';
import { renderCategory } from './views/category.js';
import { renderSeries } from './views/series.js';
import { renderEpisode } from './views/episode.js';
import { renderPlayerView } from './views/player.js';
import { renderSubscriptions } from './views/subscriptions.js';
import { renderProfile } from './views/profile.js';
import { renderAvatarPicker } from './views/avatar-picker.js';
import { renderCreatorDashboard } from './views/creator.js';
import { renderComments } from './views/comments.js';
import { renderFinances } from './views/finances.js';
import { renderNewSeries } from './views/new-series.js';
import { renderEditSeries } from './views/edit-series.js';
import { renderManageEpisodes } from './views/manage-episodes.js';
import { renderCreatorProfile } from './views/creator-profile.js';
import { renderUploadEpisode } from './views/upload-episode.js';
import { renderLogin } from './views/login.js';
import { renderRegister } from './views/register.js';
import { updateLayoutChrome } from './layout.js';

let currentCleanup = null;

export function initRouter() {
  const container = document.getElementById('app-view');

  async function handleRoute() {
    if (typeof currentCleanup === 'function') {
      try {
        currentCleanup();
      } catch (e) {
        console.warn('Cleanup error:', e);
      }
      currentCleanup = null;
    }

    if (!window.location.hash) { window.location.hash = '#/login'; return; }
    const rawHash = window.location.hash.slice(1);
    const [pathPart, queryPart] = rawHash.split('?');
    const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    const params = new URLSearchParams(queryPart || '');

    window.scrollTo({ top: 0, behavior: 'instant' });
    updateLayoutChrome();

    // 1. Rutas de autenticación
    if (path === '/login') {
      currentCleanup = renderLogin(container);
    } else if (path === '/register') {
      currentCleanup = renderRegister(container);
    } 
    // 2. Pestañas principales de consumidor
    else if (path === '/' || path === '') {
      currentCleanup = renderHome(container);
    } else if (path === '/explore') {
      const q = params.get('q') || '';
      currentCleanup = renderExplore(container, q);
    } else if (path.startsWith('/category/') || path.startsWith('/explore/category/')) {
      const cat = path.startsWith('/explore/category/')
        ? path.replace('/explore/category/', '')
        : path.replace('/category/', '');
      currentCleanup = renderCategory(container, cat);
    } else if (path.startsWith('/series/')) {
      const sId = path.replace('/series/', '');
      currentCleanup = renderSeries(container, sId);
    } else if (path.startsWith('/episode/')) {
      const epId = path.replace('/episode/', '');
      currentCleanup = renderEpisode(container, epId);
    } else if (path.startsWith('/player/')) {
      const epId = path.replace('/player/', '');
      currentCleanup = renderPlayerView(container, epId);
    } else if (path === '/subscriptions' || path === '/library') {
      currentCleanup = renderSubscriptions(container);
    } else if (path.startsWith('/creator-profile/')) {
      const cId = path.replace('/creator-profile/', '');
      currentCleanup = renderCreatorProfile(container, cId);
    } else if (path === '/profile') {
      currentCleanup = renderProfile(container);
    } else if (path === '/avatar-picker') {
      currentCleanup = renderAvatarPicker(container);
    }
    // 3. Rutas del portal de creadores
    else if (path === '/creator') {
      currentCleanup = renderCreatorDashboard(container);
    } else if (path === '/creator/comments') {
      currentCleanup = renderComments(container);
    } else if (path === '/creator/finances') {
      currentCleanup = renderFinances(container);
    } else if (path === '/creator/new-series' || path === '/creator/new') {
      currentCleanup = renderNewSeries(container);
    } else if (path.startsWith('/creator/manage/')) {
      const seriesId = path.replace('/creator/manage/', '');
      currentCleanup = renderManageEpisodes(container, seriesId);
    } else if (path.startsWith('/creator/upload/')) {
      const seriesId = path.replace('/creator/upload/', '');
      currentCleanup = renderUploadEpisode(container, seriesId);
    } else if (path.startsWith('/creator/edit/')) {
      const seriesId = path.replace('/creator/edit/', '');
      currentCleanup = renderEditSeries(container, seriesId);
    } 
    // 4. Alternativa 404
    else {
      container.innerHTML = `
        <div class="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <h2 class="text-3xl font-black font-headline text-white uppercase italic">Página no encontrada</h2>
          <p class="text-sm text-on-surface-variant font-medium">La ruta solicitada "${path}" no existe.</p>
          <a href="#/" class="px-8 py-3 primary-gradient text-surface-dim font-black rounded-full uppercase tracking-widest text-xs shadow-lg">
            Volver al Inicio
          </a>
        </div>
      `;
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}







