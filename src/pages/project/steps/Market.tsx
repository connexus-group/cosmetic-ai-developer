import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { AnalyzingState, Card, DemoBadge, KindBadge, LevelBadge, MetricCard, PageIntro, ScoreBar, Section, SourceNote } from '@/components/ui';
import { dataSource } from '@/data/source';
import { ACCENT, AXIS, CHAMPAGNE, GRID, MUTED } from '@/lib/colors';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';

export default function Market() {
  const { project: p } = useProject();
  const { data } = useAsync(() => dataSource.market(), 'market');
  const targetChannels = p.intake.channel.value.split(/\s*\/\s*/);

  return (
    <div className="space-y-6">
      <PageIntro no="02" title="Market Analysis" ko="시장 분석" question="이 카테고리 시장은 얼마나 크고, 계속 성장하고 있나요?" right={<DemoBadge />} />
      {!data ? (
        <AnalyzingState />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="bg-gradient-to-br from-ink-900 to-ink-700 p-6 text-white sm:p-8">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold tracking-[0.25em] text-champagne-300">MARKET ATTRACTIVENESS</div>
                  <DemoBadge />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-6xl font-semibold tabular-nums leading-none">{data.attractiveness.score}</span>
                  <span className="pb-1 text-lg text-ink-200">/ 100</span>
                </div>
                <div className="mt-3 inline-block rounded-full bg-champagne-300 px-3 py-1 text-xs font-bold tracking-wider text-ink-900">{data.attractiveness.label}</div>
                <p className="mt-4 text-xs leading-relaxed text-ink-200">{data.title} · 규모, 성장성, 타깃 적합도, 경쟁 강도를 종합한 AI 추정 점수입니다.</p>
              </div>
              <div className="space-y-3 p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">점수 구성</span>
                  <KindBadge kind="AI_ESTIMATE" />
                </div>
                {data.attractiveness.factors.map((f) => (
                  <ScoreBar key={f.label} label={f.label} value={f.score} />
                ))}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {data.kpis.map((k) => (
              <MetricCard key={k.id} label={k.label} value={k.level ? <LevelBadge level={k.level} className="!text-sm" /> : k.value} sub={k.sub} kind={k.id === 'competition' || k.id === 'opportunity' ? 'AI_ANALYSIS' : 'AI_ESTIMATE'} extra={<DemoBadge className="mt-2" />} />
            ))}
          </div>

          <Section
            title={`${data.title} 규모는 어떻게 변해 왔나요?`}
            subtitle={`단위: ${data.unit} · 2026E는 예상값 (점선)`}
            action={<DemoBadge />}
          >
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart
                  data={data.series.map((d, i, arr) => ({
                    ...d,
                    actual: d.estimate ? null : d.value,
                    // the dashed estimate segment starts at the last actual year
                    est: d.estimate || (arr[i + 1]?.estimate ?? false) ? d.value : null,
                  }))}
                  margin={{ top: 28, right: 24, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} padding={{ left: 16, right: 16 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v: number) => v.toLocaleString()} width={52} domain={[0, 'auto']} />
                  <Tooltip
                    cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <TipBox
                          title={String(payload[0].payload.year)}
                          rows={[{ label: payload[0].payload.estimate ? '시장 규모 (AI 추정)' : '시장 규모 (DEMO)', value: `${Number(payload[0].payload.value).toLocaleString()}억원` }]}
                        />
                      ) : null
                    }
                  />
                  <Line dataKey="actual" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 5, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls={false} isAnimationActive={false}>
                    <LabelList dataKey="actual" position="top" offset={12} formatter={(v) => (v == null ? '' : Number(v).toLocaleString())} style={{ fill: '#261b36', fontSize: 11, fontWeight: 600 }} />
                  </Line>
                  <Line dataKey="est" stroke={CHAMPAGNE} strokeWidth={2.5} strokeDasharray="6 5" dot={(props: { cx?: number; cy?: number; index?: number }) => (props.index === data.series.length - 1 ? <circle key="e" cx={props.cx} cy={props.cy} r={5} fill={CHAMPAGNE} stroke="#fff" strokeWidth={2} /> : <g key={`n${props.index}`} />)} isAnimationActive={false}>
                    <LabelList dataKey="est" content={(props) => {
                      const { x, y, index } = props as { x?: number; y?: number; index?: number };
                      if (index !== data.series.length - 1 || x == null || y == null) return null;
                      return <text x={x} y={Number(y) - 12} textAnchor="middle" fill="#261b36" fontSize={11} fontWeight={600}>{data.series[index].value.toLocaleString()}</text>;
                    }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: ACCENT }} /> 연간 시장 규모 (DEMO)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: CHAMPAGNE }} /> 2026E 예상값 (AI 추정)
              </span>
            </div>
            <SourceNote source={data.source} className="mt-4 border-t border-ink-50 pt-3" />
          </Section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="어디서 팔리나요?" subtitle="판매채널 비중 · 선택한 채널 강조" action={<DemoBadge />}>
              <div className="relative h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.channels} dataKey="share" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                      {data.channels.map((c) => (
                        <Cell key={c.name} fill={targetChannels.includes(c.name) ? ACCENT : MUTED} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <TipBox rows={[{ label: String(payload[0].name), value: `${payload[0].value}%` }]} /> : null)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <div className="text-xl font-semibold text-ink-900">{data.channels.filter((c) => targetChannels.includes(c.name)).reduce((a, c) => a + c.share, 0)}%</div>
                    <div className="text-[10px] text-slate-500">선택 채널 비중</div>
                  </div>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {data.channels.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: targetChannels.includes(c.name) ? ACCENT : MUTED }} />
                    <span className={targetChannels.includes(c.name) ? 'font-semibold text-ink-900' : 'text-slate-600'}>{c.name}</span>
                    <span className="ml-auto tabular-nums text-slate-600">{c.share}%</span>
                  </li>
                ))}
              </ul>
            </Section>
            <BandChart title="어느 가격대가 가장 클까요?" subtitle="가격대별 제품 분포" data={data.priceBands.map((b) => ({ name: b.band, value: b.share, hi: /3~4만원/.test(b.band) }))} />
            <BandChart title="누가 가장 많이 살까요?" subtitle="연령대별 구매 비중" data={data.ageGroups.map((g) => ({ name: g.group, value: g.share, hi: p.intake.target.value.startsWith(g.group.replace('대', '').replace('+', '')) }))} />
          </div>

          <AiInsight insight={data.insight} />
        </>
      )}
    </div>
  );
}

function BandChart({ title, subtitle, data }: { title: string; subtitle: string; data: { name: string; value: number; hi: boolean }[] }) {
  return (
    <Section title={title} subtitle={`${subtitle} · 목표 구간 강조`} action={<DemoBadge />}>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 36, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={64} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip cursor={{ fill: '#f7f5fa' }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox rows={[{ label: String(payload[0].payload.name), value: `${payload[0].value}%` }]} /> : null)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.hi ? ACCENT : MUTED} />
              ))}
              <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} style={{ fill: '#261b36', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
