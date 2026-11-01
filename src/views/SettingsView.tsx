import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { TaskPriority } from '../types';
import {
  Moon,
  Sun,
  Palette,
  Sliders,
  Calendar,
  Clock,
  Bot,
  Shield,
  Download,
  RotateCcw,
  Check,
  Cpu,
} from 'lucide-react';

import { isProductionEnv, isDevToken } from '../services/apiClient';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    user,
    tasks,
    projects,
    activities,
    resetToSampleData,
    showConfirmDialog,
    backendStatus,
    currentAuthToken,
    setCurrentAuthToken,
  } = useWorkspace();

  const [savedNotice, setSavedNotice] = useState(false);
  const [tokenInput, setTokenInput] = useState(currentAuthToken);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    setTokenInput(currentAuthToken);
  }, [currentAuthToken]);

  const handleApplyToken = () => {
    setTokenError(null);
    const cleanToken = tokenInput.trim();
    if (!cleanToken) return;

    if (isProductionEnv() && isDevToken(cleanToken)) {
      setTokenError('Development tokens are disabled in production. Please sign in with Firebase.');
      return;
    }

    setCurrentAuthToken(cleanToken);
    showSaved();
  };

  const showSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleExportData = () => {
    const data = {
      exportVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      user,
      settings,
      projects,
      tasks,
      activities,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    showConfirmDialog({
      title: 'Reset to Sample Data',
      message: 'This will restore all default seed tasks, projects, activities, and AI agent messages. Your current session edits will be reset.',
      confirmText: 'Reset Sample Data',
      isDestructive: true,
      onConfirm: () => {
        resetToSampleData();
        showSaved();
      },
    });
  };

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">
            Workspace Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Configure appearance, task defaults, autonomous agent permissions, and export data.
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Preferences Saved</span>
          </div>
        )}
      </div>

      {/* 1. Appearance */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
          <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Appearance</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Theme Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  updateSettings({ theme: 'dark' });
                  showSaved();
                }}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  settings.theme === 'dark'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 dark:bg-neutral-800 dark:border-indigo-500 dark:text-white font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Dark (Default)</span>
                </div>
                {settings.theme === 'dark' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  updateSettings({ theme: 'light' });
                  showSaved();
                }}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  settings.theme === 'light'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 dark:bg-neutral-800 dark:border-indigo-500 dark:text-white font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Light</span>
                </div>
                {settings.theme === 'light' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              </button>
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-2">
              Interface Accent
            </label>
            <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl">
              {['indigo', 'violet', 'emerald', 'cyan', 'amber'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    updateSettings({ accentColor: color });
                    showSaved();
                  }}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                    color === 'indigo'
                      ? 'bg-indigo-500'
                      : color === 'violet'
                      ? 'bg-violet-500'
                      : color === 'emerald'
                      ? 'bg-emerald-500'
                      : color === 'cyan'
                      ? 'bg-cyan-500'
                      : 'bg-amber-500'
                  } ${settings.accentColor === color ? 'ring-2 ring-indigo-500 dark:ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                  title={color}
                />
              ))}
              <span className="text-xs text-slate-600 dark:text-neutral-400 capitalize ml-2">
                {settings.accentColor}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. General Preferences */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
            General Preferences
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Default Task View
            </label>
            <select
              value={settings.defaultTaskView}
              onChange={(e) => {
                updateSettings({ defaultTaskView: e.target.value as 'list' | 'board' });
                showSaved();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-neutral-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="list">List View</option>
              <option value="board">Kanban Board View</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Default Task Priority
            </label>
            <select
              value={settings.defaultTaskPriority}
              onChange={(e) => {
                updateSettings({ defaultTaskPriority: e.target.value as TaskPriority });
                showSaved();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-neutral-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Start of Week
            </label>
            <select
              value={settings.startOfWeek}
              onChange={(e) => {
                updateSettings({ startOfWeek: e.target.value as 'monday' | 'sunday' });
                showSaved();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-neutral-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Date & Time Preferences */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
            Date & Time Format
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Time Format
            </label>
            <select
              value={settings.timeFormat}
              onChange={(e) => {
                updateSettings({ timeFormat: e.target.value as '12h' | '24h' });
                showSaved();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-neutral-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="12h">12-hour (e.g. 09:30 AM)</option>
              <option value="24h">24-hour (e.g. 09:30)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Date Format
            </label>
            <select
              value={settings.dateFormat}
              onChange={(e) => {
                updateSettings({ dateFormat: e.target.value as any });
                showSaved();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-neutral-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US standard)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. AI Agent Preferences */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
          <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
            AI Agent Permissions
          </h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl">
            <div>
              <span className="font-semibold text-slate-900 dark:text-neutral-200 block">
                Human-in-the-Loop Approval Requirement
              </span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                Agent cannot modify tasks or projects without explicit user click approval.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.requireAgentApproval}
              onChange={(e) => {
                updateSettings({ requireAgentApproval: e.target.checked });
                showSaved();
              }}
              className="w-4 h-4 rounded border-slate-300 dark:border-neutral-700 text-violet-600 focus:ring-violet-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl">
            <div>
              <span className="font-semibold text-slate-900 dark:text-neutral-200 block">
                Auto-Suggest Workflow Prompts
              </span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                Display recommended task triage chips across dashboard and agent view.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSuggestPrompts}
              onChange={(e) => {
                updateSettings({ autoSuggestPrompts: e.target.checked });
                showSaved();
              }}
              className="w-4 h-4 rounded border-slate-300 dark:border-neutral-700 text-violet-600 focus:ring-violet-500"
            />
          </div>
        </div>
      </div>

      {/* 5. Cloudflare Workers & D1 Integration Architecture */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
              Cloudflare Workers & D1 Persistent Storage
            </h2>
          </div>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
              backendStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
            }`}
          >
            {backendStatus === 'connected' ? '● Connected: /api/v1' : '● Offline Dev Fallback'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
          Orbit 2.0 features a dedicated Cloudflare Workers backend (<code className="text-indigo-600 dark:text-sky-300 font-mono">worker/index.ts</code>)
          connected to Cloudflare D1 with versioned SQL migrations in <code className="text-indigo-600 dark:text-sky-300 font-mono">migrations/</code>.
        </p>

        <div className="p-3 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl text-xs font-mono text-slate-800 dark:text-neutral-300 space-y-1.5">
          <div><span className="text-slate-500 dark:text-neutral-500">API Route:</span> /api/v1 (Tasks, Projects, Conversations)</div>
          <div><span className="text-slate-500 dark:text-neutral-500">Database Engine:</span> Cloudflare D1 SQLite (Binding: DB)</div>
          <div><span className="text-slate-500 dark:text-neutral-500">Verification:</span> Web Crypto HS256 JWT Verification</div>
          <div><span className="text-slate-500 dark:text-neutral-500">Active Bearer Token:</span> <span className="break-all text-slate-600 dark:text-neutral-400">{currentAuthToken}</span></div>
        </div>

        {/* Custom Bearer Token / Production JWT input */}
        <div className="pt-2 space-y-2 text-xs">
          <label className="font-semibold text-slate-900 dark:text-neutral-200 block">
            Bearer Token / Production Signed JWT
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste signed HS256 JWT or dev bearer token"
              className="flex-1 bg-slate-50 border border-slate-200 dark:bg-neutral-950 dark:border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleApplyToken}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-xs font-medium border border-slate-800 dark:border-neutral-700 transition-colors cursor-pointer"
            >
              Apply Token
            </button>
          </div>
          {tokenError && (
            <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{tokenError}</p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
            In production, a verified Firebase ID token is required. Development tokens (<code className="text-slate-800 dark:text-neutral-300 font-mono">dev_*</code>) are strictly rejected in production.
          </p>
        </div>

        {/* Multi-user token test switch (development sandbox only, disabled in production) */}
        {!isProductionEnv() && (
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-200 dark:border-neutral-800/80">
            <div>
              <span className="font-semibold text-slate-900 dark:text-neutral-200 block">Development Preset Tokens</span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                Switch development identity to test data isolation across users in local development.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentAuthToken('dev_usr_main_01');
                  showSaved();
                }}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                  currentAuthToken === 'dev_usr_main_01'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-neutral-950 dark:text-neutral-400 dark:border-neutral-800 dark:hover:text-white'
                }`}
              >
                User 1 (Alex)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentAuthToken('dev_user_beta_02');
                  showSaved();
                }}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                  currentAuthToken === 'dev_user_beta_02'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-neutral-950 dark:text-neutral-400 dark:border-neutral-800 dark:hover:text-white'
                }`}
              >
                User 2 (Isolated)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Data Management */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
          <Shield className="w-4 h-4 text-slate-400 dark:text-neutral-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
            Data Management
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl dark:text-neutral-200 dark:hover:text-white dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:border-neutral-700 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Workspace (JSON)</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50/50 hover:bg-rose-50 border border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:bg-neutral-950 dark:border-neutral-800 dark:hover:border-rose-900 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
