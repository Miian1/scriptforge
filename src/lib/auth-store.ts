import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  checked: boolean;
  // Verification pending state (after register, before email verified)
  pendingVerificationEmail: string | null;
  setPendingVerificationEmail: (email: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setChecked: (checked: boolean) => void;
  login: (email: string, password: string) => Promise<{ user?: AuthUser; error?: string; requiresVerification?: boolean; email?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ user?: AuthUser; error?: string; message?: string; email?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  checked: false,
  pendingVerificationEmail: null,

  setPendingVerificationEmail: (email) => set({ pendingVerificationEmail: email }),

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setChecked: (checked) => set({ checked }),

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ loading: false });
        return {
          error: data.error || 'Login failed',
          requiresVerification: data.requiresVerification,
          email: data.email,
        };
      }
      set({ user: data.user, loading: false, checked: true, pendingVerificationEmail: null });
      return { user: data.user };
    } catch {
      set({ loading: false });
      return { error: 'Network error. Please try again.' };
    }
  },

  register: async (name, email, password) => {
    set({ loading: true });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ loading: false });
        return { error: data.error || 'Registration failed' };
      }
      // Registration successful but user is NOT logged in
      // Show verification pending UI
      set({ loading: false, pendingVerificationEmail: data.email });
      return { message: data.message, email: data.email };
    } catch {
      set({ loading: false });
      return { error: 'Network error. Please try again.' };
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // even if fetch fails, clear local state
    }
    set({ user: null, checked: true, pendingVerificationEmail: null });
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/auth/me', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, loading: false, checked: true });
      } else {
        set({ user: null, loading: false, checked: true });
      }
    } catch {
      set({ user: null, loading: false, checked: true });
    }
  },
}));