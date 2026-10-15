import React, { useState } from 'react';
import { ModelOption } from '../../types';
import { AVAILABLE_MODELS } from '../../services/modelProviderService';
import { ChevronDown, Sparkles, Check, Info } from 'lucide-react';

interface ModelSelectorProps {
  currentModelId: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModelId,
  onSelectModel,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedModel =
    AVAILABLE_MODELS.find((m) => m.id === currentModelId) || AVAILABLE_MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-xs text-neutral-200 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="font-semibold text-neutral-100">{selectedModel.name}</span>
        <span className="text-[10px] font-mono text-neutral-400 px-1.5 py-0.2 bg-neutral-800 rounded">
          {selectedModel.badge}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1.5 w-80 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-xs">
            <div className="px-2 py-1.5 border-b border-neutral-800 mb-1 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="font-semibold text-neutral-300">Select Model Engine</span>
              <span className="text-[10px] text-amber-400/90 font-mono">Simulated Prototype</span>
            </div>

            <div className="space-y-1">
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = model.id === currentModelId;

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-neutral-800/90 border border-violet-500/40 text-neutral-100'
                        : 'hover:bg-neutral-800/50 text-neutral-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-neutral-100 truncate">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.2 rounded bg-neutral-950">
                          {model.contextWindow}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                        {model.description}
                      </p>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 pt-0.5">
                        <span>Provider: {model.provider}</span>
                        {model.isAgentCapable && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-violet-400">Agent Action Capable</span>
                          </>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 pt-2 border-t border-neutral-800 px-2 py-1 text-[11px] text-neutral-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Edge routing to Cloudflare Workers configured in backend phase.</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
