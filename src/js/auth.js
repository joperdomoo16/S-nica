import { 
  auth, 
  db, 
  storage, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  googleProvider, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from './firebase.js';
import { showToast } from './components/toast.js';

let currentUser = null;
let currentProfile = null;
let isAdmin = false;
const authListeners = [];

// Generador determinista de ID de Sonica de 8 dígitos
export function generateSonicaID(uid) {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 33) ^ uid.charCodeAt(i);
  }
  const positiveHash = Math.abs(hash);
  const eightDigit = (positiveHash % 90000000) + 10000000;
  return eightDigit.toString();
}

// Suscribirse a las actualizaciones del estado de autenticación
export function onAuthUpdate(callback) {
  authListeners.push(callback);
  if (currentUser !== null || currentProfile !== null) {
    callback({ user: currentUser, profile: currentProfile, isAdmin });
  }
}

function notifyAuthListeners() {
  authListeners.forEach(cb => {
    try {
      cb({ user: currentUser, profile: currentProfile, isAdmin });
    } catch (e) {
      console.error("Error in auth listener callback:", e);
    }
  });
}

// Comprobar si el usuario es administrador
async function checkAdminStatus(user) {
  if (!user) return false;
  if (user.email === 'sonicaoriginal@gmail.com') return true;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch (err) {
    console.warn("Could not check admin status:", err);
    return false;
  }
}

// Obtener o crear el perfil de usuario en Firestore
export async function syncUserProfile(user, customData = {}) {
  if (!user) {
    currentProfile = null;
    isAdmin = false;
    notifyAuthListeners();
    return null;
  }

  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const isSuper = user.email?.trim().toLowerCase() === 'sonicaoriginal@gmail.com';
      const sonicaId = generateSonicaID(user.uid);
      const newProfile = {
        displayName: customData.displayName || user.displayName || 'Usuario',
        username: (customData.username || user.email?.split('@')[0] || `user${sonicaId.slice(-4)}`).toLowerCase().replace(/[^a-z0-9]/g, ''),
        email: user.email || '',
        photoURL: customData.photoURL || user.photoURL || '/Avatar/21.png',
        sonicaId: sonicaId,
        categoryInterests: {},
        premium: isSuper,
        isPremium: isSuper,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(userRef, newProfile);
      currentProfile = newProfile;

      if (isSuper) {
        await setDoc(doc(db, 'admins', user.uid), {
          email: user.email,
          role: 'superadmin',
          createdAt: serverTimestamp()
        });
      }
    } else {
      currentProfile = snap.data();
      // Asegurar que exista sonicaId
      if (!currentProfile.sonicaId) {
        const sonicaId = generateSonicaID(user.uid);
        await updateDoc(userRef, { sonicaId, updatedAt: serverTimestamp() });
        currentProfile.sonicaId = sonicaId;
      }
    }

    isAdmin = await checkAdminStatus(user);
    notifyAuthListeners();
    return currentProfile;
  } catch (error) {
    console.error("Error syncing user profile:", error);
    return null;
  }
}

// Inicializar el Servicio de Autenticación
export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      await syncUserProfile(user);
    } else {
      currentProfile = null;
      isAdmin = false;
      notifyAuthListeners();
    }
  });
}

// Iniciar sesión con Correo y Contraseña
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await syncUserProfile(cred.user);
    showToast('¡Bienvenido de nuevo a Sónica!', 'success');
    return cred.user;
  } catch (error) {
    let msg = 'Error al iniciar sesión.';
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      msg = 'Correo electrónico o contraseña incorrectos.';
    } else if (error.code === 'auth/user-not-found') {
      msg = 'No existe una cuenta registrada con este correo.';
    }
    showToast(msg, 'error');
    throw error;
  }
}

// Iniciar sesión con Google
export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(cred.user);
    showToast('Sesión iniciada con Google.', 'success');
    return cred.user;
  } catch (error) {
    console.error("Google sign-in error:", error);
    showToast('No se pudo completar el inicio de sesión con Google.', 'error');
    throw error;
  }
}

// Registrarse con Correo, Nombre de usuario y Avatar
export async function registerWithEmail(email, password, displayName, username, photoURL = '/Avatar/21.png') {
  try {
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername) {
      throw new Error('El nombre de usuario es obligatorio.');
    }
    if (!/^[a-zA-Z0-9]+$/.test(cleanUsername)) {
      throw new Error('El nombre de usuario solo puede contener letras y números.');
    }

    // Comprobar que el nombre de usuario sea único en Firestore
    const qUsername = query(collection(db, 'users'), where('username', '==', cleanUsername));
    const userSnap = await getDocs(qUsername);
    if (!userSnap.empty) {
      throw new Error('El nombre de usuario ya está en uso. Por favor elige otro.');
    }

    // Crear usuario en Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await syncUserProfile(cred.user, {
      displayName: displayName.trim(),
      username: cleanUsername,
      photoURL: photoURL
    });

    showToast('¡Cuenta creada exitosamente en Sónica!', 'success');
    return cred.user;
  } catch (error) {
    showToast(error.message || 'Error al registrar la cuenta.', 'error');
    throw error;
  }
}

// Actualizar el Perfil de Usuario
export async function updateProfileData({ displayName, username, photoURL }) {
  if (!currentUser) throw new Error('No hay sesión activa.');
  const userRef = doc(db, 'users', currentUser.uid);

  const updates = { updatedAt: serverTimestamp() };
  if (displayName) updates.displayName = displayName.trim();
  if (photoURL) updates.photoURL = photoURL;

  if (username) {
    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '');
    if (!/^[a-zA-Z0-9]+$/.test(cleanUser)) {
      throw new Error('Nombre de usuario inválido.');
    }
    const q = query(collection(db, 'users'), where('username', '==', cleanUser));
    const snaps = await getDocs(q);
    const isTaken = snaps.docs.some(d => d.id !== currentUser.uid);
    if (isTaken) {
      throw new Error('El nombre de usuario ya está registrado.');
    }
    updates.username = cleanUser;
  }

  await updateDoc(userRef, updates);
  currentProfile = { ...currentProfile, ...updates };
  notifyAuthListeners();
  showToast('Perfil actualizado correctamente.', 'success');
}

// Cerrar sesión
export async function logout() {
  try {
    await signOut(auth);
    showToast('Has cerrado sesión.', 'info');
  } catch (error) {
    console.error("Logout error:", error);
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function getUserProfile() {
  return currentProfile;
}

export function isCurrentUserAdmin() {
  return isAdmin;
}

export { auth };
