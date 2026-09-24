import { icon } from '../icons.js';
import { registerWithEmail } from '../auth.js';

export function renderRegister(container) {
  let showPassword = false;
  let selectedAvatar = sessionStorage.getItem('pending_avatar') || '/Avatar/21.png';
  let showSpaceWarning = false;

  function render() {
    container.innerHTML = `
      <div class="min-h-screen bg-surface-dim text-on-surface font-body pb-10">
        <!-- Space Warning Notification -->
        <div id="space-warning-pill" class="${showSpaceWarning ? '' : 'hidden'} fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-widest whitespace-nowrap">
          No se aceptan espacios
        </div>

        <!-- TopAppBar -->
        <header class="flex items-center justify-between px-6 h-16 w-full fixed top-0 z-50 glass-panel">
          <div class="flex items-center gap-4">
            <a href="#/login" class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors active:scale-95 text-primary">
              ${icon('arrowLeft', { size: 24 })}
            </a>
            <div class="w-10 h-10 rounded-xl overflow-hidden border border-primary/30 shadow-[0_0_15px_rgba(0,229,255,0.2)] bg-surface-container-highest/20 backdrop-blur-md">
              <img src="/logo.png" alt="Logo" class="w-full h-full object-contain p-2" />
            </div>
            <h1 class="font-headline font-black tracking-tight text-on-surface text-lg">Crear Perfil</h1>
          </div>
          <div class="w-10"></div>
        </header>

        <main class="pt-24 px-6 max-w-md mx-auto space-y-8">
          <!-- Avatar Picker -->
          <div class="flex flex-col items-center">
            <div id="reg-avatar-pick-trigger" class="relative group cursor-pointer">
              <div class="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-primary to-secondary-container shadow-2xl group-hover:scale-105 transition-transform">
                <div class="w-full h-full rounded-full overflow-hidden border-2 border-surface-dim">
                  <img id="reg-avatar-preview" src="${selectedAvatar}" alt="Avatar" class="w-full h-full object-cover" />
                </div>
              </div>
              <div class="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary text-surface-dim flex items-center justify-center shadow-lg border-2 border-surface-dim group-hover:scale-110 transition-transform">
                ${icon('plus', { size: 16, strokeWidth: 3 })}
              </div>
            </div>
            <p class="text-xs text-on-surface-variant font-medium mt-3">Toca para elegir tu avatar</p>
          </div>

          <!-- Avatar Grid Modal / Drawer -->
          <div id="reg-avatar-drawer" class="hidden bg-surface-container-high/60 rounded-[2rem] p-4 border border-white/5 space-y-3">
            <p class="text-xs font-bold text-primary uppercase tracking-widest text-center">Elige un Avatar de Sónica</p>
            <div class="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 no-scrollbar" id="reg-avatar-selector-grid">
              <!-- Rendered avatars -->
            </div>
          </div>

          <!-- Error Alert -->
          <div id="register-error-banner" class="hidden bg-red-500/20 border border-red-500/50 text-red-300 text-[11px] font-bold p-3 rounded-xl text-center uppercase tracking-widest"></div>

          <!-- Registration Form -->
          <form id="register-form" class="space-y-4">
            <div class="space-y-1">
              <label class="text-on-surface-variant text-xs font-bold uppercase tracking-wider ml-1">Nombre Completo</label>
              <input 
                id="reg-fullname" 
                type="text" 
                required 
                placeholder="Tu nombre"
                class="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-5 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium text-sm"
              />
            </div>

            <div class="space-y-1">
              <label class="text-on-surface-variant text-xs font-bold uppercase tracking-wider ml-1">Nombre de Usuario (@)</label>
              <input 
                id="reg-username" 
                type="text" 
                required 
                placeholder="miusuario"
                class="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-5 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium text-sm"
              />
            </div>

            <div class="space-y-1">
              <label class="text-on-surface-variant text-xs font-bold uppercase tracking-wider ml-1">Correo Electrónico</label>
              <input 
                id="reg-email" 
                type="email" 
                required 
                placeholder="nombre@ejemplo.com"
                class="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-5 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium text-sm"
              />
            </div>

            <div class="space-y-1">
              <label class="text-on-surface-variant text-xs font-bold uppercase tracking-wider ml-1">Contraseña</label>
              <div class="relative">
                <input 
                  id="reg-password" 
                  type="${showPassword ? 'text' : 'password'}" 
                  required 
                  minlength="6"
                  placeholder="••••••••"
                  class="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 pl-5 pr-12 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium text-sm"
                />
                <button 
                  type="button" 
                  id="reg-toggle-eye"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  ${icon(showPassword ? 'eyeOff' : 'eye', { size: 20 })}
                </button>
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-on-surface-variant text-xs font-bold uppercase tracking-wider ml-1">Confirmar Contraseña</label>
              <input 
                id="reg-confirm-password" 
                type="${showPassword ? 'text' : 'password'}" 
                required 
                minlength="6"
                placeholder="••••••••"
                class="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-5 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none font-medium text-sm"
              />
            </div>

            <button 
              type="submit" 
              id="btn-register-submit"
              class="w-full bg-primary hover:bg-primary-dim text-surface-dim font-black uppercase tracking-widest py-3.5 rounded-full transition-all active:scale-95 shadow-[0_0_20px_rgba(0,229,255,0.2)] mt-6 text-sm cursor-pointer"
            >
              Crear Cuenta
            </button>
          </form>

          <div class="text-center text-xs text-on-surface-variant font-medium pb-8">
            ¿Ya tienes cuenta? 
            <a href="#/login" class="text-primary hover:underline font-bold ml-1">Inicia sesión</a>
          </div>
        </main>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const form = document.getElementById('register-form');
    const eyeBtn = document.getElementById('reg-toggle-eye');
    const avatarTrigger = document.getElementById('reg-avatar-pick-trigger');
    const avatarDrawer = document.getElementById('reg-avatar-drawer');
    const avatarGrid = document.getElementById('reg-avatar-selector-grid');
    const errorBanner = document.getElementById('register-error-banner');
    const usernameInput = document.getElementById('reg-username');

    // Username space check
    usernameInput?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.includes(' ')) {
        const warn = document.getElementById('space-warning-pill');
        if (warn) {
          warn.classList.remove('hidden');
          setTimeout(() => warn.classList.add('hidden'), 2000);
        }
      }
      e.target.value = val.replace(/\s/g, '');
    });

    // Eye toggle
    eyeBtn?.addEventListener('click', () => {
      showPassword = !showPassword;
      const pass = document.getElementById('reg-password');
      const confirm = document.getElementById('reg-confirm-password');
      if (pass) pass.type = showPassword ? 'text' : 'password';
      if (confirm) confirm.type = showPassword ? 'text' : 'password';
      eyeBtn.innerHTML = icon(showPassword ? 'eyeOff' : 'eye', { size: 20 });
    });

    // Avatar Drawer
    avatarTrigger?.addEventListener('click', () => {
      avatarDrawer?.classList.toggle('hidden');
    });

    // Populate 27 avatars
    if (avatarGrid) {
      avatarGrid.innerHTML = '';
      const avatarIds = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 27];
      avatarIds.forEach(id => {
        const src = `/Avatar/${id}.png`;
        const img = document.createElement('img');
        img.src = src;
        img.className = `w-12 h-12 rounded-full cursor-pointer hover:scale-110 transition-transform border ${src === selectedAvatar ? 'border-primary ring-2 ring-primary/40' : 'border-white/10'}`;
        img.addEventListener('click', () => {
          selectedAvatar = src;
          sessionStorage.setItem('pending_avatar', src);
          const preview = document.getElementById('reg-avatar-preview');
          if (preview) preview.src = src;
          avatarDrawer?.classList.add('hidden');
        });
        avatarGrid.appendChild(img);
      });
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('reg-fullname')?.value.trim();
      const username = document.getElementById('reg-username')?.value.trim();
      const email = document.getElementById('reg-email')?.value.trim();
      const password = document.getElementById('reg-password')?.value;
      const confirmPass = document.getElementById('reg-confirm-password')?.value;
      const btn = document.getElementById('btn-register-submit');

      if (password !== confirmPass) {
        showError('Las contraseñas no coinciden');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<div class="w-5 h-5 border-2 border-surface-dim/30 border-t-surface-dim rounded-full animate-spin"></div>';

      try {
        await registerWithEmail(email, password, fullName, username, selectedAvatar);
        sessionStorage.removeItem('pending_avatar');
        window.location.hash = '#/';
      } catch (err) {
        showError(err.message || 'Error al registrar la cuenta');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Crear Cuenta';
      }
    });

    function showError(msg) {
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.classList.remove('hidden');
      }
    }
  }

  render();
}
