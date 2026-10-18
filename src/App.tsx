/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { OverviewView } from './views/OverviewView';
import { TasksView } from './views/TasksView';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { ChatTerminalView } from './views/ChatTerminalView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { QuickCreateModal } from './components/modals/QuickCreateModal';
import { CommandPaletteModal } from './components/modals/CommandPaletteModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { AuthModal } from './components/modals/AuthModal';

const WorkspaceShell: React.FC = () => {
  const {
    currentPage,
    settings,
    apiError,
    clearApiError,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
  } = useWorkspace();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderActiveView = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewView />;
      case 'tasks':
        return <TasksView />;
      case 'projects':
        return <ProjectsView />;
      case 'project_detail':
        return <ProjectDetailView />;
      case 'agent':
        return <ChatTerminalView />;
      case 'activity':
        return <ActivityView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div
      className={`min-h-screen flex text-neutral-100 ${
        settings.theme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50 text-neutral-900'
      }`}
    >
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {apiError && (
            <div className="mb-4 px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span>{apiError}</span>
              </div>
              <button
                type="button"
                onClick={clearApiError}
                className="p-1 hover:text-white rounded"
                title="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals & Command Overlays */}
      <QuickCreateModal />
      <CommandPaletteModal />
      <ConfirmModal />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
    </div>
  );
};

export default function App() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
