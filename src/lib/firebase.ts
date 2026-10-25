/**
 * Firebase Client Initialization & Authentication Module
 * 
 * Provides:
 * - Email/Password registration & login
 * - Session persistence via Firebase Auth
 * - Dynamic ID token retrieval for Cloudflare Worker API authorization
 */

import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  onIdTokenChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';

const getInitialConfig = () => {
  let storedKey = '';
  try {
    storedKey = localStorage.getItem('orbit_custom_firebase_api_key') || '';
  } catch {}

  const envApiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_API_KEY) ||
    '';

  const isEnvKeyValid = Boolean(
    envApiKey &&
    !envApiKey.toLowerCase().includes('dummy') &&
    envApiKey !== 'AIzaSyDummyKeyForDevelopment12345'
  );

  const apiKey =
    (isEnvKeyValid ? envApiKey : storedKey.trim()) ||
    envApiKey ||
    'AIzaSyDummyKeyForDevelopment12345';

  return {
    apiKey,
    authDomain:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
      (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
      'orbit-2-auth.firebaseapp.com',
    projectId:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) ||
      (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_PROJECT_ID) ||
      'orbit-2-auth',
    storageBucket:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
      (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
      'orbit-2-auth.firebasestorage.app',
    messagingSenderId:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
      (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
      '39026315168',
    appId:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) ||
      (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_APP_ID) ||
      '1:39026315168:web:2741e68857b994821f1ec5',
  };
};

export const firebaseConfig = getInitialConfig();

/**
 * Checks whether a legitimate (non-dummy) Firebase API key is loaded
 */
export function isFirebaseConfigured(): boolean {
  const key = firebaseConfig.apiKey;
  return Boolean(
    key &&
    key !== 'AIzaSyDummyKeyForDevelopment12345' &&
    key.length > 20 &&
    !key.toLowerCase().includes('dummy')
  );
}

// Singleton Firebase App initialization
export let app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase Auth Instance
export let auth: Auth = getAuth(app);

/**
 * Saves a custom Firebase API key at runtime and reinitializes the Firebase client
 */
export async function saveCustomFirebaseApiKey(apiKey: string): Promise<boolean> {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;

  try {
    localStorage.setItem('orbit_custom_firebase_api_key', trimmed);
    firebaseConfig.apiKey = trimmed;

    if (getApps().length > 0) {
      await deleteApp(app);
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign in existing user with email and password
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  if (!isFirebaseConfigured()) {
    throw {
      code: 'auth/api-key-not-valid',
      message: 'Firebase API key is not configured for project "orbit-2-auth". Please set VITE_FIREBASE_API_KEY in Cloudflare build variables or project settings.',
    };
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/**
 * Register new user with email and password
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<FirebaseUser> {
  if (!isFirebaseConfigured()) {
    throw {
      code: 'auth/api-key-not-valid',
      message: 'Firebase API key is not configured for project "orbit-2-auth". Please set VITE_FIREBASE_API_KEY in Cloudflare build variables or project settings.',
    };
  }
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(credential.user, {
        displayName: displayName.trim(),
      });
    } catch {
      // Profile update non-fatal
    }
  }
  return credential.user;
}

/**
 * Sign out current user
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Retrieve current user's Firebase ID token
 */
export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(forceRefresh);
}

/**
 * Translate Firebase Auth error codes into human-readable messages
 */
export function formatFirebaseAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected authentication error occurred.';
  }

  const err = error as { code?: string; message?: string };
  switch (err.code) {
    case 'auth/api-key-not-valid':
      return 'Firebase API key is invalid or not yet configured for project "orbit-2-auth". Please set VITE_FIREBASE_API_KEY in your Cloudflare build variables or project settings.';
    case 'auth/internal-error':
      return 'Firebase Authentication encountered an internal error. Please verify your Firebase project configuration (VITE_FIREBASE_API_KEY) and network connectivity, then try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Access to this account has been temporarily disabled. Please reset your password or try again later.';
    case 'auth/network-request-failed':
      return 'Network connection error. Check your internet connection or verify Firebase configuration.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in your Firebase console. Please enable it under Authentication > Sign-in method.';
    default:
      if (typeof err.message === 'string' && (err.message.includes('auth/internal-error') || err.message.includes('internal error'))) {
        return 'Firebase Authentication encountered an internal error. Please verify your Firebase project configuration (VITE_FIREBASE_API_KEY) and network connectivity.';
      }
      return err.message || 'Authentication failed. Please check your credentials.';
  }
}

export { onAuthStateChanged, onIdTokenChanged };
export type { FirebaseUser };
