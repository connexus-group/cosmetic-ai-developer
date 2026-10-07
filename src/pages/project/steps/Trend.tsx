import { useState } from 'react';
import clsx from 'clsx';
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox, TrendRadar } from '@/components/charts';
import { AnalyzingState, Card, DemoBadge, KindBadge, LevelBadge, PageIntro, ScoreBar, Section, Segmented, SourceNote } from '@/components/ui';
import { DEMO_SOURCE } from '@/data/mock';
import { dataSource } from '@/data/source';
import type { IngredientTrend, TrendStage } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { useAsync } from '@/lib/useAsync';

const STAGES: TrendStage[] = ['EMERGING', 'GROWING', 'MAINSTREAM', 'SATURATED'];
const STAGE_KO: Record<TrendStage, string> = { EMERGING: '신흥', GROWING: '성장', MAINSTREAM: '주류', SATURATED: '포화' };
const STAGE_CLS: Record<TrendStage, string> = {
  EMERGING: 'bg-champagne-100 text-champagne-700',
  GROWING: 'bg-ink-100 text-ink-800',
  MAINSTREAM: 'bg-slate-100 text-slate-700',
  SATURATED: 'bg-slate-50 text-slate-500',
};

export function StageBadge({ stage }: { stage: TrendStage }) {
  return <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide', STAGE_CLS[stage])}>{stage}</span>;
}

export default function Trend() {
  const { data } = useAsync(() => dataSource.trends(), 'trends');
  const [sel, setSel] = useState('retinal');
  const [view, setView] = useState<'radar' | 'bubble'>('radar');

  return (
    <div className="space-y-6">
      <PageIntro no="05" title="Trend Radar" ko="트렌드 분석" question="어떤 원료와 컨셉이 지금 뜨고, 어떤 것은 이미 포화일까요?" right={<DemoBadge />} />
      {!data ? (
        <AnalyzingState />
      ) : (
        (() => {
          const t = data.items.find((x) => x.id === sel) ?? data.items[0];
          return (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
                <Section title="Ingredient Trend Radar" subtitle="안쪽일수록 새롭게 떠오르는 원료 · 점을 눌러 상세 보기" action={<Segmented value={view} onChange={setView} options={[{ id: 'radar', label: 'Radar' }, { id: 'bubble', label: 'Bubble' }]} />}>
                  {view === 'radar' ? <TrendRadar items={data.items} selected={sel} onSelect={setSel} /> : <TrendBubble items={data.items} selected={sel} onSelect={setSel} />}
                  <SourceNote source={DEMO_SOURCE} className="mt-3 border-t border-ink-50 pt-3" />
                </Section>
                <IngredientDetail t={t} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {STAGES.map((s) => (
                  <Card key={s} className="p-4">
                    <div className="flex items-center justify-between">
                      <StageBadge stage={s} />
                      <span className="text-xs text-slate-500">{STAGE_KO[s]}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.items
                        .filter((x) => x.stage === s)
                        .map((x) => (
                          <button key={x.id} type="button" onClick={() => setSel(x.id)} className={clsx('rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', sel === x.id ? 'bg-ink-900 text-white ring-ink-900' : 'text-ink-800 ring-ink-100 hover:bg-ink-50')}>
                            {x.name}
                          </button>
                        ))}
                    </div>
                  </Card>
                ))}
              </div>

              <AiInsight insight={data.insight} />

              <div className="grid gap-4 lg:grid-cols-3">
                {data.others.map((g) => (
                  <Section key={g.kind} title={g.title} subtitle={g.kind === 'Texture' ? '제형 트렌드' : g.kind === 'Claim' ? '효능 메시지 트렌드' : '소비 행동 트렌드'} action={<DemoBadge />}>
                    <ul className="space-y-2">
                      {g.items.map((it) => (
                        <li key={it.name} className="flex items-center gap-2 text-sm">
                          <span className="text-ink-900">{it.name}</span>
                          <StageBadge stage={it.stage} />
                          <span className={clsx('ml-auto text-xs font-semibold tabular-nums', it.change >= 0 ? 'text-ink-800' : 'text-slate-500')}>
                            {it.change > 0 ? '+' : ''}
                            {it.change}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                ))}
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}

function IngredientDetail({ t }: { t: IngredientTrend }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ingredient</div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">{t.name}</div>
        </div>
        <StageBadge stage={t.stage} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.note}</p>
      <div className="mt-5 flex items-end gap-3">
        <div className="text-4xl font-semibold tabular-nums text-ink-900">{t.trendScore}</div>
        <div className="pb-1 text-xs text-slate-500">
          Trend Score <KindBadge kind="AI_ESTIMATE" className="ml-1" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <ScoreBar label="Search Growth (검색 성장률)" value={Math.max(0, t.searchGrowth)} max={120} right={`${t.searchGrowth > 0 ? '+' : ''}${t.searchGrowth}%`} />
        <ScoreBar label="Product Launch Growth (출시 증가율)" value={Math.max(0, t.launchGrowth)} max={120} right={`${t.launchGrowth > 0 ? '+' : ''}${t.launchGrowth}%`} />
        <ScoreBar label="Competition (시장 경쟁도)" value={t.competitionScore} tone="champagne" right={<LevelBadge level={t.competition} />} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-50 pt-4 text-sm">
        <div>
          <div className="text-[11px] text-slate-500">Marketing Potential</div>
          <LevelBadge level={t.marketingPotential} className="mt-1" />
        </div>
        <div>
          <div className="text-[11px] text-slate-500">SNS 언급량 (12개월)</div>
          <div className="mt-0.5 font-semibold tabular-nums text-ink-900">{t.snsMentions.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-4">
        <DemoBadge />
      </div>
    </Card>
  );
}

function TrendBubble({ items, selected, onSelect }: { items: IngredientTrend[]; selected: string; onSelect: (id: string) => void }) {
  const data = items.map((x) => ({ ...x, sel: x.id === selected }));
  return (
    <div className="h-[420px]">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 4 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" dataKey="competitionScore" domain={[0, 100]} tick={{ fill: AXIS, fontSize: 11 }} label={{ value: 'Competition (경쟁도)', position: 'insideBottom', offset: -14, fill: AXIS, fontSize: 11 }} />
          <YAxis type="number" dataKey="searchGrowth" domain={[-20, 130]} tick={{ fill: AXIS, fontSize: 11 }} width={44} label={{ value: 'Search Growth %', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11, dy: 50 }} />
          <ZAxis type="number" dataKey="snsMentions" range={[100, 900]} />
          <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={payload[0].payload.name} rows={[{ label: '검색 성장', value: `${payload[0].payload.searchGrowth}%` }, { label: '경쟁도', value: payload[0].payload.competitionScore }, { label: '단계', value: payload[0].payload.stage }]} /> : null)} />
          <Scatter data={data.filter((d) => !d.sel)} fill={SERIES[0]} fillOpacity={0.7} stroke="#fff" strokeWidth={2} onClick={(d: { payload?: IngredientTrend }) => d.payload && onSelect(d.payload.id)}>
            <LabelList dataKey="name" position="top" style={{ fill: '#261b36', fontSize: 11 }} />
          </Scatter>
          <Scatter data={data.filter((d) => d.sel)} fill={SERIES[1]} stroke="#fff" strokeWidth={2}>
            <LabelList dataKey="name" position="top" style={{ fill: '#261b36', fontSize: 11, fontWeight: 700 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
