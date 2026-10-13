import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ClipboardList, Info } from 'lucide-react';
import { fieldById } from '@/data/intakeSpec';
import type { StepId } from '@/data/types';
import { answerKind, stepImpacts, type Flag } from '@/lib/spec';
import { KindBadge } from '@/components/ui';
import { BlueprintNotes } from '@/components/blueprint/BlueprintNotes';
import { useProject } from '../ProjectLayout';

/** Which Product Blueprint conditions this step used, and what they changed here. */
export function SpecNotes({ step, costTotal, weeks }: { step: StepId; costTotal?: number; weeks?: number }) {
  const { project: p } = useProject();
  const items = stepImpacts(p, step, { costTotal, weeks });
  const notes = <BlueprintNotes project={p} step={step} />;
  if (!items.length) return notes;
  return (
    <>
    {notes}
    <div className="rounded-2xl border border-ink-100 bg-white px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <ClipboardList size={15} className="text-champagne-700" /> 입력한 개발 조건 반영
        </div>
        <Link to={`/projects/${p.id}/overview`} className="text-xs text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline">
          조건 수정
        </Link>
      </div>
      <ul className="divide-y divide-ink-50">
        {items.map((it) => {
          const kind = answerKind(p.spec[it.field]);
          const Icon = it.tone === 'warn' ? AlertTriangle : it.tone === 'good' ? CheckCircle2 : Info;
          return (
            <li key={`${it.field}-${it.effect}`} className="flex gap-2.5 py-2">
              <Icon size={14} className={clsx('mt-0.5 shrink-0', it.tone === 'warn' ? 'text-amber-600' : it.tone === 'good' ? 'text-emerald-600' : 'text-slate-400')} />
              <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
                <span className="text-slate-500">{fieldById(it.field).label}</span> <b className="font-semibold text-ink-900">{it.value}</b>
                {kind && kind !== 'USER_INPUT' && <KindBadge kind={kind} className="ml-1.5 align-middle" />}
                <div className={clsx(it.tone === 'warn' ? 'text-amber-800' : 'text-ink-700')}>{it.effect}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-slate-400">입력값만으로 안전성이나 규제 적합성을 확정하지 않습니다.</p>
    </div>
    </>
  );
}

/** Inline warnings / matches from the user's conditions, shown on an option card. */
export function FlagList({ flags, className }: { flags: Flag[]; className?: string }) {
  if (!flags.length) return null;
  return (
    <ul className={clsx('space-y-1', className)}>
      {flags.map((f) => (
        <li key={f.text} className={clsx('flex items-start gap-1.5 text-[11px] leading-snug', f.tone === 'warn' ? 'text-amber-800' : f.tone === 'good' ? 'text-emerald-700' : 'text-slate-600')}>
          {f.tone === 'warn' ? <AlertTriangle size={11} className="mt-px shrink-0" /> : f.tone === 'good' ? <CheckCircle2 size={11} className="mt-px shrink-0" /> : <Info size={11} className="mt-px shrink-0" />}
          {f.text}
        </li>
      ))}
    </ul>
  );
}

export const MatchTag = ({ children = '입력 조건 일치' }: { children?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
    <CheckCircle2 size={11} /> {children}
  </span>
);
