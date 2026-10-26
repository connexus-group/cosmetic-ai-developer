import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { KindBadge } from '@/components/ui';
import { packagingBriefRows, selectedDirection } from '@/data/packaging';
import type { Project } from '@/data/types';
import { PackIllustration, Swatches } from './bits';
import { MockupImage } from './MockupTab';
import type { TabProps } from './PackagingStudio';

export function PackagingBriefTab({ p }: TabProps) {
  const rows = packagingBriefRows(p);
  if (!rows.length) return <p className="py-6 text-center text-[12px] text-slate-500">디자인 방향을 선택하면 Packaging Brief가 자동으로 만들어져요.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-bold tracking-[0.2em] text-champagne-700">PACKAGING BRIEF</div>
        <span className="text-[12px] text-slate-500">선택한 디자인 방향과 시안·레퍼런스·제조 검토를 자동으로 모았어요. Development Brief 07 섹션에 같은 내용이 들어갑니다.</span>
        <Link to={`/projects/${p.id}/brief`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-ink-700 hover:text-ink-900">
          Development Brief에서 보기 <ArrowRight size={13} />
        </Link>
      </div>
      <PackagingBriefVisuals p={p} />
      <dl className="grid gap-x-6 rounded-xl border border-ink-100 px-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className="border-b border-ink-50 py-2 last:border-0 md:[&:nth-last-child(2)]:border-0">
            <dt className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              {r.label}
              <KindBadge kind={r.kind} className="ml-auto" />
            </dt>
            <dd className="mt-0.5 break-words text-[13px] leading-relaxed text-ink-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Palette, illustration, attached mockups and image references. Shared with the Development Brief. */
export function PackagingBriefVisuals({ p }: { p: Project }) {
  const s = p.packagingStudio;
  const d = selectedDirection(s);
  if (!s || !d) return null;
  const pinned = (s.mockups ?? []).filter((x) => x.pinned);
  const mockups = pinned.length ? pinned : (s.mockups ?? []).slice(0, 2);
  const refs = (s.references ?? []).filter((r) => r.imageStatus === 'ok' && r.imageUrl).slice(0, 6);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="w-44 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-white">
        <PackIllustration container={s.mockupOptions?.container ?? d.container} main={s.mockupOptions?.mainColor ?? d.mainColors[0]?.hex ?? '#eee'} sub={d.subColors[0]?.hex ?? '#fff'} accent={s.mockupOptions?.subColor ?? d.mainColors[1]?.hex ?? '#999'} className="block h-28 w-full" />
        <div className="space-y-1 p-2">
          <div className="text-[12px] font-semibold text-ink-900">{d.name}</div>
          <Swatches colors={[...d.mainColors, ...d.subColors]} size="sm" />
        </div>
      </div>
      {mockups.map((x) => (
        <div key={x.id} className="w-40 shrink-0 overflow-hidden rounded-xl border border-ink-100">
          <MockupImage x={x} id={s.identity} overlay />
        </div>
      ))}
      {refs.map((r) => (
        <a key={r.id} href={r.pageUrl} target="_blank" rel="noreferrer noopener" className="relative w-32 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-white" title={`${r.source} · ${r.pageUrl}`}>
          <img src={r.imageUrl!} alt={r.title} referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-full object-contain" />
          <span className="block truncate px-1.5 py-1 text-[10px] text-slate-500">
            레퍼런스 · {r.brand ?? r.site}
          </span>
        </a>
      ))}
    </div>
  );
}
