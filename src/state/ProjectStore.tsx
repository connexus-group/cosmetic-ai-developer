import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_TESTS } from '@/data/mock';
import type { ClarifyAnswer, Intake, Project, StepId } from '@/data/types';
import { DEFAULT_CLAIM_COPY } from '@/lib/engine';

/**
 * Project store. MVP persistence is the browser's localStorage.
 * TODO(Phase 6): replace load/save with a projects API (user accounts, sharing).
 */

const KEY = 'cad.projects.v1';

function load(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function persist(projects: Project[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(projects));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

const now = () => new Date().toISOString();

interface Store {
  projects: Project[];
  get: (id: string | undefined) => Project | undefined;
  create: (input: { name: string; idea: string; intake: Intake; answers: Project['answers'] }) => Project;
  update: (id: string, fn: (p: Project) => Project) => void;
  remove: (id: string) => void;
  markVisited: (id: string, step: StepId) => void;
}

const Ctx = createContext<Store | null>(null);

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(load);
  useEffect(() => persist(projects), [projects]);

  const update = useCallback((id: string, fn: (p: Project) => Project) => {
    setProjects((list) => list.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)));
  }, []);

  const create: Store['create'] = useCallback(({ name, idea, intake, answers }) => {
    const t = now();
    const priceAnswer = answers.targetPrice?.mode === 'user' ? Number(answers.targetPrice.value.replace(/[^\d]/g, '')) : NaN;
    const project: Project = {
      id: Math.random().toString(36).slice(2, 10),
      name,
      createdAt: t,
      updatedAt: t,
      idea,
      intake,
      answers,
      visited: {},
      changed: { intake: t },
      moq: 5000,
      retailPrice: Number.isFinite(priceAnswer) && priceAnswer > 1000 ? priceAnswer : 32000,
      channelFeeRate: 0.35,
      costOverrides: {},
      tests: { ...DEFAULT_TESTS },
      // Decisions already made in the intake are pre-checked.
      checklist: { price: true, country: true },
      claimCopy: DEFAULT_CLAIM_COPY,
      brief: {},
    };
    setProjects((list) => [project, ...list]);
    return project;
  }, []);

  const remove = useCallback((id: string) => setProjects((list) => list.filter((p) => p.id !== id)), []);

  const markVisited = useCallback((id: string, step: StepId) => {
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, visited: { ...p.visited, [step]: now() } } : p)));
  }, []);

  const value = useMemo<Store>(
    () => ({ projects, get: (id) => projects.find((p) => p.id === id), create, update, remove, markVisited }),
    [projects, create, update, remove, markVisited],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProjects outside ProjectStoreProvider');
  return v;
}

export const answerLabel = (a: ClarifyAnswer | undefined) => (!a ? '미입력' : a.mode === 'unknown' ? '잘 모르겠어요' : a.value);
export { now };
