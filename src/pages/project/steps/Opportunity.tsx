import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CartesianGrid, LabelList, PolarAngleAxis, PolarGrid, Radar, RadarChart, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { AiPill, AnalyzingState, Card, DemoBadge, KindBadge, LevelBadge, PageIntro, Section, SourceNote } from '@/components/ui';
import { RULE_SOURCE } from '@/data/mock';
import { dataSource } from '@/data/source';
import type { GapPosition } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';

export default function Opportunity() {
  const { project: p } = useProject();
  const { data } = useAsync(() => dataSource.gap(), 'gap');

  return (
    <div className="space-y-10">
      <PageIntro no="06" title="Market Gap & Opportunity" ko="시장 기회 분석" question="어느 영역에 제품을 출시해야 경쟁은 피하고 수요는 잡을 수 있을까요?" right={<DemoBadge />} />
      {!data ? (
        <AnalyzingState />
      ) : (
        (() => {
          const rec = data.items.find((x) => x.recommended)!;
          const top = [...data.items].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 3);
          const radar = [
            { axis: 'Demand', ...Object.fromEntries(top.map((t) => [t.id, t.demand])) },
            { axis: 'Growth', ...Object.fromEntries(top.map((t) => [t.id, t.growth])) },
            { axis: 'Low Competition', ...Object.fromEntries(top.map((t) => [t.id, 100 - t.competition])) },
            { axis: 'Opportunity', ...Object.fromEntries(top.map((t) => [t.id, t.opportunityScore])) },
          ];
          return (
            <>
              <Card className="relative overflow-hidden border-ink-300 p-6">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-champagne-100" />
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <AiPill>AI RECOMMENDED POSITION</AiPill>
                    <div className="mt-3 text-2xl font-semibold text-ink-900">{rec.name}</div>
                    <p className="mt-1 max-w-2xl text-sm text-ink-600">{rec.why}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-600">
                      <span>Demand <LevelBadge level={rec.demandLevel} /></span>
                      <span>Competition <LevelBadge level={rec.competitionLevel} /></span>
                      <span>Opportunity <LevelBadge level={rec.opportunityLevel} /></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-semibold tabular-nums text-ink-900">{rec.opportunityScore}</div>
                    <div className="text-xs text-ink-500">
                      Opportunity Score <KindBadge kind="AI_ESTIMATE" className="ml-1" />
                    </div>
                    <Link to={`/projects/${p.id}/concept`} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800">
                      이 영역으로 컨셉 만들기 <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </Card>

              <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
                <Section title="수요와 경쟁으로 본 시장 지도" subtitle="오른쪽 위로 갈수록 수요는 높고 경쟁은 낮음 · 원 크기 = Opportunity Score" action={<DemoBadge />}>
                  <div className="h-[400px]">
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 4 }}>
                        <CartesianGrid stroke={GRID} />
                        <ReferenceArea x1={45} x2={100} y1={60} y2={100} fill="#4f7d5c" fillOpacity={0.07} stroke="#4f7d5c" strokeOpacity={0.35} strokeDasharray="4 4" label={{ value: 'AI 추천 출시 영역', position: 'insideTopRight', fill: '#0f7a55', fontSize: 11, fontWeight: 600 }} />
                        <ReferenceArea x1={0} x2={25} y1={60} y2={100} fill="#8a2f4c" fillOpacity={0.05} label={{ value: '레드오션', position: 'insideTopLeft', fill: '#b4532a', fontSize: 11 }} />
                        <XAxis type="number" dataKey="lowComp" domain={[0, 100]} tick={{ fill: AXIS, fontSize: 11 }} label={{ value: '← 경쟁 높음 · Competition · 경쟁 낮음 →', position: 'insideBottom', offset: -14, fill: AXIS, fontSize: 11 }} />
                        <YAxis type="number" dataKey="demand" domain={[30, 100]} tick={{ fill: AXIS, fontSize: 11 }} width={40} label={{ value: 'Demand', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 }} />
                        <ZAxis type="number" dataKey="opportunityScore" range={[200, 1200]} />
                        <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <GapTip g={payload[0].payload} /> : null)} />
                        <Scatter data={data.items.filter((g) => !g.recommended).map((g) => ({ ...g, lowComp: 100 - g.competition }))} fill={SERIES[0]} fillOpacity={0.65} stroke="#fff" strokeWidth={2}>
                          <LabelList dataKey="name" position="bottom" offset={14} style={{ fill: '#292524', fontSize: 11 }} />
                        </Scatter>
                        <Scatter data={[{ ...rec, lowComp: 100 - rec.competition }]} fill={SERIES[1]} stroke="#fff" strokeWidth={2}>
                          <LabelList dataKey="name" position="bottom" offset={16} style={{ fill: '#292524', fontSize: 12, fontWeight: 700 }} />
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <SourceNote source={RULE_SOURCE} className="mt-3 border-t border-ink-50 pt-3" />
                </Section>

                <Section title="상위 3개 기회 비교" subtitle="Opportunity Score 상위 영역" action={<KindBadge kind="AI_ESTIMATE" />}>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <RadarChart data={radar} outerRadius="72%">
                        <PolarGrid stroke={GRID} />
                        <PolarAngleAxis dataKey="axis" tick={{ fill: AXIS, fontSize: 11 }} />
                        {top.map((t, i) => (
                          <Radar key={t.id} dataKey={t.id} name={t.name} stroke={SERIES[i]} fill={SERIES[i]} fillOpacity={0.12} strokeWidth={2} />
                        ))}
                        <Tooltip content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={String(label)} rows={payload.map((x) => ({ label: String(x.name), value: String(x.value), color: String(x.color) }))} /> : null)} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 text-xs">
                    {top.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} />
                        <span className="text-ink-900">{t.name}</span>
                        <span className="ml-auto font-semibold tabular-nums">{t.opportunityScore}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
                    계산식 공개: {data.formula}. 가중치는 데모용 가정이며 실제 데이터로 검증이 필요합니다.
                  </p>
                </Section>
              </div>

              <AiInsight insight={data.insight} />

              <Section title="포지션별 상세" subtitle="수요·경쟁·성장과 기회 판단">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[...data.items]
                    .sort((a, b) => b.opportunityScore - a.opportunityScore)
                    .map((g) => (
                      <div key={g.id} className={clsx('rounded-xl border p-4', g.recommended ? 'border-ink-400 bg-ink-50/60' : 'border-ink-100')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-ink-900">{g.name}</div>
                          {g.recommended && <Sparkles size={15} className="text-champagne-500" />}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-ink-500">
                          <div>
                            Demand
                            <LevelBadge level={g.demandLevel} className="mt-1 block w-fit" />
                          </div>
                          <div>
                            Competition
                            <LevelBadge level={g.competitionLevel} className="mt-1 block w-fit" />
                          </div>
                          <div>
                            Opportunity
                            <LevelBadge level={g.opportunityLevel} className="mt-1 block w-fit" />
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-ink-600">{g.why}</p>
                        <div className="mt-2 text-xs text-ink-500">
                          Score <b className="tabular-nums text-ink-900">{g.opportunityScore}</b> · 성장 {g.growth}
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
            </>
          );
        })()
      )}
    </div>
  );
}

function GapTip({ g }: { g: GapPosition }) {
  return (
    <TipBox
      title={g.name}
      rows={[
        { label: 'Demand', value: g.demand },
        { label: 'Competition', value: g.competition },
        { label: 'Growth', value: g.growth },
        { label: 'Opportunity Score', value: g.opportunityScore },
      ]}
    />
  );
}
