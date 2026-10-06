import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Info, Loader2, Sparkles } from 'lucide-react';
import type { DataKind, Level, SourceRef } from '@/data/types';

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={clsx('rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(38,27,54,0.04),0_8px_24px_-12px_rgba(38,27,54,0.08)]', className)}>
      {children}
    </div>
  );
}

export function Section({ title, subtitle, action, children, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={clsx('p-5 sm:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const KIND: Record<DataKind, { label: string; cls: string; desc: string }> = {
  DEMO: { label: 'DEMO DATA', cls: 'bg-amber-50 text-amber-800 ring-amber-200', desc: '실제 데이터가 아닌 데모용 가상 데이터입니다.' },
  VERIFIED: { label: 'VERIFIED', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', desc: '출처가 확인된 데이터입니다.' },
  EXTERNAL: { label: 'EXTERNAL', cls: 'bg-sky-50 text-sky-800 ring-sky-200', desc: '외부 데이터 소스에서 가져온 값입니다.' },
  AI_ANALYSIS: { label: 'AI ANALYSIS', cls: 'bg-ink-50 text-ink-700 ring-ink-200', desc: 'AI(현재는 규칙 기반 데모 엔진)가 해석한 결과입니다.' },
  AI_ESTIMATE: { label: 'AI 추정', cls: 'bg-violet-50 text-violet-800 ring-violet-200', desc: 'AI가 추정한 예상값입니다. 실제 데이터가 아닙니다.' },
  USER_INPUT: { label: 'USER INPUT', cls: 'bg-slate-100 text-slate-700 ring-slate-200', desc: '사용자가 직접 입력한 값입니다.' },
};

export function KindBadge({ kind, className }: { kind: DataKind; className?: string }) {
  const k = KIND[kind];
  return (
    <span title={k.desc} className={clsx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset', k.cls, className)}>
      {k.label}
    </span>
  );
}

export const DemoBadge = ({ className }: { className?: string }) => <KindBadge kind="DEMO" className={className} />;

const LEVEL_CLS: Record<Level, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-50 text-amber-800',
  HIGH: 'bg-ink-100 text-ink-800',
  VERY_HIGH: 'bg-ink-700 text-white',
};
const LEVEL_TEXT: Record<Level, string> = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', VERY_HIGH: 'VERY HIGH' };

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide', LEVEL_CLS[level], className)}>{LEVEL_TEXT[level]}</span>;
}

/** Risk is a status: colour + icon dot + text label, never colour alone. */
export function RiskBadge({ risk, className }: { risk: 'LOW' | 'MEDIUM' | 'HIGH'; className?: string }) {
  const cls = risk === 'HIGH' ? 'bg-rose-50 text-rose-700 ring-rose-200' : risk === 'MEDIUM' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  const dot = risk === 'HIGH' ? 'bg-rose-500' : risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', cls, className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} />
      {risk} RISK
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'champagne';
const BTN: Record<Variant, string> = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800 shadow-sm',
  secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-50',
  champagne: 'bg-champagne-500 text-ink-900 hover:bg-champagne-300',
};
const btnBase = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

export function Button({ variant = 'secondary', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...rest} className={clsx(btnBase, BTN[variant], className)} />;
}

export function LinkButton({ to, variant = 'secondary', className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={clsx(btnBase, BTN[variant], className)}>
      {children}
    </Link>
  );
}

export function MetricCard({ label, value, sub, kind, extra, onClick, active }: { label: string; value: ReactNode; sub?: ReactNode; kind?: DataKind; extra?: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <Card onClick={onClick} className={clsx('p-4', onClick && 'cursor-pointer transition hover:border-ink-300', active && 'border-ink-400 ring-2 ring-ink-100')}>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <div className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        {kind && <KindBadge kind={kind} />}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      {extra}
    </Card>
  );
}

export function ScoreBar({ label, value, max = 100, tone = 'ink', right }: { label: ReactNode; value: number; max?: number; tone?: 'ink' | 'champagne' | 'muted'; right?: ReactNode }) {
  const color = tone === 'champagne' ? 'bg-champagne-500' : tone === 'muted' ? 'bg-slate-300' : 'bg-ink-600';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-ink-900">{right ?? value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-50">
        <div className={clsx('h-1.5 rounded-full', color)} style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }} />
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-ink-50 p-1">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          className={clsx('rounded-lg px-3 py-1.5 text-xs font-medium transition', value === o.id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-500 hover:text-ink-800')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyzingState({ label = 'AI가 데이터를 분석하고 있어요' }: { label?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-600">
        <Loader2 size={16} className="animate-spin" /> {label}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-50" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-ink-50" />
    </div>
  );
}

export function SourceNote({ source, className }: { source: SourceRef; className?: string }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500', className)}>
      <Info size={12} className="text-slate-400" />
      <span>출처 {source.sourceName}</span>
      {source.dataPeriod && (
        <span>
          조사기간 {source.dataPeriod.from} ~ {source.dataPeriod.to}
        </span>
      )}
      <span>데이터 기준일 {source.collectedDate ?? '확인 필요'}</span>
      <span>마지막 업데이트 {source.lastUpdated ?? '확인 필요'}</span>
      <span>신뢰도 {source.confidenceScore == null ? '해당 없음 (데모)' : `${Math.round(source.confidenceScore * 100)}%`}</span>
    </div>
  );
}

/** Placeholder for facts we must not invent. */
export function Unverified({ label = '확인 필요' }: { label?: string }) {
  return <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{label}</span>;
}

export function PageIntro({ no, title, ko, question, right }: { no: string; title: string; ko: string; question: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-champagne-700">
          <span>STEP {no}</span>
          <span className="h-px w-6 bg-champagne-300" />
          <span>{ko}</span>
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{question}</p>
      </div>
      {right}
    </div>
  );
}

export function AiPill({ children = 'AI RECOMMENDED' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-ink-800 to-ink-600 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white">
      <Sparkles size={11} className="text-champagne-300" /> {children}
    </span>
  );
}
