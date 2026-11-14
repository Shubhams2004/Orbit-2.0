import { UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { migrateModelPreference } from './modelProviderService';

const BASE_SETTINGS_KEY = 'orbit_user_settings_v2';

function getStorageKey(userId?: string): string {
  if (userId && userId.trim()) {
    return `${BASE_SETTINGS_KEY}_${userId.trim()}`;
  }
  return BASE_SETTINGS_KEY;
}

function normalizeLoadedSettings(raw: UserSettings, key: string): UserSettings {
  if (raw.defaultChatModel) {
    const resolved = migrateModelPreference(raw.defaultChatModel);
    if (resolved.migratedFrom) {
      const upgraded = { ...raw, defaultChatModel: resolved.modelId };
      try {
        localStorage.setItem(key, JSON.stringify(upgraded));
      } catch {}
      return upgraded;
    }
  }
  return raw;
}

export const settingsService = {
  getSettings(userId?: string): UserSettings {
    try {
      const key = getStorageKey(userId);
      const stored = localStorage.getItem(key);
      if (stored) {
        return normalizeLoadedSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }, key);
      }
      if (userId) {
        const baseStored = localStorage.getItem(BASE_SETTINGS_KEY);
        if (baseStored) {
          return normalizeLoadedSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(baseStored) }, key);
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

