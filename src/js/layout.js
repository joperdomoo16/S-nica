import { icon } from './icons.js';
import { getCurrentUser, getUserProfile, onAuthUpdate } from './auth.js';
import { db, collection, query, where, onSnapshot } from './firebase.js';

let unreadCount = 0;
let unsubscribeNotifs = null;

export function initLayout() {
  const topBackBtn = document.getElementById('top-back-btn');
  const topNotifBtn = document.getElementById('top-notif-btn');
  const topUserAvatar = document.getElementById('top-user-avatar-btn');
  const notifCloseBtn = document.getElementById('notif-close-btn');
  const notifOverlay = document.getElementById('notif-center-overlay');

  if (topBackBtn) {
    topBackBtn.innerHTML = icon('arrowLeft', { size: 24 });
    topBackBtn.addEventListener('click', () => {
      window.history.back();
    });
  }

  if (topNotifBtn) {
    topNotifBtn.innerHTML = `${icon('bell', { size: 20 })}<span id="top-notif-ping" class="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-500 rounded-full ring-2 ring-[#0a0a0b] animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)] hidden"></span>`;
    topNotifBtn.addEventListener('click', () => {
      openNotificationCenter();
    });
  }

  if (notifCloseBtn) {
    notifCloseBtn.innerHTML = icon('x', { size: 20 });
    notifCloseBtn.addEventListener('click', closeNotificationCenter);
  }

  if (notifOverlay) {
    notifOverlay.addEventListener('click', (e) => {
      if (e.target === notifOverlay) closeNotificationCenter();
    });
  }

  if (topUserAvatar) {
    topUserAvatar.addEventListener('click', () => {
      window.location.hash = '#/profile';
    });
  }

  onAuthUpdate(({ user, profile }) => {
    const avatarImg = document.getElementById('top-user-avatar-img');
    if (avatarImg) {
      avatarImg.src = profile?.photoURL || user?.photoURL || '/Avatar/21.png';
    }

    if (unsubscribeNotifs) {
      unsubscribeNotifs();
      unsubscribeNotifs = null;
    }

    if (user) {
      listenNotifications(user.uid);
    } else {
      updateNotifPing(0);
    }
  });

  window.addEventListener('hashchange', updateLayoutChrome);
  updateLayoutChrome();
}

function listenNotifications(uid) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    where('read', '==', false)
  );

  unsubscribeNotifs = onSnapshot(q, (snap) => {
    unreadCount = snap.size;
    updateNotifPing(unreadCount);
  });
}

function updateNotifPing(count) {
  const ping = document.getElementById('top-notif-ping');
  if (ping) {
    if (count > 0) {
      ping.classList.remove('hidden');
    } else {
      ping.classList.add('hidden');
    }
  }
}

