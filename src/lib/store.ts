import { readFile, writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import type { Project } from "@/types";

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "projects.json");

async function readStore(): Promise<Record<string, Project>> {
  try {
    const data = await readFile(STORE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, Project>): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  const tempFile = `${STORE_FILE}.tmp`;
  await writeFile(tempFile, JSON.stringify(store, null, 2));
  await rename(tempFile, STORE_FILE);
}

export async function getProject(id: string): Promise<Project | null> {
  const store = await readStore();
  return store[id] || null;
}

export async function saveProject(project: Project): Promise<void> {
  const store = await readStore();
  store[project.id] = project;
  await writeStore(store);
}

export async function listProjects(limit = 20): Promise<Project[]> {
  const store = await readStore();
  return Object.values(store)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
