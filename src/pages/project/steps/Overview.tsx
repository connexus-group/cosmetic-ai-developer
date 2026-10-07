import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, ArrowRight, Check, Pencil } from 'lucide-react';
import { CLARIFY_QUESTIONS } from '@/data/mock';
import type { IntakeKey } from '@/data/types';
import { KindBadge, PageIntro, Section } from '@/components/ui';
import { conceptOf, currentStep, formulaOf, NEXT_ACTION, packageOf, PHASES, phaseOf, progressOf, STEPS, stepStatus } from '@/lib/engine';
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
    <div className="space-y-10">
      <PageIntro no="01" title="Overview" ko="프로젝트 개요" question="지금 어디까지 왔고, 다음에 무엇을 하면 될까요?" />

      {/* Next step: the one thing to do now, larger than everything else on the page. */}
      <section className="rounded-xl border border-wine-100 bg-white p-6 sm:p-10">
        <div className="text-[13px] font-medium text-wine-700">Next step</div>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[13px] text-ink-500">
              {phaseOf(cur.id).label} · Step {cur.no} {cur.label}
            </div>
            <div className="mt-2 text-[26px] font-semibold leading-snug tracking-tight text-ink-900 sm:text-[32px]">{NEXT_ACTION[cur.id].question}</div>
          </div>
          <Link to={`/projects/${p.id}/${cur.id}`} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-ink-900 px-7 py-4 text-[15px] font-medium text-white transition hover:bg-wine-800">
            {NEXT_ACTION[cur.id].cta} <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <div className="grid gap-x-12 gap-y-8 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-[13px] text-ink-500">Development progress</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-[72px] leading-none text-ink-900 tabular-nums">{prog.pct}</span>
            <span className="font-display text-3xl text-ink-400">%</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-100">
            <div className="h-1 rounded-full bg-wine-600" style={{ width: `${prog.pct}%` }} />
          </div>
          <div className="mt-2 text-[13px] text-ink-500">
            단계 {prog.stepsDone}/{prog.stepsTotal} · 체크리스트 {prog.checks}/{prog.checksTotal}
          </div>
        </div>
        {[
          { label: 'Concept', value: concept?.name, to: 'concept' },
          { label: 'Formula', value: formula?.name, to: 'formula' },
          { label: 'Package', value: pkg?.name, to: 'packaging' },
        ].map((x) => (
          <Link key={x.label} to={`/projects/${p.id}/${x.to}`} className="group border-t border-ink-200 pt-4 sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0">
            <div className="text-[13px] text-ink-500">{x.label}</div>
            <div className={clsx('mt-3 text-lg font-semibold leading-snug', x.value ? 'text-ink-900' : 'text-ink-300')}>{x.value ?? '아직 선택 전'}</div>
            <div className="mt-2 text-[13px] text-wine-700 opacity-0 transition group-hover:opacity-100">{x.value ? '변경하기' : '선택하러 가기'} →</div>
          </Link>
        ))}
      </div>

      <Section
        title="Development process"
        subtitle="네 단계로 나뉜 15개 과정입니다. 언제든 눌러 이동할 수 있고, 앞 단계를 고치면 영향받는 단계에 '재검토'가 표시됩니다."
        action={
          <div className="flex flex-wrap gap-4 text-[12px] text-ink-500">
            <span className="flex items-center gap-1.5"><Check size={12} className="text-wine-600" /> 완료</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-wine-600" /> 현재 단계</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-ink-300" /> 예정</span>
          </div>
        }
      >
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {PHASES.map((ph) => {
            const done = ph.steps.filter((id) => stepStatus(p, id) === 'done').length;
            return (
              <div key={ph.id}>
                <div className="flex items-baseline gap-2 border-b border-ink-100 pb-3">
                  <span className="text-[12px] font-semibold tabular-nums text-wine-700">{ph.no}</span>
                  <span className="font-semibold text-ink-900">{ph.label}</span>
                  <span className="text-[13px] text-ink-400">{ph.ko}</span>
                  <span className="ml-auto text-[12px] tabular-nums text-ink-400">
                    {done}/{ph.steps.length}
                  </span>
                </div>
                <ul className="mt-2">
                  {ph.steps.map((id) => {
                    const s = STEPS.find((x) => x.id === id)!;
                    const st = stepStatus(p, id);
                    const isCur = id === cur.id;
                    return (
                      <li key={id}>
                        <Link
                          to={`/projects/${p.id}/${id}`}
                          className={clsx('-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition hover:bg-ink-50', isCur && 'bg-wine-50 hover:bg-wine-50')}
                        >
                          <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-full', st === 'done' ? 'bg-wine-50 text-wine-700' : isCur ? 'bg-wine-600' : st === 'stale' ? 'bg-amber-100' : 'border border-ink-200')}>
                            {st === 'done' ? <Check size={11} /> : st === 'stale' ? <AlertCircle size={11} className="text-amber-700" /> : isCur ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                          </span>
                          <span className={clsx('text-[15px]', isCur ? 'font-semibold text-wine-800' : st === 'todo' ? 'text-ink-500' : 'text-ink-900')}>{s.label}</span>
                          <span className="ml-auto text-[12px] text-ink-400">{st === 'done' ? '완료' : st === 'stale' ? '재검토' : isCur ? '현재 단계' : ''}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="AI 요구사항 분석" subtitle="값을 누르면 수정할 수 있어요. 수정하면 이후 분석에 '재검토 필요'가 표시됩니다.">
          <div className="mb-4 rounded-xl bg-ink-50/60 px-4 py-3 text-sm text-ink-800">“{p.idea}”</div>
          <dl className="divide-y divide-ink-50">
            {(Object.keys(INTAKE_LABELS) as IntakeKey[]).map((k) => (
              <div key={k} className="group flex items-center gap-3 py-2.5">
                <dt className="w-28 shrink-0 text-xs font-medium text-ink-500">{INTAKE_LABELS[k].en}</dt>
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
                      <Pencil size={11} className="text-ink-300 opacity-0 group-hover:opacity-100" />
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
                  <dt className="flex-1 text-xs text-ink-500">{q.question}</dt>
                  <dd className={clsx('text-sm font-medium', a && a.mode !== 'unknown' ? 'text-ink-900' : 'text-ink-400')}>{answerLabel(a)}</dd>
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
