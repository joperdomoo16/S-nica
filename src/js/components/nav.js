import { onAuthUpdate, logout } from '../auth.js';
import { openAuthModal } from './auth-modal.js';

export function initNav() {
  const authContainer = document.getElementById('auth-header-container');
  const searchInput = document.getElementById('quick-search-input');

  // Quick search input handler
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) {
        window.location.hash = `#/explore?q=${encodeURIComponent(q)}`;
      }
    }
  });

  // Update header based on Auth state
  onAuthUpdate(({ user, profile, isAdmin }) => {
    if (!authContainer) return;

    if (!user) {
      authContainer.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btn-header-login">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          <span>Acceder</span>
        </button>
      `;

      document.getElementById('btn-header-login')?.addEventListener('click', () => {
        openAuthModal('login');
      });
    } else {
      const avatarSrc = profile?.photoURL || user.photoURL || '/Avatar/21.png';
      const name = profile?.displayName || user.displayName || 'Mi Perfil';

      authContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${isAdmin ? `
            <a href="#/admin" class="btn btn-outline btn-xs" style="border-color: #ef4444; color: #f87171;" title="Panel de Moderación">
              Admin
            </a>
          ` : ''}
          <a href="#/creator" class="btn btn-secondary btn-xs" title="Estudio de Creadores">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Crear</span>
          </a>
          <a href="#/profile" class="avatar-btn" title="${name}">
            <img src="${avatarSrc}" alt="${name}" class="avatar avatar-sm">
          </a>
        </div>
      `;
    }
  });

  // Sync Bottom Navigation highlighting
  window.addEventListener('hashchange', updateActiveNav);
  updateActiveNav();
}

export function updateActiveNav() {
  const hash = window.location.hash.slice(1) || '/';
  const navItems = document.querySelectorAll('.bottom-nav-item');
  
  navItems.forEach(item => {
    const route = item.getAttribute('data-route');
    if (route === '/' && (hash === '/' || hash === '')) {
      item.classList.add('active');
    } else if (route !== '/' && hash.startsWith(route)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}
