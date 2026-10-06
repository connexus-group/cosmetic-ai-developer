import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_TESTS } from '@/data/mock';
import type { ClarifyAnswer, Intake, Project, StepId } from '@/data/types';
import { DEFAULT_CLAIM_COPY } from '@/lib/engine';

/**
 * Project store. MVP persistence is the browser's localStorage.
 * TODO(Phase 6): replace load/save with a projects API (user accounts, sharing).
 */

const KEY = 'cad.projects.v1';

const INTAKE_KEYS = ['category', 'target', 'benefit', 'price', 'channel', 'position', 'concept'] as const;

/**
 * Saved projects come from the user's browser and may be from an older version of the app
 * or edited by hand. Fill in anything missing and drop entries that cannot be repaired,
 * so a bad entry never breaks rendering.
 */
function normalize(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Project>;
  if (typeof p.id !== 'string' || !p.id) return null;
  const t = typeof p.createdAt === 'string' ? p.createdAt : now();
  const intakeIn = (p.intake ?? {}) as Partial<Intake>;
  const intake = Object.fromEntries(
    INTAKE_KEYS.map((k) => {
      const f = intakeIn[k];
      return [k, f && typeof f.value === 'string' ? f : { value: '', kind: 'AI_ESTIMATE' }];
    }),
  ) as unknown as Intake;
  return {
    name: 'Untitled Product',
    idea: '',
    answers: {},
    visited: {},
    moq: 5000,
    retailPrice: 32000,
    channelFeeRate: 0.35,
    costOverrides: {},
    tests: { ...DEFAULT_TESTS },
    checklist: {},
    claimCopy: DEFAULT_CLAIM_COPY,
    brief: {},
    ...p,
    id: p.id,
    createdAt: t,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : t,
    changed: { intake: t, ...(p.changed ?? {}) },
    intake,
  } as Project;
}

function load(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(normalize).filter((p): p is Project => p !== null) : [];
  } catch {
    return [];
  }
}

/** Readable, URL-safe project id from the product name, e.g. "pdrn-firming-ampoule". */
function slugId(name: string, taken: Set<string>) {
  const base =
    name
      .toLowerCase()
      .replace(/\+/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'project';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
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
  const latest = useRef(projects);
  useEffect(() => {
    latest.current = projects;
    persist(projects);
  }, [projects]);

  const update = useCallback((id: string, fn: (p: Project) => Project) => {
    setProjects((list) => list.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)));
  }, []);

  const create: Store['create'] = useCallback(({ name, idea, intake, answers }) => {
    const t = now();
    const priceAnswer = answers.targetPrice?.mode === 'user' ? Number(answers.targetPrice.value.replace(/[^\d]/g, '')) : NaN;
    const project: Project = {
      id: slugId(name, new Set(latest.current.map((x) => x.id))),
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
    latest.current = [project, ...latest.current];
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
