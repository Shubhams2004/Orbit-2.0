import { UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';

const SETTINGS_KEY = 'orbit_user_settings_v2';

export const settingsService = {
  getSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback on privacy or quota restrictions
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore quota errors
    }
  },
};
