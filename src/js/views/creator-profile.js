import { 
  db, 
  auth, 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  serverTimestamp 
} from '../firebase.js';
import { icon } from '../icons.js';
import { calculateSeriesRating } from '../utils.js';

export function renderCreatorProfile(container, creatorId) {
  const DEFAULT_AVATAR = '/Avatar/21.png';
  let creator = null;
  let series = [];
  let isLoading = true;
  let isFollowing = false;
  let isFollowLoading = false;
  
  let unsubCreator = null;
  let unsubSeries = null;
  let unsubFollow = null;

  function init() {
    unsubCreator = onSnapshot(doc(db, 'users', creatorId), (docSnap) => {
      if (docSnap.exists()) {
        creator = { id: docSnap.id, ...docSnap.data() };
      } else {
        window.location.hash = '#/';
        return;
      }
      isLoading = false;
      render();
    });

    const q = query(
      collection(db, 'series'),
      where('creatorId', '==', creatorId),
      where('status', '==', 'publicado'),
      orderBy('createdAt', 'desc')
    );

    unsubSeries = onSnapshot(q, (snapshot) => {
      series = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });

    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid !== creatorId) {
      unsubFollow = onSnapshot(doc(db, `users/${currentUser.uid}/following/${creatorId}`), (snap) => {
        isFollowing = snap.exists();
        render();
      });
    }
  }

  async function handleFollow() {
    const user = auth.currentUser;
    if (!user) {
      window.location.hash = '#/login';
      return;
    }
    if (isFollowLoading) return;
    
    isFollowLoading = true;
    render();

    try {
      const followRef = doc(db, `users/${user.uid}/following/${creatorId}`);
      const followerRef = doc(db, `users/${creatorId}/followers/${user.uid}`);
      const creatorRef = doc(db, 'users', creatorId);

      if (isFollowing) {
        await deleteDoc(followRef);
        await deleteDoc(followerRef);
        await updateDoc(creatorRef, {
          followersCount: increment(-1)
        });
      } else {
        const timestamp = serverTimestamp();
        await setDoc(followRef, {
          creatorId,
          createdAt: timestamp
        });
        await setDoc(followerRef, {
          userId: user.uid,
          createdAt: timestamp
        });
        await updateDoc(creatorRef, {
          followersCount: increment(1)
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      isFollowLoading = false;
      render();
    }
  }

  function getUsername(c) {
    if (c.email === 'sonicaoriginal@gmail.com') return '@sonica';
    if (c.username) return `@${c.username}`;
    if (c.displayName?.startsWith('@')) return c.displayName;
    return `@${c.displayName?.replace(/\s+/g, '').toLowerCase() || 'usuario'}`;
  }

  function getDisplayName(c) {
    return c.email === 'sonicaoriginal@gmail.com' ? 'Sónica Originals' : (c.displayName || 'Usuario');
  }

  function render() {
    if (isLoading || !creator) {
      container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-surface-dim">
          <div class="animate-spin text-primary">${icon('loader2', { size: 40 })}</div>
        </div>
      `;
      return;
    }

    const isVerified = creator.isVerified || creator.email === 'sonicaoriginal@gmail.com';
    const isOwner = auth.currentUser && auth.currentUser.uid === creatorId;

    let followBtnHTML = '';
    if (!isOwner) {
      const btnClass = isFollowing 
        ? "bg-white/10 text-on-surface-variant border border-white/5" 
        : "bg-primary text-surface-dim";
      const iconHTML = isFollowLoading 
        ? icon('loader2', { size: 16, className: 'animate-spin' })
        : (isFollowing ? icon('check', { size: 20, strokeWidth: 3 }) : icon('plus', { size: 20, strokeWidth: 3 }));
      
      followBtnHTML = `
        <button id="btn-follow-creator" class="ml-2 w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-[0.98] shadow-lg ${btnClass} cursor-pointer">
          ${iconHTML}
        </button>
      `;
    }

    let socialHTML = '';
    if (creator.twitter || creator.instagram) {
      socialHTML = `
        <div class="flex gap-4 mt-8">
          ${creator.twitter ? `
            <a href="https://twitter.com/${creator.twitter}" target="_blank" rel="noreferrer" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-on-surface-variant hover:text-primary transition-colors border border-white/5">
              ${icon('twitter', { size: 20 })}
            </a>
          ` : ''}
          ${creator.instagram ? `
            <a href="https://instagram.com/${creator.instagram}" target="_blank" rel="noreferrer" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-on-surface-variant hover:text-primary transition-colors border border-white/5">
              ${icon('instagram', { size: 20 })}
            </a>
          ` : ''}
        </div>
      `;
    }

    let seriesHTML = '';
    if (series.length === 0) {
      seriesHTML = `
        <div class="col-span-full text-center py-20 opacity-30 italic">
          Este creador aún no tiene series publicadas.
        </div>
      `;
    } else {
      seriesHTML = series.map(item => `
        <div class="series-card bg-surface-container-high/20 backdrop-blur-xl rounded-[2.5rem] p-5 border border-white/5 hover:border-primary/20 transition-all cursor-pointer group flex flex-col gap-6" data-id="${item.id}">
          <div class="relative aspect-square rounded-[1.8rem] overflow-hidden shadow-xl">
            <img src="${item.thumbnail}" alt="" class="w-full h-full object-cover transition-transform group-hover:scale-110" referrerpolicy="no-referrer" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div class="absolute bottom-4 left-5 right-5 flex justify-between items-center text-white">
              <div class="bg-primary/20 backdrop-blur-md px-3 py-1 rounded-full border border-primary/30 flex items-center gap-1.5">
                ${icon('star', { size: 12, className: 'text-primary' })}
                <span class="text-[10px] font-black leading-none">${calculateSeriesRating(item)}</span>
              </div>
              <div class="flex items-center gap-1.5 text-primary">
                ${icon('play', { size: 12 })}
                <span class="text-[10px] font-black tracking-widest">${item.views || 0}</span>
              </div>
            </div>
          </div>
          
          <div class="space-y-2 px-2 pb-2">
            <span class="text-primary text-[10px] font-black uppercase tracking-[0.2em] opacity-60 italic">
              ${item.category}
            </span>
            <h4 class="text-xl font-black font-headline uppercase italic leading-none group-hover:text-primary transition-colors line-clamp-1">
              ${item.title}
            </h4>
            <p class="text-xs text-on-surface-variant font-medium line-clamp-2 opacity-60 italic">
              ${item.description}
            </p>
          </div>
        </div>
      `).join('');
    }

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-32">
        <!-- Hero Header -->
        <div class="relative h-64 w-full bg-surface-container-high overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-surface-dim z-10"></div>
          <img 
            src="${creator.photoURL || DEFAULT_AVATAR}" 
            alt="Cover" 
            class="w-full h-full object-cover opacity-30 blur-2xl scale-125"
            referrerpolicy="no-referrer"
          />
          <button id="btn-back-creator" class="absolute top-6 left-6 z-20 w-12 h-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer">
            ${icon('arrow-left', { size: 24 })}
          </button>
        </div>

        <div class="px-6 -mt-20 relative z-10 flex flex-col items-center">
          <!-- Avatar & Basic Info -->
          <div class="relative">
            <div class="w-40 h-40 rounded-[3rem] overflow-hidden border-4 border-surface-dim shadow-2xl bg-surface-container-high">
              <img 
                src="${creator.photoURL || DEFAULT_AVATAR}"
                alt="Avatar"
                class="w-full h-full object-cover"
                referrerpolicy="no-referrer"
              />
            </div>
            ${isVerified ? `
              <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-surface-dim rounded-2xl flex items-center justify-center shadow-lg border-4 border-surface-dim">
                ${icon('shield-check', { size: 20, strokeWidth: 3 })}
              </div>
            ` : ''}
          </div>

          <div class="mt-8 text-center space-y-2 flex flex-col items-center">
            <div class="flex items-center justify-center gap-2">
              <h1 class="text-3xl font-black font-headline text-white uppercase italic tracking-tighter">
                ${getDisplayName(creator)}
              </h1>
              ${isVerified ? icon('check-circle2', { size: 18, className: 'text-primary' }) : ''}
              ${followBtnHTML}
            </div>
            <p class="text-on-surface-variant font-black text-[10px] uppercase tracking-[0.4em]">
              ${getUsername(creator)}
            </p>
          </div>

          <!-- Stats Row -->
          <div class="flex items-center gap-8 mt-8 py-6 px-10 bg-surface-container-high/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5">
            <div class="text-center">
              <p class="text-xl font-black text-white">${series.length}</p>
              <p class="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">Series</p>
            </div>
            <div class="w-[1px] h-8 bg-white/10"></div>
            <div class="text-center">
              <p class="text-xl font-black text-white">${creator.followersCount || 0}</p>
              <p class="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">Seguidores</p>
            </div>
            <div class="w-[1px] h-8 bg-white/10"></div>
            <div class="text-center">
              <p class="text-xl font-black text-white">${creator.reviewsCount || 0}</p>
              <p class="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">Reseñas</p>
            </div>
          </div>

          <!-- Bio -->
          ${creator.bio ? `
            <p class="mt-8 text-center text-on-surface-variant text-sm max-w-md italic opacity-70 px-4">
              "${creator.bio}"
            </p>
          ` : ''}

          <!-- Social Links -->
          ${socialHTML}

          <!-- Series Created List -->
          <section class="w-full mt-16 space-y-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-2xl font-black font-headline tracking-tighter uppercase italic">Obras del Creador</h3>
              <span class="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                ${series.length} títulos
              </span>
            </div>

            <div class="grid grid-cols-1 gap-6">
              ${seriesHTML}
            </div>
          </section>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const btnBack = document.getElementById('btn-back-creator');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.history.back();
      });
    }

    const btnFollow = document.getElementById('btn-follow-creator');
    if (btnFollow) {
      btnFollow.addEventListener('click', handleFollow);
    }

    const cards = container.querySelectorAll('.series-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const sid = card.getAttribute('data-id');
        window.location.hash = `#/series/${sid}`;
      });
    });
  }

  init();

  return () => {
    if (unsubCreator) unsubCreator();
    if (unsubSeries) unsubSeries();
    if (unsubFollow) unsubFollow();
  };
}
