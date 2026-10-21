import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { FileText, Images, Palette, Factory, Wand2, Pencil } from 'lucide-react';
import { Card, KindBadge } from '@/components/ui';
import { fetchStudioStatus, planningInputs, selectedDirection, type StudioStatus } from '@/data/packaging';
import type { PackagingStudio as Studio, Project } from '@/data/types';
import { StatusPill } from './bits';
import { DesignDirectionTab } from './DesignDirectionTab';
import { ReferenceLibraryTab } from './ReferenceLibraryTab';
import { MockupTab } from './MockupTab';
import { FeasibilityTab } from './FeasibilityTab';
import { PackagingBriefTab } from './PackagingBriefTab';

export type StudioTab = 'direction' | 'references' | 'mockup' | 'feasibility' | 'brief';
export type SetStudio = (fn: (s: Studio) => Studio) => void;
export interface TabProps {
  p: Project;
  studio: Studio;
  setStudio: SetStudio;
  /** undefined = still checking, null = API not reachable */
  status: StudioStatus | null | undefined;
  inputs: ReturnType<typeof planningInputs>;
  go: (t: StudioTab) => void;
}

const TABS: { id: StudioTab; no: string; label: string; ko: string; icon: typeof Palette }[] = [
  { id: 'direction', no: '1', label: 'Design Direction', ko: '디자인 방향', icon: Palette },
  { id: 'references', no: '2', label: 'Reference Library', ko: '실제 레퍼런스', icon: Images },
  { id: 'mockup', no: '3', label: 'AI Design Mockup', ko: 'AI 시안', icon: Wand2 },
  { id: 'feasibility', no: '4', label: 'Manufacturing Feasibility', ko: '제조 가능성', icon: Factory },
];

const TAB_KEY = 'cad.packaging.tab';

/** AI Packaging & Design Studio. Sits above the original Packaging content, which stays unchanged. */
export function PackagingStudio({ p, update }: { p: Project; update: (fn: (p: Project) => Project) => void }) {
  const [status, setStatus] = useState<StudioStatus | null | undefined>(undefined);
  const [tab, setTab] = useState<StudioTab>(() => {
    try {
      const v = sessionStorage.getItem(TAB_KEY) as StudioTab | null;
      return v && ['direction', 'references', 'mockup', 'feasibility', 'brief'].includes(v) ? v : 'direction';
    } catch {
      return 'direction';
    }
  });
  useEffect(() => {
    const ctrl = new AbortController();
    fetchStudioStatus(ctrl.signal).then((s) => {
      if (!ctrl.signal.aborted) setStatus(s);
    });
    return () => {
      ctrl.abort();
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  const inputs = useMemo(() => planningInputs(p), [p]);
  const studio = p.packagingStudio ?? {};
  const setStudio: SetStudio = (fn) => update((pr) => ({ ...pr, packagingStudio: fn(pr.packagingStudio ?? {}) }));
  const selected = selectedDirection(studio);
  const props: TabProps = { p, studio, setStudio, status, inputs, go: setTab };
  const core = inputs.filter((x) => x.core);
  const missing = core.filter((x) => !x.value).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-50 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI PACKAGING &amp; DESIGN STUDIO</div>
          <div className="text-[13px] text-slate-500">Product Blueprint 값으로 디자인 방향 → 레퍼런스 → 시안 → 제조 검토 → 패키지 기획서</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {status === undefined ? (
            <span className="text-[11px] text-slate-400">연결 상태 확인 중…</span>
          ) : status === null ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200">서버 API 확인 불가 (로컬 미리보기) · 모든 외부 기능 미연결로 처리</span>
          ) : (
            <>
              <StatusPill on={status.ai.configured} label="AI 디자인 제안" offText="데모 규칙" tone="demo" />
              <StatusPill on={status.firecrawl.configured} label="레퍼런스(Firecrawl)" />
              <StatusPill on={status.imageGen.configured} label="이미지 생성" />
              <StatusPill on={status.storage.supabase} label="Supabase" offText="이 브라우저에 저장" tone="demo" />
            </>
          )}
        </div>
      </div>

      {/* Product Blueprint values, read only (never typed again here) */}
      <div className="border-b border-ink-50 bg-ink-50/40 px-4 py-2.5 sm:px-5">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="font-semibold text-ink-700">Product Blueprint 연동</span>
          {missing > 0 && <span className="text-amber-700">미정 {missing}개 · 미정 값은 추천에서 "미정"으로 다룹니다</span>}
          <Link to={`/projects/${p.id}/overview`} className="ml-auto inline-flex items-center gap-1 font-medium text-ink-600 hover:text-ink-900">
            <Pencil size={11} /> 기획안에서 수정
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {core.map((x) => (
            <div key={x.key} className="min-w-0">
              <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {x.label}
                {x.kind && <KindBadge kind={x.kind} className="scale-90 origin-left" />}
              </dt>
              <dd className={clsx('truncate text-[12.5px]', x.value ? 'text-ink-900' : 'text-slate-400')} title={x.value || '미정'}>
                {x.value || '미정'}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-ink-50 px-2 pt-2 sm:px-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx('flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-medium transition', tab === t.id ? 'border-ink-800 text-ink-900' : 'border-transparent text-slate-500 hover:text-ink-800')}
          >
            <t.icon size={14} />
            <span className="text-slate-400">{t.no}</span> {t.label}
            <span className="hidden text-[11px] font-normal text-slate-400 2xl:inline">{t.ko}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'brief'}
          disabled={!selected}
          title={selected ? '' : '디자인 방향을 선택하면 자동 생성됩니다'}
          onClick={() => setTab('brief')}
          className={clsx('ml-auto flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', tab === 'brief' ? 'border-champagne-500 text-ink-900' : 'border-transparent text-champagne-700 hover:text-ink-900')}
        >
          <FileText size={14} /> Packaging Brief
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {tab === 'direction' && <DesignDirectionTab {...props} />}
        {tab === 'references' && <ReferenceLibraryTab {...props} />}
        {tab === 'mockup' && <MockupTab {...props} />}
        {tab === 'feasibility' && <FeasibilityTab {...props} />}
        {tab === 'brief' && <PackagingBriefTab {...props} />}
      </div>
    </Card>
  );
}
