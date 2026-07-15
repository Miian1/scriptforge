import Dexie, { type EntityTable } from 'dexie';
import type { Project, Scene, AppSettings } from './types';

const db = new Dexie('YouTubeScriptAgentDB') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  scenes: EntityTable<Scene, 'id'>;
  appSettings: EntityTable<AppSettings & { id: string }, 'id'>; // stores theme & autoSave only
};

db.version(1).stores({
  projects: 'id, title, topic, status, createdAt, updatedAt',
  scenes: 'id, projectId, sceneNumber, createdAt, updatedAt',
  appSettings: 'id',
});

export { db };

// Project operations
export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function createProject(project: Project): Promise<void> {
  await db.projects.add(project);
}

export async function updateProject(id: string, changes: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.scenes, async () => {
    await db.scenes.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function searchProjects(query: string): Promise<Project[]> {
  const lower = query.toLowerCase();
  return db.projects
    .filter(
      (p) =>
        p.title.toLowerCase().includes(lower) ||
        p.topic.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
    )
    .reverse()
    .sortBy('updatedAt');
}

// Scene operations
export async function getScenesByProject(projectId: string): Promise<Scene[]> {
  return db.scenes.where('projectId').equals(projectId).sortBy('sceneNumber');
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

export async function createScene(scene: Scene): Promise<void> {
  await db.scenes.add(scene);
}

export async function createScenes(scenes: Scene[]): Promise<void> {
  await db.scenes.bulkAdd(scenes);
}

export async function updateScene(id: string, changes: Partial<Scene>): Promise<void> {
  await db.scenes.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteScene(id: string): Promise<void> {
  await db.scenes.delete(id);
}

export async function deleteScenesByProject(projectId: string): Promise<void> {
  await db.scenes.where('projectId').equals(projectId).delete();
}

export async function reorderScenes(scenes: { id: string; sceneNumber: number }[]): Promise<void> {
  await db.transaction('rw', db.scenes, async () => {
    for (const s of scenes) {
      await db.scenes.update(s.id, { sceneNumber: s.sceneNumber, updatedAt: Date.now() });
    }
  });
}

// App settings operations
export async function getAppSettings(): Promise<AppSettings | undefined> {
  const row = await db.appSettings.get('main');
  return row ? { theme: row.theme, autoSave: row.autoSave } : undefined;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await db.appSettings.put({ id: 'main', ...settings });
}

// Stats
export async function getProjectStats(): Promise<{
  total: number;
  completed: number;
  draft: number;
  error: number;
}> {
  const all = await db.projects.count();
  const completed = await db.projects.where('status').equals('completed').count();
  const draft = await db.projects.where('status').equals('draft').count();
  const error = await db.projects.where('status').equals('error').count();
  return { total: all, completed, draft, error };
}