export function updateLayoutChrome() {
  const rawHash = window.location.hash.slice(1) || '/';
  const path = rawHash.split('?')[0];

  const topBar = document.getElementById('top-app-bar');
  const bottomNav = document.getElementById('bottom-nav-bar');
  const mainView = document.getElementById('app-view');
  const topBackBtn = document.getElementById('top-back-btn');
  const topTitle = document.getElementById('top-page-title');

  // Screens that don't show the bottom nav
  const hideBottomNav = ['/login', '/register', '/avatar-picker'].includes(path) || path.startsWith('/admin');

  // Screens that don't show the top header
  const hideTopBar = ['/login', '/register'].includes(path) || path.startsWith('/player/') || path.startsWith('/series/') || path.startsWith('/creator/upload/') || path.startsWith('/admin');

  // Main tabs where back button is hidden
  const isMainTab = ['/', '/explore', '/creator', '/subscriptions', '/creator/comments', '/creator/finances'].includes(path);

  // Toggle Top Bar
  if (topBar) {
    if (hideTopBar) {
      topBar.classList.add('hidden');
    } else {
      topBar.classList.remove('hidden');
    }
  }

  // Toggle Back Button
  if (topBackBtn) {
    if (isMainTab) {
      topBackBtn.classList.add('hidden');
    } else {
      topBackBtn.classList.remove('hidden');
    }
  }

  // Update Page Title
  if (topTitle) {
    let title = 'Sónica';
    if (path === '/creator/new-series') title = 'Crear Nueva Serie';
    else if (path.startsWith('/creator/manage/')) title = 'Administrar Capítulos';

    if (title === 'Sónica') {
      topTitle.className = 'text-[17px] font-black font-headline tracking-tight bg-gradient-to-br from-[#00e5ff] to-[#004d40] bg-clip-text text-transparent';
      topTitle.textContent = 'Sónica';
    } else {
      topTitle.className = 'text-[17px] font-black font-headline tracking-tight text-primary brightness-125';
      topTitle.textContent = title;
    }
  }

  // Toggle Bottom Nav
  if (bottomNav) {
    if (hideBottomNav) {
      bottomNav.classList.add('hidden');
    } else {
      bottomNav.classList.remove('hidden');
      renderBottomNavButtons(path);
    }
  }

  // Update main padding
  if (mainView) {
    mainView.className = `flex-1 ${!hideTopBar ? 'pt-16' : 'pt-0'} ${!hideBottomNav ? 'pb-24' : 'pb-0'}`;
  }
}

function renderBottomNavButtons(path) {
  const container = document.getElementById('bottom-nav-inner');
  if (!container) return;

  const isCreatorPath = path.startsWith('/creator') && !path.startsWith('/creator-profile');

  if (!isCreatorPath) {
    container.innerHTML = `
      ${renderNavBtn('home', 'Inicio', path === '/', '#/')}
      ${renderNavBtn('compass', 'Explorar', path === '/explore' || path.startsWith('/creator-profile'), '#/explore')}
      ${renderNavBtn('mic', 'Creador', path.startsWith('/creator') && !path.startsWith('/creator-profile'), '#/creator')}
      ${renderNavBtn('library', 'Biblioteca', path === '/subscriptions', '#/subscriptions')}
    `;
  } else {
    container.innerHTML = `
      ${renderNavBtn('arrowLeft', 'Volver', false, '#/')}
      ${renderNavBtn('mic', 'Mis Series', path.startsWith('/creator') && !path.includes('/comments') && !path.includes('/finances'), '#/creator')}
      ${renderNavBtn('messageSquare', 'Reseñas', path === '/creator/comments', '#/creator/comments')}
      ${renderNavBtn('wallet', 'Billetera', path === '/creator/finances', '#/creator/finances')}
    `;
  }
}

function renderNavBtn(iconName, label, active, href) {
  return `
    <a 
      href="${href}" 
      class="flex flex-col items-center justify-center transition-all active:scale-95 duration-200 h-16 w-1/4 min-w-[72px] relative group ${
        active 
          ? 'text-primary brightness-125 bg-[#0a0a0a]/40 rounded-2xl ring-1 ring-white/5 shadow-[0_8px_24px_rgba(34,211,238,0.1)]' 
          : 'text-on-surface-variant opacity-50 hover:opacity-100'
      }"
    >
      <div class="transition-transform group-active:scale-90 ${active ? 'mb-0.5' : 'mb-1'}">
        ${icon(iconName, { size: 22, strokeWidth: iconName === 'mic' || iconName === 'messageSquare' || iconName === 'wallet' ? 2.5 : 2 })}
      </div>
      <span class="font-headline text-[9px] font-black uppercase tracking-[0.15em] transition-all ${active ? 'opacity-100' : 'opacity-80'}">
        ${label}
      </span>
      ${active ? '<div class="absolute -bottom-1 w-6 h-0.5 primary-gradient rounded-full blur-[1px]"></div>' : ''}
    </a>
  `;
}

export function openNotificationCenter() {
  const overlay = document.getElementById('notif-center-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

export function closeNotificationCenter() {
  const overlay = document.getElementById('notif-center-overlay');
  if (overlay) overlay.classList.add('hidden');
}
