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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 dark:bg-neutral-900 dark:hover:bg-neutral-850 dark:border-neutral-800 dark:text-neutral-100 transition-colors shadow-xs cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-violet-400" />
        <span>{selectedModel.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-xs">
            <div className="px-2.5 py-1.5 border-b border-slate-200 dark:border-neutral-800 mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
              <span className="font-semibold text-slate-800 dark:text-neutral-300">Model Engine</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Edge Intelligence</span>
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
                    className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 dark:bg-neutral-800 dark:border-transparent dark:text-white'
                        : 'hover:bg-slate-100 text-slate-700 dark:hover:bg-neutral-850 dark:text-neutral-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-neutral-100 truncate">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 dark:bg-neutral-950 dark:text-neutral-400 dark:border-transparent px-1 py-0.5 rounded">
                          {model.contextWindow}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {model.description}
                      </p>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
