import { db, doc, getDoc } from './firebase.js';

export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export function parseDate(value) {
  if (!value) return new Date();
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000));
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  return new Date();
}

export function getColombiaTime(value) {
  const d = parseDate(value);
  const colombiaOffset = -5 * 60; // -300 minutes
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (colombiaOffset * 60000));
}

export function getColombiaHoursElapsed(createdAtValue) {
  try {
    const nowCol = getColombiaTime();
    const createdCol = getColombiaTime(createdAtValue);
    const diffMs = nowCol.getTime() - createdCol.getTime();
    return diffMs / (1000 * 60 * 60);
  } catch (e) {
    console.error("Error calculating hours elapsed in Colombia time:", e);
    return 0;
  }
}

export function calculateSeriesRating(series) {
  if (series?.ratingSum && series?.ratingCount && series.ratingCount > 0) {
    return (series.ratingSum / series.ratingCount).toFixed(1);
  }
  return typeof series?.rating === 'number' ? series.rating.toFixed(1) : (series?.rating || '0.0');
}

export async function handleShare(title, text) {
  const url = window.location.href;
  const shareData = {
    title: title || 'Sónica',
    text: text || 'Escucha este contenido en Sónica',
    url: url
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert('¡Enlace copiado al portapapeles!');
    } catch (err) {
      alert('No se pudo copiar el enlace.');
    }
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        await copyToClipboard();
      }
    }
  } else {
    await copyToClipboard();
  }
}

export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  if (typeof seconds === 'string') return seconds.replace(' min', '').toUpperCase();
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} MIN`;
}

export function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Reciente';
  try {
    const date = getColombiaTime(dateInput);
    const now = getColombiaTime();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} m`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString();
  } catch {
    return 'Reciente';
  }
}

export function optimizeImage(base64Str, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
}

const userCache = new Map();
export async function getCachedUser(userId) {
  if (!userId) return null;
  if (userCache.has(userId)) return userCache.get(userId);
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data();
      userCache.set(userId, data);
      return data;
    }
  } catch (e) {
    console.warn('Error fetching cached user:', e);
  }
  return null;
}

