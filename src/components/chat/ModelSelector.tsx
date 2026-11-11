import React, { useState, useEffect } from 'react';
import { ModelOption, ProviderConnection } from '../../types';
import { modelProviderService, AVAILABLE_MODELS } from '../../services/modelProviderService';
import { ChevronDown, Sparkles, Check, KeyRound, Plus, ShieldCheck } from 'lucide-react';

interface ModelSelectorProps {
  currentModelId: string;
  onSelectModel: (modelId: string) => void;
  onOpenConnectModal?: (provider?: 'gemini' | 'openai' | 'anthropic') => void;
  compact?: boolean;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModelId,
  onSelectModel,
  onOpenConnectModal,
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(AVAILABLE_MODELS);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const [loadedModels, loadedProviders] = await Promise.all([
          modelProviderService.getAvailableModels(),
          modelProviderService.getProviders(),
        ]);
        if (isMounted) {
          setModels(loadedModels);
          setProviders(loadedProviders);
        }
      } catch {
        // Fallback
      }
    };

    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const selectedModel =
    models.find((m) => m.id === currentModelId) || models[0] || AVAILABLE_MODELS[0];

  const handleModelClick = (model: ModelOption) => {
    // If model requires BYOK and is not configured, open the connection dialog
    if (model.providerKey && model.providerKey !== 'cloudflare' && !model.isConfigured) {
      setIsOpen(false);
      if (onOpenConnectModal) {
        onOpenConnectModal(model.providerKey as 'gemini' | 'openai' | 'anthropic');
      }
      return;
    }

    onSelectModel(model.id);
    setIsOpen(false);
  };

  const handleOpenConnect = (e: React.MouseEvent, providerKey?: 'gemini' | 'openai' | 'anthropic') => {
    e.stopPropagation();
    setIsOpen(false);
    if (onOpenConnectModal) {
      onOpenConnectModal(providerKey);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[40px] flex items-center gap-2 rounded-xl transition-colors duration-150 cursor-pointer ${
          compact
            ? 'px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-medium text-slate-800 dark:bg-neutral-850 dark:hover:bg-neutral-800 dark:border-neutral-750 dark:text-neutral-200'
            : 'px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 dark:bg-neutral-900 dark:hover:bg-neutral-850 dark:border-neutral-800 dark:text-neutral-100 shadow-xs'
        }`}
        title={`Active model: ${selectedModel.name} (${selectedModel.provider})`}
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-violet-400 shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[180px]">{selectedModel.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-neutral-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-84 sm:w-92 bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 text-xs max-h-[80vh] overflow-y-auto">
            {/* Header info */}
            <div className="px-3 py-2 border-b border-slate-200 dark:border-neutral-800 mb-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
              <span className="font-semibold text-slate-800 dark:text-neutral-200">AI Model & Provider</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">BYOK Supported</span>
            </div>

            {/* Model list grouped by provider */}
            <div className="space-y-1">
              {models.map((model) => {
                const isSelected = model.id === currentModelId;
                const isBuiltIn = model.providerKey === 'cloudflare' || model.isDefault;
                const isConfigured = Boolean(isBuiltIn || model.isConfigured);

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleModelClick(model)}
                    className={`w-full min-h-[44px] text-left p-2.5 rounded-xl transition-colors duration-150 flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 dark:bg-neutral-800 dark:border-transparent dark:text-white'
                        : 'hover:bg-slate-100 text-slate-700 dark:hover:bg-neutral-850 dark:text-neutral-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-neutral-100 truncate">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:text-neutral-400 dark:border-transparent px-1 py-0.5 rounded">
                          {model.contextWindow}
                        </span>
                        {isBuiltIn ? (
                          <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded-full border border-indigo-200 dark:border-indigo-800/40">
                            Default
                          </span>
                        ) : isConfigured ? (
                          <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            BYOK Ready
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50 px-1.5 py-0.2 rounded-full border border-amber-200 dark:border-amber-800/40">
                            Requires Key
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-1 leading-relaxed">
                        {model.description}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 mt-0.5">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : !isConfigured ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenConnect(e, model.providerKey as any)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 dark:text-indigo-400 dark:hover:bg-indigo-500 border border-indigo-200 dark:border-indigo-800 transition-colors"
                          title="Connect API Key"
                        >
                          Connect
                        </button>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom: Connect your AI Provider Action */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={(e) => handleOpenConnect(e)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-neutral-850 dark:hover:bg-neutral-800 dark:hover:text-indigo-400 text-slate-800 dark:text-neutral-200 text-xs font-medium transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer border border-dashed border-slate-300 dark:border-neutral-700"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Connect your AI provider (BYOK)</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
