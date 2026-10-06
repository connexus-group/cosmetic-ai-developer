import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, ArrowRight, Check, Pencil } from 'lucide-react';
import { CLARIFY_QUESTIONS } from '@/data/mock';
import type { IntakeKey } from '@/data/types';
import { ProgressRing } from '@/components/charts';
import { Card, KindBadge, PageIntro, Section } from '@/components/ui';
import { conceptOf, currentStep, formulaOf, packageOf, progressOf, STEPS, stepStatus } from '@/lib/engine';
import { INTAKE_LABELS } from '@/lib/intake';
import { answerLabel } from '@/state/ProjectStore';
import { useProject } from '../ProjectLayout';

export default function Overview() {
  const { project: p, update, touch } = useProject();
  const [editing, setEditing] = useState<IntakeKey | null>(null);
  const prog = progressOf(p);
  const cur = currentStep(p);
  const concept = conceptOf(p);
  const formula = formulaOf(p);
  const pkg = packageOf(p);
  const isDemoScenario = /앰플|세럼/.test(p.intake.category.value);

  const saveField = (k: IntakeKey, value: string) => {
    setEditing(null);
    if (value === p.intake[k].value) return;
    update((x) => ({ ...x, intake: { ...x.intake, [k]: { value, kind: 'USER_INPUT' } }, changed: touch('intake') }));
  };

  return (
    <div className="space-y-6">
      <PageIntro no="01" title="Overview" ko="프로젝트 개요" question="지금 어디까지 왔고, 다음에 무엇을 하면 될까요?" />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <ProgressRing value={prog.pct} size={112} stroke={10} label="Development" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Development Progress</div>
              <div className="mt-1 text-3xl font-semibold text-ink-900">{prog.pct}%</div>
              <div className="mt-1 text-xs text-slate-500">
                분석·설계 단계 {prog.stepsDone}/{prog.stepsTotal} · 체크리스트 {prog.checks}/{prog.checksTotal}
              </div>
            </div>
          </div>
          <Link to={`/projects/${p.id}/${cur.id}`} className="flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-3 text-sm font-medium text-white hover:bg-ink-800">
            다음 단계: {cur.no} {cur.label} <ArrowRight size={15} />
          </Link>
        </Card>
        <Card className="grid grid-cols-3 divide-x divide-ink-50 p-0">
          {[
            { label: 'Concept', value: concept?.name, to: 'concept' },
            { label: 'Formula', value: formula?.name, to: 'formula' },
            { label: 'Package', value: pkg?.name, to: 'packaging' },
          ].map((x) => (
            <Link key={x.label} to={`/projects/${p.id}/${x.to}`} className="p-5 hover:bg-ink-50/50">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{x.label}</div>
              <div className={clsx('mt-2 text-sm font-semibold', x.value ? 'text-ink-900' : 'text-slate-400')}>{x.value ?? '아직 선택 전'}</div>
            </Link>
          ))}
        </Card>
      </div>

      <Section title="개발 프로세스" subtitle="각 단계를 눌러 언제든 이동할 수 있어요. 앞 단계를 고치면 영향을 받는 단계에 '재검토 필요'가 표시됩니다.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((s) => {
            const st = stepStatus(p, s.id);
            return (
              <Link
                key={s.id}
                to={`/projects/${p.id}/${s.id}`}
                className={clsx(
                  'rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm',
                  st === 'done' ? 'border-ink-200 bg-ink-50/60' : st === 'stale' ? 'border-amber-200 bg-amber-50/60' : 'border-ink-100 bg-white',
                  s.id === cur.id && 'ring-2 ring-champagne-300',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tabular-nums text-slate-400">{s.no}</span>
                  {st === 'done' ? <Check size={14} className="text-ink-700" /> : st === 'stale' ? <AlertCircle size={14} className="text-amber-600" /> : null}
                </div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{s.label}</div>
                <div className="text-[11px] text-slate-500">{st === 'done' ? '완료' : st === 'stale' ? '재검토 필요' : s.id === cur.id ? '진행할 차례' : '미완료'}</div>
              </Link>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="AI 요구사항 분석" subtitle="값을 누르면 수정할 수 있어요. 수정하면 이후 분석에 '재검토 필요'가 표시됩니다.">
          <div className="mb-4 rounded-xl bg-ink-50/60 px-4 py-3 text-sm text-ink-800">“{p.idea}”</div>
          <dl className="divide-y divide-ink-50">
            {(Object.keys(INTAKE_LABELS) as IntakeKey[]).map((k) => (
              <div key={k} className="group flex items-center gap-3 py-2.5">
                <dt className="w-28 shrink-0 text-xs font-medium text-slate-500">{INTAKE_LABELS[k].en}</dt>
                <dd className="min-w-0 flex-1 text-sm font-medium text-ink-900">
                  {editing === k ? (
                    <input
                      autoFocus
                      defaultValue={p.intake[k].value}
                      onBlur={(e) => saveField(k, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="w-full rounded-lg border border-ink-200 px-2 py-1 outline-none focus:border-ink-500"
                    />
                  ) : (
                    <button type="button" onClick={() => setEditing(k)} className="flex items-center gap-2 text-left">
                      {p.intake[k].value}
                      <Pencil size={11} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                    </button>
                  )}
                </dd>
                <KindBadge kind={p.intake[k].kind} />
              </div>
            ))}
          </dl>
        </Section>
        <Section title="추가 정보" subtitle="입력 단계에서 답한 내용">
          <dl className="divide-y divide-ink-50">
            {CLARIFY_QUESTIONS.map((q) => {
              const a = p.answers[q.id];
              return (
                <div key={q.id} className="flex items-center gap-3 py-2.5">
                  <dt className="flex-1 text-xs text-slate-500">{q.question}</dt>
                  <dd className={clsx('text-sm font-medium', a && a.mode !== 'unknown' ? 'text-ink-900' : 'text-slate-400')}>{answerLabel(a)}</dd>
                  {a?.mode === 'ai' && <KindBadge kind="AI_ESTIMATE" />}
                  {a?.mode === 'user' && <KindBadge kind="USER_INPUT" />}
                </div>
              );
            })}
          </dl>
          {!isDemoScenario && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              데모 모드의 시장·경쟁·소비자 데이터는 "안티에이징 앰플" 시나리오 기준입니다. 다른 카테고리는 실제 데이터 연결 후 반영됩니다.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
