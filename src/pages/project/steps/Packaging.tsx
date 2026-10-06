import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, CircleAlert, CircleCheck, Package } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiInsight } from '@/components/AiInsight';
import { TipBox } from '@/components/charts';
import { AiPill, AnalyzingState, Button, Card, DemoBadge, KindBadge, PageIntro, ScoreBar, Section } from '@/components/ui';
import { dataSource } from '@/data/source';
import type { ConceptOption, FormulaOption, PackageOption, PackageId } from '@/data/types';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { effectiveConcept, formulaOf, krw } from '@/lib/engine';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';
import { PreviewBanner } from './PreviewBanner';

function recommend(c: ConceptOption): PackageId {
  return c.actives.includes('Retinal') || c.hero === 'NAD+' ? 'airless' : 'dropper';
}

/** Compatibility drops for open containers only when the formula has oxidation / light sensitive actives. */
function compat(x: PackageOption, c: ConceptOption) {
  const sensitive = c.actives.includes('Retinal') || c.hero === 'NAD+';
  return sensitive || x.airless ? x.compatibility : Math.min(95, x.compatibility + 22);
}

function technicalNotes(c: ConceptOption, f: FormulaOption | undefined): { ok: boolean; text: string }[] {
  const notes: { ok: boolean; text: string }[] = [];
  if (c.actives.includes('Retinal')) {
    notes.push({ ok: false, text: 'Retinal 사용 → 빛에 약함: 불투명 또는 차광 용기 필요' });
    notes.push({ ok: false, text: 'Retinal은 산화에 민감 → 공기 유입을 막는 Airless Pump 추천' });
  }
  if (c.hero === 'NAD+') notes.push({ ok: false, text: 'NAD+ 안정성 데이터 확인 전 → 공기·빛 차단 구조 우선' });
  if (c.hero === 'PDRN') notes.push({ ok: true, text: 'PDRN은 수용성 원료로 일반 용기와 호환성 문제는 크지 않음 (용기 적합성 시험으로 확인)' });
  if (f?.id === 'capsule') notes.push({ ok: false, text: '캡슐 제형 → 캡슐이 깨지지 않는 넓은 토출구 펌프 구조 검토 필요' });
  if (f?.id === 'gel') notes.push({ ok: false, text: '중점도 젤 → 펌프 토출량·토출 압력 확인 필요' });
  if (f?.id === 'milky') notes.push({ ok: true, text: '중저점도 밀키 제형 → 에어리스·펌프 모두 토출에 무리 없음' });
  notes.push({ ok: true, text: '30ml 앰플 용량은 에어리스·스포이드 모두 표준 규격 사용 가능' });
  return notes;
}

