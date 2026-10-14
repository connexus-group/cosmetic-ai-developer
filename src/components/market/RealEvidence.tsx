import { useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CircleSlash, Database, ExternalLink, KeyRound, RefreshCw } from 'lucide-react';
import { Button, KindBadge, Section } from '@/components/ui';
import { fetchMarketData, fetchMarketStatus, MarketDataError, queryFromBlueprint, type MarketDataResult, type MarketObservation } from '@/data/marketData';
import { fetchTradeData, fmtUsd, type TradeResult } from '@/data/tradeData';
import type { Blueprint } from '@/data/types';
import { Notice, Spinner, StatementRow } from './RealMarketData';

type Load<T> = { state: 'loading' } | { state: 'error'; code: string; message: string } | { state: 'done'; data: T };
const errOf = (e: unknown) => ({ state: 'error' as const, code: e instanceof MarketDataError ? e.code : 'ERROR', message: e instanceof Error ? e.message : '알 수 없는 오류' });

/**
 * Korea's export values by destination (UN Comtrade, free, no key) for the selected sales countries.
 * Real customs statistics for the whole HS heading, with source, period, collection date and link.
 */
export function TradeExports({ category, markets }: { category: string; markets: string[] }) {
  const [load, setLoad] = useState<Load<TradeResult>>({ state: 'loading' });
  const [showTop, setShowTop] = useState(false);
  const key = JSON.stringify([category, markets]);
  const run = (refresh = false) => {
    setLoad({ state: 'loading' });
    fetchTradeData(category, markets, { refresh }).then((data) => setLoad({ state: 'done', data }), (e: unknown) => setLoad(errOf(e)));
  };
  useEffect(() => {
    run();
    // re-run when the category or selected countries change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (load.state === 'loading') return <Spinner label="UN Comtrade에서 수출 통계를 가져오는 중" />;
  if (load.state === 'error')
    return (
      <Notice tone="error" icon={<AlertTriangle size={15} />} title={load.code === 'RATE_LIMIT' ? '무료 호출 한도 초과' : '수출 통계를 가져오지 못했습니다'}>
        {load.message}
        <div className="mt-1 flex items-center gap-2 text-xs">
          가상 수치로 대신 채우지 않았습니다.
          <button type="button" className="underline" onClick={() => run(true)}>
            다시 시도
          </button>
        </div>
      </Notice>
    );
  const d = load.data;
  if (d.status === 'NO_DATA')
    return (
      <Notice tone="empty" icon={<CircleSlash size={15} />} title="데이터 부족">
        이 품목의 최근 수출 통계가 아직 공개되지 않았습니다.
      </Notice>
    );
  const byId = new Map(d.observations.map((o) => [o.id, o]));
  return (
    <div className="space-y-3">
      {d.markets.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {d.markets.map((m) => (
            <div key={m.key} className="rounded-xl border border-sky-100 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                {m.label}
                {m.rank && <span className="text-sky-800">수출 {m.rank}위</span>}
              </div>
              {m.value === null ? (
                <div className="mt-1 text-sm text-slate-400">데이터 부족</div>
              ) : (
                <>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{fmtUsd(m.value)}</div>
                  <div className="text-[11px] text-slate-500">
                    {d.latest}년 · 전체 수출의 {m.share}%
                    {m.change !== null && (
                      <span className={clsx('ml-1 font-semibold', m.change >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        전년 대비 {m.change >= 0 ? '+' : ''}
                        {m.change}%
                      </span>
                    )}
                  </div>
                  {m.members > 1 && m.reported < m.members && <div className="text-[10px] text-amber-700">{m.members}개국 중 {m.reported}개국 값만 합산</div>}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">선택한 판매 국가가 국내뿐이거나 수출 통계와 연결되지 않는 지역이에요. 아래 전체 수출 상위 국가를 참고하세요.</p>
      )}
      {d.unmatchedMarkets.length > 0 && <p className="text-[11px] text-slate-400">수출 통계와 연결하지 못한 지역: {d.unmatchedMarkets.join(', ')}</p>}
      <ul className="space-y-1.5">
        {d.statements.map((s) => (
          <StatementRow key={s.id} s={s} byId={byId} />
        ))}
        {d.gaps.map((g) => (
          <li key={g} className="text-sm text-slate-500">
            <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold">데이터 부족</span>
            {g}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setShowTop(!showTop)} className="text-xs font-semibold text-sky-800 underline underline-offset-2">
        {showTop ? '수출 상위 10개국 닫기' : `${d.latest}년 수출 상위 10개국 보기`}
      </button>
      {showTop && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-ink-50">
                <th className="py-1.5 pr-3 font-semibold">순위</th>
                <th className="py-1.5 pr-3 font-semibold">국가</th>
                <th className="py-1.5 pr-3 font-semibold">{d.latest}년 수출액</th>
                <th className="py-1.5 pr-3 font-semibold">비중</th>
                <th className="py-1.5 font-semibold">전년 대비</th>
              </tr>
            </thead>
            <tbody>
              {d.top.map((t) => (
                <tr key={t.code} className="border-b border-ink-50/70">
                  <td className="py-1.5 pr-3 tabular-nums">{t.rank}</td>
                  <td className="py-1.5 pr-3 font-medium text-ink-900">{t.name}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtUsd(t.value)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{t.share}%</td>
                  <td className="py-1.5 tabular-nums">{t.change === null ? '-' : `${t.change >= 0 ? '+' : ''}${t.change}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SourceBox
        rows={[
          ['출처', d.source.name],
          ['조사 기간', d.years.length ? `${d.years.at(-1)}년 ~ ${d.years[0]}년 (연간)` : '-'],
          ['국가', '대한민국 → 수입국'],
          ['수집일', `${new Date(d.fetchedAt).toLocaleString('ko-KR')}${d.fromCache === 'database' ? ' · 저장된 수집 결과' : d.fromCache === 'memory' ? ' · 캐시' : ''}`],
          ['품목', d.source.hsLabel],
          ['단위', d.source.unit],
        ]}
        definition={d.source.definition}
        links={[['UN Comtrade', d.source.url]]}
        footer={`비용 없음 (키 없는 공개 API) · 저장소 ${d.storage === 'saved' ? 'Supabase 저장됨' : d.storage === 'error' ? '저장 실패' : '미설정'}`}
      />
      <div className="flex justify-end">
        <Button className="px-2.5 py-1 text-xs" onClick={() => run(true)}>
          <RefreshCw size={12} /> 새로 수집
        </Button>
      </div>
    </div>
  );
}

function SourceBox({ rows, definition, links, footer }: { rows: [string, ReactNode][]; definition: string; links: [string, string][]; footer?: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-sky-100 bg-sky-50/40 p-3 text-xs text-slate-600">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span className="font-semibold text-slate-700">{k}</span> {v}
          </div>
        ))}
        <div>
          <span className="font-semibold text-slate-700">원문 링크</span>{' '}
          {links.map(([label, url]) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 inline-flex items-center gap-0.5 text-sky-800 underline underline-offset-2">
              {label} <ExternalLink size={11} />
            </a>
          ))}
        </div>
      </div>
      <div>
        <span className="font-semibold text-slate-700">지표 정의</span> {definition}
      </div>
      {footer && <div className="text-[11px] text-slate-400">{footer}</div>}
    </div>
  );
}

const NAVER_METRICS = /_by_(age|gender)$|^keyword_click_index$/;

/** Naver DataLab evidence for the blueprint's target, benefits and ingredients (free key needed). */
function NaverEvidence({ bp }: { bp: Blueprint }) {
  const q = useMemo(() => queryFromBlueprint(bp), [bp]);
  const [load, setLoad] = useState<Load<MarketDataResult> | { state: 'nokey' } | { state: 'noserver'; message: string }>({ state: 'loading' });
  const key = JSON.stringify(q);
  useEffect(() => {
    let alive = true;
    setLoad({ state: 'loading' });
    fetchMarketStatus().then(
      (s) => {
        if (!alive) return;
        if (s.sources.find((x) => x.id === 'naver-datalab-shopping')?.status !== 'connected') return setLoad({ state: 'nokey' });
        fetchMarketData({ ...q, idea: bp.idea }).then((data) => alive && setLoad({ state: 'done', data }), (e: unknown) => alive && setLoad(errOf(e)));
      },
      (e: Error) => {
        if (alive) setLoad({ state: 'noserver', message: e.message });
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (load.state === 'loading') return <Spinner label="네이버 데이터랩 확인 중" />;
  if (load.state === 'noserver')
    return (
      <Notice tone="error" icon={<AlertTriangle size={15} />} title="서버 API 연결 실패">
        {load.message}
      </Notice>
    );
  if (load.state === 'nokey')
    return (
      <Notice tone="empty" icon={<KeyRound size={15} />} title="아직 데이터 없음 · 네이버 무료 키가 필요해요">
        네이버 데이터랩 키를 넣으면 "{q.keywords.join(', ') || q.category}" 키워드의 실제 클릭 추이와 연령·성별 관심도가 여기에 표시돼요. 키 발급은 무료입니다.
      </Notice>
    );
  if (load.state === 'error')
    return (
      <Notice tone="error" icon={<AlertTriangle size={15} />} title={load.code === 'RATE_LIMIT' ? '호출 한도 초과' : '데이터를 가져오지 못했습니다'}>
        {load.message}
      </Notice>
    );
  const d = load.data;
  const byId = new Map<string, MarketObservation>(d.observations.map((o) => [o.id, o]));
  const rows = d.findings.statements.filter((s) => s.observationIds.some((id) => NAVER_METRICS.test(byId.get(id)?.metricName ?? '')));
  return (
    <div className="space-y-2">
      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.map((s) => (
            <StatementRow key={s.id} s={s} byId={byId} />
          ))}
        </ul>
      ) : (
        <Notice tone="empty" icon={<CircleSlash size={15} />} title="데이터 부족">
          조회한 키워드의 클릭 데이터가 없습니다.
        </Notice>
      )}
      <SourceBox
        rows={[
          ['출처', d.source.name],
          ['조사 기간', `${d.query.startDate} ~ ${d.query.endDate} (월별)`],
          ['국가', '대한민국 (KR)'],
          ['수집일', new Date(d.fetchedAt).toLocaleString('ko-KR')],
          ['단위', d.source.unit],
        ]}
        definition="네이버쇼핑에서 검색 후 클릭한 양의 상대지표입니다. 판매량, 매출, 구매자 비율이 아닙니다."
        links={[
          ['데이터랩 쇼핑인사이트', d.source.url],
          ['API 문서', d.source.docsUrl],
        ]}
      />
    </div>
  );
}

const NO_SOURCE = ['차별화 포인트', '제형 및 사용감', '용량 및 패키지', '목표 제조원가', '예상 초도 생산수량'];

/**
 * "실제 데이터 근거" under the AI Product Blueprint. Shows real collected values next to the
 * draft without overwriting it: items with a free official source get the data, the rest say so.
 */
export function BlueprintEvidence({ bp }: { bp: Blueprint }) {
  const val = (k: string) => (bp.entries[k]?.origin === 'UNDETERMINED' ? '' : (bp.entries[k]?.value ?? ''));
  const markets = val('markets').split(/[,·/]/).map((x) => x.trim()).filter(Boolean);
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Database size={15} className="text-sky-700" /> 실제 데이터 근거
        </span>
      }
      subtitle="위 기획안의 값을 바꾸지 않고, 확인할 수 있는 실제 공식 데이터만 옆에 보여 줘요 · 모두 무료 데이터"
      action={<KindBadge kind="EXTERNAL" />}
      className="mt-4 border-sky-100"
    >
      <div className="space-y-5">
        <Item title="주요 판매 국가" sub="한국 화장품의 국가별 실제 수출액 · UN Comtrade (키 불필요)">
          <TradeExports category={val('category') || '스킨케어'} markets={markets} />
        </Item>
        <Item title="타깃 소비자 · 핵심 효능 · 핵심 원료" sub="네이버쇼핑 검색 클릭 추이와 연령·성별 관심도 · 네이버 데이터랩 (무료 키 필요)">
          <NaverEvidence bp={bp} />
        </Item>
        <Item title="실제 데이터가 없는 항목" sub="무료로 쓸 수 있는 공식 데이터가 없어 위의 데모 제안을 그대로 두었어요">
          <div className="flex flex-wrap gap-1.5">
            {NO_SOURCE.map((n) => (
              <span key={n} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {n} · 데이터 부족
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">원가와 초도 수량은 제조사 견적으로, 제형과 패키지는 샘플 테스트로 확인해야 하는 값이에요.</p>
        </Item>
      </div>
    </Section>
  );
}

function Item({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-[13px] font-semibold text-ink-900">{title}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
      {children}
    </div>
  );
}

/** Market screen block: real export statistics for the project's sales countries. */
export function TradeSection({ category, markets }: { category: string; markets: string[] }) {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Database size={15} className="text-sky-700" /> 실제 데이터 · 한국 화장품 국가별 수출액
        </span>
      }
      subtitle="UN Comtrade 공식 무역통계 · 키 없이 무료 · 품목 전체 수출액이며 특정 제품 매출이 아닙니다"
      action={<KindBadge kind="EXTERNAL" />}
      className="border-sky-100"
    >
      <TradeExports category={category} markets={markets} />
    </Section>
  );
}
