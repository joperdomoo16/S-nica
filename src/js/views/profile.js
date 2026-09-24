import { auth, db, doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, signOut, onAuthStateChanged } from '../firebase.js';
import { icon } from '../icons.js';
import { updateProfileData } from '../auth.js';

export function renderProfile(container) {
  let user = null;
  let profile = null;
  let activeView = 'menu';
  let isEditing = false;
  let editDisplayName = '';
  let editUsername = '';
  let isSaving = false;
  let showDeleteConfirm = false;
  let openFaqIndex = null;

  // Privacy settings
  let privacySettings = {
    profilePublic: true,
    showListeningActivity: true,
    allowComments: true,
  };

  // Notification settings
  let notifSettings = {
    newEpisodes: true,
    comments: true,
    followers: true,
    moderation: true,
    recommendations: true,
    promotions: false,
  };

  // App settings
  let appSettings = {
    autoplay: true,
    streamingQuality: 'alta',
    autoDownload: false,
  };

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-surface-dim">
      <div class="animate-spin text-primary">${icon('loader-circle', { size: 40 })}</div>
    </div>
  `;

  const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
    user = currentUser;
    if (!user) {
      container.innerHTML = `
        <div class="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
          <h2 class="text-3xl font-black font-headline uppercase italic text-white">Tu Perfil</h2>
          <p class="text-on-surface-variant max-w-xs text-sm">Inicia sesión para gestionar tus preferencias, suscripciones y configuración.</p>
          <button id="btn-profile-login" class="primary-gradient text-surface-dim font-black uppercase tracking-widest px-8 py-4 rounded-full text-xs shadow-lg cursor-pointer">
            Iniciar Sesión
          </button>
        </div>
      `;
      document.getElementById('btn-profile-login')?.addEventListener('click', () => {
        window.location.hash = '#/login';
      });
      return;
    }
    loadProfile();
  });

  async function loadProfile() {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        profile = { id: snap.id, ...snap.data() };
        if (profile.privacySettings) {
          privacySettings = { ...privacySettings, ...profile.privacySettings };
        }
        if (profile.notificationSettings) {
          notifSettings = { ...notifSettings, ...profile.notificationSettings };
        }
        if (profile.appSettings) {
          appSettings = { ...appSettings, ...profile.appSettings };
        }
      } else {
        profile = {
          displayName: user.displayName || 'Usuario',
          photoURL: user.photoURL || '/Avatar/21.png',
          username: user.email?.split('@')[0] || 'usuario',
          sonicaId: user.uid.slice(0, 8).toUpperCase()
        };
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
    render();
  }

  async function handleLogout() {
    await signOut(auth);
    window.location.hash = '#/login';
  }

  async function handleSaveInfo() {
    if (!editDisplayName.trim() || !editUsername.trim() || isSaving) return;
    isSaving = true;
    render();

    try {
      const cleanUsername = editUsername.trim().toLowerCase().replace(/\s+/g, '');
      await updateProfileData({
        displayName: editDisplayName.trim(),
        username: cleanUsername
      });
      profile.displayName = editDisplayName.trim();
      profile.username = cleanUsername;
      isEditing = false;
    } catch (e) {
      console.error('Error updating profile info:', e);
      alert('Error al actualizar datos');
    } finally {
      isSaving = false;
      render();
    }
  }

  async function handleTogglePrivacy(key, value) {
    privacySettings[key] = value;
    render();
    try {
      await updateProfileData({ privacySettings: { ...privacySettings } });
    } catch (err) {
      console.error('Error updating privacy:', err);
    }
  }

  async function handleToggleNotif(key, value) {
    notifSettings[key] = value;
    render();
    try {
      await updateProfileData({ notificationSettings: { ...notifSettings } });
    } catch (err) {
      console.error('Error updating notifications:', err);
    }
  }

  async function handleToggleAppSetting(key, value) {
    appSettings[key] = value;
    render();
    try {
      await updateProfileData({ appSettings: { ...appSettings } });
    } catch (err) {
      console.error('Error updating app settings:', err);
    }
  }

  function handleClearCache() {
    try {
      localStorage.removeItem('sonica_listening_history');
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
      }
      alert('¡Caché liberada con éxito!');
    } catch {
      alert('Error al limpiar la caché');
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    try {
      isSaving = true;
      render();
      const userId = user.uid;

      const seriesQuery = query(collection(db, 'series'), where('creatorId', '==', userId));
      const seriesSnap = await getDocs(seriesQuery);
      const userSeries = seriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const series of userSeries) {
        const episodesQuery = query(collection(db, 'episodes'), where('seriesId', '==', series.id));
        const episodesSnap = await getDocs(episodesQuery);
        const seriesEpisodes = episodesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const isPublished = series.status === 'publicado';
        const hasEpisodes = seriesEpisodes.length > 0;

        if (isPublished && hasEpisodes) {
          console.log(`Conservando serie publicada: ${series.title}`);
        } else {
          for (const ep of seriesEpisodes) {
            const qComments = query(collection(db, 'comments'), where('episodeId', '==', ep.id));
            const commentsSnap = await getDocs(qComments);
            for (const d of commentsSnap.docs) { await deleteDoc(d.ref); }
            await deleteDoc(doc(db, 'episodes', ep.id));
          }
          const qSeriesComments = query(collection(db, 'comments'), where('seriesId', '==', series.id));
          const seriesCommentsSnap = await getDocs(qSeriesComments);
          for (const d of seriesCommentsSnap.docs) { await deleteDoc(d.ref); }
          await deleteDoc(doc(db, 'series', series.id));
        }
      }

      await deleteDoc(doc(db, 'users', userId));

      try {
        await user.delete();
      } catch (authDeleteError) {
        console.warn("Auth deletion failed or requires re-authentication:", authDeleteError);
      }

      await signOut(auth);
      window.location.hash = '#/login';
    } catch (err) {
      console.error('Error deleting account:', err);
      alert(err.message || 'Error al eliminar la cuenta. Por favor, inténtalo de nuevo.');
    } finally {
      isSaving = false;
      showDeleteConfirm = false;
      render();
    }
  }

  function renderMenuItem(iconName, label, viewName) {
    return `
      <button 
        data-nav-view="${viewName}"
        class="w-full flex items-center justify-between px-6 py-5 hover:bg-surface-container-highest/30 transition-colors border-b border-white/[0.03] last:border-none cursor-pointer group"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
            ${icon(iconName, { size: 20 })}
          </div>
          <span class="text-sm font-bold text-white group-hover:text-primary transition-colors">${label}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-white/20 group-hover:text-white/60 transition-colors">
            ${icon('chevron-right', { size: 18 })}
          </span>
        </div>
      </button>
    `;
  }

  function renderToggleItem(iconName, iconClass, label, description, value, toggleId) {
    return `
      <button id="${toggleId}" class="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-surface-container-highest/50 transition-colors cursor-pointer">
        <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
          <span class="${iconClass}">${icon(iconName, { size: 18 })}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-white">${label}</p>
          <p class="text-[10px] text-on-surface-variant/50 font-bold mt-0.5">${description}</p>
        </div>
        <div class="w-12 h-7 rounded-full p-1 transition-colors ${value ? 'bg-primary' : 'bg-white/10'}">
          <div class="w-5 h-5 rounded-full bg-white shadow-md transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}"></div>
        </div>
      </button>
    `;
  }

  function renderInfoItem(iconHtml, label, value) {
    return `
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
          ${iconHtml}
        </div>
        <div class="flex flex-col">
          <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 mb-1">${label}</p>
          <p class="text-sm font-bold text-white break-words">${value}</p>
        </div>
      </div>
    `;
  }

  function render() {
    const isPremiumUser = user?.email?.toLowerCase() === 'sonicaoriginal@gmail.com' || profile?.premium === true || profile?.isPremium === true;
    const photoURL = profile?.photoURL || user.photoURL || '/Avatar/21.png';
    const displayName = profile?.displayName || user.displayName || 'Usuario';
    const username = profile?.username || user.email?.split('@')[0] || 'usuario';
    const sonicaId = profile?.sonicaId || user.uid.slice(0, 8).toUpperCase();
    const memberSince = user?.metadata?.creationTime 
      ? new Date(user.metadata.creationTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) 
      : 'Sin especificar';

    // ─── INFO VIEW ───
    if (activeView === 'info') {
      container.innerHTML = `
        <div class="px-6 space-y-6 pt-6 pb-24 max-w-lg mx-auto">
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
              <button id="btn-back-menu" class="p-3 rounded-full bg-surface-container-high/40 text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer">
                ${icon('arrow-left', { size: 20 })}
              </button>
              <h2 class="text-xl font-black font-headline text-white uppercase italic tracking-tight">Información Personal</h2>
            </div>
            ${!isEditing ? `
              <button id="btn-start-edit" class="px-5 py-2.5 rounded-full bg-primary/10 text-primary font-black text-xs uppercase tracking-widest hover:bg-primary/20 transition-colors cursor-pointer">
                Editar
              </button>
            ` : ''}
          </div>

          <div class="bg-surface-container-high/40 rounded-[2.5rem] p-8 border border-white/5 space-y-8 backdrop-blur-sm">
            ${isEditing ? `
              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Nombre</label>
                  <input 
                    type="text" 
                    id="input-edit-display-name" 
                    value="${editDisplayName || displayName}" 
                    class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="Tu nombre"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-40 ml-1">Nombre de Usuario</label>
                  <div class="relative">
                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40">${icon('at-sign', { size: 18 })}</span>
                    <input 
                      type="text" 
                      id="input-edit-username" 
                      value="${editUsername || username}" 
                      class="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white font-bold focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="usuario"
                    />
                  </div>
                </div>
                <div class="flex gap-3 pt-4">
                  <button id="btn-cancel-edit" class="flex-1 py-4 rounded-2xl bg-white/5 text-white/60 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer">
                    Cancelar
                  </button>
                  <button id="btn-save-edit" class="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2">
                    ${isSaving ? icon('loader-circle', { size: 16, className: 'animate-spin' }) : 'Guardar'}
                  </button>
                </div>
              </div>
            ` : `
              <div class="space-y-8">
                ${renderInfoItem(`<span class="text-primary">${icon('user', { size: 20 })}</span>`, 'Nombre', displayName)}
                ${renderInfoItem(`<span class="text-secondary">${icon('at-sign', { size: 20 })}</span>`, 'Usuario', `@${username}`)}
                ${renderInfoItem(`<span class="text-white/40">${icon('hash', { size: 20 })}</span>`, 'ID de Sónica', sonicaId)}
                ${renderInfoItem(`<span class="text-tertiary">${icon('mail', { size: 20 })}</span>`, 'Correo Electrónico', user.email || 'Sin especificar')}
                ${renderInfoItem(`<span class="text-white/40">${icon('calendar', { size: 20 })}</span>`, 'Miembro desde', memberSince)}
              </div>
            `}
          </div>

          <p class="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em] text-center px-12 leading-relaxed">
            Tus datos están protegidos y nunca serán compartidos sin tu consentimiento.
          </p>
        </div>
      `;

      document.getElementById('btn-back-menu')?.addEventListener('click', () => {
        activeView = 'menu';
        isEditing = false;
        render();
      });
      document.getElementById('btn-start-edit')?.addEventListener('click', () => {
        isEditing = true;
        editDisplayName = displayName;
        editUsername = username;
        render();
      });
      document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
        isEditing = false;
        render();
      });
      document.getElementById('btn-save-edit')?.addEventListener('click', () => {
        editDisplayName = document.getElementById('input-edit-display-name')?.value || '';
        editUsername = document.getElementById('input-edit-username')?.value || '';
        handleSaveInfo();
      });
      return;
    }

    // ─── SECURITY VIEW ───
    if (activeView === 'security') {
      const providerName = user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : user?.providerData?.[0]?.providerId === 'apple.com' ? 'Apple' : 'Email & Password';
      const lastSignIn = user?.metadata?.lastSignInTime 
        ? new Date(user.metadata.lastSignInTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Desconocido';

      container.innerHTML = `
        <div class="px-6 space-y-6 pt-6 pb-24 max-w-lg mx-auto">
          <div class="flex items-center gap-4 mb-8">
            <button id="btn-back-menu" class="p-3 rounded-full bg-surface-container-high/40 text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer">
              ${icon('arrow-left', { size: 20 })}
            </button>
            <h2 class="text-xl font-black font-headline text-white uppercase italic tracking-tight">Seguridad y Privacidad</h2>
          </div>

          <!-- Authentication -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Autenticación</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              <div class="flex items-center gap-4 px-6 py-5">
                <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span class="text-primary">${icon('lock', { size: 18 })}</span>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-bold text-white">Método de acceso</p>
                  <p class="text-[10px] text-on-surface-variant/60 font-bold mt-0.5">${providerName}</p>
                </div>
                <span class="text-green-400">${icon('shield-check', { size: 18 })}</span>
              </div>
              <div class="h-px bg-white/5"></div>
              <div class="flex items-center gap-4 px-6 py-5">
                <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                  <span class="text-on-surface-variant">${icon('smartphone', { size: 18 })}</span>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-bold text-white">Sesión activa</p>
                  <p class="text-[10px] text-on-surface-variant/60 font-bold mt-0.5">Último inicio: ${lastSignIn}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Privacy Toggles -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Privacidad</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              ${renderToggleItem('eye', 'text-primary', 'Perfil público', 'Otros usuarios pueden ver tu perfil', privacySettings.profilePublic, 'toggle-profile-public')}
              <div class="h-px bg-white/5"></div>
              ${renderToggleItem('smartphone', 'text-secondary', 'Actividad de escucha', 'Mostrar lo que estás escuchando', privacySettings.showListeningActivity, 'toggle-listening')}
              <div class="h-px bg-white/5"></div>
              ${renderToggleItem('mail', 'text-on-surface-variant', 'Permitir comentarios', 'Recibir comentarios en tu contenido', privacySettings.allowComments, 'toggle-comments')}
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] ml-2 opacity-60">Zona de Peligro</h4>
            <div class="bg-red-500/5 rounded-[2rem] border border-red-500/10 overflow-hidden">
              <button id="btn-delete-account" class="w-full flex items-center gap-4 px-6 py-5 group text-left hover:bg-red-500/10 transition-colors cursor-pointer">
                <div class="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <span class="text-red-400">${icon('trash-2', { size: 18 })}</span>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-bold text-red-400">Eliminar mi cuenta</p>
                  <p class="text-[10px] text-on-surface-variant/40 font-bold mt-0.5">Esta acción no se puede deshacer</p>
                </div>
                <span class="text-red-400/40">${icon('chevron-right', { size: 18 })}</span>
              </button>
            </div>
          </div>

          ${showDeleteConfirm ? `
            <div id="delete-modal-overlay" class="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <div id="delete-modal-bg" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
              <div class="relative w-full max-w-sm bg-surface-container-highest rounded-[2.5rem] p-8 border border-white/5 shadow-2xl text-center space-y-6">
                <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                  <span class="text-red-400">${icon('alert-triangle', { size: 32 })}</span>
                </div>
                <div class="space-y-3">
                  <h3 class="text-xl font-black font-headline text-white uppercase italic">¿Eliminar cuenta?</h3>
                  <p class="text-sm text-on-surface-variant font-medium leading-relaxed">
                    Se eliminarán permanentemente tus datos, series no publicadas y configuración. Las series publicadas con episodios se mantendrán en Sónica.
                  </p>
                </div>
                <div class="flex flex-col gap-3 pt-2">
                  <button id="btn-confirm-delete" class="w-full h-14 bg-red-500 text-white font-black uppercase tracking-widest rounded-full active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
                    ${isSaving ? icon('loader-circle', { size: 18, className: 'animate-spin' }) : 'Sí, Eliminar'}
                  </button>
                  <button id="btn-cancel-delete" class="w-full h-14 bg-white/5 text-on-surface-variant font-black uppercase tracking-widest rounded-full text-sm cursor-pointer">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

          <p class="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em] text-center px-12 leading-relaxed pb-10">
            Tu seguridad es nuestra prioridad. Los datos se cifran en tránsito y en reposo.
          </p>
        </div>
      `;

      document.getElementById('btn-back-menu')?.addEventListener('click', () => { activeView = 'menu'; render(); });
      document.getElementById('toggle-profile-public')?.addEventListener('click', () => handleTogglePrivacy('profilePublic', !privacySettings.profilePublic));
      document.getElementById('toggle-listening')?.addEventListener('click', () => handleTogglePrivacy('showListeningActivity', !privacySettings.showListeningActivity));
      document.getElementById('toggle-comments')?.addEventListener('click', () => handleTogglePrivacy('allowComments', !privacySettings.allowComments));
      document.getElementById('btn-delete-account')?.addEventListener('click', () => { showDeleteConfirm = true; render(); });
      document.getElementById('btn-confirm-delete')?.addEventListener('click', handleDeleteAccount);
      document.getElementById('btn-cancel-delete')?.addEventListener('click', () => { showDeleteConfirm = false; render(); });
      document.getElementById('delete-modal-bg')?.addEventListener('click', () => { showDeleteConfirm = false; render(); });
      return;
    }

    // ─── NOTIFICATIONS VIEW ───
    if (activeView === 'notifications') {
      container.innerHTML = `
        <div class="px-6 space-y-6 pt-6 pb-24 max-w-lg mx-auto">
          <div class="flex items-center gap-4 mb-8">
            <button id="btn-back-menu" class="p-3 rounded-full bg-surface-container-high/40 text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer">
              ${icon('arrow-left', { size: 20 })}
            </button>
            <h2 class="text-xl font-black font-headline text-white uppercase italic tracking-tight">Notificaciones</h2>
          </div>

          <!-- Content -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Contenido</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              ${renderToggleItem('volume-2', 'text-primary', 'Nuevos episodios', 'Cuando se publiquen nuevos episodios de tus series', notifSettings.newEpisodes, 'toggle-new-episodes')}
              <div class="h-px bg-white/5"></div>
              ${renderToggleItem('message-square', 'text-secondary', 'Comentarios', 'Respuestas y menciones en tus comentarios', notifSettings.comments, 'toggle-notif-comments')}
              <div class="h-px bg-white/5"></div>
              ${renderToggleItem('heart', 'text-pink-400', 'Nuevos seguidores', 'Cuando alguien te siga', notifSettings.followers, 'toggle-followers')}
            </div>
          </div>

          <!-- System -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Sistema</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              ${renderToggleItem('shield-check', 'text-green-400', 'Moderación', 'Estado de revisión de tu contenido', notifSettings.moderation, 'toggle-moderation')}
              <div class="h-px bg-white/5"></div>
              ${renderToggleItem('star', 'text-yellow-400', 'Recomendaciones', 'Contenido sugerido para ti', notifSettings.recommendations, 'toggle-recommendations')}
              <div class="h-px bg-white/5"></div>
              ${renderToggleItem('megaphone', 'text-on-surface-variant', 'Promociones', 'Ofertas y novedades de Sónica', notifSettings.promotions, 'toggle-promotions')}
            </div>
          </div>

          <p class="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em] text-center px-12 leading-relaxed pb-10">
            Tus preferencias se guardan automáticamente.
          </p>
        </div>
      `;

      document.getElementById('btn-back-menu')?.addEventListener('click', () => { activeView = 'menu'; render(); });
      document.getElementById('toggle-new-episodes')?.addEventListener('click', () => handleToggleNotif('newEpisodes', !notifSettings.newEpisodes));
      document.getElementById('toggle-notif-comments')?.addEventListener('click', () => handleToggleNotif('comments', !notifSettings.comments));
      document.getElementById('toggle-followers')?.addEventListener('click', () => handleToggleNotif('followers', !notifSettings.followers));
      document.getElementById('toggle-moderation')?.addEventListener('click', () => handleToggleNotif('moderation', !notifSettings.moderation));
      document.getElementById('toggle-recommendations')?.addEventListener('click', () => handleToggleNotif('recommendations', !notifSettings.recommendations));
      document.getElementById('toggle-promotions')?.addEventListener('click', () => handleToggleNotif('promotions', !notifSettings.promotions));
      return;
    }

    // ─── HELP VIEW ───
    if (activeView === 'help') {
      const faqs = [
        { q: '¿Cómo puedo crear mi propio pódcast?', a: 'Desde el Panel del Creador puedes crear una nueva serie, agregar episodios y publicarlos para toda la comunidad.' },
        { q: '¿Qué incluye Sónica Premium?', a: 'Premium te da acceso sin anuncios, descarga offline, audio de alta calidad y herramientas de creación con IA.' },
        { q: '¿Cómo cambio mi foto de perfil?', a: 'Toca tu avatar en la página de perfil y selecciona un nuevo avatar de nuestra galería.' },
        { q: '¿Puedo monetizar mi contenido?', a: 'Sí, los creadores verificados pueden acceder al programa de monetización desde el Panel del Creador.' },
        { q: '¿Cómo reporto contenido inapropiado?', a: 'Puedes reportar cualquier contenido tocando el icono de opciones junto al episodio o comentario.' },
        { q: '¿Por qué mi serie está en revisión?', a: 'Todo el contenido nuevo pasa por un proceso de moderación para garantizar la calidad y seguridad de la comunidad.' },
        { q: '¿Cómo elimino mi cuenta?', a: 'Ve a Seguridad y Privacidad en tu perfil y encontrarás la opción en la Zona de Peligro.' },
      ];

      container.innerHTML = `
        <div class="px-6 space-y-6 pt-6 pb-24 max-w-lg mx-auto">
          <div class="flex items-center gap-4 mb-8">
            <button id="btn-back-menu" class="p-3 rounded-full bg-surface-container-high/40 text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer">
              ${icon('arrow-left', { size: 20 })}
            </button>
            <h2 class="text-xl font-black font-headline text-white uppercase italic tracking-tight">Centro de Ayuda</h2>
          </div>

          <!-- Contact Card -->
          <div class="bg-gradient-to-br from-primary/10 to-secondary/5 rounded-[2.5rem] border border-primary/20 p-8 space-y-5">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <span class="text-primary">${icon('headphones', { size: 24 })}</span>
              </div>
              <div>
                <h3 class="text-base font-black text-white uppercase italic tracking-tight">¿Necesitas ayuda?</h3>
                <p class="text-xs text-on-surface-variant/60 font-medium mt-0.5">Nuestro equipo está listo para atenderte</p>
              </div>
            </div>
            <a href="mailto:support@sonica.com" class="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-primary text-on-primary font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all no-underline">
              <span>${icon('send', { size: 16 })}</span>
              Escribir a Soporte
            </a>
            <p class="text-[10px] text-center text-on-surface-variant/40 font-bold tracking-wider">
              support@sonica.com
            </p>
          </div>

          <!-- FAQ -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Preguntas Frecuentes</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              ${faqs.map((faq, idx) => `
                ${idx > 0 ? '<div class="h-px bg-white/5"></div>' : ''}
                <button data-faq-index="${idx}" class="w-full text-left px-6 py-5 hover:bg-surface-container-highest/50 transition-colors cursor-pointer">
                  <div class="flex items-start gap-4">
                    <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
                      <span class="text-primary">${icon('file-text', { size: 14 })}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-sm font-bold text-white leading-snug">${faq.q}</p>
                        <span class="text-on-surface-variant/40 shrink-0 transition-transform ${openFaqIndex === idx ? 'rotate-180' : ''}">
                          ${icon('chevron-down', { size: 16 })}
                        </span>
                      </div>
                      ${openFaqIndex === idx ? `
                        <p class="text-xs text-on-surface-variant/60 font-medium leading-relaxed mt-3">${faq.a}</p>
                      ` : ''}
                    </div>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- App Info -->
          <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 p-6 text-center space-y-2">
            <p class="text-sm font-black text-white uppercase italic tracking-tight">Sónica</p>
            <p class="text-[10px] text-on-surface-variant/40 font-bold tracking-widest">Versión 1.0.0</p>
            <p class="text-[10px] text-on-surface-variant/30 font-medium leading-relaxed pt-2">
              © 2025 Sónica. Todos los derechos reservados.
            </p>
          </div>

          <div class="pb-10"></div>
        </div>
      `;

      document.getElementById('btn-back-menu')?.addEventListener('click', () => { activeView = 'menu'; render(); });
      container.querySelectorAll('[data-faq-index]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-faq-index'));
          openFaqIndex = openFaqIndex === idx ? null : idx;
          render();
        });
      });
      return;
    }

    // ─── PREMIUM VIEW ───
    if (activeView === 'premium') {
      container.innerHTML = `
        <div class="px-6 space-y-8 pt-6 pb-24 max-w-lg mx-auto">
          <div class="flex items-center gap-4 mb-4">
            <button id="btn-back-menu" class="p-3 rounded-full bg-surface-container-high/40 text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer">
              ${icon('arrow-left', { size: 20 })}
            </button>
            <h2 class="text-xl font-black font-headline text-white uppercase italic tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]">Planes Premium</h2>
          </div>

          <!-- Plan Gratuito -->
          <div class="w-full bg-gradient-to-br from-[#0a0a0c] via-[#050506] to-[#0a0a0c] rounded-[2.5rem] border border-white/5 p-8 space-y-6 relative overflow-hidden shadow-lg">
            <div class="relative space-y-6">
              <div class="px-3.5 py-1 bg-white/5 border border-white/10 w-fit rounded-full text-[9px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1.5">
                🆓 GRATUITO
              </div>
              <div class="space-y-2">
                <h3 class="text-2xl font-black font-headline text-white tracking-tight uppercase italic">
                  Prueba y <span class="text-white/70">conversión</span>
                </h3>
                <p class="text-xs text-on-surface-variant/70 leading-relaxed font-medium">
                  Acceso básico con anuncios. Incluye muestra de creación IA (2 voces, 10 min/mes).
                </p>
              </div>
              <ul class="space-y-3.5">
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-white/70 shrink-0 mt-0.5 border border-white/10">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/60">Catálogo completo de pódcasts</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-white/70 shrink-0 mt-0.5 border border-white/10">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/60">Reproducción en segundo plano</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-white/70 shrink-0 mt-0.5 border border-white/10">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/60">Audio 128 kbps (con anuncios)</span>
                </li>
              </ul>
              <div class="pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-baseline gap-2">
                  <span class="text-3xl font-black text-white">USD 0</span>
                </div>
                ${!isPremiumUser ? `
                  <button disabled class="px-6 h-12 bg-white/5 border border-white/10 text-white/50 font-black uppercase tracking-[0.15em] rounded-full flex items-center justify-center gap-2 select-none text-xs font-headline italic">
                    PLAN ACTUAL
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Plan Premium Oyente -->
          <div class="w-full bg-gradient-to-br from-[#041a1f] via-[#020d0f] to-[#09090b] rounded-[2.5rem] border border-cyan-500/30 p-8 space-y-6 relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.05)]">
            <div class="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl"></div>
            <div class="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-teal-500/10 blur-3xl"></div>
            <div class="relative space-y-6">
              <div class="px-3.5 py-1 bg-cyan-500/10 border border-cyan-400/20 w-fit rounded-full text-[9px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5 shadow-[inset_0_0_12px_rgba(6,182,212,0.1)]">
                <span class="text-cyan-400 animate-pulse">⚡</span> PREMIUM OYENTE
              </div>
              <div class="space-y-2">
                <h3 class="text-2xl font-black font-headline text-white tracking-tight uppercase italic">
                  Para <span class="text-cyan-400">oyentes puros</span>
                </h3>
                <p class="text-xs text-on-surface-variant/70 leading-relaxed font-medium">
                  Catálogo completo, cero anuncios, descarga para escucha offline y audio de alta calidad.
                </p>
              </div>
              <ul class="space-y-3.5">
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Cero publicidad (AdMob)</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Descarga / escucha offline</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Calidad de audio Alta</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 border border-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Insignia (badge) Estándar</span>
                </li>
              </ul>
              <div class="pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-black text-white">USD 2,99</span>
                    <span class="text-[10px] font-black uppercase text-cyan-400 tracking-wider">/ MES</span>
                  </div>
                  <p class="text-xs font-black text-cyan-400/80 tracking-wide mt-1 drop-shadow-[0_0_6px_rgba(6,182,212,0.15)]">
                    ≈ $9.000 COP / mes
                  </p>
                </div>
                ${isPremiumUser ? `
                  <button disabled class="px-6 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black uppercase tracking-[0.15em] rounded-full flex items-center justify-center gap-2 select-none text-xs font-headline italic">
                    ${icon('star', { size: 14, fill: 'currentColor' })} PLAN ACTIVO
                  </button>
                ` : `
                  <button id="btn-choose-oyente" class="px-6 h-12 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-black uppercase tracking-[0.15em] rounded-full flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.25)] hover:shadow-[0_0_35px_rgba(6,182,212,0.4)] transition-all active:scale-[0.98] text-xs font-headline italic cursor-pointer">
                    ELEGIR OYENTE
                  </button>
                `}
              </div>
            </div>
          </div>

          <!-- Plan Premium Total -->
          <div class="w-full bg-gradient-to-br from-[#271804] via-[#0b0803] to-[#09090b] rounded-[2.5rem] border border-yellow-500/30 p-8 space-y-6 relative overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.1)]">
            <div class="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-yellow-500/10 blur-3xl"></div>
            <div class="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl"></div>
            <div class="relative space-y-6">
              <div class="px-3.5 py-1 bg-yellow-500/10 border border-yellow-400/20 w-fit rounded-full text-[9px] font-black uppercase tracking-widest text-yellow-400 flex items-center gap-1.5 shadow-[inset_0_0_12px_rgba(234,179,8,0.1)]">
                <span class="text-yellow-400 animate-pulse">👑</span> PREMIUM TOTAL
              </div>
              <div class="space-y-2">
                <h3 class="text-2xl font-black font-headline text-white tracking-tight uppercase italic">
                  Oyentes + <span class="text-yellow-400">Creadores IA</span>
                </h3>
                <p class="text-xs text-on-surface-variant/70 leading-relaxed font-medium">
                  Todo lo de Oyente, más herramientas de creación avanzadas, generación de texto a voz y licencia comercial.
                </p>
              </div>
              <ul class="space-y-3.5">
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 mt-0.5 border border-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Todo lo incluido en Premium Oyente</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 mt-0.5 border border-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">IA de texto a voz (generación)</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 mt-0.5 border border-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Todas las voces neuronales + Efectos IA</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 mt-0.5 border border-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Licencia comercial del audio IA</span>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0 mt-0.5 border border-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                    <span>${icon('shield-check', { size: 12 })}</span>
                  </div>
                  <span class="text-xs font-bold text-white/80">Insignia (badge) Dorada 👑 y Acceso anticipado</span>
                </li>
              </ul>
              <div class="pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-black text-white">USD 6,99</span>
                    <span class="text-[10px] font-black uppercase text-yellow-400 tracking-wider">/ MES</span>
                  </div>
                  <p class="text-xs font-black text-yellow-400/80 tracking-wide mt-1 drop-shadow-[0_0_6px_rgba(234,179,8,0.15)]">
                    ≈ $22.000 COP / mes
                  </p>
                </div>
                ${isPremiumUser ? `
                  <button disabled class="px-6 h-12 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black uppercase tracking-[0.15em] rounded-full flex items-center justify-center gap-2 select-none text-xs font-headline italic">
                    ${icon('star', { size: 14, fill: 'currentColor' })} PLAN ACTIVO
                  </button>
                ` : `
                  <button id="btn-choose-total" class="px-6 h-12 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-white font-black uppercase tracking-[0.15em] rounded-full flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(234,179,8,0.25)] hover:shadow-[0_0_35px_rgba(234,179,8,0.4)] transition-all active:scale-[0.98] text-xs font-headline italic cursor-pointer">
                    ELEGIR TOTAL
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-back-menu')?.addEventListener('click', () => { activeView = 'menu'; render(); });
      document.getElementById('btn-choose-oyente')?.addEventListener('click', () => alert('¡Pronto podrás suscribirte a Premium Oyente!'));
      document.getElementById('btn-choose-total')?.addEventListener('click', () => alert('¡Pronto podrás suscribirte a Premium Total!'));
      return;
    }

    // ─── SETTINGS VIEW ───
    if (activeView === 'settings') {
      container.innerHTML = `
        <div class="px-6 space-y-6 pt-6 pb-24 max-w-lg mx-auto">
          <div class="flex items-center gap-4 mb-6">
            <button id="btn-back-menu" class="p-3 rounded-full bg-surface-container-high/40 text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer">
              ${icon('arrow-left', { size: 20 })}
            </button>
            <h2 class="text-xl font-black font-headline text-white uppercase italic tracking-tight">Ajustes</h2>
          </div>

          <!-- Playback -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Reproducción</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              ${renderToggleItem('play-circle', 'text-primary', 'Reproducción automática', 'Continuar con el siguiente episodio automáticamente', appSettings.autoplay, 'toggle-autoplay')}
              <div class="h-px bg-white/5"></div>
              <div class="px-6 py-5">
                <div class="flex items-center gap-4 mb-4">
                  <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
                    <span class="text-secondary">${icon('gauge', { size: 18 })}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-white">Calidad de Streaming</p>
                    <p class="text-[10px] text-on-surface-variant/50 font-bold mt-0.5">Afecta el consumo de datos</p>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  ${['baja', 'media', 'alta'].map(q => `
                    <button data-quality="${q}" class="py-3 rounded-xl border font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                      appSettings.streamingQuality === q
                        ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10'
                        : 'bg-white/5 border-white/5 text-on-surface-variant'
                    }">${q === 'baja' ? 'Baja' : q === 'media' ? 'Media' : 'Alta'}</button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Data & Storage -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2 opacity-60">Datos y Almacenamiento</h4>
            <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
              ${renderToggleItem('wifi', 'text-green-400', 'Descarga automática', 'Descargar episodios nuevos con WiFi', appSettings.autoDownload, 'toggle-auto-download')}
              <div class="h-px bg-white/5"></div>
              <button id="btn-clear-cache" class="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-surface-container-highest/50 transition-colors cursor-pointer">
                <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
                  <span class="text-on-surface-variant">${icon('hard-drive', { size: 18 })}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-white">Limpiar Caché</p>
                  <p class="text-[10px] text-on-surface-variant/50 font-bold mt-0.5">Libera espacio en tu dispositivo</p>
                </div>
                <span class="text-on-surface-variant/40">${icon('chevron-right', { size: 16 })}</span>
              </button>
            </div>
          </div>

          <p class="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em] text-center px-12 leading-relaxed pb-10">
            Tus ajustes se guardan automáticamente.
          </p>
        </div>
      `;

      document.getElementById('btn-back-menu')?.addEventListener('click', () => { activeView = 'menu'; render(); });
      document.getElementById('toggle-autoplay')?.addEventListener('click', () => handleToggleAppSetting('autoplay', !appSettings.autoplay));
      document.getElementById('toggle-auto-download')?.addEventListener('click', () => handleToggleAppSetting('autoDownload', !appSettings.autoDownload));
      document.getElementById('btn-clear-cache')?.addEventListener('click', handleClearCache);
      container.querySelectorAll('[data-quality]').forEach(btn => {
        btn.addEventListener('click', () => {
          handleToggleAppSetting('streamingQuality', btn.getAttribute('data-quality'));
        });
      });
      return;
    }

    // ─── DEFAULT: MAIN MENU VIEW ───
    container.innerHTML = `
      <div class="px-6 space-y-8 min-h-screen pb-32">
        <!-- Profile Header -->
        <section class="flex flex-col items-center pt-6">
          <div class="relative group cursor-pointer" id="profile-avatar-clickable">
            <div class="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-secondary-container shadow-2xl group-hover:scale-105 transition-transform">
              <div class="w-full h-full rounded-full overflow-hidden border-4 border-surface-dim relative">
                <img 
                  src="${photoURL}" 
                  alt="Profile"
                  class="w-full h-full object-cover"
                  referrerpolicy="no-referrer"
                />
                <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-white">${icon('camera', { size: 24 })}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="text-center mt-6">
            <h2 class="text-2xl font-black font-headline text-white flex items-center justify-center gap-2">
              ${displayName}
              ${isPremiumUser ? `
                <span class="px-2.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase tracking-wider border border-yellow-500/30 flex items-center gap-1 select-none shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                  ${icon('star', { size: 8, fill: 'currentColor' })} Premium
                </span>
              ` : ''}
            </h2>
            <div class="flex flex-col items-center gap-0.5">
              <p class="text-primary font-bold text-sm">@${username}</p>
            </div>
            <p class="text-on-surface-variant/30 font-bold text-[9px] mt-2 tracking-widest uppercase">
              ID: ${sonicaId}
            </p>
          </div>
        </section>

        <!-- Menu: Account Section -->
        <section class="space-y-4">
          <h3 class="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2">Cuenta</h3>
          <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
            ${renderMenuItem('user', 'Información Personal', 'info')}
            <button 
              id="btn-goto-public-profile"
              class="w-full flex items-center justify-between px-6 py-5 hover:bg-surface-container-highest/30 transition-colors border-b border-white/[0.03] cursor-pointer group"
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-secondary group-hover:text-primary transition-colors">
                  ${icon('external-link', { size: 20 })}
                </div>
                <span class="text-sm font-bold text-white group-hover:text-primary transition-colors">Mi Perfil Público</span>
              </div>
              <span class="text-white/20 group-hover:text-white/60 transition-colors">
                ${icon('chevron-right', { size: 18 })}
              </span>
            </button>
            ${renderMenuItem('shield', 'Seguridad y Privacidad', 'security')}
            ${renderMenuItem('bell', 'Notificaciones', 'notifications')}
            <button 
              data-nav-view="premium"
              class="w-full flex items-center justify-between px-6 py-5 hover:bg-surface-container-highest/30 transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-yellow-400 group-hover:text-primary transition-colors">
                  ${icon('star', { size: 20, fill: 'rgba(250,204,21,0.1)' })}
                </div>
                <span class="text-yellow-400 font-extrabold text-sm flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(250,204,21,0.25)]">
                  Sónica Premium
                </span>
              </div>
              <span class="text-white/20 group-hover:text-white/60 transition-colors">
                ${icon('chevron-right', { size: 18 })}
              </span>
            </button>
          </div>
        </section>

        <!-- Menu: Support Section -->
        <section class="space-y-4">
          <h3 class="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2">Soporte</h3>
          <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
            ${renderMenuItem('help-circle', 'Centro de Ayuda', 'help')}
            ${renderMenuItem('settings', 'Ajustes de la aplicación', 'settings')}
          </div>
        </section>

        <!-- Creator Shortcut -->
        <section class="space-y-4">
          <h3 class="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] ml-2">Creador</h3>
          <div class="bg-surface-container-high/40 rounded-[2rem] border border-outline-variant/5 overflow-hidden">
            <button 
              id="btn-goto-creator-dashboard"
              class="w-full flex items-center justify-between px-6 py-5 hover:bg-surface-container-highest/30 transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  ${icon('sparkles', { size: 20 })}
                </div>
                <span class="text-sm font-bold text-white group-hover:text-primary transition-colors">Panel del Creador</span>
              </div>
              <span class="text-white/20 group-hover:text-white/60 transition-colors">
                ${icon('chevron-right', { size: 18 })}
              </span>
            </button>
          </div>
        </section>

        <!-- Logout Section -->
        <section class="pb-10">
          <button 
            id="btn-profile-logout"
            class="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors active:scale-95 cursor-pointer"
          >
            ${icon('log-out', { size: 20 })}
            Cerrar Sesión
          </button>
        </section>
      </div>
    `;

    document.getElementById('profile-avatar-clickable')?.addEventListener('click', () => {
      window.location.hash = '#/avatar-picker';
    });

    document.getElementById('btn-goto-public-profile')?.addEventListener('click', () => {
      window.location.hash = `#/creator-profile/${user?.uid}`;
    });

    document.getElementById('btn-goto-creator-dashboard')?.addEventListener('click', () => {
      window.location.hash = '#/creator';
    });

    document.getElementById('btn-profile-logout')?.addEventListener('click', handleLogout);

    container.querySelectorAll('[data-nav-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-nav-view');
        activeView = v;
        render();
      });
    });
  }

  return unsubAuth;
}
