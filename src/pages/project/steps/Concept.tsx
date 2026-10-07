import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, FlaskConical } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { AiPill, AnalyzingState, Button, Card, DemoBadge, KindBadge, LevelBadge, PageIntro, ScoreBar, Section } from '@/components/ui';
import { dataSource } from '@/data/source';
import type { ConceptOption } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { krw } from '@/lib/engine';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';

const SCORE_LABELS: [keyof ConceptOption['scores'], string, string][] = [
  ['marketability', 'Marketability', '시장성'],
  ['differentiation', 'Differentiation', '차별성'],
  ['trend', 'Trend', '트렌드'],
  ['costEfficiency', 'Cost Efficiency', '원가 효율'],
  ['difficulty', 'Development Difficulty', '개발 난이도'],
];

export default function Concept() {
  const { project: p, update, touch } = useProject();
  const navigate = useNavigate();
  const { data } = useAsync(() => dataSource.concepts(), 'concepts');

  const choose = (c: ConceptOption) => {
    update((x) => ({
      ...x,
      conceptId: c.id,
      name: c.name,
      retailPrice: c.retailPrice,
      changed: x.conceptId === c.id ? x.changed : touch('concept'),
      checklist: { ...x.checklist, concept: true },
    }));
    navigate(`/projects/${p.id}/formula`);
  };

  return (
    <div className="space-y-6">
      <PageIntro no="07" title="AI Product Concept" ko="AI 제품 컨셉 3안" question="시장조사 결과를 바탕으로, 어떤 제품을 만들면 좋을까요?" right={<KindBadge kind="AI_ANALYSIS" />} />
      {!data ? (
        <AnalyzingState label="AI가 시장조사 결과로 제품 컨셉을 설계하고 있어요" />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            {data.map((c, i) => (
              <ConceptCard key={c.id} c={c} color={SERIES[i]} selected={p.conceptId === c.id} onChoose={() => choose(c)} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Section title="세 가지 안을 한눈에 비교" subtitle="개발 난이도는 낮을수록 좋음 (차트에서는 '개발 용이성'으로 뒤집어 표시)" action={<KindBadge kind="AI_ESTIMATE" />}>
              <div className="h-72">
                <ResponsiveContainer>
                  <RadarChart
                    outerRadius="72%"
                    data={SCORE_LABELS.map(([k, en, ko]) => ({ axis: k === 'difficulty' ? '개발 용이성' : ko, en, ...Object.fromEntries(data.map((c) => [c.id, k === 'difficulty' ? 100 - c.scores[k] : c.scores[k]])) }))}
                  >
                    <PolarGrid stroke={GRID} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: AXIS, fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    {data.map((c, i) => (
                      <Radar key={c.id} dataKey={c.id} name={`${c.id}. ${c.type}`} stroke={SERIES[i]} fill={SERIES[i]} fillOpacity={0.1} strokeWidth={2} />
                    ))}
                    <Tooltip content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={String(label)} rows={payload.map((x) => ({ label: String(x.name), value: String(x.value), color: String(x.color) }))} /> : null)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {data.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} /> {c.id}. {c.type}
                  </span>
                ))}
              </div>
            </Section>
            <AiInsight
              insight={{
                finding: 'B안(PDRN + Retinal)은 다섯 지표가 가장 고르게 높고, A안은 시장성·원가, C안은 트렌드·차별성에 치우쳐 있습니다.',
                why: '신규 브랜드는 첫 제품에서 "팔릴 수 있는가"와 "왜 우리 제품인가"를 동시에 증명해야 합니다.',
                opportunity: 'B안은 경쟁 중간 영역에서 소비자 불만(자극·끈적임)을 직접 해결해 리뷰로 차별성이 드러나기 쉽습니다.',
                risk: 'B안은 레티날 안정화와 저자극 시험이 필요해 A안보다 개발 난이도와 기간이 늘어납니다.',
                recommendation: '첫 출시는 B안으로 진행하고, A안은 가격을 낮춘 라인 확장, C안은 트렌드가 커지는 시점의 차기작으로 검토하세요.',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ConceptCard({ c, color, selected, onChoose }: { c: ConceptOption; color: string; selected: boolean; onChoose: () => void }) {
  return (
    <Card className={clsx('flex flex-col overflow-hidden', c.recommended && 'border-ink-400 ring-2 ring-ink-200', selected && 'ring-2 ring-champagne-500')}>
      <div className="relative bg-gradient-to-br from-ink-50 to-white px-6 pb-5 pt-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.18em]" style={{ color }}>
            OPTION {c.id} · {c.type}
          </span>
          {c.recommended && <AiPill />}
        </div>
        <div className="mt-3 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink-900 text-champagne-300">
            <FlaskConical size={22} />
          </div>
          <div>
            <div className="text-lg font-semibold leading-snug text-ink-900">{c.name}</div>
            <div className="text-xs text-slate-500">{c.nameKo}</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{c.oneLiner}</p>
      </div>
      <div className="space-y-2.5 border-t border-ink-50 px-6 py-5">
        {SCORE_LABELS.map(([k, en, ko]) => (
          <ScoreBar key={k} label={`${en} · ${ko}`} value={c.scores[k]} tone={k === 'difficulty' ? 'champagne' : 'ink'} />
        ))}
        <div className="pt-1 text-right">
          <KindBadge kind="AI_ESTIMATE" />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-50 px-6 py-5 text-sm">
        <Item label="Estimated Cost" value={`${krw(c.estimatedCost)}`} badge />
        <Item label="Recommended Price" value={`${krw(c.retailPrice)} / ${c.sizeMl}ml`} badge />
        <Item label="Hero Ingredient" value={c.hero} />
        <Item label="Active Ingredients" value={c.actives.join(' · ')} />
        <Item label="Texture" value={c.texture} />
        <Item label="Competition" value={<LevelBadge level={c.competition} />} />
        <Item label="Target Consumer" value={c.target} wide />
        <Item label="Key Claims" value={c.claims.join(' / ')} wide />
        <Item label="Differentiation" value={c.differentiation} wide />
      </dl>
      <div className="mt-auto border-t border-ink-50 bg-ink-50/40 px-6 py-4">
        <p className="mb-3 text-xs text-slate-600">{c.reason}</p>
        <Button variant={c.recommended ? 'primary' : 'secondary'} className="w-full" onClick={onChoose}>
          {selected ? (
            <>
              <Check size={15} /> 선택됨 · 제형 단계로
            </>
          ) : (
            '이 제품으로 개발'
          )}
        </Button>
      </div>
    </Card>
  );
}

function Item({ label, value, wide, badge }: { label: string; value: React.ReactNode; wide?: boolean; badge?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label} {badge && <DemoBadge className="!px-1.5 !py-0 !text-[9px]" />}
      </dt>
      <dd className="mt-0.5 font-medium text-ink-900">{value}</dd>
    </div>
  );
}
