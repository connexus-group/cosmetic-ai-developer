import { useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { AiInsight } from '@/components/AiInsight';
import { AnalyzingState, Card, DemoBadge, KindBadge, LevelBadge, PageIntro, Unverified } from '@/components/ui';
import { dataSource } from '@/data/source';
import type { IngredientInfo, IngredientTier } from '@/data/types';
import { effectiveConcept, formulaOf } from '@/lib/engine';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';
import { PreviewBanner } from './PreviewBanner';
import { StageBadge } from './Trend';

const TIERS: { id: IngredientTier; label: string; desc: string; cls: string }[] = [
  { id: 'HERO', label: 'HERO INGREDIENT', desc: '제품의 얼굴. 마케팅 메시지의 중심', cls: 'from-ink-900 to-ink-700 text-white' },
  { id: 'ACTIVE', label: 'ACTIVE INGREDIENT', desc: '핵심 효능을 만드는 성분', cls: 'from-ink-600 to-ink-500 text-white' },
  { id: 'SUPPORTING', label: 'SUPPORTING INGREDIENT', desc: '자극 완화·보습 등 보조', cls: 'from-champagne-300 to-champagne-100 text-ink-900' },
  { id: 'BASE', label: 'BASE INGREDIENT', desc: '제형의 바탕이 되는 성분', cls: 'from-slate-100 to-white text-ink-900' },
];

export default function Ingredients() {
  const { project: p } = useProject();
  const concept = effectiveConcept(p);
  const formula = formulaOf(p);
  const { data } = useAsync(() => dataSource.ingredients(concept.id), `ingredients-${concept.id}`);
  const [open, setOpen] = useState<string | null>(null);
  const sel = data?.find((x) => x.id === open);

  return (
    <div className="space-y-6">
      <PageIntro no="09" title="Ingredient Strategy" ko="원료 추천" question="어떤 원료를 어떤 역할로 조합해야 할까요?" right={<KindBadge kind="AI_ANALYSIS" />} />
      {!p.conceptId && <PreviewBanner projectId={p.id} step="concept" what="제품 컨셉" />}
      <div className="rounded-xl bg-ink-50/70 px-4 py-3 text-xs text-ink-800">
        기준: <b>{concept.name}</b>
        {formula && (
          <>
            {' '}· 제형 <b>{formula.name}</b>
          </>
        )}
        <span className="ml-2 text-slate-500">원료사·특허·임상·가격·MOQ는 확인된 데이터가 없어 임의로 만들지 않고 "확인 필요"로 표시합니다.</span>
      </div>
      {!data ? (
        <AnalyzingState />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {TIERS.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className={clsx('flex items-center justify-between bg-gradient-to-r px-5 py-3', t.cls)}>
                  <div className="text-xs font-bold tracking-[0.18em]">{t.label}</div>
                  <div className="text-[11px] opacity-80">{t.desc}</div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data
                    .filter((x) => x.tier === t.id)
                    .map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setOpen(x.id)}
                        className={clsx('rounded-xl border p-3 text-left transition hover:border-ink-300', open === x.id ? 'border-ink-500 bg-ink-50 ring-2 ring-ink-100' : 'border-ink-100')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink-900">{x.name}</span>
                          {x.trend && <StageBadge stage={x.trend} />}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">INCI: {x.inci ?? '확인 필요'}</div>
                        <div className="mt-2 line-clamp-2 text-xs text-slate-600">{x.role}</div>
                      </button>
                    ))}
                </div>
              </Card>
            ))}
            <AiInsight
              insight={{
                finding: `${concept.hero}을(를) 히어로로, ${concept.actives.join('·')}을(를) 액티브로 두는 조합입니다.`,
                why: '소비자에게 익숙한 히어로 성분은 신뢰를, 액티브 성분은 실제 효능 메시지를 만듭니다.',
                opportunity: concept.actives.includes('Retinal') ? 'Ectoin·Panthenol로 레티날 자극을 보완하면 "순한 레티날" 메시지를 만들 수 있습니다.' : '서포팅 성분으로 보습과 장벽 메시지를 함께 가져갈 수 있습니다.',
                risk: '원료 등급·함량·가격은 원료사마다 달라 아직 확정할 수 없습니다. 모든 함량은 제조사 처방 검토가 필요합니다.',
                recommendation: '제조사에 히어로·액티브 원료의 규격서와 단가를 먼저 요청하고, 기능성 고시 성분은 고시 함량을 기준으로 처방을 받으세요.',
              }}
            />
          </div>
          <div className="hidden xl:block">
            <div className="sticky top-20">{sel ? <Detail x={sel} onClose={() => setOpen(null)} /> : <Card className="p-8 text-center text-sm text-slate-500">원료 카드를 누르면 상세 정보가 여기에 열립니다.</Card>}</div>
          </div>
          {sel && (
            <div className="fixed inset-0 z-40 flex items-end bg-ink-900/40 p-3 xl:hidden" onClick={() => setOpen(null)}>
              <div className="max-h-[85vh] w-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <Detail x={sel} onClose={() => setOpen(null)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ x, onClose }: { x: IngredientInfo; onClose: () => void }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="border-t border-ink-50 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-relaxed text-ink-900">{children}</div>
    </div>
  );
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold tracking-[0.18em] text-champagne-700">{x.tier} INGREDIENT</div>
          <div className="mt-1 text-xl font-semibold text-ink-900">{x.name}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-50">
          <X size={16} />
        </button>
      </div>
      <div className="mt-3">
        <Row label="INCI">{x.inci ?? <Unverified />}</Row>
        <Row label="Role · 역할">{x.role}</Row>
        <Row label="Recommended Range · 추천 함량">{x.recommendedRange ?? <Unverified label="제조사·원료사 확인 필요" />}</Row>
        <Row label="Trend">{x.trend ? <StageBadge stage={x.trend} /> : <span className="text-slate-500">해당 없음 (베이스 원료)</span>}</Row>
        <Row label="Marketing Potential">{x.marketingPotential ? <LevelBadge level={x.marketingPotential} /> : <span className="text-slate-500">해당 없음</span>}</Row>
        <Row label="Evidence · 근거">{x.evidence ?? <Unverified label="데이터 없음 · 임상/연구자료 확인 필요" />}</Row>
        <Row label="Formulation Notes · 배합 노트">{x.formulationNotes}</Row>
        <Row label="Risk / Caution · 주의사항">{x.caution}</Row>
        <Row label="원료사 · 가격 · MOQ">
          <div className="flex flex-wrap gap-1.5">
            <Unverified label="원료사 확인 필요" />
            <Unverified label="가격 데이터 없음" />
            <Unverified label="MOQ 원료사 확인 필요" />
          </div>
        </Row>
        <Row label="Source">
          <div className="flex items-center gap-2">
            <DemoBadge /> <span className="text-xs text-slate-500">데모 원료 라이브러리 · 출처 확인 필요</span>
          </div>
        </Row>
      </div>
    </Card>
  );
}
