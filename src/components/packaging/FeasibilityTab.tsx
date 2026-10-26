import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { KindBadge, Unverified } from '@/components/ui';
import { CONTAINER_OPTIONS, fitChecks, inputMap, MATERIAL_CANDIDATES, materialOf, PRINT_METHODS, quoteText, selectedDirection } from '@/data/packaging';
import type { SupplierQuote } from '@/data/types';
import { parseWon } from '@/lib/spec';
import type { TabProps } from './PackagingStudio';

export function FeasibilityTab({ p, studio, setStudio, inputs, go }: TabProps) {
  const d = selectedDirection(studio);
  const m = inputMap(inputs);
  const container = studio.mockupOptions?.container ?? CONTAINER_OPTIONS.find((c) => d?.container.includes(c)) ?? CONTAINER_OPTIONS.find((c) => m.container.includes(c)) ?? '에어리스';
  const material = studio.material ?? d?.material ?? materialOf(container);
  const checks = fitChecks(p, container, material);
  const firstRun = parseWon(m.firstRun);
  const targetCost = parseWon(m.cost);
  const q = studio.quotes ?? {};
  const pkgTotal = q.container?.unitPrice != null && q.carton?.unitPrice != null ? q.container.unitPrice + q.carton.unitPrice : null;

  const setQuote = (k: 'container' | 'carton', patch: Partial<SupplierQuote>) =>
    setStudio((s) => ({ ...s, quotes: { ...s.quotes, [k]: { supplier: '', unitPrice: null, moq: null, date: '', note: '', ...s.quotes?.[k], ...patch } } }));

  return (
    <div className="space-y-3">
      {!d && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          디자인 방향을 선택하지 않아 기획안의 용기·제형 기준으로 보여드려요.{' '}
          <button type="button" className="font-semibold underline" onClick={() => go('direction')}>
            방향 선택
          </button>
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-ink-100">
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-ink-50">
            <Tr label="권장 용기 유형" badge={<KindBadge kind={d ? (studio.directions?.mode === 'ai' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND') : 'AI_ANALYSIS'} />}>
              <b>{container}</b>
              {d && <span className="text-slate-500"> · {d.container}</span>}
              <span className="block text-[11px] text-slate-500">시안 탭에서 용기 형태를 바꾸면 여기에도 반영됩니다.</span>
            </Tr>
            <Tr label="용량" badge={inputs.find((x) => x.key === 'size')?.kind ? <KindBadge kind={inputs.find((x) => x.key === 'size')!.kind!} /> : null}>
              {m.size || <Unverified label="미정" />}
            </Tr>
            <Tr label="재질 후보" badge={<KindBadge kind="AI_ANALYSIS" />}>
              <div className="flex flex-wrap gap-1">
                {(MATERIAL_CANDIDATES[container] ?? []).map((x) => (
                  <button key={x} type="button" onClick={() => setStudio((s) => ({ ...s, material: x }))} className={clsx('rounded-md px-2 py-0.5 text-[12px] ring-1 ring-inset', studio.material === x ? 'bg-ink-800 text-white ring-ink-800' : 'text-ink-800 ring-ink-200 hover:bg-ink-50')}>
                    {x}
                  </button>
                ))}
              </div>
              <span className="mt-0.5 block text-[11px] text-slate-500">현재: {material} · 공급사 재질 사양서로 확인 필요</span>
            </Tr>
            <Tr label="제형·용기 적합성" badge={<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">확인 필요</span>}>
              <div className="mb-1 text-[11px] text-slate-500">제형 {m.texture || '미정'} × {container} · 실제 용기 적합성 시험 전까지 모든 항목은 확인 필요입니다.</div>
              <ul className="space-y-1">
                {checks.map((c) => (
                  <li key={c.item} className="flex items-start gap-1.5 text-[12.5px]">
                    <CircleAlert size={13} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      <b className="font-medium">{c.item}</b> · {c.note}
                    </span>
                  </li>
                ))}
              </ul>
            </Tr>
            <Tr label="초도 MOQ" badge={<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">공급사 확인 필요</span>}>
              기획 초도 수량 <b>{m.firstRun || '미정'}</b>
              <span className="block text-[11.5px] text-slate-600">
                용기·단상자 MOQ는 공급사마다 달라 확정값을 표시하지 않습니다. 기성(스톡) 용기는 소량 대응 여부를, 신규 금형·전용 컬러 사출은 최소 수량과 금형비를 견적으로 확인하세요.
                {firstRun && firstRun < 3000 ? ' 초도 수량이 적어 기성 용기 + 라벨·실크 인쇄 조합이 현실적인지 우선 확인 권장.' : ''}
              </span>
              {(q.container?.moq || q.carton?.moq) && (
                <span className="mt-0.5 block text-[11.5px]">
                  견적 MOQ: 용기 {q.container?.moq?.toLocaleString('ko-KR') ?? '-'}개 · 단상자 {q.carton?.moq?.toLocaleString('ko-KR') ?? '-'}개
                  {firstRun && [q.container?.moq, q.carton?.moq].some((x) => x && x > firstRun) ? <b className="text-rose-700"> · 초도 수량보다 큼</b> : ''}
                </span>
              )}
            </Tr>
            <Tr label="용기 예상 단가" badge={<KindBadge kind="USER_INPUT" className={q.container?.unitPrice != null ? '' : 'hidden'} />}>
              <QuoteForm q={q.container} onChange={(x) => setQuote('container', x)} />
            </Tr>
            <Tr label="단상자 예상 단가" badge={<KindBadge kind="USER_INPUT" className={q.carton?.unitPrice != null ? '' : 'hidden'} />}>
              <QuoteForm q={q.carton} onChange={(x) => setQuote('carton', x)} />
            </Tr>
            <Tr label="인쇄·후가공" badge={<KindBadge kind={d ? (studio.directions?.mode === 'ai' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND') : 'AI_ANALYSIS'} />}>
              {d && <div className="mb-1">{d.finishing}</div>}
              <div className="text-[11.5px] text-slate-600">
                용기 후보: {PRINT_METHODS.container.join(', ')}
                <br />
                단상자 후보: {PRINT_METHODS.carton.join(', ')}
              </div>
              <span className="text-[11px] text-slate-500">후가공 단가와 가능 여부는 인쇄·용기 공급사 견적으로 확인 필요</span>
            </Tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
        {pkgTotal != null ? (
          <span>
            입력한 견적 기준 용기+단상자 {pkgTotal.toLocaleString('ko-KR')}원
            {targetCost ? ` · 목표 제조원가 ${targetCost.toLocaleString('ko-KR')}원의 ${Math.round((pkgTotal / targetCost) * 100)}%` : ''} <KindBadge kind="USER_INPUT" />
          </span>
        ) : (
          <span>용기·단상자 견적을 모두 입력하면 목표 원가 대비 비중을 계산해요. 견적이 없으면 단가를 만들지 않습니다.</span>
        )}
        <Link to={`/projects/${p.id}/cost`} className="ml-auto font-medium text-ink-600 underline underline-offset-2">
          원가 시뮬레이션(11단계) 보기
        </Link>
      </div>
    </div>
  );
}

function Tr({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr className="align-top">
      <th className="w-28 bg-ink-50/40 px-3 py-2 text-left text-[11.5px] font-semibold text-slate-600 sm:w-36">
        {label}
        {badge && <div className="mt-1">{badge}</div>}
      </th>
      <td className="px-3 py-2">{children}</td>
    </tr>
  );
}

function QuoteForm({ q, onChange }: { q?: SupplierQuote; onChange: (x: Partial<SupplierQuote>) => void }) {
  const field = 'min-w-0 rounded-md border border-ink-100 px-2 py-1 text-[12px] outline-none focus:border-ink-400';
  const num = (v: string) => {
    const n = Number(v.replace(/[^\d]/g, ''));
    return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };
  return (
    <div>
      <div className={clsx('mb-1 text-[12.5px]', q?.unitPrice != null ? 'font-semibold text-ink-900' : 'text-slate-500')}>{quoteText(q)}</div>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        <input className={field} placeholder="공급사" value={q?.supplier ?? ''} onChange={(e) => onChange({ supplier: e.target.value })} />
        <input className={field} placeholder="견적 단가(원)" inputMode="numeric" value={q?.unitPrice ?? ''} onChange={(e) => onChange({ unitPrice: num(e.target.value) })} />
        <input className={field} placeholder="견적 MOQ(개)" inputMode="numeric" value={q?.moq ?? ''} onChange={(e) => onChange({ moq: num(e.target.value) })} />
        <input className={field} type="date" value={q?.date ?? ''} onChange={(e) => onChange({ date: e.target.value })} />
      </div>
    </div>
  );
}
