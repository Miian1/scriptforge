import { create } from 'zustand';
import type { Project, Scene, Character } from './types';

interface AppState {
  // Editor state
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  generatingProjectId: string | null;
  setGeneratingProjectId: (id: string | null) => void;

  // Tools config (fetched from /api/config)
  tools: { youtube: boolean };
  toolsLoaded: boolean;
  loadTools: () => Promise<void>;

  // Projects
  projects: Project[];
  projectsLoaded: boolean;
  loadProjects: () => Promise<void>;
  addProject: (project: Project) => Promise<void>;
  updateProject: (id: string, changes: Partial<Project>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  searchAndSetProjects: (query: string) => Promise<void>;

  // Scenes
  scenes: Scene[];
  scenesLoaded: boolean;
  loadScenes: (projectId: string) => Promise<void>;
  addScene: (scene: Scene) => Promise<void>;
  addScenes: (scenes: Scene[]) => Promise<void>;
  updateScene: (id: string, changes: Partial<Scene>) => Promise<void>;
  removeScene: (id: string) => Promise<void>;
  reorderScenes: (scenes: Scene[]) => Promise<void>;

  // Characters
  characters: Character[];
  charactersLoaded: boolean;
  loadCharacters: (projectId: string) => Promise<void>;
  addCharacter: (character: Character) => Promise<void>;
  updateCharacter: (id: string, changes: Partial<Character>) => Promise<void>;
  removeCharacter: (id: string) => Promise<void>;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

// Helper: map MongoDB doc to Project
function mapProject(p: Record<string, unknown>): Project {
  return {
    id: p.id as string,
    title: p.title as string,
    topic: p.topic as string,
    description: (p.description as string) || '',
    thumbnailPrompt: (p.thumbnailPrompt as string) || '',
    tags: (Array.isArray(p.tags) ? p.tags : []) as string[],
    settings: {
      duration: (p.settings as Project['settings'])?.duration || 'medium',
      theme: (p.settings as Project['settings'])?.theme || 'cinematic',
      language: (p.settings as Project['settings'])?.language || 'english',
      writingStyle: (p.settings as Project['settings'])?.writingStyle || 'conversational',
      targetAudience: (p.settings as Project['settings'])?.targetAudience || 'general',
      sceneLength: (p.settings as Project['settings'])?.sceneLength || 8,
      totalScenes: (p.settings as Project['settings'])?.totalScenes || 60,
      scenesPerPhase: (p.settings as Project['settings'])?.scenesPerPhase || 10,
    },
    status: (p.status as Project['status']) || 'draft',
    scoreHistory: Array.isArray(p.scoreHistory) ? p.scoreHistory : [],
    createdAt: p.createdAt as number,
    updatedAt: p.updatedAt as number,
  };
}

// Helper: map MongoDB doc to Scene
function mapScene(s: Record<string, unknown>): Scene {
  return {
    id: s.id as string,
    projectId: s.projectId as string,
    sceneNumber: s.sceneNumber as number,
    title: s.title as string,
    estimatedDuration: (s.estimatedDuration as number) || 0,
    goal: (s.goal as string) || '',
    narration: (s.narration as string) || '',
    imagePrompt: (s.imagePrompt as string) || '',
    animationPrompt: (s.animationPrompt as string) || '',
    characterIds: Array.isArray(s.characterIds) ? s.characterIds : [],
    notes: (s.notes as Scene['notes']) || { emotion: '', visualFocus: '', transitionSuggestion: '', importantDetails: '' },
    createdAt: s.createdAt as number,
    updatedAt: s.updatedAt as number,
  };
}

function mapCharacter(c: Record<string, unknown>): Character {
  return {
    id: c.id as string,
    projectId: c.projectId as string,
    name: (c.name as string) || 'Untitled',
    design: (c.design as Character['design']) || {
      characterName: '', characterType: '', species: '', personality: '',
      artStyle: '', primaryColor: '', secondaryColor: '', outlineColor: '',
      headShape: '', bodyShape: '', eyeShape: '', mouthStyle: '',
      accessories: '', theme: '', animationStyle: '',
    },
    imagePrompt: (c.imagePrompt as string) || '',
    createdAt: c.createdAt as number,
    updatedAt: c.updatedAt as number,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  // Editor
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  generatingProjectId: null,
  setGeneratingProjectId: (id) => set({ generatingProjectId: id }),

  // Tools config
  tools: { youtube: true },
  toolsLoaded: false,
  loadTools: async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        set({ tools: data.tools || { youtube: true }, toolsLoaded: true });
      }
    } catch {
      // graceful — defaults stay true
    }
  },

