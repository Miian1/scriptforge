'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
import Dashboard from '@/components/dashboard/Dashboard';
import CreateProject from '@/components/project/CreateProject';
import ScriptEditor from '@/components/editor/ScriptEditor';
import Settings from '@/components/settings/Settings';
import About from '@/components/about/About';
import { Toaster } from '@/components/ui/sonner';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2,
};

function ViewRouter() {
  const currentView = useAppStore((s) => s.currentView);

  const viewMap: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    'create-project': <CreateProject />,
    editor: <ScriptEditor />,
    settings: <Settings />,
    about: <About />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="flex flex-1 flex-col min-h-0"
      >
        {viewMap[currentView]}
      </motion.div>
    </AnimatePresence>
  );
}

function AppContent() {
  const loadProjects = useAppStore((s) => s.loadProjects);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const currentView = useAppStore((s) => s.currentView);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Sidebar widths: expanded=256px(16rem), collapsed=68px
  // Mobile: no margin, bottom padding for nav bar
  return (
    <div className="relative min-h-screen">
      <AppSidebar />

      <div
        className={cn(
          'flex min-h-screen flex-col',
          'transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          // Mobile: no sidebar margin, add bottom padding for bottom nav
          isMobile && 'pb-20',
          // Tablet/Desktop: sidebar margin
          !isMobile && (sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-[256px]')
        )}
      >
        {currentView !== 'editor' && <AppHeader />}
        <main className="flex-1 p-4 md:p-6">
          <ViewRouter />
        </main>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default function AppShell() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AppContent />
    </ThemeProvider>
  );
}