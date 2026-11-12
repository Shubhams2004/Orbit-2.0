import { UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';

const BASE_SETTINGS_KEY = 'orbit_user_settings_v2';

function getStorageKey(userId?: string): string {
  if (userId && userId.trim()) {
    return `${BASE_SETTINGS_KEY}_${userId.trim()}`;
  }
  return BASE_SETTINGS_KEY;
}

export const settingsService = {
  getSettings(userId?: string): UserSettings {
    try {
      const key = getStorageKey(userId);
      const stored = localStorage.getItem(key);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
      if (userId) {
        const baseStored = localStorage.getItem(BASE_SETTINGS_KEY);
        if (baseStored) {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(baseStored) };
        }
      }
    } catch {
      // Fallback on privacy or quota restrictions
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: UserSettings, userId?: string): void {
    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      // Ignore quota errors
    }
  },
};

