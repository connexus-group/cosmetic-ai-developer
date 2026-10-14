import { Fragment, useEffect, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Database, ExternalLink, Globe, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button, KindBadge, Section } from '@/components/ui';
import { Notice, Spinner } from '@/components/market/RealMarketData';
import { collectCompetitors, CompetitorDataError, fetchCompetitorStatus, parseUrlList, type CollectResult, type CompetitorProduct, type CompetitorStatus, type FieldStatus, type ItemResult } from '@/data/competitorProducts';
import { publishProducts, sameUrl, useCollectedProducts } from '@/data/competitorStore';
import { useProject } from '@/pages/project/ProjectLayout';

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
};

const ITEM_LABEL: Record<ItemResult['status'], { text: string; cls: string }> = {
  OK: { text: '수집 완료', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  CACHED: { text: '저장값 사용', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  BLOCKED: { text: '수집 안 함 (접근 제한)', cls: 'bg-slate-100 text-slate-700 ring-slate-200' },
  NO_DATA: { text: '데이터 없음', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ERROR: { text: '오류', cls: 'bg-rose-50 text-rose-800 ring-rose-200' },
  SKIPPED: { text: '건너뜀', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  INVALID: { text: '잘못된 URL', cls: 'bg-rose-50 text-rose-800 ring-rose-200' },
};

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'error'; code: string; message: string } | { state: 'done'; data: CollectResult };

/**
 * REAL DATA block for the Competitors screen. Shows only products collected from public product
 * pages through Firecrawl and stored in Supabase, each with its original URL and collection date.
 * Fields that are not printed on the page stay empty. Demo competitors below are never mixed in.
 */
export function RealCompetitorProducts() {
  const { project, update } = useProject();
  const saved = project.competitorUrls ?? [];
  const [draft, setDraft] = useState(saved.join('\n'));
  const [status, setStatus] = useState<{ s?: CompetitorStatus; err?: string }>({});
  const [load, setLoad] = useState<Load>({ state: 'idle' });

  useEffect(() => {
    let alive = true;
    fetchCompetitorStatus(saved).then(
      (s) => {
        publishProducts(s.products);
        if (alive) setStatus({ s });
      },
      (e: Error) => alive && setStatus({ err: e.message }),
    );
    return () => {
      alive = false;
    };
    // load once per screen; later loads come from the buttons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (refresh: boolean) => {
    const urls = parseUrlList(draft).slice(0, status.s?.maxUrls ?? 10);
    setDraft(urls.join('\n'));
    update((p) => ({ ...p, competitorUrls: urls }));
    if (!urls.length) return setLoad({ state: 'error', code: 'BAD_REQUEST', message: '수집할 제품 페이지 URL을 한 줄에 하나씩 입력하세요.' });
    setLoad({ state: 'loading' });
    collectCompetitors(urls, refresh).then(
      (data) => {
        publishProducts(data.results.flatMap((r) => (r.product ? [r.product] : [])));
        setLoad({ state: 'done', data });
      },
      (e: unknown) => setLoad({ state: 'error', code: e instanceof CompetitorDataError ? e.code : 'ERROR', message: e instanceof Error ? e.message : '알 수 없는 오류' }),
    );
  };

  // URLs added by the auto discovery above show up in the list too
  const urlKey = (project.competitorUrls ?? []).join('\n');
  useEffect(() => {
    setDraft((d) => {
      const cur = parseUrlList(d);
      const add = (project.competitorUrls ?? []).filter((u) => !cur.some((c) => sameUrl(c, u)));
      return add.length ? [...cur, ...add].join('\n') : d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  /** stored rows and anything collected in this session (shared store); only URLs still in the list */
  const products = useCollectedProducts(project.competitorUrls);

  const s = status.s;
  const connected = s?.firecrawl.configured === true;

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Database size={15} className="text-sky-700" /> 실제 수집 제품 · Firecrawl
        </span>
      }
      subtitle="공개된 경쟁제품 페이지에서 직접 수집한 제품명·가격·용량·전성분 · 페이지에 적힌 값만 표시합니다"
      action={connected ? <KindBadge kind="EXTERNAL" /> : <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">미연결</span>}
      className="border-sky-100"
    >
      {status.err ? (
        <Notice tone="error" icon={<AlertTriangle size={15} />} title="서버 API 연결 실패">
          {status.err}
        </Notice>
      ) : !s ? (
        <Spinner label="Firecrawl·Supabase 연결 상태 확인 중" />
      ) : (
        <div className="space-y-5">
          {!connected && <SetupGuide supabase={s.storage.supabase} />}
          {connected && !s.storage.supabase && (
            <Notice tone="warn" icon={<AlertTriangle size={15} />} title="Supabase 미연결 · 수집 결과가 저장되지 않습니다">
              수집은 되지만 저장되지 않아 화면을 다시 열면 사라집니다. <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>를 설정하고 <code>supabase/migrations/20261014000000_competitor_products.sql</code>을 실행하세요.
            </Notice>
          )}
          {s.storageError && (
            <Notice tone="warn" icon={<AlertTriangle size={15} />} title="저장된 제품을 불러오지 못했습니다">
              {s.storageError}
            </Notice>
          )}
          {connected && (
            <UrlForm draft={draft} setDraft={setDraft} busy={load.state === 'loading'} max={s.maxUrls} credits={s.firecrawl.creditsPerPage} cacheHours={s.cacheHours} onCollect={() => run(false)} onRefresh={() => run(true)} />
          )}
          {load.state === 'loading' && <Spinner label="robots.txt 확인 후 Firecrawl로 제품 페이지를 수집하는 중 (페이지당 최대 1분)" />}
          {load.state === 'error' && (
            <Notice tone="error" icon={<AlertTriangle size={15} />} title={load.code === 'NOT_CONFIGURED' ? 'Firecrawl 미연결' : '수집하지 못했습니다'}>
              {load.message}
              <div className="mt-1 text-xs">가상 데이터로 대신 채우지 않았습니다.</div>
            </Notice>
          )}
          {load.state === 'done' && <RunLog data={load.data} />}
          {products.length ? (
            <ProductTable products={products} />
          ) : (
            load.state !== 'loading' && (
              <Notice tone="empty" icon={<Globe size={15} />} title="표시할 실제 수집 제품이 없습니다">
                {connected ? '경쟁제품 공식 페이지 URL을 입력하고 수집하세요. 아래 섹션의 경쟁제품은 데모 데이터입니다.' : '연결 전이라 실제 수집 데이터가 없습니다. 아래 섹션의 경쟁제품은 모두 데모 데이터입니다.'}
              </Notice>
            )
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            수집 규칙: 이용약관상 자동 수집을 금지한 쇼핑몰(올리브영, 쿠팡, 11번가, 컬리, 화해 등)은 수집하지 않고, 그 밖의 사이트도 robots.txt가 허용한 페이지만 수집합니다. Firecrawl이 추출한 값 중 페이지 본문에서 같은 글자를 찾을 수 없는 값은 버리고 &ldquo;확인 안 됨&rdquo;으로 표시합니다. 가격은 수집 시점에 페이지에 표시된 값이며 이후 바뀔 수 있습니다.
          </p>
        </div>
      )}
    </Section>
  );
}


function SetupGuide({ supabase }: { supabase: boolean }) {
  return (
    <Notice tone="empty" icon={<KeyRound size={15} />} title="아직 연결되지 않았습니다 · 실제 데이터 없음">
      <p>Firecrawl API Key가 서버에 설정되지 않아 실제 제품 페이지를 수집하지 않았습니다. 이 화면의 아래 경쟁제품은 모두 데모 데이터입니다.</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
        <li>
          <a className="underline" href="https://www.firecrawl.dev" target="_blank" rel="noreferrer">
            firecrawl.dev
          </a>
          에 가입합니다 (무료 플랜: 월 1,000 크레딧, 카드 불필요). 대시보드 → API Keys에서 키를 복사합니다.
        </li>
        <li>
          Vercel → Settings → Environment Variables에 <code>FIRECRAWL_API_KEY</code>를 넣고 다시 배포합니다. (로컬은 <code>.env.local</code>)
        </li>
        {!supabase && (
          <li>
            저장용으로{' '}
            <a className="underline" href="https://supabase.com" target="_blank" rel="noreferrer">
              Supabase
            </a>{' '}
            무료 프로젝트를 만들고 SQL Editor에서 <code>supabase/migrations/20261014000000_competitor_products.sql</code>을 실행한 뒤 <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>(Project Settings → API)를 같은 곳에 넣습니다.
          </li>
        )}
      </ol>
    </Notice>
  );
}

function UrlForm({ draft, setDraft, busy, max, credits, cacheHours, onCollect, onRefresh }: { draft: string; setDraft: (s: string) => void; busy: boolean; max: number; credits: number; cacheHours: number; onCollect: () => void; onRefresh: () => void }) {
  const n = parseUrlList(draft).length;
  return (
    <div className="space-y-2 rounded-xl bg-ink-50/60 p-3">
      <label className="block text-[11px] font-semibold text-slate-500">
        경쟁제품 페이지 URL (한 줄에 하나, 최대 {max}개 · 브랜드 공식몰 제품 상세 페이지 권장)
        <textarea
          className="mt-1 h-24 w-full rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 font-mono text-xs text-ink-900 outline-none focus:border-ink-300"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={'https://브랜드공식몰/product/...\nhttps://...'}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={busy || n === 0} onClick={onCollect}>
          수집하기 ({n}개)
        </Button>
        <Button disabled={busy || n === 0} onClick={onRefresh} className="flex items-center gap-1">
          <RefreshCw size={13} /> 다시 수집
        </Button>
        <span className="text-[11px] text-slate-500">
          페이지당 Firecrawl {credits} 크레딧 · {cacheHours}시간 안에 수집한 페이지는 저장값을 다시 씁니다 (크레딧 사용 없음)
        </span>
      </div>
    </div>
  );
}

function RunLog({ data }: { data: CollectResult }) {
  return (
    <div className="rounded-xl border border-ink-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="font-semibold text-ink-800">이번 수집 결과</span>
        <span>
          {fmtDateTime(data.collectedAt)} · 예상 사용 크레딧 {data.creditsUsedEstimate}
        </span>
      </div>
      <ul className="space-y-1.5">
        {data.results.map((r) => (
          <li key={r.url} className="flex flex-wrap items-start gap-2 text-xs">
            <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', ITEM_LABEL[r.status].cls)}>{ITEM_LABEL[r.status].text}</span>
            <span className="min-w-0 break-all text-slate-600">{r.url}</span>
            {r.status === 'OK' && r.stored && (
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={12} /> Supabase 저장됨
              </span>
            )}
            {r.message && (
              <span className="flex w-full items-start gap-1 pl-1 text-slate-500">
                {r.status === 'BLOCKED' && <ShieldAlert size={12} className="mt-0.5 shrink-0" />} {r.message}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Missing({ status }: { status: FieldStatus }) {
  return <span className="text-[11px] text-slate-400">{status === 'DROPPED' ? '확인 안 됨' : '페이지에 없음'}</span>;
}

/** price per ml, only when both values are real and comparable (same page, KRW, ml) */
const perMl = (p: CompetitorProduct) => (p.priceValue !== null && p.volumeValue && p.volumeUnit === 'ml' && p.currency === 'KRW' ? Math.round(p.priceValue / p.volumeValue) : null);

function ProductTable({ products }: { products: CompetitorProduct[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
            {['Product', 'Price (페이지 표기)', 'Size', 'Price/ml (계산)', 'Ingredients', 'Source', '수집일'].map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const ppm = perMl(p);
            const isOpen = open === p.id;
            return (
              <Fragment key={p.id}>
                <tr className="border-b border-ink-50 align-top">
                  <td className="px-2 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{p.brand ?? <Missing status={p.fieldStatus.brand} />}</div>
                    <div className="font-medium text-ink-900">{p.productName ?? <Missing status={p.fieldStatus.name} />}</div>
                    {!p.productName && p.pageTitle && <div className="text-[11px] text-slate-500">페이지 제목: {p.pageTitle}</div>}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{p.priceText ? <span title={`${p.priceValue} ${p.currency}`}>{p.priceText}</span> : <Missing status={p.fieldStatus.price} />}</td>
                  <td className="px-2 py-2 tabular-nums">{p.volumeText ?? <Missing status={p.fieldStatus.volume} />}</td>
                  <td className="px-2 py-2 tabular-nums text-slate-600">{ppm !== null ? `${ppm.toLocaleString('ko-KR')}원` : <span className="text-[11px] text-slate-400">계산 불가</span>}</td>
                  <td className="px-2 py-2">
                    {p.ingredients.length ? (
                      <button type="button" className="flex items-center gap-1 text-xs font-medium text-ink-700 underline-offset-2 hover:underline" onClick={() => setOpen(isOpen ? null : p.id)}>
                        전성분 {p.ingredients.length}개 {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    ) : (
                      <Missing status={p.fieldStatus.ingredients} />
                    )}
                    {p.ingredientsDropped > 0 && <div className="text-[10px] text-amber-700">페이지에서 확인 안 된 {p.ingredientsDropped}개 제외</div>}
                  </td>
                  <td className="px-2 py-2">
                    <a href={p.finalUrl || p.url} target="_blank" rel="noreferrer" className="flex max-w-[220px] items-center gap-1 break-all text-xs text-sky-700 hover:underline">
                      <ExternalLink size={11} className="shrink-0" /> {p.domain}
                    </a>
                    <div className="mt-0.5 text-[10px] text-slate-400">Firecrawl 수집</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-600">{fmtDateTime(p.collectedAt)}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-ink-50 bg-ink-50/40">
                    <td colSpan={7} className="px-3 py-2 text-xs leading-relaxed text-slate-700">
                      <span className="font-semibold text-ink-800">전성분 (페이지 표기 순서)</span> {p.ingredients.join(', ')}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Separates the real block above from the demo competitors below. */
export function CompetitorDemoNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <div>
        <b>여기부터는 데모 데이터입니다.</b> 아래 경쟁제품, 가격, 평점, 리뷰 수, 포지션은 화면 설명용 가상 값이며 실제 제품 정보가 아닙니다. 실제 수집 제품은 위의 &ldquo;실제 수집 제품 · Firecrawl&rdquo; 영역에만 표시됩니다.
      </div>
    </div>
  );
}
