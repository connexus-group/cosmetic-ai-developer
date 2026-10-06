import { useState } from 'react';
import clsx from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { Heatmap, TipBox } from '@/components/charts';
import { AnalyzingState, DemoBadge, MetricCard, PageIntro, Section, SourceNote } from '@/components/ui';
import { DEMO_SOURCE } from '@/data/mock';
import { dataSource } from '@/data/source';
import type { KeywordStat } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { useAsync } from '@/lib/useAsync';

export default function Consumer() {
  const { data } = useAsync(() => dataSource.consumer(), 'consumer');
  const [pos, setPos] = useState('저자극');
  const [pain, setPain] = useState('끈적임');

  return (
    <div className="space-y-6">
      <PageIntro no="04" title="Consumer Analysis" ko="소비자 니즈 분석" question="소비자는 무엇을 좋아하고, 무엇에 불만을 느끼나요?" right={<DemoBadge />} />
      {!data ? (
        <AnalyzingState />
      ) : (
        (() => {
          const p = data.positives.find((x) => x.term === pos)!;
          const n = data.pains.find((x) => x.term === pain)!;
          const fastestPos = [...data.positives].sort((a, b) => b.change - a.change)[0];
          const fastestPain = [...data.pains].sort((a, b) => b.change - a.change)[0];
          const series = data.months.map((m, i) => ({ month: m, pos: p.monthly[i], pain: n.monthly[i] }));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label="Reviews analyzed" value={data.sampleSize.toLocaleString()} sub="경쟁제품 리뷰 (최근 12개월)" kind="DEMO" />
                <MetricCard label="Top need" value={fastestPos.term} sub={`언급 +${fastestPos.change}% 증가`} kind="AI_ANALYSIS" />
                <MetricCard label="Top pain" value={fastestPain.term} sub={`언급 +${fastestPain.change}% 증가`} kind="AI_ANALYSIS" />
                <MetricCard label="Pain share" value={`${Math.round((data.pains.reduce((a, x) => a + x.mentions, 0) / data.sampleSize) * 100)}%`} sub="불만 키워드가 포함된 리뷰 비율" kind="AI_ANALYSIS" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <KeywordList title="Positive Needs" subtitle="소비자가 좋아하는 점 · 눌러서 추이 보기" items={data.positives} active={pos} onPick={setPos} tone="pos" />
                <KeywordList title="Pain Points" subtitle="소비자가 불만인 점 · 눌러서 추이 보기" items={data.pains} active={pain} onPick={setPain} tone="pain" />
              </div>

              <Section title={`"${pos}"와 "${pain}" 언급은 어떻게 변하고 있나요?`} subtitle="월별 리뷰 언급 수" action={<DemoBadge />}>
                <div className="h-72">
                  <ResponsiveContainer>
                    <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={40} />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <TipBox title={`20${String(label).replace('.', '년 ')}월`} rows={payload.map((x) => ({ label: x.dataKey === 'pos' ? pos : pain, value: `${x.value}건`, color: String(x.color) }))} />
                          ) : null
                        }
                      />
                      <Line type="monotone" dataKey="pos" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                      <Line type="monotone" dataKey="pain" stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4" style={{ background: SERIES[0] }} /> {pos} (니즈)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4" style={{ background: SERIES[1] }} /> {pain} (불만)
                  </span>
                </div>
              </Section>

              <AiInsight insight={data.insight} title="AI CONSUMER INSIGHT" />

              <Section title="어떤 피부 타입이 어떤 불만을 가장 많이 말하나요?" subtitle="피부 타입별 불만 언급 비중 (행 기준 %, 진할수록 많음)" action={<DemoBadge />}>
                <Heatmap rows={data.skinTypes} cols={data.pains.map((x) => x.term)} values={data.heatmap} />
                <p className="mt-3 text-xs text-slate-500">지성·복합성은 "끈적임·무거운 사용감", 민감성은 "자극"이 두드러집니다.</p>
                <SourceNote source={DEMO_SOURCE} className="mt-4 border-t border-ink-50 pt-3" />
              </Section>
            </>
          );
        })()
      )}
    </div>
  );
}

function KeywordList({ title, subtitle, items, active, onPick, tone }: { title: string; subtitle: string; items: KeywordStat[]; active: string; onPick: (t: string) => void; tone: 'pos' | 'pain' }) {
  const max = Math.max(...items.map((x) => x.mentions));
  const color = tone === 'pos' ? SERIES[0] : SERIES[1];
  return (
    <Section title={title} subtitle={subtitle} action={<DemoBadge />}>
      <div className="space-y-1">
        {items.map((k) => (
          <button
            type="button"
            key={k.term}
            onClick={() => onPick(k.term)}
            className={clsx('grid w-full grid-cols-[96px_1fr_56px_60px] items-center gap-3 rounded-xl px-2 py-2 text-left transition', active === k.term ? 'bg-ink-50' : 'hover:bg-ink-50/50')}
          >
            <span className={clsx('text-sm', active === k.term ? 'font-semibold text-ink-900' : 'text-slate-700')}>{k.term}</span>
            <span className="h-2 rounded-full bg-ink-50">
              <span className="block h-2 rounded-full" style={{ width: `${(k.mentions / max) * 100}%`, background: color, opacity: active === k.term ? 1 : 0.55 }} />
            </span>
            <span className="text-right text-xs tabular-nums text-slate-600">{k.mentions.toLocaleString()}</span>
            <span className={clsx('flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums', k.change >= 0 ? 'text-ink-800' : 'text-slate-500')}>
              {k.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {k.change > 0 ? '+' : ''}
              {k.change}%
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}
