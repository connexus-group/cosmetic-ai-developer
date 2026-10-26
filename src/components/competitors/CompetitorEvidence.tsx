import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Swords } from 'lucide-react';
import { KindBadge } from '@/components/ui';
import { differentiation, fmtKrw } from '@/lib/competitorAnalysis';
import { setCompetitorContext } from '@/lib/blueprint';
import { useProject } from '@/pages/project/ProjectLayout';
import { useCompetitorAnalysis } from './CompetitorAnalysis';

/**
 * Real competitor evidence for the Product Blueprint (Overview) and Concept screens.
 * Lists only products collected from real pages, with source URL and collection date.
 * Shows nothing but a pointer when no product has been collected yet.
 */
export function CompetitorEvidence({ compact = false }: { compact?: boolean }) {
  const { project } = useProject();
  const { list, attrs, sizeMl } = useCompetitorAnalysis(true);
  const diffs = differentiation(list, attrs, sizeMl);
  const top = [...list].sort((a, b) => b.relevance - a.relevance).slice(0, compact ? 3 : 5);

  // AI "다시 추천" on the blueprint cites these products (only when the AI key is set; Demo Mode ignores them)
  useEffect(() => {
    setCompetitorContext(
      [...list]
        .sort((a, b) => b.relevance - a.relevance)
        .map((x) => ({ brand: x.p.brand ?? x.p.domain, product: x.p.productName ?? x.p.pageTitle ?? '', price: x.p.salePriceText ?? x.p.priceText ?? '', size: x.p.volumeText ?? '', per100Krw: x.per100Krw, keyIngredients: x.p.keyIngredients ?? [], usp: x.p.usp ?? [], url: x.p.finalUrl || x.p.url, collectedAt: x.p.collectedAt })),
    );
  }, [list]);

  return (
    <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/30 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
          <Swords size={13} className="text-sky-700" /> 실제 경쟁제품 근거 · Firecrawl 수집
        </span>
        {list.length > 0 && <KindBadge kind="EXTERNAL" />}
      </div>
      {!list.length ? (
        <div className="text-xs text-slate-500">
          아직 수집한 실제 경쟁제품이 없습니다.{' '}
          <Link to={`/projects/${project.id}/competitors`} className="underline">
            03 Competitors
          </Link>
          에서 자동 탐색 후 수집하면 이곳과 AI 기획안에 근거로 쓰입니다.
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {top.map((x) => (
              <li key={x.p.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-medium text-ink-900">
                  {x.p.brand ?? x.p.domain} {x.p.productName ?? ''}
                </span>
                <span className="tabular-nums text-slate-600">{x.p.salePriceText ?? x.p.priceText ?? '가격 없음'}</span>
                {x.per100Krw !== null && <span className="tabular-nums text-slate-500">100ml당 {fmtKrw(x.per100Krw)}</span>}
                <span className="text-slate-400">관련성 추정 {x.relevance}</span>
                <a href={x.p.finalUrl || x.p.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-sky-700 hover:underline">
                  <ExternalLink size={10} /> {x.p.domain}
                </a>
                <span className="text-[10px] text-slate-400">{new Date(x.p.collectedAt).toLocaleDateString('ko-KR')} 수집</span>
              </li>
            ))}
          </ul>
          {diffs.length > 0 && (
            <div className="mt-2 border-t border-sky-100 pt-2">
              <div className="mb-1 text-[11px] font-semibold text-slate-600">차별화 기회 (수집 데이터 기반 규칙 분석)</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">
                {diffs.slice(0, compact ? 2 : 4).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2 text-[10px] text-slate-400">수집 {list.length}개 · 페이지에 적힌 값만 사용 · 관련성은 시장점유율이나 판매 순위가 아닙니다.</div>
        </>
      )}
    </div>
  );
}
