import { useState } from 'react';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { CartesianGrid, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { AnalyzingState, Card, DemoBadge, KindBadge, MetricCard, PageIntro, Section, Segmented, SourceNote } from '@/components/ui';
import { DEMO_SOURCE } from '@/data/mock';
import { dataSource } from '@/data/source';
import type { Competitor } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { conceptOf, krw } from '@/lib/engine';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';

const perMl = (c: Competitor) => Math.round(c.price / c.sizeMl);

export default function Competitors() {
  const { project: p } = useProject();
  const { data } = useAsync(() => dataSource.competitors(), 'competitors');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [selected, setSelected] = useState<string | null>(null);
  const concept = conceptOf(p);
  const ours = { id: 'ours', name: concept?.name ?? '우리 제품 (목표)', price: concept?.retailPrice ?? p.retailPrice, premiumScore: concept?.id === 'C' ? 88 : concept?.id === 'A' ? 58 : 70, reviews: 6000 };

  if (!data) return <Shell><AnalyzingState /></Shell>;
  const items = data.items;
  const avgPpm = Math.round(items.reduce((a, c) => a + perMl(c), 0) / items.length);
  const avgRating = (items.reduce((a, c) => a + c.rating, 0) / items.length).toFixed(2);
  const totalReviews = items.reduce((a, c) => a + c.reviews, 0);

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Competitors" value={`${items.length}개`} sub="유사 컨셉 경쟁제품" kind="AI_ANALYSIS" />
        <MetricCard label="Avg. Price / ml" value={krw(avgPpm)} sub="경쟁제품 평균" kind="DEMO" />
        <MetricCard label="Avg. Rating" value={avgRating} sub="리뷰 평점 평균" kind="DEMO" />
        <MetricCard label="Total Reviews" value={totalReviews.toLocaleString()} sub="분석 대상 리뷰 수" kind="DEMO" />
      </div>

      <Section title="가격과 포지션으로 보면 어디가 비어 있나요?" subtitle="X축 판매가 · Y축 프리미엄/기능성 포지션 (AI 추정) · 원 크기 리뷰 수" action={<DemoBadge />}>
        <div className="h-[380px]">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid stroke={GRID} />
              <ReferenceArea x1={26000} x2={36000} y1={40} y2={82} fill="#eb6834" fillOpacity={0.05} stroke="#eb6834" strokeOpacity={0.25} strokeDasharray="4 4" label={{ value: '경쟁 밀집 구간', position: 'insideTopLeft', fill: '#b4532a', fontSize: 11 }} />
              <XAxis type="number" dataKey="price" name="가격" domain={[20000, 52000]} tickFormatter={(v: number) => `${v / 10000}만`} tick={{ fill: AXIS, fontSize: 11 }} label={{ value: 'Price (판매가)', position: 'insideBottom', offset: -14, fill: AXIS, fontSize: 11 }} />
              <YAxis type="number" dataKey="premiumScore" name="포지션" domain={[30, 100]} tick={{ fill: AXIS, fontSize: 11 }} width={44} label={{ value: 'Premium / Functionality', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11, dy: 70 }} />
              <ZAxis type="number" dataKey="reviews" range={[120, 900]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as (Competitor | typeof ours) | undefined;
                  if (!active || !d) return null;
                  return 'brand' in d ? (
                    <TipBox title={`${d.brand} ${d.product}`} rows={[{ label: '판매가', value: krw(d.price) }, { label: 'ml당', value: krw(perMl(d)) }, { label: 'Hero', value: d.hero }, { label: '리뷰', value: d.reviews.toLocaleString() }]} />
                  ) : (
                    <TipBox title={d.name} rows={[{ label: '목표 판매가', value: krw(d.price) }, { label: '상태', value: '기획 중' }]} />
                  );
                }}
              />
              <Scatter name="경쟁제품" data={items} fill={SERIES[0]} fillOpacity={0.75} stroke="#fff" strokeWidth={2} onClick={(d: { payload?: Competitor }) => d.payload && setSelected(d.payload.id)} />
              <Scatter name="우리 제품" data={[ours]} fill={SERIES[1]} stroke="#fff" strokeWidth={2} shape="diamond" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[0] }} /> 경쟁제품 (원 크기 = 리뷰 수)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45" style={{ background: SERIES[1] }} /> {ours.name} (목표 위치)
          </span>
        </div>
        <SourceNote source={DEMO_SOURCE} className="mt-4 border-t border-ink-50 pt-3" />
      </Section>

      <AiInsight insight={data.insight} />

      <Section title="경쟁제품 상세" subtitle="카드를 누르면 리뷰 키워드를 볼 수 있어요" action={<Segmented value={view} onChange={setView} options={[{ id: 'cards', label: '카드' }, { id: 'table', label: '표' }]} />}>
        {view === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((c) => (
              <CompetitorCard key={c.id} c={c} open={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  {['Brand', 'Product', 'Price', 'Size', 'Price/ml', 'Hero', 'Claims', 'Rating', 'Reviews', 'Channel'].map((h) => (
                    <th key={h} className="px-2 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50">
                    <td className="px-2 py-2 text-slate-600">{c.brand}</td>
                    <td className="px-2 py-2 font-medium text-ink-900">{c.product}</td>
                    <td className="px-2 py-2 tabular-nums">{krw(c.price)}</td>
                    <td className="px-2 py-2 tabular-nums">{c.sizeMl}ml</td>
                    <td className="px-2 py-2 tabular-nums">{krw(perMl(c))}</td>
                    <td className="px-2 py-2">{c.hero}</td>
                    <td className="px-2 py-2 text-slate-600">{c.claims.join(', ')}</td>
                    <td className="px-2 py-2 tabular-nums">{c.rating}</td>
                    <td className="px-2 py-2 tabular-nums">{c.reviews.toLocaleString()}</td>
                    <td className="px-2 py-2 text-slate-600">{c.channels.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageIntro no="03" title="Competitor Analysis" ko="경쟁제품 분석" question="비슷한 제품은 누가, 얼마에, 어떤 메시지로 팔고 있나요?" right={<DemoBadge />} />
      {children}
    </div>
  );
}

function CompetitorCard({ c, open, onClick }: { c: Competitor; open: boolean; onClick: () => void }) {
  return (
    <Card onClick={onClick} className={clsx('cursor-pointer p-4 transition hover:border-ink-300', open && 'border-ink-400 ring-2 ring-ink-100')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.brand}</div>
        <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700">{c.hero}</span>
      </div>
      <div className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-ink-900">{c.product}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-ink-900">{krw(c.price)}</span>
        <span className="text-xs text-slate-500">
          {c.sizeMl}ml · {krw(perMl(c))}/ml
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
        <Star size={12} className="fill-champagne-500 text-champagne-500" /> {c.rating} · 리뷰 {c.reviews.toLocaleString()}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {c.claims.map((x) => (
          <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {x}
          </span>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        {c.channels.join(' · ')} · {c.texture}
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-ink-50 pt-3 text-xs">
          <div>
            <span className="font-semibold text-emerald-700">긍정</span> <span className="text-slate-600">{c.positiveKeywords.join(', ')}</span>
          </div>
          <div>
            <span className="font-semibold text-rose-700">부정</span> <span className="text-slate-600">{c.negativeKeywords.join(', ')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            포지션 점수 {c.premiumScore} <KindBadge kind="AI_ESTIMATE" />
          </div>
        </div>
      )}
    </Card>
  );
}
