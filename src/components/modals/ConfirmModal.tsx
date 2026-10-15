import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirmDialog } = useWorkspace();

  if (!confirmDialog.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 text-neutral-100 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                confirmDialog.isDestructive
                  ? 'bg-rose-500/10 text-rose-400'
                  : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-neutral-100">
              {confirmDialog.title}
            </h3>
          </div>
          <button
            onClick={closeConfirmDialog}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
          {confirmDialog.message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeConfirmDialog}
            className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              confirmDialog.onConfirm();
              closeConfirmDialog();
            }}
            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors ${
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