  // Projects — MongoDB API
  projects: [],
  projectsLoaded: false,
  loadProjects: async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const projects = (data.projects || []).map(mapProject);
        set({ projects, projectsLoaded: true });
      }
    } catch {
      // silently fail — will retry on next call
    }
  },
  addProject: async (project) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          topic: project.topic,
          description: project.description,
          settings: project.settings,
          status: project.status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = mapProject(data.project);
        set((s) => ({ projects: [created, ...s.projects] }));
        // Return the MongoDB-assigned ID so callers can use it
        return created.id;
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'PLAN_LIMIT_REACHED') {
          throw new Error(data.error || 'Plan limit reached');
        }
      }
    } catch {
      // fallback: add locally
      set((s) => ({ projects: [project, ...s.projects] }));
      return project.id;
    }
    return project.id;
  },
  updateProject: async (id, changes) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = mapProject(data.project);
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
      }
    } catch {
      // fallback: update locally
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...changes, updatedAt: Date.now() } : p)),
      }));
    }
  },
  removeProject: async (id) => {
    try {
      await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    } catch {
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    }
  },
  searchAndSetProjects: async (query) => {
    const projects = get().projects;
    if (!query.trim()) {
      // Reload from server
      get().loadProjects();
    } else {
      const lower = query.toLowerCase();
      const filtered = projects.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.topic.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower)
      );
      set({ projects: filtered });
    }
  },

  // Scenes — MongoDB API
  scenes: [],
  scenesLoaded: false,
  loadScenes: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/scenes?projectId=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        const data = await res.json();
        const scenes = (data.scenes || []).map(mapScene);
        set({ scenes, scenesLoaded: true });
      }
    } catch {
      // silently fail
    }
  },
  addScene: async (scene) => {
    try {
      const res = await fetch('/api/projects/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: scene.projectId,
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          estimatedDuration: scene.estimatedDuration,
          goal: scene.goal,
          narration: scene.narration,
          imagePrompt: scene.imagePrompt,
          animationPrompt: scene.animationPrompt,
          notes: scene.notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = mapScene(data.scene);
        set((s) => ({ scenes: [...s.scenes, created] }));
      }
    } catch {
      set((s) => ({ scenes: [...s.scenes, scene] }));
    }
  },
  addScenes: async (scenes) => {
    // Create scenes one by one (bulk would need a separate endpoint)
    for (const scene of scenes) {
      try {
        const res = await fetch('/api/projects/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: scene.projectId,
            sceneNumber: scene.sceneNumber,
            title: scene.title,
            estimatedDuration: scene.estimatedDuration,
            goal: scene.goal,
            narration: scene.narration,
            imagePrompt: scene.imagePrompt,
            animationPrompt: scene.animationPrompt,
            notes: scene.notes,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const created = mapScene(data.scene);
          set((s) => ({ scenes: [...s.scenes, created] }));
        }
      } catch {
        set((s) => ({ scenes: [...s.scenes, scene] }));
      }
    }
  },
  updateScene: async (id, changes) => {
    try {
      const res = await fetch('/api/projects/scenes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = mapScene(data.scene);
        set((s) => ({
          scenes: s.scenes.map((sc) => (sc.id === id ? updated : sc)),
        }));
      }
    } catch {
      set((s) => ({
        scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, ...changes, updatedAt: Date.now() } : sc)),
      }));
    }
  },
  removeScene: async (id) => {
    try {
      await fetch(`/api/projects/scenes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      set((s) => {
        const remaining = s.scenes
          .filter((sc) => sc.id !== id)
          .map((sc, i) => ({ ...sc, sceneNumber: i + 1 }));
        // Reorder in DB
        fetch('/api/projects/scenes/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: remaining.map((sc) => ({ id: sc.id, sceneNumber: sc.sceneNumber })) }),
        }).catch(() => {});
        return { scenes: remaining };
      });
    } catch {
      set((s) => {
        const remaining = s.scenes
          .filter((sc) => sc.id !== id)
          .map((sc, i) => ({ ...sc, sceneNumber: i + 1 }));
        return { scenes: remaining };
      });
    }
  },
  reorderScenes: async (newOrder) => {
    const renumbered = newOrder.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    try {
      await fetch('/api/projects/scenes/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: renumbered.map((s) => ({ id: s.id, sceneNumber: s.sceneNumber })) }),
      });
    } catch {
      // silent
    }
    set({ scenes: renumbered });
  },

  // Characters — MongoDB API
  characters: [],
  charactersLoaded: false,
  loadCharacters: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/characters?projectId=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        const data = await res.json();
        const characters = (data.characters || []).map(mapCharacter);
        set({ characters, charactersLoaded: true });
      }
    } catch {
      // silently fail
    }
  },
  addCharacter: async (character) => {
    try {
      const res = await fetch('/api/projects/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: character.projectId,
          name: character.name,
          design: character.design,
          imagePrompt: character.imagePrompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = mapCharacter(data.character);
        set((s) => ({ characters: [...s.characters, created] }));
      }
    } catch {
      set((s) => ({ characters: [...s.characters, character] }));
    }
  },
  updateCharacter: async (id, changes) => {
    try {
      const res = await fetch('/api/projects/characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = mapCharacter(data.character);
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? updated : c)),
        }));
      }
    } catch {
      set((s) => ({
        characters: s.characters.map((c) => (c.id === id ? { ...c, ...changes, updatedAt: Date.now() } : c)),
      }));
    }
  },
  removeCharacter: async (id) => {
    try {
      await fetch(`/api/projects/characters?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      set((s) => ({ characters: s.characters.filter((c) => c.id !== id) }));
    } catch {
      set((s) => ({ characters: s.characters.filter((c) => c.id !== id) }));
    }
  },

  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));