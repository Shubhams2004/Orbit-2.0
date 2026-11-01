import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirmDialog } = useWorkspace();

  if (!confirmDialog.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white border border-slate-200 text-slate-900 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                confirmDialog.isDestructive
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                  : 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">
              {confirmDialog.title}
            </h3>
          </div>
          <button
            onClick={closeConfirmDialog}
            className="p-1 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
          {confirmDialog.message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeConfirmDialog}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-neutral-300 dark:hover:text-white dark:bg-neutral-800/80 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              confirmDialog.onConfirm();
              closeConfirmDialog();
            }}
            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer shadow-xs ${
              confirmDialog.isDestructive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {confirmDialog.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
