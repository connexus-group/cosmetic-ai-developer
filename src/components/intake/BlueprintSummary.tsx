import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Pencil } from 'lucide-react';
import { fieldsOf, SPEC_GROUPS } from '@/data/intakeSpec';
import type { Spec, SpecFieldId } from '@/data/types';
import { answerKind, displayValue, isSet } from '@/lib/spec';
import { Button, Card, KindBadge } from '../ui';

/** Product Blueprint Summary: every condition grouped, with its source and an edit link. */
export function BlueprintSummary({ spec, productName, onEdit, onBack, onStart }: { spec: Spec; productName: string; onEdit: (groupNo: number, field?: SpecFieldId) => void; onBack: () => void; onStart: () => void }) {
  const all = SPEC_GROUPS.flatMap((g) => fieldsOf(g.id));
  const user = all.filter((f) => spec[f.id]?.mode === 'user' && isSet(spec[f.id])).length;
  const idea = all.filter((f) => spec[f.id]?.mode === 'idea' && isSet(spec[f.id])).length;
  const demo = all.filter((f) => spec[f.id]?.mode === 'ai' && isSet(spec[f.id])).length;
  const open = all.length - user - idea - demo;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">PRODUCT BLUEPRINT SUMMARY</div>
        <h2 className="mt-1 text-xl font-semibold text-ink-900">{productName} · 제품 개발 조건 최종 확인</h2>
        <p className="mt-1 text-xs text-slate-500">입력한 조건이 시장·컨셉·제형·원료·패키지·원가·규제 분석에 그대로 쓰입니다. 바꾸고 싶은 항목은 수정 버튼을 누르세요.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: '직접 입력', n: user, kind: 'USER_INPUT' as const },
          { label: '아이디어에서 추출', n: idea, kind: 'AI_ANALYSIS' as const },
          { label: '데모 추천 (가설)', n: demo, kind: 'DEMO_RECOMMEND' as const },
          { label: '미정', n: open, kind: null },
        ].map((x) => (
          <div key={x.label} className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
              {x.label}
              {x.kind ? <KindBadge kind={x.kind} /> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">미정</span>}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{x.n}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {SPEC_GROUPS.map((g) => (
          <Card key={g.id} className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-ink-50 bg-ink-50/40 px-5 py-3">
              <div>
                <span className="text-[10px] font-bold tracking-[0.16em] text-champagne-700">STEP {g.no}</span>
                <span className="ml-2 text-sm font-semibold text-ink-900">{g.en}</span>
              </div>
              <button type="button" onClick={() => onEdit(g.no)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-600 hover:bg-white hover:text-ink-900">
                <Pencil size={12} /> 단계 수정
              </button>
            </div>
            <dl className="divide-y divide-ink-50 px-5">
              {fieldsOf(g.id).map((f) => {
                const a = spec[f.id];
                const kind = answerKind(a);
                const value = displayValue(f, a);
                return (
                  <div key={f.id} className="flex items-start gap-3 py-2.5">
                    <dt className="w-28 shrink-0 pt-0.5 text-[12px] text-slate-500 sm:w-36">{f.label}</dt>
                    <dd className={clsx('min-w-0 flex-1 break-words text-[13px]', value === '미정' ? 'text-slate-400' : 'font-medium text-ink-900')}>
                      {value}
                      {a?.mode === 'unknown' && <span className="ml-1 text-[11px] text-slate-400">(잘 모르겠어요)</span>}
                    </dd>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {kind && <KindBadge kind={kind} />}
                      <button type="button" onClick={() => onEdit(g.no, f.id)} aria-label={`${f.label} 수정`} className="rounded-md p-1 text-slate-400 hover:bg-ink-50 hover:text-ink-800">
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </dl>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        데모 추천 값은 실제 AI API가 아닌 규칙 기반 추천이며 검증된 시장조사 결과가 아닌 가설입니다. 입력값만으로 안전성이나 규제 적합성을 확정하지 않으며, 원료·기능성·표시광고는 규제 검토가 필요합니다.
      </p>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> 이전 · Global
        </Button>
        <Button variant="primary" className="px-6 py-3 text-[15px]" onClick={onStart}>
          이 조건으로 제품 개발 시작 <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

/** Compact Blueprint for the project overview: answered conditions per group, with the count still open. */
export function BlueprintCompact({ spec, onEdit }: { spec: Spec; onEdit: (groupNo: number) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {SPEC_GROUPS.map((g) => {
        const fields = fieldsOf(g.id);
        const answered = fields.filter((f) => isSet(spec[f.id]));
        const open = fields.length - answered.length;
        return (
          <div key={g.id} className="rounded-xl border border-ink-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold tracking-[0.16em] text-champagne-700">STEP {g.no}</span>
                <span className="ml-2 text-sm font-semibold text-ink-900">{g.label}</span>
              </div>
              <button type="button" onClick={() => onEdit(g.no)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:text-ink-900">
                <Pencil size={12} /> 수정
              </button>
            </div>
            <dl className="mt-2 space-y-1.5">
              {answered.map((f) => {
                const kind = answerKind(spec[f.id]);
                return (
                  <div key={f.id} className="flex items-start gap-2 text-[13px]">
                    <dt className="w-24 shrink-0 text-[12px] text-slate-500">{f.label}</dt>
                    <dd className="min-w-0 flex-1 break-words font-medium text-ink-900">{displayValue(f, spec[f.id])}</dd>
                    {kind && kind !== 'USER_INPUT' && <KindBadge kind={kind} />}
                  </div>
                );
              })}
              {!answered.length && <div className="text-[12px] text-slate-400">입력한 조건이 없어요.</div>}
            </dl>
            {open > 0 && <div className="mt-2 text-[11px] text-slate-400">미정 {open}개</div>}
          </div>
        );
      })}
    </div>
  );
}
