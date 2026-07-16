'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Info,
  Film,
  PanelLeftClose,
  LogOut,
  X,
  Crown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthStore } from '@/lib/auth-store';

// ── Constants ──────────────────────────────────────────

const SIDEBAR_EXPANDED = 256;
const SIDEBAR_COLLAPSED = 68;
const TABLET_BREAKPOINT = 1024;

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { path: '/create-project', label: 'New Project', icon: PlusCircle, primary: true },
  { path: '/plans', label: 'Plans', icon: Crown, primary: true },
  { path: '/settings', label: 'Settings', icon: Settings, primary: false },
  { path: '/about', label: 'About', icon: Info, primary: false },
];

// ── Sidebar Palette (theme-aware) ─────────────────────

const sidebar = {
  bg: 'bg-background',
  active: 'bg-accent',
  text: 'text-foreground',
  muted: 'text-muted-foreground',
  border: 'border-border',
  hover: 'hover:bg-accent/50',
};

// ── Icon Slot (fixed, left-aligned, never moves) ──────

function IconSlot({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-10 h-10 shrink-0 flex items-center justify-center">
      {children}
    </span>
  );
}

// ── Sidebar Nav Item ───────────────────────────────────

function SidebarNavItem({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  const button = (
    <Button
      variant="ghost"
      className={cn(
        'h-10 w-full font-normal relative overflow-hidden rounded-lg justify-start pl-0',
        sidebar.text, sidebar.hover,
        isActive && `${sidebar.active} ${sidebar.text} font-medium`
      )}
      onClick={onClick}
    >
      <IconSlot>
        <Icon className="size-4 shrink-0" />
      </IconSlot>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// ── Collapse Toggle ────────────────────────────────────

function CollapseToggle() {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={toggleSidebarCollapsed}
          className={cn('h-10 w-full rounded-lg justify-start pl-0', sidebar.text, sidebar.hover)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconSlot>
            <motion.div
              animate={{ rotate: sidebarCollapsed ? 0 : 180 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <PanelLeftClose className="size-4" />
            </motion.div>
          </IconSlot>
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="whitespace-nowrap overflow-hidden text-sm font-normal"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Logout Buttons ────────────────────────────────────

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const button = (
    <Button
      variant="ghost"
      onClick={handleLogout}
      className={cn(
        'h-10 w-full rounded-lg justify-start pl-0 text-destructive hover:text-destructive hover:bg-destructive/10',
      )}
      aria-label="Log out"
    >
      <IconSlot>
        <LogOut className="size-4 shrink-0" />
      </IconSlot>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="whitespace-nowrap overflow-hidden text-sm font-normal"
          >
            Log Out
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>Log Out</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function MobileLogoutButton({ onClose }: { onClose: () => void }) {
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push('/');
  };

  return (
    <Button
      variant="ghost"
      onClick={handleLogout}
      className="h-11 w-full justify-start gap-3 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <LogOut className="size-5 shrink-0" />
      Log Out
    </Button>
  );
}

// ── Desktop Sidebar (lg+): Full or Collapsed ───────────

function DesktopSidebar() {
  const { sidebarCollapsed } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const userName = useAuthStore((s) => s.user?.name);
  const userRole = useAuthStore((s) => s.user?.role);

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'hidden md:fixed md:inset-y-0 md:z-40 md:flex md:flex-col overflow-hidden border-r shadow-sm',
        sidebar.bg, sidebar.border
      )}
    >
      {/* Brand — hidden when collapsed on tablet */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 56 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="flex items-center h-14 px-4 gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Film className="size-4 text-primary-foreground" />
              </div>
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-sm font-bold tracking-tight text-foreground leading-tight">
                  ScriptForge
                </h1>
                <p className="text-[10px] text-muted-foreground leading-none">
                  AI Script Agent
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-2.5 py-2 sidebar-scroll overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.path}
            item={item}
            isActive={pathname === item.path}
            collapsed={sidebarCollapsed}
            onClick={() => router.push(item.path)}
          />
        ))}
      </nav>

      {/* User info + logout + collapse toggle */}
      <div className={cn('shrink-0 px-2 py-1 border-t flex flex-col gap-1', sidebar.border)}>
        {/* User name (expanded only) */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 28 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center h-7 px-3 gap-2">
                <p className="text-[11px] text-muted-foreground truncate">
                  {userName ?? ''}
                </p>
                {userRole === 'admin' && (
                  <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary">Admin</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <CollapseToggle />
        <LogoutButton collapsed={sidebarCollapsed} />
      </div>
    </motion.aside>
  );
}

// ── Mobile Hamburger Overlay Drawer ────────────────────

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          {/* Drawer panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-72 flex flex-col md:hidden',
              sidebar.bg
            )}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between h-14 px-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                  <Film className="size-4 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-tight text-foreground leading-tight">
                    ScriptForge
                  </h1>
                  <p className="text-[10px] text-muted-foreground leading-none">
                    AI Script Agent
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/50 h-9 w-9"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>

            <Separator className={sidebar.border} />

            {/* Drawer nav */}
            <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(
                      'h-12 w-full justify-start gap-3 rounded-lg font-normal text-base',
                      sidebar.text, sidebar.hover,
                      isActive && `${sidebar.active} font-medium`
                    )}
                    onClick={() => {
                      router.push(item.path);
                      onClose();
                    }}
                  >
                    <Icon className="size-5 shrink-0" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>

            {/* Logout button in mobile drawer */}
            <div className={cn('px-3 py-2 border-t', sidebar.border)}>
              <MobileLogoutButton onClose={onClose} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Mobile Bottom Navigation Bar ───────────────────────

function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Only show Dashboard, Settings, About in bottom bar (New Project is the FAB)
  const bottomItems = NAV_ITEMS.filter((i) => i.path !== '/create-project');

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 flex md:hidden h-16 items-center justify-around px-2',
        'bg-background border-t border-border shadow-[0_-1px_3px_rgba(0,0,0,0.05)]'
      )}
    >
      {bottomItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 w-16 h-full rounded-lg transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
            {isActive && (
              <motion.div
                layoutId="bottomNavIndicator"
                className="absolute -top-px left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Floating Action Button (FAB) ───────────────────────

function FAB() {
  const router = useRouter();

  return (
    <motion.button
      onClick={() => router.push('/create-project')}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'fixed bottom-20 right-4 z-30 md:hidden',
        'flex size-14 items-center justify-center rounded-full shadow-lg',
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90 active:bg-primary/80',
        'transition-shadow hover:shadow-xl'
      )}
      aria-label="New Project"
    >
      <PlusCircle className="size-6" />
    </motion.button>
  );
}

// ── Auto-collapse logic for tablet breakpoint ──────────

function useAutoCollapse() {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: 768px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const onChange = () => {
      const nowTablet = mql.matches;
      setIsTablet(nowTablet);
      // Auto-collapse on tablet, but respect manual toggle on desktop
      if (nowTablet && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      } else if (!nowTablet && !mql.matches && sidebarCollapsed && window.innerWidth >= TABLET_BREAKPOINT) {
        // Expanding back to desktop — stay collapsed if user chose it
      }
    };
    mql.addEventListener('change', onChange);
    onChange(); // Initial check
    return () => mql.removeEventListener('change', onChange);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  return isTablet;
}

// ── Main Export ────────────────────────────────────────

export default function AppSidebar() {
  const isMobile = useIsMobile();
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  useAutoCollapse();

  return (
    <>
      {/* Desktop & Tablet sidebar */}
      <DesktopSidebar />

      {/* Mobile: hamburger overlay drawer */}
      <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile: bottom nav bar */}
      {isMobile && <BottomNavBar />}

      {/* Mobile: FAB for New Project */}
      {isMobile && <FAB />}
    </>
  );
}