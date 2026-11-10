import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { UserAvatar, ANIMATED_AVATAR_PRESETS } from '../components/common/UserAvatar';
import {
  User as UserIcon,
  Shield,
  Sparkles,
  Check,
  Copy,
  LogOut,
  Layers,
  CheckCircle2,
  MessageSquare,
  Clock,
  Key,
  ExternalLink,
  Flame,
  Radio,
  Image as ImageIcon,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const {
    user,
    updateUser,
    firebaseUser,
    logoutUser,
    tasks,
    projects,
    conversations,
    backendStatus,
    currentAuthToken,
  } = useWorkspace();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    role: user.role,
    bio: user.bio || 'Architecting distributed edge systems and AI copilot workspaces with Orbit 2.0.',
    statusMessage: user.statusMessage || 'Active on Cloudflare Edge',
    avatarUrl: user.avatarUrl,
    avatarAnimation: user.avatarAnimation || 'glow',
  });

  const [copiedUid, setCopiedUid] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Statistics
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const activeProjectsCount = projects.filter((p) => p.status === 'active' || p.status === 'in_progress').length;

  const handleCopyUid = () => {
    const uid = firebaseUser?.uid || user.id;
    navigator.clipboard?.writeText(uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSelectPreset = (url: string) => {
    setFormData((prev) => ({ ...prev, avatarUrl: url }));
    updateUser({ avatarUrl: url });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSelectAnimation = (anim: 'pulse' | 'glow' | 'spin' | 'orbit' | 'wave' | 'none') => {
    setFormData((prev) => ({ ...prev, avatarAnimation: anim }));
    updateUser({ avatarAnimation: anim });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAvatarUrl.trim()) {
      handleSelectPreset(customAvatarUrl.trim());
      setCustomAvatarUrl('');
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      name: formData.name.trim() || user.name,
      role: formData.role.trim() || user.role,
      bio: formData.bio.trim(),
      statusMessage: formData.statusMessage.trim(),
      avatarUrl: formData.avatarUrl,
      avatarAnimation: formData.avatarAnimation as any,
    });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const previewUser = {
    ...user,
    name: formData.name,
    role: formData.role,
    avatarUrl: formData.avatarUrl,
    avatarAnimation: formData.avatarAnimation as any,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Save Toast Notification */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-xl text-xs font-medium animate-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4" />
          <span>Profile and animated avatar updated successfully!</span>
        </div>
      )}

      {/* Header Profile Hero Card */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
        {/* Banner Gradient */}
        <div className="h-36 sm:h-44 w-full bg-linear-to-r from-indigo-900 via-indigo-600 to-cyan-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/30 backdrop-blur-md text-white border border-white/20">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>{formData.statusMessage || 'Edge Active'}</span>
            </span>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            {/* Animated Profile Image */}
            <div className="relative group">
              <UserAvatar
                user={previewUser}
                size="2xl"
                showAnimationRing={true}
                className="shadow-2xl ring-4 ring-white dark:ring-neutral-900"
              />
              <span className="absolute bottom-1 right-1 p-1 bg-indigo-600 rounded-full text-white shadow-md border-2 border-white dark:border-neutral-900">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {user.name}
                </h1>
                {firebaseUser ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    title="Verified Firebase Account"
                  >
                    <Shield className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                    Local Workspace
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                {user.role}
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md">
                {user.bio || 'Product Lead & AI Architect on Orbit 2.0.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 transition-colors"
            >
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
            {firebaseUser && (
              <button
                onClick={() => logoutUser()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Animated Avatar Studio), Right Column (Profile & Stats) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Animated Avatar Studio */}
        <div className="lg:col-span-1 space-y-6">
          {/* Animated Avatar Selector Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Animated Avatars
                </h3>
              </div>
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                5 Presets
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Select an animated vector image to power your presence across Orbit:
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 gap-2.5">
              {ANIMATED_AVATAR_PRESETS.map((preset) => {
                const isSelected = formData.avatarUrl === preset.url;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.url)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/50'
                        : 'border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 bg-slate-50/50 dark:bg-neutral-950/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-950 p-0.5 ring-1 ring-slate-300 dark:ring-neutral-700">
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-900 dark:text-white">
                          {preset.name}
                        </span>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-neutral-500">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                        {preset.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Animation Aura Effects */}
            <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 space-y-2.5">
              <label className="text-xs font-medium text-slate-700 dark:text-neutral-300 block">
                Avatar Aura Effect
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['glow', 'pulse', 'orbit', 'spin', 'wave', 'none'] as const).map((effect) => {
                  const isActive = formData.avatarAnimation === effect;
                  return (
                    <button
                      key={effect}
                      type="button"
                      onClick={() => handleSelectAnimation(effect)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-xs'
                          : 'border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {effect}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom GIF / Image URL */}
            <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 space-y-2">
              <label className="text-xs font-medium text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Custom Animated Image URL</span>
              </label>
              <form onSubmit={handleApplyCustomUrl} className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://.../avatar.gif"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!customAvatarUrl.trim()}
                  className="px-3 py-1.5 bg-indigo-600 disabled:opacity-40 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Details & Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile Form (conditional or display) */}
          {isEditing ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-500" />
                  <span>Edit Profile Details</span>
                </h3>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-neutral-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-neutral-300">
                      Title / Role
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-neutral-300">
                    Status Message
                  </label>
                  <input
                    type="text"
                    value={formData.statusMessage}
                    onChange={(e) => setFormData({ ...formData, statusMessage: e.target.value })}
                    placeholder="e.g. Architecting Orbit 2.0 Edge Systems"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-neutral-300">
                    Bio & Focus
                  </label>
                  <textarea
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Activity & Performance Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">Completed</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {completedTasks}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">Tasks finished</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">In Flight</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {inProgressTasks}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">Active tasks</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                <Layers className="w-4 h-4" />
                <span className="text-xs font-medium">Projects</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {activeProjectsCount}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">Active roadmaps</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-medium">Threads</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {conversations.length}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">AI sessions</p>
            </div>
          </div>

          {/* Account & Security Information */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Identity & Security Verification</span>
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-neutral-800 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Account Email</span>
                <span className="font-mono text-slate-900 dark:text-white font-medium">
                  {user.email}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">User UID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                    {firebaseUser?.uid ? `${firebaseUser.uid.slice(0, 16)}...` : user.id}
                  </span>
                  <button
                    onClick={handleCopyUid}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded"
                    title="Copy UID"
                  >
                    {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Edge Backend Status</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {backendStatus === 'connected' ? 'Connected (Cloudflare Edge D1)' : 'Offline Resilient Cache'}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Authentication Protocol</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-neutral-300">
                  Firebase RS256 JWT Token
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Bearer Session Token</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-neutral-400">
                  {currentAuthToken ? 'Active Session (Auto-Injected)' : 'Dev Token Enabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