export default function Packaging() {
  const { project: p, update, touch } = useProject();
  const navigate = useNavigate();
  const concept = effectiveConcept(p);
  const formula = formulaOf(p);
  const { data } = useAsync(() => dataSource.packages(), 'packages');
  const recId = recommend(concept);
  const notes = technicalNotes(concept, formula);

  const choose = (x: PackageOption) => {
    update((pr) => ({ ...pr, packageId: x.id, changed: pr.packageId === x.id ? pr.changed : touch('package') }));
    navigate(`/projects/${p.id}/cost`);
  };

  return (
    <div className="space-y-6">
      <PageIntro no="10" title="Packaging" ko="패키지 추천" question="내용물을 지키면서 브랜드에도 맞는 용기는 무엇일까요?" right={<KindBadge kind="AI_ANALYSIS" />} />
      {!p.conceptId && <PreviewBanner projectId={p.id} step="concept" what="제품 컨셉" />}
      {p.conceptId && !p.formulaId && <PreviewBanner projectId={p.id} step="formula" what="제형" />}
      {!data ? (
        <AnalyzingState />
      ) : (
        <>
          <Section title="내용물과 용기의 기술적 적합성" subtitle={`${concept.name}${formula ? ` · ${formula.name}` : ''} 기준`}>
            <ul className="grid gap-2 md:grid-cols-2">
              {notes.map((n) => (
                <li key={n.text} className={clsx('flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm', n.ok ? 'bg-emerald-50/60 text-emerald-900' : 'bg-amber-50/70 text-amber-900')}>
                  {n.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0" /> : <CircleAlert size={16} className="mt-0.5 shrink-0" />}
                  {n.text}
                </li>
              ))}
            </ul>
          </Section>

          <div className="grid gap-5 xl:grid-cols-3">
            {data.map((x, i) => {
              const rec = x.id === recId;
              const selected = p.packageId === x.id;
              return (
                <Card key={x.id} className={clsx('flex flex-col p-6', rec && 'border-ink-400 ring-2 ring-ink-200', selected && 'ring-2 ring-champagne-500')}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-[0.18em]" style={{ color: SERIES[i] }}>
                      OPTION {String.fromCharCode(65 + i)}
                    </span>
                    {rec && <AiPill>AI RECOMMENDED PACKAGE</AiPill>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-50 text-ink-700">
                      <Package size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-ink-900">{x.name}</div>
                      <div className="text-xs text-slate-500">
                        {x.nameKo} · {x.material}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{x.description}</p>
                  <div className="mt-4 space-y-2.5">
                    <ScoreBar label="Compatibility · 내용물 호환성" value={compat(x, concept)} />
                    <ScoreBar label="Protection · 보호 성능" value={x.protection} />
                    <ScoreBar label="Premium Feel · 고급감" value={x.premiumFeel} />
                    <ScoreBar label="Sustainability · 친환경성" value={x.sustainability} tone="muted" />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-50 pt-4 text-sm">
                    <div>
                      <dt className="text-[11px] text-slate-500">예상 단가 (용기+펌프)</dt>
                      <dd className="font-semibold text-ink-900">{krw(x.unitCost + x.pumpCost)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">MOQ</dt>
                      <dd className="font-semibold text-ink-900">{x.moq.toLocaleString()}개</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">차광</dt>
                      <dd className="text-ink-900">{x.lightBlocking ? '가능' : '불가'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Airless</dt>
                      <dd className="text-ink-900">{x.airless ? '예' : '아니오'}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex gap-1.5">
                    <DemoBadge />
                    <KindBadge kind="AI_ESTIMATE" />
                  </div>
                  <Button variant={rec ? 'primary' : 'secondary'} className="mt-5 w-full" onClick={() => choose(x)}>
                    {selected ? (
                      <>
                        <Check size={15} /> 선택됨 · 원가 단계로
                      </>
                    ) : (
                      '이 패키지 선택'
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Section title="패키지 비교" subtitle="점수가 높을수록 좋음" action={<KindBadge kind="AI_ESTIMATE" />}>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      { m: 'Compatibility', ...Object.fromEntries(data.map((x) => [x.id, compat(x, concept)])) },
                      { m: 'Protection', ...Object.fromEntries(data.map((x) => [x.id, x.protection])) },
                      { m: 'Premium', ...Object.fromEntries(data.map((x) => [x.id, x.premiumFeel])) },
                      { m: 'Sustainability', ...Object.fromEntries(data.map((x) => [x.id, x.sustainability])) },
                    ]}
                    barGap={2}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                    <Tooltip cursor={{ fill: '#f7f5fa' }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={String(label)} rows={payload.map((x) => ({ label: data.find((d) => d.id === x.dataKey)?.name ?? '', value: String(x.value), color: String(x.color) }))} /> : null)} />
                    {data.map((x, i) => (
                      <Bar key={x.id} dataKey={x.id} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                {data.map((x, i) => (
                  <span key={x.id} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} /> {x.name}
                  </span>
                ))}
              </div>
            </Section>
            <AiInsight
              insight={{
                finding: recId === 'airless' ? 'Airless Pump가 보호 성능(95)과 호환성(92)이 가장 높습니다.' : 'Dropper가 고급감(88)이 가장 높고 PDRN 앰플과 호환성 문제가 작습니다.',
                why: recId === 'airless' ? '레티날 같은 산화·광 민감 성분은 용기에 따라 사용기한과 효능 유지가 달라집니다.' : '앰플 카테고리에서 스포이드는 "고농축" 이미지를 전달합니다.',
                opportunity: recId === 'airless' ? '"마지막 한 방울까지 신선하게" 같은 메시지로 효능 신뢰도를 높일 수 있습니다.' : '경쟁제품과 같은 용기 문법으로 카테고리 인지도를 빠르게 얻을 수 있습니다.',
                risk: recId === 'airless' ? '에어리스는 MOQ가 10,000개로 높아 초도 물량이 적으면 단가가 크게 오릅니다.' : '사용 중 공기 접촉이 있어 산화 민감 성분을 추가하면 재검토가 필요합니다.',
                recommendation: recId === 'airless' ? 'Airless Pump를 기본으로, 초도 물량이 5,000개 이하라면 기성품 에어리스 용기를 제조사에 문의하세요.' : 'Dropper를 기본으로 하되 차광 유리와 용기 적합성 시험을 함께 진행하세요.',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
