import clsx from 'clsx';
import { CalendarClock, Check, Info } from 'lucide-react';
import { AiInsight } from '@/components/AiInsight';
import { Gantt, PHASE_LABEL, ProgressRing } from '@/components/charts';
import { Card, KindBadge, PageIntro, Section } from '@/components/ui';
import { CHECKLIST } from '@/data/mock';
import type { ChecklistItem } from '@/data/types';
import { effectiveConcept, progressOf, timelineOf } from '@/lib/engine';
import { useProject } from '../ProjectLayout';

const GROUPS: ChecklistItem['group'][] = ['기획', '개발', '검증', '생산·출시'];
const PHASE_DOT = { plan: 'bg-ink-300', develop: 'bg-ink-600', verify: 'bg-champagne-500', launch: 'bg-ink-900' } as const;

export default function Timeline() {
  const { project: p, update } = useProject();
  const concept = effectiveConcept(p);
  const { tasks, weeks, notes } = timelineOf(p);
  const prog = progressOf(p);
  const launch = new Date(Date.now() + weeks * 7 * 86400000);
  const toggle = (id: string) => update((x) => ({ ...x, checklist: { ...x.checklist, [id]: !x.checklist[id] } }));

  return (
    <div className="space-y-6">
      <PageIntro no="14" title="Development Timeline" ko="개발 일정 · 체크리스트" question="언제 출시할 수 있고, 무엇부터 해야 할까요?" right={<KindBadge kind="AI_ESTIMATE" />} />

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.3fr]">
        <Card className="flex items-center gap-4 bg-gradient-to-br from-ink-900 to-ink-700 p-6 text-white">
          <CalendarClock size={28} className="text-champagne-300" />
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-champagne-300">ESTIMATED LAUNCH</div>
            <div className="text-4xl font-semibold tabular-nums">{weeks} Weeks</div>
            <div className="text-xs text-ink-200">약 {Math.round((weeks / 4.345) * 10) / 10}개월 · 오늘 시작 시 {launch.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 출시 예상</div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">일정 기준</div>
          <div className="mt-1 text-sm font-semibold text-ink-900">{concept.name}</div>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {notes.length ? notes.map((n) => <li key={n}>· {n}</li>) : <li>· 표준 개발 일정 기준</li>}
          </ul>
        </Card>
        <Card className="flex items-center gap-4 p-6">
          <ProgressRing value={prog.pct} size={84} stroke={8} label="Progress" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Development Progress</div>
            <div className="mt-1 text-sm text-slate-600">
              체크리스트 <b className="text-ink-900">{prog.checks}/{prog.checksTotal}</b> 완료
            </div>
            <div className="text-xs text-slate-500">아래 체크리스트를 체크하면 진행률이 올라가요.</div>
          </div>
        </Card>
      </div>

      <Section
        title="개발 일정 (Gantt)"
        subtitle="주 단위 · 막대에 마우스를 올리면 기간이 보여요"
        action={
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
            {(Object.keys(PHASE_LABEL) as (keyof typeof PHASE_LABEL)[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={clsx('h-2.5 w-2.5 rounded-sm', PHASE_DOT[k])} /> {PHASE_LABEL[k]}
              </span>
            ))}
          </div>
        }
      >
        <Gantt tasks={tasks} weeks={weeks} />
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Info size={12} /> 일반적인 OEM 개발 일정을 기준으로 한 예상값입니다. 제조사 일정과 시험기관 일정에 따라 달라집니다.
        </p>
      </Section>

      <Section title="Development Checklist" subtitle="초보 브랜드가 빠뜨리기 쉬운 일을 단계별로 정리했어요. 직접 체크하세요.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((g) => {
            const list = CHECKLIST.filter((c) => c.group === g);
            const done = list.filter((c) => p.checklist[c.id]).length;
            return (
              <div key={g} className="rounded-xl border border-ink-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-900">{g}</span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {done}/{list.length}
                  </span>
                </div>
                <div className="mb-3 h-1 rounded-full bg-ink-50">
                  <div className="h-1 rounded-full bg-ink-600 transition-all" style={{ width: `${(done / list.length) * 100}%` }} />
                </div>
                <ul className="space-y-1">
                  {list.map((c) => {
                    const on = !!p.checklist[c.id];
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => toggle(c.id)} aria-pressed={on} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-ink-50">
                          <span className={clsx('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border', on ? 'border-ink-800 bg-ink-800 text-white' : 'border-ink-200')}>{on && <Check size={12} />}</span>
                          <span className={clsx(on ? 'text-slate-400 line-through' : 'text-ink-900')}>{c.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <AiInsight
        insight={{
          finding: `현재 조건으로는 기획부터 입고까지 약 ${weeks}주가 걸립니다.`,
          why: '샘플 수정 횟수와 시험 기간이 전체 일정을 가장 크게 좌우합니다.',
          opportunity: '패키지 개발과 디자인을 샘플 단계와 병행하면 일정을 줄일 수 있습니다 (현재 일정에 반영됨).',
          risk: '2차 샘플에서 사용감이 확정되지 않으면 3차 샘플로 2~3주가 추가될 수 있습니다.',
          recommendation: '제조사 선정 시 샘플 리드타임과 에어리스 용기 MOQ를 함께 확인하고, 다음 단계에서 개발의뢰서를 전달하세요.',
        }}
      />
    </div>
  );
}
