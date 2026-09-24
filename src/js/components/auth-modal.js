import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../auth.js';
import { showToast } from './toast.js';

let activeTab = 'login';
let selectedAvatar = '/Avatar/21.png';

export function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  const backdrop = document.getElementById('auth-modal-backdrop');
  const closeBtn = document.getElementById('auth-modal-close');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const googleBtn = document.getElementById('btn-google-login');

  // Close handlers
  backdrop?.addEventListener('click', closeAuthModal);
  closeBtn?.addEventListener('click', closeAuthModal);

  // Tab switching
  tabLogin?.addEventListener('click', () => switchTab('login'));
  tabRegister?.addEventListener('click', () => switchTab('register'));

  // Render avatar selector for registration
  renderAvatarGrid();

  // Login form submit
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-submit-login');

    try {
      btn.disabled = true;
      btn.innerHTML = '<span>Verificando...</span>';
      await loginWithEmail(email, password);
      closeAuthModal();
      formLogin.reset();
    } catch (err) {
      // Error is handled in auth.js
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Entrar a Sónica</span>';
    }
  });

  // Register form submit
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const avatar = selectedAvatar;
    const btn = document.getElementById('btn-submit-register');

    try {
      btn.disabled = true;
      btn.innerHTML = '<span>Creando cuenta...</span>';
      await registerWithEmail(email, password, name, username, avatar);
      closeAuthModal();
      formRegister.reset();
    } catch (err) {
      // Error handled in auth.js
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Registrarse en Sónica</span>';
    }
  });

  // Google sign in
  googleBtn?.addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      closeAuthModal();
    } catch (err) {
      // handled
    }
  });
}

function renderAvatarGrid() {
  const grid = document.getElementById('reg-avatar-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // 27 avatars
  const avatarIds = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 27];
  avatarIds.forEach(id => {
    const src = `/Avatar/${id}.png`;
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Avatar ${id}`;
    img.className = `avatar-choice ${src === selectedAvatar ? 'selected' : ''}`;
    img.addEventListener('click', () => {
      selectedAvatar = src;
      grid.querySelectorAll('.avatar-choice').forEach(el => el.classList.remove('selected'));
      img.classList.add('selected');
      const valInput = document.getElementById('reg-avatar-val');
      if (valInput) valInput.value = src;
    });
    grid.appendChild(img);
  });
}

export function openAuthModal(tab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    switchTab(tab);
  }
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

export function switchTab(tab) {
  activeTab = tab;
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (tab === 'login') {
    tabLogin?.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.remove('hidden');
    formRegister?.classList.add('hidden');
  } else {
    tabLogin?.classList.remove('active');
    tabRegister?.classList.add('active');
    formLogin?.classList.add('hidden');
    formRegister?.classList.remove('hidden');
  }
}
