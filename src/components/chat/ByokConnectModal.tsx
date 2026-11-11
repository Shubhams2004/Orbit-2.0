import React, { useState, useEffect } from 'react';
import { ProviderConnection, ModelOption } from '../../types';
import { modelProviderService, AVAILABLE_MODELS } from '../../services/modelProviderService';
import {
  Sparkles,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Check,
  Trash2,
  ExternalLink,
  X,
  Eye,
  EyeOff,
  Cpu,
  Layers,
  Info,
} from 'lucide-react';

interface ByokConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProvider?: 'gemini' | 'openai' | 'anthropic' | 'cloudflare';
  currentModelId: string;
  onSelectModel: (modelId: string) => void;
}

export const ByokConnectModal: React.FC<ByokConnectModalProps> = ({
  isOpen,
  onClose,
  initialProvider = 'gemini',
  currentModelId,
  onSelectModel,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'cloudflare'>(
    initialProvider === 'cloudflare' ? 'gemini' : initialProvider
  );
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);

  // Sync initial provider when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialProvider !== 'cloudflare') {
        setSelectedProvider(initialProvider);
      }
      loadProviders();
      setErrorMsg(null);
      setSuccessMsg(null);
      setApiKey('');
      setIsUpdatingKey(false);
    }
  }, [isOpen, initialProvider]);

  const loadProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const list = await modelProviderService.getProviders();
      setProviders(list);

      // Set default selected model based on current provider
      const currentProviderInfo = list.find((p) => p.id === selectedProvider);
      if (currentProviderInfo?.preferredModel) {
        setSelectedModel(currentProviderInfo.preferredModel);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const activeProviderInfo = providers.find((p) => p.id === selectedProvider);
  const isAlreadyConnected = Boolean(activeProviderInfo?.isConfigured && activeProviderInfo.keyHint);

  const providerModels = AVAILABLE_MODELS.filter((m) => {
    if (selectedProvider === 'gemini') return m.providerKey === 'gemini';
    if (selectedProvider === 'openai') return m.providerKey === 'openai';
    if (selectedProvider === 'anthropic') return m.providerKey === 'anthropic';
    return m.providerKey === 'cloudflare';
  });

  // Keep selectedModel valid for provider
  useEffect(() => {
    if (providerModels.length > 0 && !providerModels.some((m) => m.id === selectedModel)) {
      setSelectedModel(providerModels[0].id);
    }
  }, [selectedProvider, providerModels]);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setErrorMsg('Please enter a valid API key.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await modelProviderService.connectProvider(
        selectedProvider,
        apiKey.trim(),
        selectedModel
      );

      setSuccessMsg(`Connected successfully with ${result.keyHint}!`);
      setApiKey('');
      setIsUpdatingKey(false);
      await loadProviders();

      if (selectedModel) {
        onSelectModel(selectedModel);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed. Please check your API key.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${activeProviderInfo?.name || selectedProvider}? Your stored encrypted key will be removed.`)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await modelProviderService.disconnectProvider(selectedProvider);
      setSuccessMsg('Provider disconnected successfully.');
      await loadProviders();

      // If currently selected model belonged to this provider, switch back to Cloudflare Workers AI
      const currentModelObj = AVAILABLE_MODELS.find((m) => m.id === currentModelId);
      if (currentModelObj?.providerKey === selectedProvider) {
        onSelectModel('orbit-agent-v2');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Disconnection failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDefaultWorkersAi = () => {
    onSelectModel('orbit-agent-v2');
    onClose();
  };

  const providerDocLinks: Record<string, { label: string; url: string; hint: string }> = {
    gemini: {
      label: 'Google AI Studio',
      url: 'https://aistudio.google.com/app/apikey',
      hint: 'Starts with AIzaSy...',
    },
    openai: {
      label: 'OpenAI API Keys',
      url: 'https://platform.openai.com/api-keys',
      hint: 'Starts with sk-... or sk-proj-...',
    },
    anthropic: {
      label: 'Anthropic Console',
      url: 'https://console.anthropic.com/settings/keys',
      hint: 'Starts with sk-ant-...',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-xs font-sans max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-neutral-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-neutral-100">
                Connect AI Provider (BYOK)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                Bring Your Own API Key • Encrypted at rest • Isolated to your account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors duration-150 cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
              Select Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gemini', name: 'Google Gemini', icon: Sparkles },
                { id: 'openai', name: 'OpenAI', icon: Cpu },
                { id: 'anthropic', name: 'Anthropic', icon: Layers },
              ].map((prov) => {
                const Icon = prov.icon;
                const isSelected = selectedProvider === prov.id;
                const provInfo = providers.find((p) => p.id === prov.id);
                const isConnected = provInfo?.isConfigured;

                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(prov.id as any);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setIsUpdatingKey(false);
                      setApiKey('');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-colors duration-150 flex flex-col justify-between gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-600 dark:text-white shadow-2xs'
                        : 'bg-slate-50 dark:bg-neutral-850/60 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      {isConnected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-xs leading-tight">{prov.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">
                        {isConnected ? 'Connected' : 'Not configured'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connected State Overview */}
          {isAlreadyConnected && !isUpdatingKey ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <div>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300 text-xs">
                      {activeProviderInfo?.name} Connected
                    </span>
                    <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                      Key Hint: {activeProviderInfo?.keyHint}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsUpdatingKey(true)}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
                  >
                    Update Key
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isSubmitting}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition-colors duration-150 flex items-center gap-1 cursor-pointer"
                    title="Disconnect key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>

              {/* Model Picker for this connected provider */}
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/30">
                <label className="block text-[11px] font-medium text-emerald-900 dark:text-emerald-300 mb-1.5">
                  Active Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {providerModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(m.id);
                        onClose();
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-colors duration-150 cursor-pointer flex items-center justify-between ${
                        currentModelId === m.id
                          ? 'bg-emerald-600 text-white border-transparent shadow-xs'
                          : 'bg-white dark:bg-neutral-900 border-emerald-200/80 dark:border-neutral-800 text-slate-800 dark:text-neutral-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-semibold text-xs truncate">{m.name}</div>
                        <div className={`text-[10px] ${currentModelId === m.id ? 'text-emerald-100' : 'text-slate-400 dark:text-neutral-500'}`}>
                          {m.contextWindow} context
                        </div>
                      </div>
                      {currentModelId === m.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Key Input Form */
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300">
                    {activeProviderInfo?.name || selectedProvider} API Key
                  </label>
                  {providerDocLinks[selectedProvider] && (
                    <a
                      href={providerDocLinks[selectedProvider].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1"
                    >
                      <span>Get key from {providerDocLinks[selectedProvider].label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={providerDocLinks[selectedProvider]?.hint || 'Enter API Key...'}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-neutral-850 dark:border-neutral-750 dark:text-white dark:placeholder-neutral-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-white cursor-pointer p-0.5"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model Picker */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Initial Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 dark:bg-neutral-850 dark:border-neutral-750 dark:text-white"
                >
                  {providerModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.contextWindow})
                    </option>
                  ))}
                </select>
              </div>

              {/* Security & Billing Disclaimers */}
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-neutral-850/60 border border-slate-200/80 dark:border-neutral-800 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-neutral-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Encrypted at rest (AES-256-GCM). Never logged or exposed.</span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-500 dark:text-neutral-400 pl-5">
                  <span>Usage is billed directly by {activeProviderInfo?.name || selectedProvider} to your account.</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                {isUpdatingKey ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUpdatingKey(false);
                      setApiKey('');
                    }}
                    className="min-h-[40px] px-3.5 text-xs text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
                  >
                    Cancel Update
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !apiKey.trim()}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs transition-colors duration-150 flex items-center gap-2 cursor-pointer shadow-xs ml-auto"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Encrypting & Connecting...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Save & Connect</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Cloudflare Workers AI Default Fallback Option */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800 dark:text-neutral-200 text-xs">
                  Orbit Core (Default)
                </div>
                <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                  Llama 3.1 8B Instruct Fast • Built-in • No key required
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelectDefaultWorkersAi}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 cursor-pointer ${
                currentModelId === 'orbit-agent-v2'
                  ? 'bg-slate-200 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border-transparent'
                  : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-neutral-850 dark:hover:bg-neutral-800 dark:text-neutral-200 border-slate-200 dark:border-neutral-750'
              }`}
            >
              {currentModelId === 'orbit-agent-v2' ? 'Active Default' : 'Switch to Built-in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
