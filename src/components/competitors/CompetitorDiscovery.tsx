import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ChevronDown, ChevronUp, Coins, Search, Sparkles } from 'lucide-react';
import { Button, KindBadge, Section } from '@/components/ui';
import { Notice, Spinner } from '@/components/market/RealMarketData';
import { collectCompetitors, CompetitorDataError, discoverCompetitors, fetchDiscoveryStatus, type Candidate, type CollectResult, type DiscoveryResult, type DiscoveryStatus, type IdeaAttributes } from '@/data/competitorProducts';
import { publishProducts, sameUrl } from '@/data/competitorStore';
import { marketLabel } from '@/data/intakeSpec';
import { buildQueries, ideaAttributes, searchCredits, type AttrKey, type AttrSource } from '@/lib/competitorAnalysis';
import { useProject } from '@/pages/project/ProjectLayout';

const LIMIT = 10;
const DEFAULT_PICK = 5;
const MAX_PICK = 10;

type Run = { state: 'idle' } | { state: 'busy'; label: string } | { state: 'error'; code: string; message: string };

const MATCH_LABEL: Record<keyof Candidate['matches'], string> = { category: '유형', benefit: '효능', ingredient: '원료', target: '타깃', market: '국가' };

/**
 * Auto competitor discovery: idea attributes → Firecrawl search → candidate filter → user picks → collect.
 * Search results are candidates only; nothing reaches the comparison until its page is collected.
 */
