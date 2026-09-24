import { 
  db, 
  auth, 
  doc, 
  updateDoc 
} from '../firebase.js';
import { updateProfileData } from '../auth.js';
import { icon } from '../icons.js';
import { optimizeImage } from '../utils.js';

const AVATARS = [
  '/Avatar/1.png', '/Avatar/2.png', '/Avatar/3.png', '/Avatar/4.png',
  '/Avatar/5.png', '/Avatar/7.png', '/Avatar/8.png', '/Avatar/10.png',
  '/Avatar/11.png', '/Avatar/12.png', '/Avatar/14.png', '/Avatar/15.png',
  '/Avatar/16.png', '/Avatar/17.png', '/Avatar/18.png', '/Avatar/20.png',
  '/Avatar/21.png', '/Avatar/22.png', '/Avatar/23.png', '/Avatar/24.png',
  '/Avatar/26.jpg', '/Avatar/27.png'
];

export function renderAvatarPicker(container) {
  const user = auth.currentUser;
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  let selected = user.photoURL || '/Avatar/21.png';
  let isProcessing = false;

  function render() {
    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32">
        <div class="px-6 pt-8 max-w-lg mx-auto space-y-8">
          <!-- Header -->
          <div class="flex items-center gap-4">
            <button id="btn-back-avatar" class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-primary active:scale-95 transition-all cursor-pointer">
              ${icon('arrow-left', { size: 24, strokeWidth: 3 })}
            </button>
            <h1 class="text-2xl font-black font-headline uppercase italic">Elige tu Avatar</h1>
          </div>

          <!-- Preview & Custom Upload -->
          <div class="flex flex-col items-center space-y-4">
            <div class="relative w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-secondary-container shadow-2xl">
              <div class="w-full h-full rounded-full overflow-hidden border-4 border-surface-dim">
                <img src="${selected}" class="w-full h-full object-cover" />
              </div>
            </div>

            <label class="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-primary font-black text-xs uppercase tracking-widest border border-white/10 cursor-pointer flex items-center gap-2">
              <input type="file" id="input-avatar-file" accept="image/*" class="hidden" />
              ${icon('camera', { size: 16 })}
              <span>Subir Foto Personalizada</span>
            </label>
          </div>

          <!-- Avatars Grid -->
          <div class="space-y-4">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60">Avatares Oficiales de Sónica</p>
            <div class="grid grid-cols-4 sm:grid-cols-5 gap-3">
              ${AVATARS.map(av => `
                <div 
                  data-pick-avatar="${av}"
                  class="relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all active:scale-90 ${
                    selected === av 
                      ? 'border-primary ring-2 ring-primary/40 shadow-[0_0_15px_rgba(0,229,255,0.4)]' 
                      : 'border-white/5 opacity-70 hover:opacity-100'
                  }"
                >
                  <img src="${av}" class="w-full h-full object-cover" />
                  ${selected === av ? `
                    <div class="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div class="w-6 h-6 rounded-full bg-primary text-surface-dim flex items-center justify-center">
                        ${icon('check', { size: 14, strokeWidth: 4 })}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Confirm button -->
          <div class="pt-4">
            <button 
              id="btn-confirm-avatar"
              ${isProcessing ? 'disabled' : ''}
              class="w-full py-5 primary-gradient rounded-full font-black text-sm uppercase tracking-widest text-surface-dim shadow-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              ${isProcessing ? icon('loader2', { size: 20, className: 'animate-spin' }) : 'Confirmar Selección'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-back-avatar')?.addEventListener('click', () => {
      window.location.hash = '#/profile';
    });

    container.querySelectorAll('[data-pick-avatar]').forEach(item => {
      item.addEventListener('click', () => {
        selected = item.getAttribute('data-pick-avatar');
        render();
      });
    });

    document.getElementById('input-avatar-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      isProcessing = true;
      render();

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const opt = await optimizeImage(reader.result, 256, 256, 0.7);
          selected = opt;
        } catch (err) {
          console.error(err);
        } finally {
          isProcessing = false;
          render();
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-confirm-avatar')?.addEventListener('click', async () => {
      isProcessing = true;
      render();

      try {
        await updateProfileData({ photoURL: selected });
        alert('¡Avatar actualizado!');
        window.location.hash = '#/profile';
      } catch (err) {
        console.error("Error saving avatar:", err);
        alert('Error al guardar el avatar.');
        isProcessing = false;
        render();
      }
    });
  }

  render();
}
