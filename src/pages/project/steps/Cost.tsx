import { RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { Button, Card, DemoBadge, KindBadge, MetricCard, PageIntro, Section, Segmented, StatStrip } from '@/components/ui';
import { COST_LABELS } from '@/data/mock';
import type { CostKey, Moq } from '@/data/types';
import { ACCENT, AXIS, CHAMPAGNE, GRID, MUTED } from '@/lib/colors';
import { costDefaults, costSummary, effectiveConcept, formulaOf, krw, packageOf, pct } from '@/lib/engine';
import { useProject } from '../ProjectLayout';
import { PreviewBanner } from './PreviewBanner';

const MOQS: Moq[] = [3000, 5000, 10000];

export default function Cost() {
  const { project: p, update } = useProject();
  const concept = effectiveConcept(p);
  const s = costSummary(p);
  const defaults = costDefaults(p);
  const byMoq = MOQS.map((m) => ({ moq: m, label: `${m.toLocaleString()}ea`, total: costSummary(p, m).total }));
  const vat = p.retailPrice - p.retailPrice / 1.1;
  const fee = (p.retailPrice / 1.1) * p.channelFeeRate;
  const margin = p.retailPrice - vat - fee - s.total;
  const split = [
    { label: '제조원가', value: s.total, color: ACCENT },
    { label: '채널 수수료', value: fee, color: CHAMPAGNE },
    { label: '부가세', value: vat, color: MUTED },
    { label: '브랜드 마진', value: Math.max(0, margin), color: '#4f7d5c' },
  ];

  const setOverride = (k: CostKey, v: string) => {
    const n = Number(v.replace(/[^\d]/g, ''));
    update((x) => ({ ...x, costOverrides: { ...x.costOverrides, [k]: Number.isFinite(n) ? n : 0 } }));
  };
  const resetLine = (k: CostKey) =>
    update((x) => {
      const next = { ...x.costOverrides };
      delete next[k];
      return { ...x, costOverrides: next };
    });

  return (
    <div className="space-y-10">
      <PageIntro no="11" title="Cost Simulator" ko="목표 원가 계산" question="얼마에 만들어서 얼마에 팔면 남을까요?" right={<DemoBadge />} />
      {(!p.conceptId || !p.formulaId || !p.packageId) && <PreviewBanner projectId={p.id} step={!p.conceptId ? 'concept' : !p.formulaId ? 'formula' : 'packaging'} what={!p.conceptId ? '제품 컨셉' : !p.formulaId ? '제형' : '패키지'} />}

      <StatStrip className="sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Manufacturing Cost" value={krw(s.total)} sub={`MOQ ${p.moq.toLocaleString()}개 기준 개당`} kind="AI_ESTIMATE" />
        <MetricCard label="Cost Ratio" value={pct(s.costRatio)} sub={`판매가 ${krw(p.retailPrice)} 대비`} kind="AI_ANALYSIS" />
        <MetricCard label="Gross Margin" value={pct(s.grossMargin)} sub="부가세 제외 매출 대비" kind="AI_ANALYSIS" />
        <MetricCard label="Net Margin" value={pct(s.netMargin)} sub={`채널 수수료 ${Math.round(p.channelFeeRate * 100)}% 반영`} kind="AI_ANALYSIS" />
      </StatStrip>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_1fr]">
        <Section
          title="원가 항목 (개당, MOQ 5,000 기준 단가)"
          subtitle="숫자를 직접 고치면 즉시 다시 계산돼요. 고친 값은 USER INPUT으로 표시됩니다."
          action={
            Object.keys(p.costOverrides).length > 0 ? (
              <Button variant="ghost" onClick={() => update((x) => ({ ...x, costOverrides: {} }))}>
                <RotateCcw size={13} /> 모두 초기화
              </Button>
            ) : undefined
          }
        >
          <div className="divide-y divide-ink-50">
            {s.lines.map((l) => (
              <div key={l.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                <div className="w-full shrink-0 text-sm text-ink-700 sm:w-32">{COST_LABELS[l.key]}</div>
                <div className="relative w-28 sm:w-36">
                  <input
                    inputMode="numeric"
                    value={l.at5000.toLocaleString('ko-KR')}
                    onChange={(e) => setOverride(l.key, e.target.value)}
                    className="w-full rounded-lg border border-ink-100 bg-white py-1.5 pl-3 pr-8 text-right text-sm tabular-nums outline-none focus:border-ink-400"
                    aria-label={`${COST_LABELS[l.key]} 단가`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">원</span>
                </div>
                <KindBadge kind={l.edited ? 'USER_INPUT' : 'AI_ESTIMATE'} />
                {l.edited && (
                  <button type="button" onClick={() => resetLine(l.key)} className="text-[11px] text-ink-400 hover:text-ink-700">
                    기본값 {defaults[l.key].toLocaleString()}원
                  </button>
                )}
                <div className="ml-auto text-right text-sm font-semibold tabular-nums text-ink-900">{krw(l.value)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 text-sm">
              <span className="font-semibold text-ink-900">예상 제조원가 (MOQ {p.moq.toLocaleString()})</span>
              <span className="text-lg font-semibold tabular-nums text-ink-900">{krw(s.total)}</span>
            </div>
          </div>
        </Section>

        <div className="space-y-10">
          <Card className="space-y-4 p-6">
            <div>
              <div className="mb-2 text-xs font-semibold text-ink-500">MOQ (초도 생산수량)</div>
              <Segmented value={p.moq} onChange={(v) => update((x) => ({ ...x, moq: v }))} options={MOQS.map((m) => ({ id: m, label: `${m.toLocaleString()}ea` }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-ink-500">
                판매가 (부가세 포함)
                <input
                  inputMode="numeric"
                  value={p.retailPrice.toLocaleString('ko-KR')}
                  onChange={(e) => update((x) => ({ ...x, retailPrice: Number(e.target.value.replace(/[^\d]/g, '')) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-1.5 text-right text-sm tabular-nums text-ink-900 outline-none focus:border-ink-400"
                />
              </label>
              <label className="text-xs text-ink-500">
                채널 수수료율 (%)
                <input
                  inputMode="numeric"
                  value={Math.round(p.channelFeeRate * 100)}
                  onChange={(e) => update((x) => ({ ...x, channelFeeRate: Math.min(90, Number(e.target.value.replace(/[^\d]/g, '')) || 0) / 100 }))}
                  className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-1.5 text-right text-sm tabular-nums text-ink-900 outline-none focus:border-ink-400"
                />
              </label>
            </div>
            <p className="text-[11px] text-ink-500">채널 수수료는 데모 가정값입니다. 실제 계약 조건으로 바꿔 입력하세요. 채널별 마진 구조는 확장 가능한 구조로 두었습니다.</p>
            <div>
              <div className="mb-2 text-xs font-semibold text-ink-500">판매가 {krw(p.retailPrice)}는 이렇게 나뉘어요</div>
              <div className="flex h-8 overflow-hidden rounded-lg">
                {split.map((x) => (
                  <div key={x.label} title={`${x.label} ${krw(x.value)}`} style={{ width: `${(x.value / p.retailPrice) * 100}%`, background: x.color }} className="border-r-2 border-white last:border-r-0" />
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-600">
                {split.map((x) => (
                  <span key={x.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: x.color }} /> {x.label} <b className="ml-auto tabular-nums text-ink-900">{krw(x.value)}</b>
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Section title="MOQ에 따라 개당 원가는 어떻게 바뀌나요?" subtitle="수량이 많을수록 용기·충진 단가가 내려가요 (데모 가정)" action={<KindBadge kind="AI_ESTIMATE" />}>
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={byMoq} margin={{ top: 22, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f6f1ec' }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={String(payload[0].payload.label)} rows={[{ label: '개당 제조원가', value: krw(Number(payload[0].value)) }]} /> : null)} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56} onClick={(d: { payload?: { moq: Moq } }) => d.payload && update((x) => ({ ...x, moq: d.payload!.moq }))}>
                    {byMoq.map((b) => (
                      <Cell key={b.moq} fill={b.moq === p.moq ? ACCENT : MUTED} cursor="pointer" />
                    ))}
                    <LabelList dataKey="total" position="top" formatter={(v) => krw(Number(v))} style={{ fill: '#292524', fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>

      <AiInsight
        insight={{
          finding: `MOQ ${p.moq.toLocaleString()}개 기준 예상 제조원가는 ${krw(s.total)}, 원가율 ${pct(s.costRatio)}입니다.`,
          why: '화장품은 일반적으로 원가율이 낮아도 채널 수수료·마케팅비 비중이 커서 실제 남는 금액은 훨씬 작습니다.',
          opportunity: `MOQ를 10,000개로 늘리면 개당 ${krw(byMoq[1].total - byMoq[2].total)} 절감되지만 재고 부담이 커집니다.`,
          risk: `${formulaOf(p)?.name ?? '선택 제형'} 내용물과 ${packageOf(p)?.name ?? '선택 용기'} 단가는 데모 추정값이며, 실제 견적은 제조사·용기사 확인이 필요합니다.`,
          recommendation: `${concept.id === 'C' ? '프리미엄 가격 유지가 필요합니다. ' : ''}초도는 5,000개로 시작해 판매 데이터를 확인한 뒤 10,000개로 늘리는 것을 추천합니다.`,
        }}
      />
    </div>
  );
}
