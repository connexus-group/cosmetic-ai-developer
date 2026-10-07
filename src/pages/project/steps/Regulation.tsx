import clsx from 'clsx';
import { Scale, ShieldAlert } from 'lucide-react';
import { AiInsight } from '@/components/AiInsight';
import { Card, KindBadge, PageIntro, RiskBadge, Section } from '@/components/ui';
import type { RegulationItem } from '@/data/types';
import { checkClaims, DEFAULT_CLAIM_COPY, effectiveConcept, regulationItems } from '@/lib/engine';
import { useProject } from '../ProjectLayout';
import { PreviewBanner } from './PreviewBanner';

const AREAS: { id: RegulationItem['area']; ko: string }[] = [
  { id: 'Functional Cosmetic', ko: '기능성화장품' },
  { id: 'Claims Risk', ko: '표시·광고 표현' },
  { id: 'Ingredient Review', ko: '원료 검토' },
  { id: 'Label Review', ko: '표시사항' },
  { id: 'Export', ko: '해외 판매' },
];
const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export default function Regulation() {
  const { project: p, update } = useProject();
  const concept = effectiveConcept(p);
  const items = regulationItems(p);
  const hits = checkClaims(p.claimCopy);
  const count = (r: 'LOW' | 'MEDIUM' | 'HIGH') => items.filter((i) => i.risk === r).length;

  return (
    <div className="space-y-6">
      <PageIntro no="12" title="Regulation Check" ko="규제 검토" question="출시 전에 어떤 규제 사항을 확인해야 할까요?" right={<KindBadge kind="AI_ANALYSIS" />} />
      {!p.conceptId && <PreviewBanner projectId={p.id} step="concept" what="제품 컨셉" />}
      <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 text-xs text-slate-600">
        <Scale size={16} className="mt-0.5 shrink-0 text-ink-500" />
        이 화면은 규칙 기반 사전 점검입니다. 법적 판단이 아니며, 모든 항목은 최종적으로 <b className="text-ink-900">"규제 검토 필요"</b>합니다. 실제 출시 전 전문가 또는 제조사 RA 담당자의 검토를 받으세요.
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
          <Card key={r} className="p-4">
            <RiskBadge risk={r} />
            <div className="mt-2 text-3xl font-semibold tabular-nums text-ink-900">{count(r)}</div>
            <div className="text-xs text-slate-500">검토 항목</div>
          </Card>
        ))}
      </div>

      <Section title="영역별 리스크" subtitle={`${concept.name} 기준 · 영역에서 가장 높은 리스크 표시`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AREAS.map((a) => {
            const list = items.filter((i) => i.area === a.id);
            const top = list.reduce<'LOW' | 'MEDIUM' | 'HIGH'>((m, i) => (RANK[i.risk] > RANK[m] ? i.risk : m), 'LOW');
            return (
              <div key={a.id} className={clsx('rounded-xl border p-4', top === 'HIGH' ? 'border-rose-200 bg-rose-50/50' : top === 'MEDIUM' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/40')}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{a.id}</div>
                <div className="mt-0.5 text-sm font-semibold text-ink-900">{a.ko}</div>
                <RiskBadge risk={top} className="mt-3" />
                <div className="mt-2 text-[11px] text-slate-500">{list.length}개 항목</div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="체크리스트" subtitle="리스크가 높은 순서">
        <div className="divide-y divide-ink-50">
          {[...items]
            .sort((a, b) => RANK[b.risk] - RANK[a.risk])
            .map((i) => (
              <div key={i.id} className="grid gap-2 py-3 md:grid-cols-[150px_1fr_1fr] md:gap-4">
                <div>
                  <RiskBadge risk={i.risk} />
                  <div className="mt-1 text-[11px] text-slate-500">{i.area}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink-900">{i.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{i.detail}</div>
                </div>
                <div className="rounded-lg bg-ink-50/60 px-3 py-2 text-xs text-ink-800">
                  <span className="font-semibold">할 일 · </span>
                  {i.action}
                </div>
              </div>
            ))}
        </div>
      </Section>

      <Section
        title="표현 Risk Checker"
        subtitle="광고·상세페이지 문구를 입력하면 의약품 오인·과장 표현을 찾아드려요"
        action={
          <button type="button" onClick={() => update((x) => ({ ...x, claimCopy: DEFAULT_CLAIM_COPY }))} className="text-xs text-slate-500 hover:text-ink-800">
            예시 문구 넣기
          </button>
        }
      >
        <textarea
          value={p.claimCopy}
          onChange={(e) => update((x) => ({ ...x, claimCopy: e.target.value }))}
          rows={3}
          className="w-full resize-none rounded-xl border border-ink-100 px-4 py-3 text-sm leading-relaxed outline-none focus:border-ink-400"
          placeholder="예: 피부 재생을 돕는 PDRN 앰플"
        />
        <div className="mt-4">
          {hits.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">감지된 주의 표현이 없습니다. 최종 문구는 규제 검토 필요.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {hits.map((h) => (
                <div key={h.phrase} className={clsx('rounded-xl border p-4', h.risk === 'HIGH' ? 'border-rose-200 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40')}>
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={15} className={h.risk === 'HIGH' ? 'text-rose-600' : 'text-amber-600'} />
                    <span className="font-semibold text-ink-900">"{h.phrase}"</span>
                    <RiskBadge risk={h.risk} className="ml-auto" />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{h.reason}</p>
                  <p className="mt-2 text-xs text-ink-800">
                    <b>대안 표현</b> · {h.alternative}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <AiInsight
        insight={{
          finding: `검토 항목 ${items.length}개 중 HIGH ${count('HIGH')}개, MEDIUM ${count('MEDIUM')}개입니다.`,
          why: '기능성 표시와 광고 표현은 출시 후 수정하기 어렵고, 단상자·상세페이지를 다시 만들어야 할 수 있습니다.',
          opportunity: '주름개선 기능성을 확보하면 "주름 개선"을 공식적으로 말할 수 있어 경쟁제품 대비 신뢰도가 올라갑니다.',
          risk: hits.some((h) => h.risk === 'HIGH') ? '현재 문구에 의약품 오인 소지가 있는 표현이 포함되어 있습니다.' : '표시사항과 원료 주의 문구는 디자인 확정 전에 확인해야 합니다.',
          recommendation: '기능성 진행 여부를 먼저 결정하고, 광고 문구는 대안 표현으로 바꾼 뒤 제조사 RA 검토를 받으세요.',
        }}
      />
    </div>
  );
}
