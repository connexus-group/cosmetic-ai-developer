import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, ChevronDown } from 'lucide-react';
import type { Project, StepId } from '@/data/types';
import { STEP_IDS } from '@/data/types';
import { currentStep, NEXT_ACTION, PHASES, phaseOf, progressOf, STEPS, stepStatus } from '@/lib/engine';
import { now, useProjects } from '@/state/ProjectStore';

interface Ctx {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  /** record that an upstream decision changed now (marks downstream steps "재검토 필요") */
  touch: (key: keyof Project['changed']) => Partial<Project['changed']>;
}
const ProjectCtx = createContext<Ctx | null>(null);

export function useProject() {
  const v = useContext(ProjectCtx);
  if (!v) throw new Error('useProject outside ProjectLayout');
  return v;
}

export default function ProjectLayout() {
  const { id, step } = useParams();
  const { get, update, markVisited } = useProjects();
  const project = get(id);
  const stepId = (STEP_IDS as readonly string[]).includes(step ?? '') ? (step as StepId) : undefined;

  useEffect(() => {
    if (project && stepId) markVisited(project.id, stepId);
    // only when the step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, stepId]);

  if (!project) return <Navigate to="/projects" replace />;
  if (!stepId) return <Navigate to={`/projects/${project.id}/overview`} replace />;

  const prog = progressOf(project);
  const cur = currentStep(project);
  const idx = STEPS.findIndex((s) => s.id === stepId);
  const prev = STEPS[idx - 1];
  const next = STEPS[idx + 1];

  const ctx: Ctx = {
    project,
    update: (fn) => update(project.id, fn),
    touch: (key) => ({ ...project.changed, [key]: now() }),
  };

  const facts = [
    { label: 'Target', value: project.intake.target.value },
    { label: 'Category', value: project.intake.category.value.split(' > ').pop() },
    { label: 'Price', value: project.intake.price.value },
    { label: 'Channel', value: project.intake.channel.value },
  ];
  const curPhase = phaseOf(cur.id);

  return (
    <ProjectCtx.Provider value={ctx}>
      {/* Always visible: which product, and where it is in development. */}
      <div className="no-print sticky top-14 z-20 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <div className="min-w-0 flex-1 truncate">
            <span className="font-display text-[22px] leading-none text-ink-900">{project.name}</span>
          </div>
          <div className="hidden items-center gap-2 text-[13px] text-ink-500 md:flex">
            <span>현재 개발 단계</span>
            <span className="rounded-full bg-wine-50 px-2.5 py-1 font-medium text-wine-800">
              {curPhase.label} · {cur.no} {cur.label}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-ink-100 sm:block">
              <div className="h-1 rounded-full bg-wine-600 transition-all" style={{ width: `${prog.pct}%` }} />
            </div>
            <span className="text-[13px] font-semibold tabular-nums text-ink-900">{prog.pct}%</span>
          </div>
        </div>
      </div>

      <div className="no-print border-b border-ink-100/70">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-10 gap-y-3 px-4 py-5 sm:px-6">
          <div className="text-[12px] font-medium text-wine-700">AI Product Development</div>
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[12px] text-ink-400">{f.label}</dt>
                <dd className="mt-0.5 truncate text-[15px] font-medium text-ink-900">{f.value || '미입력'}</dd>
              </div>
            ))}
          </dl>
          <Link to="/projects" className="ml-auto text-[13px] text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline">
            모든 프로젝트
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-12 px-4 py-10 sm:px-6">
        <aside className="no-print hidden w-60 shrink-0 lg:block">
          <StepNav project={project} active={stepId} next={cur.id} />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="no-print -mx-4 mb-8 overflow-x-auto px-4 lg:hidden">
            <MobileStepNav project={project} active={stepId} />
          </div>
          <Outlet />
          <div className="no-print mt-16 flex items-center justify-between gap-4 border-t border-ink-100 pt-8">
            {prev ? (
              <Link to={`/projects/${project.id}/${prev.id}`} className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
                <ArrowLeft size={15} /> {prev.no} {prev.label}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/projects/${project.id}/${next.id}`} className="flex items-center gap-2 rounded-lg bg-ink-900 px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-wine-800">
                {NEXT_ACTION[next.id].cta} <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </ProjectCtx.Provider>
  );
}

function StepNav({ project, active, next }: { project: Project; active: StepId; next: StepId }) {
  const activePhase = phaseOf(active).id;
  const [open, setOpen] = useState<Set<string>>(() => new Set([activePhase]));
  // Moving to another phase (e.g. via the next button) opens it.
  useEffect(() => {
    setOpen((o) => (o.has(activePhase) ? o : new Set(o).add(activePhase)));
  }, [activePhase]);
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <nav className="sticky top-36 space-y-1" aria-label="개발 단계">
      {PHASES.map((ph) => {
        const isOpen = open.has(ph.id);
        const done = ph.steps.filter((id) => stepStatus(project, id) === 'done').length;
        const here = ph.id === activePhase;
        return (
          <div key={ph.id} className="pb-1">
            <button
              type="button"
              onClick={() => toggle(ph.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-ink-100/50"
            >
              <span className={clsx('text-[11px] font-semibold tabular-nums', here ? 'text-wine-700' : 'text-ink-400')}>{ph.no}</span>
              <span className={clsx('text-[13px] font-semibold tracking-wide', here ? 'text-ink-900' : 'text-ink-600')}>{ph.label}</span>
              <span className="text-[12px] text-ink-400">{ph.ko}</span>
              <span className="ml-auto text-[11px] tabular-nums text-ink-400">
                {done}/{ph.steps.length}
              </span>
              <ChevronDown size={14} className={clsx('text-ink-400 transition', !isOpen && '-rotate-90')} />
            </button>
            {isOpen && (
              <ul className="mb-2 ml-3 border-l border-ink-100">
                {ph.steps.map((id) => {
                  const s = STEPS.find((x) => x.id === id)!;
                  const st = stepStatus(project, id);
                  const isActive = id === active;
                  return (
                    <li key={id}>
                      <NavLink
                        to={`/projects/${project.id}/${id}`}
                        className={clsx(
                          '-ml-px flex items-center gap-2.5 border-l-2 py-2 pl-4 pr-2 text-[14px] transition',
                          isActive ? 'border-wine-600 font-semibold text-wine-800' : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900',
                        )}
                      >
                        <span className={clsx('w-5 text-[11px] tabular-nums', isActive ? 'text-wine-600' : 'text-ink-300')}>{s.no}</span>
                        <span className="truncate">{s.label}</span>
                        <span className="ml-auto flex items-center">
                          {st === 'done' ? (
                            <Check size={13} className="text-wine-600" aria-label="완료" />
                          ) : st === 'stale' ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700" title="이전 단계가 바뀌었어요">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 재검토
                            </span>
                          ) : id === next && !isActive ? (
                            <span className="text-[10px] font-medium text-wine-600">다음</span>
                          ) : null}
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function MobileStepNav({ project, active }: { project: Project; active: StepId }) {
  return (
    <nav className="flex items-center gap-1" aria-label="개발 단계">
      {PHASES.map((ph, i) => (
        <div key={ph.id} className="flex shrink-0 items-center gap-1">
          {i > 0 && <span className="mx-1.5 h-4 w-px bg-ink-200" />}
          <span className="mr-1 text-[11px] font-semibold text-ink-400">{ph.label}</span>
          {ph.steps.map((id) => {
            const s = STEPS.find((x) => x.id === id)!;
            const st = stepStatus(project, id);
            const isActive = id === active;
            return (
              <NavLink
                key={id}
                to={`/projects/${project.id}/${id}`}
                className={clsx(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap transition',
                  isActive ? 'bg-wine-700 font-medium text-white' : 'text-ink-600 ring-1 ring-inset ring-ink-100 hover:bg-white',
                )}
              >
                {st === 'done' && !isActive && <Check size={12} className="text-wine-600" />}
                {st === 'stale' && !isActive && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                {s.label}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
