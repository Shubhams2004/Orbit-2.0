import React, { useState, useEffect, useMemo } from 'react';
import { ModelOption, ProviderConnection, ModelCategory } from '../../types';
import { modelProviderService, AVAILABLE_MODELS } from '../../services/modelProviderService';
import {
  ChevronDown,
  Sparkles,
  Check,
  KeyRound,
  Search,
  Zap,
  Scale,
  Brain,
  Code2,
  Cpu,
  RefreshCw,
  Eye,
  AudioLines,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ModelSelectorProps {
  currentModelId: string;
  onSelectModel: (modelId: string) => void;
  onOpenConnectModal?: (provider?: 'gemini' | 'openai' | 'anthropic') => void;
  compact?: boolean;
  className?: string;
}

const CATEGORIES: Array<{ id: 'all' | ModelCategory; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'fast', label: 'Fast', icon: Zap },
  { id: 'balanced', label: 'Balanced', icon: Scale },
  { id: 'reasoning', label: 'Reasoning', icon: Brain },
  { id: 'coding', label: 'Coding & Agentic', icon: Code2 },
  { id: 'specialized', label: 'Specialized', icon: Cpu },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ModelCategory>('all');
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryNotice, setDiscoveryNotice] = useState<string | null>(null);

  // Load models & providers
  const loadCatalog = async (forceDiscover = false) => {
    try {
      const [loadedModels, loadedProviders] = await Promise.all([
        modelProviderService.getAvailableModels(forceDiscover),
        modelProviderService.getProviders(),
      ]);
      setModels(loadedModels);
      setProviders(loadedProviders);
    } catch {
      // Fallback
    }
  };

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

  // Live model discovery trigger
  const handleTriggerDiscovery = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDiscovering(true);
    setDiscoveryNotice(null);
    try {
      const result = await modelProviderService.discoverModels();
      setModels(result.models);
      const verifiedCount = result.models.filter((m) => m.isDiscovered).length;
      setDiscoveryNotice(`Discovered & verified ${verifiedCount} models via official APIs.`);
    } catch {
      setDiscoveryNotice('Discovery offline. Used curated official catalog.');
    } finally {
      setIsDiscovering(false);
    }
  };

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

  // Filtered models based on search query, category, and configured status
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'coding') {
          if (model.category !== 'coding' && !model.isAgentCapable) return false;
        } else if (model.category !== selectedCategory) {
          return false;
        }
      }

      // Configured-only toggle
      if (onlyConfigured) {
        const isReady = model.isDefault || model.providerKey === 'cloudflare' || model.isConfigured;
        if (!isReady) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = model.name.toLowerCase().includes(query);
        const matchesId = model.id.toLowerCase().includes(query);
        const matchesProvider = model.provider.toLowerCase().includes(query);
        const matchesDesc = model.description.toLowerCase().includes(query);
        const matchesCategory = (model.categoryLabel || '').toLowerCase().includes(query);
        const matchesBadge = (model.badge || '').toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesProvider && !matchesDesc && !matchesCategory && !matchesBadge) {
          return false;
        }
      }

      return true;
    });
  }, [models, selectedCategory, onlyConfigured, searchQuery]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button - Responsive with clean truncation to prevent mobile clipping */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[40px] flex items-center gap-1.5 sm:gap-2 rounded-xl transition-colors duration-150 cursor-pointer max-w-full ${
          compact
            ? 'px-2 sm:px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-medium text-slate-800 dark:bg-neutral-850 dark:hover:bg-neutral-800 dark:border-neutral-750 dark:text-neutral-200'
            : 'px-3 sm:px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 dark:bg-neutral-900 dark:hover:bg-neutral-850 dark:border-neutral-800 dark:text-neutral-100 shadow-xs'
        }`}
        title={`Active model: ${selectedModel.name} (${selectedModel.provider})`}
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-violet-400 shrink-0" />
        <span className="truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[170px] text-left">
          {selectedModel.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-neutral-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover & Mobile Responsive Sheet */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent backdrop-blur-xs sm:backdrop-blur-none"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Popover - Boundary constrained: never clips horizontally or overflows viewport */}
          <div className="fixed inset-x-2.5 bottom-2.5 sm:inset-auto sm:left-0 sm:bottom-full sm:mb-2 w-auto sm:w-[480px] max-w-[calc(100vw-20px)] bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 text-xs max-h-[82vh] flex flex-col overflow-hidden">
            {/* Header: Title, Discovery status, & Close */}
            <div className="px-3.5 py-3 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between bg-slate-50/70 dark:bg-neutral-900/80">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-neutral-100">
                  Select AI Model
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/40 px-1.5 py-0.5 rounded-full font-medium">
                  BYOK Enabled
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTriggerDiscovery}
                  disabled={isDiscovering}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Verify models with connected provider APIs"
                >
                  <RefreshCw className={`w-3 h-3 ${isDiscovering ? 'animate-spin text-indigo-500' : ''}`} />
                  <span className="hidden xs:inline">{isDiscovering ? 'Discovering...' : 'Discover'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Close model selector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Discovery Notice Banner (if triggered) */}
            {discoveryNotice && (
              <div className="px-3.5 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/50 border-b border-indigo-100 dark:border-indigo-900/50 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                <span>{discoveryNotice}</span>
                <button
                  type="button"
                  onClick={() => setDiscoveryNotice(null)}
                  className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-200 ml-2"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Search Input & Configured Only Filter */}
            <div className="p-2.5 pb-2 border-b border-slate-100 dark:border-neutral-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models by name, provider, or capability..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-neutral-850 border border-slate-200 dark:border-neutral-750 rounded-xl text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills (Horizontal scrollable with zero clipping) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-neutral-850 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}

                <div className="ml-auto pl-2 shrink-0">
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyConfigured}
                      onChange={(e) => setOnlyConfigured(e.target.checked)}
                      className="rounded border-slate-300 dark:border-neutral-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Ready only</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Scrollable Model List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 overscroll-contain">
              {filteredModels.length === 0 ? (
                <div className="text-center py-8 px-4 text-slate-500 dark:text-neutral-400">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="font-medium text-xs">No matching models found</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try adjusting your search query or category filter.
                  </p>
                </div>
              ) : (
                filteredModels.map((model) => {
                  const isSelected = model.id === currentModelId;
                  const isBuiltIn = model.providerKey === 'cloudflare' || model.isDefault;
                  const isConfigured = Boolean(isBuiltIn || model.isConfigured);
                  const isPreview = model.status === 'preview';

                  return (
                    <div
                      key={model.id}
                      onClick={() => handleModelClick(model)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-150 flex flex-col gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 dark:bg-neutral-800/90 dark:border-indigo-600/50 dark:text-white shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 dark:bg-neutral-900 dark:hover:bg-neutral-850 dark:border-neutral-800 text-slate-800 dark:text-neutral-200'
                      }`}
                    >
                      {/* Top Row: Name, Provider, Context Window, Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-semibold text-xs text-slate-900 dark:text-neutral-100">
                            {model.name}
                          </span>

                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                            · {model.provider}
                          </span>

                          {/* Verified Context Window Chip */}
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:text-neutral-400 dark:border-neutral-800 px-1.5 py-0.2 rounded font-medium">
                            {model.contextWindow}
                          </span>

                          {/* Preview tag */}
                          {isPreview && (
                            <span className="text-[9px] font-medium text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/60 px-1.5 py-0.2 rounded-full border border-purple-200 dark:border-purple-800/40">
                              Preview
                            </span>
                          )}

                          {/* Category Label */}
                          {model.categoryLabel && (
                            <span className="text-[9px] font-medium text-slate-600 bg-slate-100 dark:text-neutral-400 dark:bg-neutral-800 px-1.5 py-0.2 rounded-full">
                              {model.categoryLabel}
                            </span>
                          )}
                        </div>

                        {/* Status Chip & Selection / Connect Action */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isBuiltIn ? (
                            <span className="text-[9px] font-medium text-indigo-700 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/40">
                              Default
                            </span>
                          ) : isConfigured ? (
                            <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Ready
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleOpenConnect(e, model.providerKey as any)}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800/60 transition-colors cursor-pointer"
                              title="Connect API Key"
                            >
                              Connect Key
                            </button>
                          )}

                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {model.description}
                      </p>

                      {/* Bottom Capabilities Row (Modalities & Reasoning) */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] text-slate-500 dark:text-neutral-400">
                        {model.reasoningCapability && model.reasoningCapability !== 'standard' && (
                          <span className="flex items-center gap-0.5 text-indigo-700 dark:text-indigo-300 font-medium">
                            <Brain className="w-2.5 h-2.5" />
                            {model.reasoningCapability === 'advanced'
                              ? 'Advanced Reasoning'
                              : model.reasoningCapability === 'hybrid'
                              ? 'Hybrid Thinking'
                              : 'Agentic'}
                          </span>
                        )}

                        {model.modalities && model.modalities.includes('image') && (
                          <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded text-[10px]">
                            <Eye className="w-2.5 h-2.5" />
                            Vision
                          </span>
                        )}

                        {model.modalities && model.modalities.includes('audio') && (
                          <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded text-[10px]">
                            <AudioLines className="w-2.5 h-2.5" />
                            Audio
                          </span>
                        )}

                        {model.isDiscovered && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-auto font-medium">
                            ✓ Live API Verified
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Bar: Quick Connect your AI Provider (BYOK) */}
            <div className="p-2.5 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/60 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={(e) => handleOpenConnect(e)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-neutral-850 dark:hover:bg-neutral-800 dark:text-indigo-300 text-xs font-medium transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer border border-dashed border-indigo-300 dark:border-neutral-700"
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
