import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Droplets } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { AiPill, AnalyzingState, Button, Card, KindBadge, PageIntro, ScoreBar, Section } from '@/components/ui';
import { dataSource } from '@/data/source';
import type { FormulaOption } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { effectiveConcept, krw } from '@/lib/engine';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';
import { PreviewBanner } from './PreviewBanner';

const AXES: { key: string; label: string; get: (f: FormulaOption) => number }[] = [
  { key: 'absorption', label: 'Absorption 흡수', get: (f) => f.absorption },
  { key: 'moisture', label: 'Moisture 보습', get: (f) => f.moisture },
  { key: 'nonSticky', label: 'Non-sticky 산뜻함', get: (f) => 100 - f.stickiness },
  { key: 'finish', label: 'Finish 광택', get: (f) => f.finish },
  { key: 'ease', label: 'Ease 개발 용이성', get: (f) => 100 - f.difficulty },
];

export default function Formula() {
  const { project: p, update, touch } = useProject();
  const navigate = useNavigate();
  const concept = effectiveConcept(p);
  const { data } = useAsync(() => dataSource.formulas(), 'formulas');

  const choose = (f: FormulaOption) => {
    update((x) => ({ ...x, formulaId: f.id, changed: x.formulaId === f.id ? x.changed : touch('formula') }));
    navigate(`/projects/${p.id}/ingredients`);
  };

  return (
    <div className="space-y-6">
      <PageIntro no="08" title="Formula" ko="제형 추천" question={`${concept.name}에는 어떤 제형이 가장 잘 맞을까요?`} right={<KindBadge kind="AI_ANALYSIS" />} />
      {!p.conceptId && <PreviewBanner projectId={p.id} step="concept" what="제품 컨셉" />}
      {!data ? (
        <AnalyzingState />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            {data.items.map((f, i) => {
              const rec = data.recommended[concept.id] === f.id;
              const selected = p.formulaId === f.id;
              return (
                <Card key={f.id} className={clsx('flex flex-col p-6', rec && 'border-ink-400 ring-2 ring-ink-200', selected && 'ring-2 ring-champagne-500')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-[0.18em]" style={{ color: SERIES[i] }}>
                      OPTION {String.fromCharCode(65 + i)}
                    </span>
                    {rec && <AiPill />}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-50 text-ink-700">
                      <Droplets size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-ink-900">{f.name}</div>
                      <div className="text-xs text-slate-500">{f.nameKo}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.description}</p>
                  <div className="mt-4 space-y-2.5">
                    <ScoreBar label="Absorption · 흡수 속도" value={f.absorption} />
                    <ScoreBar label="Moisture · 보습감" value={f.moisture} />
                    <ScoreBar label="Stickiness · 끈적임 (낮을수록 좋음)" value={f.stickiness} tone="champagne" />
                    <ScoreBar label="Finish · 광택" value={f.finish} />
                    <ScoreBar label="Residue · 잔여감 (낮을수록 좋음)" value={f.residue} tone="champagne" />
                    <ScoreBar label="Development Difficulty · 제조 난이도" value={f.difficulty} tone="champagne" />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-50 pt-4 text-sm">
                    <div>
                      <dt className="text-[11px] text-slate-500">Estimated Cost (30ml 내용물)</dt>
                      <dd className="font-semibold text-ink-900">{krw(f.costPerUnit)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Trend Score</dt>
                      <dd className="font-semibold text-ink-900">{f.trendScore}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[11px] text-slate-500">예상 점도</dt>
                      <dd className="text-ink-900">{f.viscosity}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[11px] text-slate-500">추천 피부타입</dt>
                      <dd className="text-ink-900">{f.skinTypes}</dd>
                    </div>
                  </dl>
                  <div className="mt-2">
                    <KindBadge kind="AI_ESTIMATE" />
                  </div>
                  <Button variant={rec ? 'primary' : 'secondary'} className="mt-5 w-full" onClick={() => choose(f)}>
                    {selected ? (
                      <>
                        <Check size={15} /> 선택됨 · 원료 단계로
                      </>
                    ) : (
                      '이 제형 선택'
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Section title="사용감 비교" subtitle="바깥쪽일수록 좋음 (끈적임·난이도는 뒤집어 표시)" action={<KindBadge kind="AI_ESTIMATE" />}>
              <div className="h-72">
                <ResponsiveContainer>
                  <RadarChart outerRadius="72%" data={AXES.map((a) => ({ axis: a.label, ...Object.fromEntries(data.items.map((f) => [f.id, a.get(f)])) }))}>
                    <PolarGrid stroke={GRID} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: AXIS, fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    {data.items.map((f, i) => (
                      <Radar key={f.id} dataKey={f.id} name={f.name} stroke={SERIES[i]} fill={SERIES[i]} fillOpacity={0.1} strokeWidth={2} />
                    ))}
                    <Tooltip content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={String(label)} rows={payload.map((x) => ({ label: String(x.name), value: String(x.value), color: String(x.color) }))} /> : null)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                {data.items.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} /> {f.name}
                  </span>
                ))}
              </div>
            </Section>
            <AiInsight
              insight={
                concept.id === 'B'
                  ? {
                      finding: '밀키 에센스는 끈적임(22)과 잔여감(28)이 가장 낮으면서 보습(78)을 유지합니다.',
                      why: '소비자 불만 1위가 "끈적임"이고, 레티날은 지용성이라 유화 제형에 안정적으로 담기 좋습니다.',
                      opportunity: '"아침에도 쓰는 가벼운 레티날"이라는 소비자 트렌드와 직접 연결됩니다.',
                      risk: '유화 안정성과 레티날 산화를 막기 위해 안정도 시험과 차광·에어리스 용기가 필요합니다.',
                      recommendation: 'Milky Essence Serum을 1순위로, 여름 한정 라인은 Gel Network를 검토하세요.',
                    }
                  : concept.id === 'A'
                    ? {
                        finding: '젤 네트워크 앰플은 흡수(88)가 가장 빠르고 제조 난이도(35)가 가장 낮습니다.',
                        why: 'Market Safe 컨셉은 빠른 출시와 원가 안정이 가장 중요합니다.',
                        opportunity: '지성·복합성 30대의 "가벼운 탄력 앰플" 수요에 바로 대응할 수 있습니다.',
                        risk: '보습감이 상대적으로 낮아 건성 피부 리뷰에서 불만이 나올 수 있습니다.',
                        recommendation: 'Gel Network Ampoule을 기본으로, 보습 보조 성분을 강화하세요.',
                      }
                    : {
                        finding: '캡슐 세럼은 광택(80)과 시각적 차별화가 가장 크지만 난이도(82)가 높습니다.',
                        why: 'Trend Leader 컨셉은 "새로움"을 눈으로 보여주는 것이 중요합니다.',
                        opportunity: 'NAD+ 같은 신흥 성분을 캡슐로 보여주면 SNS 콘텐츠로 확산되기 쉽습니다.',
                        risk: '캡슐 제조가 가능한 제조사가 제한적이고 원가가 높습니다.',
                        recommendation: 'Capsule Serum을 추천하되, 제조사 가능 여부를 먼저 확인하세요.',
                      }
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
