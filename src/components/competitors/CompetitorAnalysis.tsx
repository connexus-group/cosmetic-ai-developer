import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { TipBox } from '@/components/charts';
import { KindBadge, Section } from '@/components/ui';
import { Notice } from '@/components/market/RealMarketData';
import { fetchFxRates, type FxRates } from '@/data/competitorProducts';
import { useCollectedProducts } from '@/data/competitorStore';
import { AXIS, GRID, SERIES } from '@/lib/colors';
import { analyzeProduct, commonClaims, CRITERIA, differentiation, fmtKrw, ideaAttributes, ingredientOverlap, MIN_FOR_CHARTS, type Analyzed } from '@/lib/competitorAnalysis';
import { signals } from '@/lib/spec';
import { useProject } from '@/pages/project/ProjectLayout';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR');
};
const label = (x: Analyzed) => `${x.p.brand ?? x.p.domain} ${x.p.productName ?? ''}`.trim().slice(0, 28);

/** Hook: collected products for this project, analyzed against the idea, with KRW conversion. */
export function useCompetitorAnalysis(load = false) {
  const { project } = useProject();
  const products = useCollectedProducts(project.competitorUrls, load);
  const { attrs } = useMemo(() => ideaAttributes(project), [project]);
  const currencies = useMemo(() => [...new Set(products.map((p) => p.currency).filter((c): c is string => !!c && c !== 'KRW'))].sort().join(','), [products]);
  const [fx, setFx] = useState<{ data: FxRates | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!currencies) return;
    let alive = true;
    fetchFxRates(currencies.split(',')).then(
      (data) => alive && setFx({ data, error: null }),
      (e: Error) => alive && setFx({ data: null, error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [currencies]);
  const list = useMemo(() => products.map((p) => analyzeProduct(p, attrs, fx.data)), [products, attrs, fx.data]);
  const sizeMl = signals(project).sizeMl;
  return { list, attrs, fx, sizeMl, needsFx: !!currencies };
}

function Insufficient({ have, need = MIN_FOR_CHARTS, what }: { have: number; need?: number; what: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-xs text-slate-500">
      데이터 부족 · {what}에 필요한 실제 수집 값이 {have}개뿐입니다 (최소 {need}개). 가상 값으로 채우지 않았습니다.
    </div>
  );
}

function Chart({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-50 p-3">
      <div className="mb-1 text-xs font-semibold text-ink-800">{title}</div>
      {note && <div className="mb-2 text-[11px] text-slate-500">{note}</div>}
      {children}
    </div>
  );
}

/**
 * Comparison of collected competitors. Every number comes from rows stored from real product pages
 * (Firecrawl → Supabase). Relevance and differentiation are rule-based estimates and are labelled so.
 */
export function CompetitorAnalysis() {
  const { list, attrs, fx, sizeMl, needsFx } = useCompetitorAnalysis();
  const priced = list.filter((x) => x.priceKrw !== null);
  const per100 = list.filter((x) => x.per100Krw !== null);
  const withInci = list.filter((x) => x.p.ingredients.length > 0);
  const withUsp = list.filter((x) => (x.p.usp ?? []).length > 0);
  const overlap = useMemo(() => ingredientOverlap(withInci), [withInci]);
  const claims = useMemo(() => commonClaims(withUsp), [withUsp]);
  const diffs = useMemo(() => differentiation(list, attrs, sizeMl), [list, attrs, sizeMl]);
  const fxDates = [...new Set(list.flatMap((x) => (x.fx ? [`${x.p.currency} 1 = ${x.fx.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원 (${x.fx.date})`] : [])))];
  const legacy = list.some((x) => x.p.usp === undefined || (x.p.keyIngredients === undefined && x.p.sizeValue === undefined));

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <BarChart3 size={15} className="text-sky-700" /> 실제 수집 제품 비교 분석
        </span>
      }
      subtitle={`수집·저장된 경쟁제품 ${list.length}개로만 만든 비교표와 그래프 · 관련성과 차별화 기회는 규칙 기반 추정`}
      action={list.length ? <KindBadge kind="EXTERNAL" /> : undefined}
      className="border-sky-100"
    >
      {!list.length ? (
        <Notice tone="empty" icon={<Info size={15} />} title="비교할 실제 수집 제품이 없습니다">
          위의 자동 탐색이나 URL 입력으로 경쟁제품을 수집하면 비교표와 그래프가 여기에 생깁니다. 그 전에는 아무 그래프도 그리지 않습니다.
        </Notice>
      ) : (
        <div className="space-y-5">
          {legacy && (
            <Notice tone="warn" icon={<Info size={15} />} title="일부 제품은 예전 방식으로 수집됐습니다">
              정가·할인가·핵심 원료·USP 칸이 없는 제품이 있습니다. &ldquo;다시 수집&rdquo;하면 채워집니다 (Supabase에 새 마이그레이션 실행 필요).
            </Notice>
          )}
          <ComparisonTable list={list} />
          <div className="text-[11px] leading-relaxed text-slate-500">
            환산 기준: 실제 판매가(할인가가 표시되면 할인가, 아니면 표시 가격) ÷ 용량 × 100. 용량은 페이지에 적힌 ml/g를 쓰고, fl oz/oz만 적힌 경우 1 fl oz = 29.5735ml, 1 oz = 28.3495g으로 환산합니다.{' '}
            {needsFx && (fxDates.length ? <>환율: {fxDates.join(' · ')} · {fx.data?.source}</> : <span className="text-amber-700">환율을 불러오지 못해 원화가 아닌 제품은 원화 비교에서 뺐습니다{fx.error ? ` (${fx.error})` : ''}.</span>)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Chart title="브랜드별 실제 판매가 (원화 환산)">
              {priced.length < MIN_FOR_CHARTS ? (
                <Insufficient have={priced.length} what="가격 비교" />
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <BarChart data={priced.map((x) => ({ name: label(x), v: Math.round(x.priceKrw!) }))} layout="vertical" margin={{ left: 8, right: 48 }}>
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" tick={{ fill: AXIS, fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}천`} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: AXIS, fontSize: 10 }} />
                      <Tooltip formatter={(v) => fmtKrw(Number(v))} />
                      <Bar dataKey="v" fill={SERIES[0]} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="v" position="right" formatter={(v) => fmtKrw(Number(v)) ?? ''} style={{ fontSize: 10, fill: AXIS }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Chart>
            <Chart title="100ml(g)당 가격 (원화 환산)">
              {per100.length < MIN_FOR_CHARTS ? (
                <Insufficient have={per100.length} what="용량당 가격 비교" />
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <BarChart data={per100.map((x) => ({ name: label(x), v: Math.round(x.per100Krw!) }))} layout="vertical" margin={{ left: 8, right: 48 }}>
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" tick={{ fill: AXIS, fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}천`} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: AXIS, fontSize: 10 }} />
                      <Tooltip formatter={(v) => fmtKrw(Number(v))} />
                      <Bar dataKey="v" fill={SERIES[2]} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="v" position="right" formatter={(v) => fmtKrw(Number(v)) ?? ''} style={{ fontSize: 10, fill: AXIS }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Chart>
            <Chart title="포지셔닝 맵" note="X축 100ml당 가격(원) · Y축 아이디어와의 관련성 추정(0~100, 시장점유율·판매 순위 아님)">
              {per100.length < MIN_FOR_CHARTS ? (
                <Insufficient have={per100.length} what="포지셔닝 맵" />
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid stroke={GRID} />
                      <XAxis type="number" dataKey="x" name="100ml당" tick={{ fill: AXIS, fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}천`} label={{ value: '100ml당 가격', position: 'insideBottom', offset: -10, fill: AXIS, fontSize: 10 }} />
                      <YAxis type="number" dataKey="y" name="관련성" domain={[0, 100]} tick={{ fill: AXIS, fontSize: 10 }} width={36} />
                      <Tooltip
                        content={({ active, payload }) => {
                          const d = payload?.[0]?.payload as { name: string; x: number; y: number } | undefined;
                          return active && d ? <TipBox title={d.name} rows={[{ label: '100ml당', value: fmtKrw(d.x) ?? '' }, { label: '관련성 추정', value: String(d.y) }]} /> : null;
                        }}
                      />
                      <Scatter data={per100.map((x) => ({ name: label(x), x: Math.round(x.per100Krw!), y: x.relevance }))} fill={SERIES[0]} />
                      {attrs.targetPrice && sizeMl ? <Scatter data={[{ name: '우리 제품 (목표)', x: Math.round((attrs.targetPrice / sizeMl) * 100), y: 100 }]} fill={SERIES[1]} shape="diamond" /> : null}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Chart>
            <Chart title="여러 제품에 공통으로 들어간 성분" note="페이지에 적힌 전성분 기준 · 2개 이상 제품에 있는 성분">
              {withInci.length < MIN_FOR_CHARTS ? (
                <Insufficient have={withInci.length} what="성분 비교" />
              ) : overlap.length ? (
                <ul className="space-y-1">
                  {overlap.map((o) => (
                    <li key={o.name} className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 truncate text-slate-700" title={o.name}>
                        {o.name}
                      </span>
                      <span className="h-2 rounded bg-sky-200" style={{ width: `${(o.n / withInci.length) * 100}%` }} />
                      <span className="tabular-nums text-slate-500">
                        {o.n}/{withInci.length}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-500">2개 이상 제품에 겹치는 성분이 없습니다.</div>
              )}
            </Chart>
            <Chart title="공통 소구 표현 (USP)" note="페이지에서 그대로 옮긴 USP 문구 중 2개 이상 제품에 나온 단어">
              {withUsp.length < MIN_FOR_CHARTS ? (
                <Insufficient have={withUsp.length} what="소구 표현 비교" />
              ) : claims.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {claims.map((c) => (
                    <span key={c.term} className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-800">
                      {c.term} <span className="text-slate-500">{c.n}개</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">2개 이상 제품에 반복되는 표현이 없습니다.</div>
              )}
            </Chart>
            <Chart title="차별화 기회" note="수집된 값과 기획 입력만으로 계산한 규칙 기반 분석 · 판단은 직접 검토하세요">
              {list.length < 2 ? (
                <Insufficient have={list.length} need={2} what="차별화 분석" />
              ) : diffs.length ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700">
                  {diffs.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-500">필수 원료·목표가를 입력하면 비교할 수 있습니다.</div>
              )}
            </Chart>
          </div>
          <div className="flex items-start gap-1 text-[11px] text-slate-500">
            <KindBadge kind="AI_ESTIMATE" /> 관련성 추정 = {CRITERIA.map((c) => `${c.label} ${c.weight}`).join(' + ')}점. 수집된 제품명·유형·USP·성분·가격·국가가 기획 입력과 맞는지로 계산하며, 페이지에 값이 없으면 0점입니다. 실제 시장점유율이나 판매 순위가 아닙니다.
          </div>
        </div>
      )}
    </Section>
  );
}

const MISSING = <span className="text-[11px] text-slate-400">없음</span>;

function ComparisonTable({ list }: { list: Analyzed[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-xs">
        <thead>
          <tr className="border-b border-ink-100 text-left text-[10px] uppercase tracking-wider text-slate-500">
            {['브랜드 / 제품', '국가 (추정)', '유형', '정가', '할인가', '용량', '100ml당 (원)', '핵심 원료', 'USP (페이지 문구)', '관련성 추정', '출처 / 수집일'].map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((x) => {
            const p = x.p;
            const regular = p.regularPriceText ?? (p.salePriceText ? null : p.priceText);
            return (
              <tr key={p.id} className="border-b border-ink-50 align-top">
                <td className="px-2 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{p.brand ?? '브랜드 없음'}</div>
                  <div className="font-medium text-ink-900">{p.productName ?? p.pageTitle ?? '제품명 없음'}</div>
                </td>
                <td className="px-2 py-2">{p.country ? <span title={p.countryBasis ?? ''}>{p.country}</span> : MISSING}</td>
                <td className="px-2 py-2">{p.category ?? MISSING}</td>
                <td className="px-2 py-2 tabular-nums">{regular ?? MISSING}</td>
                <td className="px-2 py-2 tabular-nums">{p.salePriceText ?? MISSING}</td>
                <td className="px-2 py-2 tabular-nums">
                  {x.size ? `${x.size.value}${x.size.unit}` : MISSING}
                  {x.size?.converted && <div className="text-[10px] text-slate-400">{p.volumeText}에서 환산</div>}
                </td>
                <td className="px-2 py-2 tabular-nums">{fmtKrw(x.per100Krw) ?? <span className="text-[11px] text-slate-400">계산 불가</span>}</td>
                <td className="max-w-[160px] px-2 py-2 text-slate-600">{p.keyIngredients?.length ? p.keyIngredients.join(', ') : MISSING}</td>
                <td className="max-w-[220px] px-2 py-2 text-slate-600">{p.usp?.length ? p.usp.map((u) => <div key={u}>&ldquo;{u}&rdquo;</div>) : MISSING}</td>
                <td className="px-2 py-2">
                  <div className="font-semibold tabular-nums text-ink-900">{x.relevance}</div>
                  <div className="text-[10px] text-slate-400">{CRITERIA.filter((c) => x.match[c.key]).map((c) => c.label).join('·') || '일치 없음'}</div>
                </td>
                <td className="px-2 py-2">
                  <a href={p.finalUrl || p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 break-all text-sky-700 hover:underline">
                    <ExternalLink size={10} className="shrink-0" /> {p.domain}
                  </a>
                  <div className="text-[10px] text-slate-400">{fmtDate(p.collectedAt)} 수집</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
