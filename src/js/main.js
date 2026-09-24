import { initAuth } from './auth.js';
import { initNav } from './components/nav.js';
import { initAuthModal } from './components/auth-modal.js';
import { initNotifications } from './components/notifications.js';
import { initPlayer } from './player.js';
import { initRouter } from './router.js';
import { initLayout } from './layout.js';
import { auth, signOut } from './firebase.js';

// Punto de entrada de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.location.search.includes('logout=true')) {
      await signOut(auth);
      window.history.replaceState({}, document.title, '/');
      window.location.hash = '#/login';
    }

    // 1. Inicializar el motor del reproductor
    initPlayer();

    // 2. Inicializar la escucha de Autenticación y Sesión
    initAuth();

    // 3. Inicializar Navegación Superior e Inferior
    initNav();
    initLayout();

    // 4. Inicializar Modal de Autenticación y Selectores de Avatar
    initAuthModal();

    // 5. Inicializar Campana de Notificaciones y Menú Desplegable
    initNotifications();

    // 6. Inicializar Enrutador SPA
    initRouter();

    console.log('%c SÓNICA ', 'background: #00f2fe; color: #050608; font-weight: bold; padding: 4px 8px; border-radius: 4px;', 'Aplicación web iniciada exitosamente.');
  } catch (error) {
    console.error("Critical error during application bootstrap:", error);
  }
});