export function CompetitorDiscovery() {
  const { project, update } = useProject();
  const initial = useMemo(() => ideaAttributes(project), [project]);
  const [attrs, setAttrs] = useState<IdeaAttributes>(initial.attrs);
  const [edited, setEdited] = useState<Partial<Record<AttrKey, true>>>({});
  const [market, setMarket] = useState(initial.attrs.markets[0] ?? 'KR');
  const [queries, setQueries] = useState<string[]>(() => buildQueries(initial.attrs, initial.attrs.markets[0] ?? 'KR'));
  const [queriesEdited, setQueriesEdited] = useState(false);
  const [status, setStatus] = useState<{ s?: DiscoveryStatus; err?: string }>({});
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [run, setRun] = useState<Run>({ state: 'idle' });
  const [collected, setCollected] = useState<CollectResult | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchDiscoveryStatus().then(
      (s) => alive && setStatus({ s }),
      (e: Error) => alive && setStatus({ err: e.message }),
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!queriesEdited) setQueries(buildQueries(attrs, market));
  }, [attrs, market, queriesEdited]);

  const s = status.s;
  const setAttr = <K extends keyof IdeaAttributes>(k: K, v: IdeaAttributes[K]) => {
    setAttrs((a) => ({ ...a, [k]: v }));
    setEdited((e) => ({ ...e, [k]: true }));
  };
  const src = (k: AttrKey): AttrSource | '수정함' => (edited[k] ? '수정함' : initial.sources[k]);
  const liveQueries = queries.map((q) => q.trim()).filter((q) => q.length >= 2).slice(0, 3);
  const searchCost = liveQueries.length * searchCredits(LIMIT);
  const perProduct = s?.costs.perProduct ?? 5;
  const remaining = s?.usage ? Math.max(0, (s.costs.freeMonthly ?? 1000) - s.usage.total) : null;
  const locations = s?.locations ?? { KR: 'South Korea' };
  const marketOptions = [...new Set([...attrs.markets, 'KR', 'US', 'JP'])].filter((m) => locations[m]);

  const search = (refresh: boolean) => {
    setRun({ state: 'busy', label: 'Firecrawl로 검색한 뒤 판매 페이지만 골라 robots.txt를 확인하는 중' });
    setCollected(null);
    discoverCompetitors({ attributes: attrs, market, queries: liveQueries, limit: LIMIT, refresh }).then(
      (r) => {
        setResult(r);
        setPicked(r.candidates.filter((c) => !c.excluded).slice(0, DEFAULT_PICK).map((c) => c.url));
        setRun({ state: 'idle' });
        fetchDiscoveryStatus().then((st) => setStatus({ s: st }), () => undefined);
      },
      (e: unknown) => setRun({ state: 'error', code: e instanceof CompetitorDataError ? e.code : 'ERROR', message: e instanceof Error ? e.message : '알 수 없는 오류' }),
    );
  };

  const collect = () => {
    const urls = picked.slice(0, MAX_PICK);
    if (!urls.length) return;
    setRun({ state: 'busy', label: `선택한 ${urls.length}개 페이지를 robots.txt 확인 후 수집하는 중 (페이지당 최대 1분)` });
    collectCompetitors(urls, false).then(
      (r) => {
        setCollected(r);
        publishProducts(r.results.flatMap((x) => (x.product ? [x.product] : [])));
        const ok = r.results.filter((x) => x.product).map((x) => x.url);
        update((p) => {
          const prev = p.competitorUrls ?? [];
          return { ...p, competitorUrls: [...prev, ...ok.filter((u) => !prev.some((v) => sameUrl(u, v)))] };
        });
        setRun({ state: 'idle' });
        fetchDiscoveryStatus().then((st) => setStatus({ s: st }), () => undefined);
      },
      (e: unknown) => setRun({ state: 'error', code: e instanceof CompetitorDataError ? e.code : 'ERROR', message: e instanceof Error ? e.message : '알 수 없는 오류' }),
    );
  };

  const busy = run.state === 'busy';
  const quota = run.state === 'error' && run.code === 'QUOTA';
  const allowed = result?.candidates.filter((c) => !c.excluded) ?? [];
  const excluded = result?.candidates.filter((c) => c.excluded) ?? [];

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Search size={15} className="text-sky-700" /> 경쟁제품 자동 탐색
        </span>
      }
      subtitle="제품 아이디어로 검색해 비슷한 제품의 공식 판매 페이지를 찾고, 고른 페이지만 실제로 수집합니다"
      action={s?.firecrawl.configured ? <KindBadge kind="EXTERNAL" /> : <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">미연결</span>}
      className="border-sky-100"
    >
      {status.err ? (
        <Notice tone="error" icon={<AlertTriangle size={15} />} title="서버 API 연결 실패">
          {status.err}
        </Notice>
      ) : !s ? (
        <Spinner label="연결 상태 확인 중" />
      ) : !s.firecrawl.configured ? (
        <Notice tone="empty" icon={<AlertTriangle size={15} />} title="Firecrawl 미연결 · 검색하지 않았습니다">
          서버에 <code>FIRECRAWL_API_KEY</code>가 없어 자동 탐색을 쓸 수 없습니다. 아래 &ldquo;실제 수집 제품&rdquo;의 설정 안내를 따라 연결하세요.
        </Notice>
      ) : (
        <div className="space-y-5">
          {/* 1. attributes */}
          <div className="rounded-xl bg-ink-50/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-800">
              <Sparkles size={13} /> 1. 아이디어 속성 <span className="font-normal text-slate-500">(기획 입력에서 가져옴 · 고쳐서 검색할 수 있어요 · AI 호출 없음)</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <AttrInput label="카테고리" source={src('category')} value={attrs.category} onChange={(v) => setAttr('category', v)} />
              <AttrInput label="제품 유형" source={src('subtype')} value={attrs.subtype} onChange={(v) => setAttr('subtype', v)} />
              <AttrInput label="효능 (쉼표로 구분)" source={src('benefits')} value={attrs.benefits.join(', ')} onChange={(v) => setAttr('benefits', splitComma(v))} />
              <AttrInput label="타깃" source={src('target')} value={attrs.target} onChange={(v) => setAttr('target', v)} />
              <AttrInput label="원료 키워드 (쉼표로 구분)" source={src('ingredients')} value={attrs.ingredients.join(', ')} onChange={(v) => setAttr('ingredients', splitComma(v))} />
              <AttrInput label="목표 판매가 (원)" source={src('targetPrice')} value={attrs.targetPrice ? String(attrs.targetPrice) : ''} onChange={(v) => setAttr('targetPrice', Number(v.replace(/[^\d]/g, '')) || null)} />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              판매 국가: {attrs.markets.map(marketLabel).join(', ')} <span className="text-slate-400">({src('markets') === '없음' ? '입력 없음 · 대한민국 기본값' : src('markets')})</span>
            </div>
          </div>

          {/* 2. queries + cost */}
          <div className="rounded-xl border border-ink-50 p-3">
            <div className="mb-2 text-xs font-semibold text-ink-800">2. 검색어와 예상 크레딧</div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] font-semibold text-slate-500">
                검색 국가
                <select className="mt-1 block rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-xs" value={market} onChange={(e) => setMarket(e.target.value)}>
                  {marketOptions.map((m) => (
                    <option key={m} value={m}>
                      {marketLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              {[0, 1, 2].map((i) => (
                <label key={i} className="min-w-[180px] flex-1 text-[11px] font-semibold text-slate-500">
                  검색어 {i + 1}
                  <input
                    className="mt-1 block w-full rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-xs text-ink-900"
                    value={queries[i] ?? ''}
                    placeholder={i === 2 ? '(선택)' : ''}
                    onChange={(e) => {
                      const next = [...queries];
                      next[i] = e.target.value;
                      setQueries(next);
                      setQueriesEdited(true);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" disabled={busy || quota || !liveQueries.length} onClick={() => search(false)}>
                후보 찾기
              </Button>
              <Button disabled={busy || quota || !liveQueries.length} onClick={() => search(true)}>
                새로 검색
              </Button>
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Coins size={12} /> 검색 {liveQueries.length}회 × {searchCredits(LIMIT)} = 최대 {searchCost} 크레딧 · 24시간 안의 같은 검색은 저장값 사용(0 크레딧) · 이후 제품 1개 수집당 {perProduct} 크레딧
              </span>
            </div>
            <UsageLine s={s} remaining={remaining} />
          </div>

          {busy && <Spinner label={run.label} />}
          {run.state === 'error' && (
            <Notice tone="error" icon={<AlertTriangle size={15} />} title={quota ? '이번 달 무료 크레딧 소진 · 중단했습니다' : '진행하지 못했습니다'}>
              {run.message}
              <div className="mt-1 text-xs">가상 후보나 가상 제품으로 대신 채우지 않았습니다.</div>
            </Notice>
          )}

          {/* 3. candidates */}
          {result && (
            <div className="rounded-xl border border-ink-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink-800">
                  3. 후보 {allowed.length}개 <span className="font-normal text-slate-500">(제외 {excluded.length}개)</span>
                </span>
                <span className="text-slate-500">
                  {result.runs.map((r) => `"${r.query}" ${r.results}건${r.fromCache ? ' · 저장값' : ''}`).join(' · ')} · 이번 사용 {result.creditsUsed} 크레딧
                </span>
              </div>
              <p className="mb-2 flex items-start gap-1 text-[11px] text-slate-500">
                <KindBadge kind="AI_ESTIMATE" /> {result.scoreNote}
              </p>
              {result.warnings.map((w) => (
                <div key={w} className="mb-1 text-[11px] text-amber-700">
                  {w}
                </div>
              ))}
              {allowed.length ? (
                <ul className="divide-y divide-ink-50">
                  {allowed.map((c) => (
                    <CandidateRow key={c.url} c={c} checked={picked.includes(c.url)} disabled={!picked.includes(c.url) && picked.length >= MAX_PICK} onToggle={() => setPicked((x) => (x.includes(c.url) ? x.filter((u) => u !== c.url) : [...x, c.url]))} />
                  ))}
                </ul>
              ) : (
                <Notice tone="empty" icon={<Search size={15} />} title="수집할 수 있는 후보가 없습니다">
                  검색 결과가 모두 제외됐습니다. 검색어를 바꾸거나 브랜드 공식몰 URL을 아래에 직접 입력하세요.
                </Notice>
              )}
              {result.unchecked > 0 && <div className="mt-1 text-[11px] text-slate-400">하위 {result.unchecked}개 후보는 robots.txt를 아직 확인하지 않았습니다. 수집할 때 다시 확인합니다.</div>}
              {allowed.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="primary" disabled={busy || quota || !picked.length} onClick={collect}>
                    선택한 {picked.length}개 수집
                  </Button>
                  <span className="text-[11px] text-slate-500">
                    최대 {picked.length * perProduct} 크레딧 (한 번에 {MAX_PICK}개까지) · 24시간 안에 수집한 페이지는 저장값을 다시 써서 0 크레딧
                    {remaining !== null && picked.length * perProduct > remaining && <b className="ml-1 text-rose-700">이번 달 남은 크레딧({remaining})보다 많습니다</b>}
                  </span>
                </div>
              )}
              {excluded.length > 0 && (
                <div className="mt-3">
                  <button type="button" className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-ink-700" onClick={() => setShowExcluded(!showExcluded)}>
                    제외된 결과 {excluded.length}개와 이유 {showExcluded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showExcluded && (
                    <ul className="mt-1 space-y-1">
                      {excluded.map((c) => (
                        <li key={c.url} className="text-[11px] text-slate-500">
                          <span className="break-all">{c.domain}</span> · {c.excluded}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {collected && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-slate-700">
              <b className="text-ink-800">수집 결과</b> · 예상 사용 {collected.creditsUsedEstimate} 크레딧 ·{' '}
              {collected.results.map((r) => `${shortHost(r.url)} ${r.status === 'OK' ? '수집' : r.status === 'CACHED' ? '저장값' : r.status === 'BLOCKED' ? '접근 제한' : r.status === 'NO_DATA' ? '데이터 없음' : r.status === 'SKIPPED' ? '건너뜀' : '오류'}`).join(' · ')}
              <div className="mt-1 text-slate-500">수집된 제품은 아래 &ldquo;실제 수집 제품&rdquo; 목록과 비교 분석에 추가됐습니다.</div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

const splitComma = (v: string) => v.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
const shortHost = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

function AttrInput({ label, source, value, onChange }: { label: string; source: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-[11px] font-semibold text-slate-500">
      <span className="flex items-center justify-between gap-1">
        {label} <span className={clsx('font-normal', source === '없음' ? 'text-slate-400' : 'text-sky-700')}>{source === '없음' ? '입력 없음' : source}</span>
      </span>
      <input className="mt-1 block w-full rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-xs text-ink-900 outline-none focus:border-ink-300" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function UsageLine({ s, remaining }: { s: DiscoveryStatus; remaining: number | null }) {
  if (!s.storage.supabase) return <div className="mt-2 text-[11px] text-slate-400">Supabase 미연결이라 이번 달 사용량을 기록하지 못합니다. 정확한 잔여 크레딧은 Firecrawl 대시보드에서 확인하세요.</div>;
  if (!s.usage) return <div className="mt-2 text-[11px] text-amber-700">사용량 기록을 읽지 못했습니다{s.usageError ? `: ${s.usageError}` : ''}. 새 마이그레이션(20261014120000_competitor_discovery.sql)을 실행했는지 확인하세요.</div>;
  return (
    <div className="mt-2 text-[11px] text-slate-500">
      이번 달 이 앱이 기록한 사용량 {s.usage.total} 크레딧 (검색 {s.usage.search} · 수집 {s.usage.scrape}) · 무료 {s.costs.freeMonthly} 기준 남은 추정 {remaining} · 정확한 값은 Firecrawl 대시보드 기준
    </div>
  );
}

function CandidateRow({ c, checked, disabled, onToggle }: { c: Candidate; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-start gap-2 py-2">
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={onToggle} aria-label={`${c.title} 선택`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-ink-900">{c.title || c.domain}</span>
          <a href={c.url} target="_blank" rel="noreferrer" className="break-all text-[11px] text-sky-700 hover:underline">
            {c.domain}
          </a>
        </div>
        {c.description && <div className="line-clamp-2 text-[11px] text-slate-500">{c.description}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {(Object.keys(MATCH_LABEL) as (keyof Candidate['matches'])[]).map((k) => (
            <span key={k} className={clsx('rounded-full px-1.5 py-0.5 text-[10px]', c.matches[k] ? 'bg-sky-50 text-sky-800' : 'bg-slate-50 text-slate-400')}>
              {MATCH_LABEL[k]} {c.matches[k] ? '일치' : '-'}
            </span>
          ))}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-ink-900">{c.score}</div>
        <div className="text-[10px] text-slate-400">관련성 추정</div>
      </div>
    </li>
  );
}
