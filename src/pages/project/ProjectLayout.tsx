import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { Project, StepId } from '@/data/types';
import { STEP_IDS } from '@/data/types';
import { ProgressRing } from '@/components/charts';
import { currentStep, progressOf, STEPS, stepStatus } from '@/lib/engine';
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

  return (
    <ProjectCtx.Provider value={ctx}>
      <div className="no-print bg-gradient-to-r from-ink-900 via-ink-800 to-ink-700 text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-5 px-4 py-5 sm:px-6">
          <ProgressRing value={prog.pct} size={76} stroke={7} label="Progress" dark />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold tracking-[0.22em] text-champagne-300">PROJECT</div>
            <div className="truncate text-xl font-semibold uppercase tracking-wide sm:text-2xl">{project.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-200">
              <span>
                Development Progress <b className="text-white">{prog.pct}%</b>
              </span>
              <span>
                현재 단계 <b className="text-white">{cur.no} {cur.label}</b>
              </span>
              <span>
                단계 {prog.stepsDone}/{prog.stepsTotal} · 체크리스트 {prog.checks}/{prog.checksTotal}
              </span>
            </div>
          </div>
          <Link to="/projects" className="rounded-lg px-3 py-1.5 text-xs text-ink-200 ring-1 ring-white/20 hover:bg-white/10">
            모든 프로젝트
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 sm:px-6">
        <aside className="no-print hidden w-56 shrink-0 lg:block">
          <StepNav project={project} active={stepId} />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 lg:hidden">
            <StepNav project={project} active={stepId} horizontal />
          </div>
          <Outlet />
          <div className="no-print mt-10 flex items-center justify-between border-t border-ink-100 pt-5">
            {prev ? (
              <Link to={`/projects/${project.id}/${prev.id}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-ink-900">
                <ArrowLeft size={15} /> {prev.no} {prev.label}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/projects/${project.id}/${next.id}`} className="flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800">
                다음: {next.no} {next.label} <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </ProjectCtx.Provider>
  );
}

function StepNav({ project, active, horizontal }: { project: Project; active: StepId; horizontal?: boolean }) {
  return (
    <nav className={clsx(horizontal ? 'flex gap-1.5' : 'sticky top-20 space-y-0.5')}>
      {!horizontal && <div className="mb-2 px-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">DEVELOPMENT STEPS</div>}
      {STEPS.map((s) => {
        const st = stepStatus(project, s.id);
        return (
          <NavLink
            key={s.id}
            to={`/projects/${project.id}/${s.id}`}
            className={clsx(
              'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition',
              horizontal && 'shrink-0 ring-1 ring-inset ring-ink-100',
              s.id === active ? 'bg-white font-semibold text-ink-900 shadow-sm ring-1 ring-ink-100' : 'text-slate-600 hover:bg-white/70',
            )}
          >
            <span
              className={clsx(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums',
                st === 'done' ? 'bg-ink-700 text-white' : st === 'stale' ? 'bg-amber-100 text-amber-800' : s.id === active ? 'bg-champagne-300 text-ink-900' : 'bg-ink-50 text-slate-500',
              )}
              title={st === 'done' ? '완료' : st === 'stale' ? '재검토 필요: 이전 단계가 바뀌었어요' : '미완료'}
            >
              {st === 'done' ? <Check size={12} /> : st === 'stale' ? <AlertCircle size={12} /> : s.no}
            </span>
            <span className="whitespace-nowrap">{s.label}</span>
            {st === 'stale' && !horizontal && <span className="ml-auto text-[9px] font-semibold text-amber-700">재검토</span>}
          </NavLink>
        );
      })}
      {!horizontal && <Legend />}
    </nav>
  );
}

function Legend() {
  const Item = ({ cls, children }: { cls: string; children: ReactNode }) => (
    <div className="flex items-center gap-1.5">
      <span className={clsx('h-2.5 w-2.5 rounded-full', cls)} /> {children}
    </div>
  );
  return (
    <div className="mt-4 space-y-1 border-t border-ink-100 px-2 pt-3 text-[11px] text-slate-500">
      <Item cls="bg-ink-700">완료</Item>
      <Item cls="bg-amber-300">재검토 필요</Item>
      <Item cls="bg-ink-100">미완료</Item>
    </div>
  );
}
