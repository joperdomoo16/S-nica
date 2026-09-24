import { db, collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from '../firebase.js';
import { onAuthUpdate } from '../auth.js';

let unsubscribeNotifs = null;

export function initNotifications() {
  const notifBtn = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const markAllBtn = document.getElementById('notif-mark-all');

  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown?.contains(e.target) && !notifBtn?.contains(e.target)) {
      dropdown?.classList.add('hidden');
    }
  });

  markAllBtn?.addEventListener('click', async () => {
    const list = document.getElementById('notif-list');
    const unreadElements = list?.querySelectorAll('.notif-item.unread');
    if (!unreadElements || unreadElements.length === 0) return;

    const batch = writeBatch(db);
    unreadElements.forEach(el => {
      const notifId = el.dataset.id;
      if (notifId) {
        batch.update(doc(db, 'notifications', notifId), { read: true });
      }
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Failed marking notifications read:", err);
    }
  });

  onAuthUpdate(({ user }) => {
    if (unsubscribeNotifs) {
      unsubscribeNotifs();
      unsubscribeNotifs = null;
    }

    if (user) {
      listenUserNotifications(user.uid);
    } else {
      updateBadge(0);
      renderEmpty();
    }
  });
}

function listenUserNotifications(uid) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid)
  );

  unsubscribeNotifs = onSnapshot(q, (snapshot) => {
    const notifs = [];
    let unreadCount = 0;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = { id: docSnap.id, ...data };
      notifs.push(item);
      if (!item.read) unreadCount++;
    });

    // Sort descending by date
    notifs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    updateBadge(unreadCount);
    renderNotifications(notifs);
  }, (err) => {
    console.warn("Notifications listener error:", err);
  });
}

function updateBadge(count) {
  const badge = document.getElementById('notif-count');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifications(notifs) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (notifs.length === 0) {
    renderEmpty();
    return;
  }

  list.innerHTML = '';
  notifs.slice(0, 10).forEach(n => {
    const item = document.createElement('div');
    item.className = `notif-item ${!n.read ? 'unread' : ''}`;
    item.dataset.id = n.id;
    item.innerHTML = `
      <div class="notif-item-title">${n.title || 'Notificación'}</div>
      <div class="notif-item-msg">${n.message || ''}</div>
    `;

    item.addEventListener('click', async () => {
      if (!n.read) {
        try {
          await updateDoc(doc(db, 'notifications', n.id), { read: true });
        } catch (e) {}
      }
      if (n.seriesId) {
        window.location.hash = `#/series/${n.seriesId}`;
        document.getElementById('notif-dropdown')?.classList.add('hidden');
      }
    });

    list.appendChild(item);
  });
}

function renderEmpty() {
  const list = document.getElementById('notif-list');
  if (list) {
    list.innerHTML = '<div class="notif-empty">No tienes notificaciones pendientes</div>';
  }
}
