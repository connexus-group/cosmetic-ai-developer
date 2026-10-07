import clsx from 'clsx';
import { Check } from 'lucide-react';
import { AiInsight } from '@/components/AiInsight';
import { AnalyzingState, Card, KindBadge, PageIntro, Section } from '@/components/ui';
import { dataSource } from '@/data/source';
import type { TestItem } from '@/data/types';
import { effectiveConcept } from '@/lib/engine';
import { useAsync } from '@/lib/useAsync';
import { useProject } from '../ProjectLayout';

const GROUPS: { id: TestItem['group']; title: string; desc: string; cls: string }[] = [
  { id: 'REQUIRED', title: 'REQUIRED', desc: '출시를 위해 반드시 필요한 시험', cls: 'bg-wine-700 text-white' },
  { id: 'RECOMMENDED', title: 'RECOMMENDED', desc: '제품 특성상 강력히 권장', cls: 'bg-ink-100 text-ink-800' },
  { id: 'MARKETING', title: 'MARKETING', desc: '광고 문구의 근거를 만드는 효능 시험', cls: 'bg-champagne-100 text-champagne-700' },
];

export default function Testing() {
  const { project: p, update } = useProject();
  const concept = effectiveConcept(p);
  const { data } = useAsync(() => dataSource.tests(), 'tests');
  const toggle = (id: string) => update((x) => ({ ...x, tests: { ...x.tests, [id]: !x.tests[id] } }));

  return (
    <div className="space-y-10">
      <PageIntro no="13" title="Testing" ko="필요 시험" question="출시 전에 어떤 시험을 해야 하고, 광고에 쓸 근거는 무엇일까요?" right={<KindBadge kind="AI_ANALYSIS" />} />
      {!data ? (
        <AnalyzingState />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {GROUPS.map((g) => {
              const list = data.filter((t) => t.group === g.id);
              const n = list.filter((t) => p.tests[t.id]).length;
              return (
                <Card key={g.id} className="p-4">
                  <span className={clsx('rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider', g.cls)}>{g.title}</span>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-ink-900">
                    {n}
                    <span className="text-sm font-normal text-ink-400"> / {list.length}</span>
                  </div>
                  <div className="text-xs text-ink-500">선택한 시험</div>
                </Card>
              );
            })}
          </div>

          {GROUPS.map((g) => (
            <Section key={g.id} title={<span className="flex items-center gap-2"><span className={clsx('rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider', g.cls)}>{g.title}</span>{g.desc}</span>}>
              <div className="grid gap-3 md:grid-cols-2">
                {data
                  .filter((t) => t.group === g.id)
                  .map((t) => {
                    const on = !!p.tests[t.id];
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggle(t.id)}
                        className={clsx('flex gap-3 rounded-xl border p-4 text-left transition', on ? 'border-ink-300 bg-ink-50/60' : 'border-ink-100 hover:border-ink-200')}
                        aria-pressed={on}
                      >
                        <span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border', on ? 'border-wine-700 bg-wine-700 text-white' : 'border-ink-200 bg-white')}>{on && <Check size={13} />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold text-ink-900">{t.name}</span>
                            <span className="text-xs text-ink-500">{t.nameKo}</span>
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-ink-600">
                            <b className="text-ink-800">목적</b> {t.purpose}
                          </span>
                          <span className="block text-xs leading-relaxed text-ink-600">
                            <b className="text-ink-800">필요성</b> {t.necessity}
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span className="rounded-full bg-white px-2 py-0.5 text-ink-600 ring-1 ring-ink-100">예상 기간 {t.weeks}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-ink-600 ring-1 ring-ink-100">{t.stage}</span>
                            {t.note && <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-ink-100">{t.note}</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            </Section>
          ))}

          <p className="text-[11px] text-ink-500">
            시험 기간은 일반적인 범위의 데모 예상값입니다 <KindBadge kind="AI_ESTIMATE" className="ml-1" />. 실제 기간·비용은 시험기관 견적으로 확인하세요.
          </p>

          <AiInsight
            insight={{
              finding: concept.actives.includes('Retinal') ? 'Retinal 배합으로 안정도·용기 적합성·피부 자극 시험이 특히 중요합니다.' : '필수 4개 시험과 핵심 메시지의 효능 시험을 우선 진행하면 됩니다.',
              why: '"저자극", "탄력 ○% 개선" 같은 문구는 시험 결과가 있어야 광고에 쓸 수 있습니다.',
              opportunity: '탄력·주름 효능 시험 결과를 상세페이지 핵심 근거로 쓰면 경쟁제품과 차별화됩니다.',
              risk: '마케팅 시험을 너무 많이 넣으면 비용과 일정이 늘어납니다 (4개 이상이면 일정 +1주).',
              recommendation: '필수 4개 + 피부 자극 + 탄력·주름 효능 시험 조합을 추천합니다. 핵심 메시지와 연결되지 않는 시험은 출시 후로 미루세요.',
            }}
          />
        </>
      )}
    </div>
  );
}
