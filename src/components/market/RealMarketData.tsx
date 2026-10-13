import { useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CircleSlash, Database, ExternalLink, KeyRound, Loader2, RefreshCw, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TipBox } from '@/components/charts';
import { Button, KindBadge, Section } from '@/components/ui';
import { defaultMarketQuery, fetchMarketData, fetchMarketStatus, MarketDataError, type MarketDataResult, type MarketDataStatus, type MarketObservation, type MarketQueryInput, type Statement } from '@/data/marketData';
import { ACCENT, AXIS, CHAMPAGNE, GRID, MUTED, SERIES } from '@/lib/colors';
import { useProject } from '@/pages/project/ProjectLayout';

type Focus = 'market' | 'consumer' | 'trend';
const COLORS = [...SERIES, ACCENT, CHAMPAGNE];
const AGE_KO: Record<string, string> = { '10': '10대', '20': '20대', '30': '30대', '40': '40대', '50': '50대', '60': '60대+' };
const GENDER_KO: Record<string, string> = { f: '여성', m: '남성' };
const KIND_KO: Record<string, string> = { finding: '발견', implication: '기획 시사점', risk: '주의', recommendation: '다음 확인' };
const FOCUS_TEXT: Record<Focus, string> = {
  market: '분야 전체와 키워드의 네이버쇼핑 클릭 추이',
  consumer: '연령별·성별 관심도 (클릭 상대지표)',
  trend: '키워드별 클릭 추이 비교',
};

const fmtDate = (iso: string) => iso.slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'error'; code: string; message: string } | { state: 'done'; data: MarketDataResult };

/**
 * REAL DATA block for Market / Consumer / Trend. Shows only values returned by the server
 * from an external source, with source, period, country, collection date, metric definition
 * and a link to the original. Errors and missing data are shown as such — never replaced by demo values.
 */
export function RealMarketData({ focus }: { focus: Focus }) {
  const { project, update } = useProject();
  const initial = project.marketQuery ?? defaultMarketQuery(project);
  const [query, setQuery] = useState<MarketQueryInput>(initial);
  const [draft, setDraft] = useState(initial.keywords.join(', '));
  const [status, setStatus] = useState<{ s?: MarketDataStatus; err?: string }>({});
  const [load, setLoad] = useState<Load>({ state: 'idle' });

  const run = (q: MarketQueryInput, refresh = false) => {
    setLoad({ state: 'loading' });
    fetchMarketData({ ...q, idea: project.idea }, { refresh }).then(
      (data) => setLoad({ state: 'done', data }),
      (e: unknown) => setLoad({ state: 'error', code: e instanceof MarketDataError ? e.code : 'ERROR', message: e instanceof Error ? e.message : '알 수 없는 오류' }),
    );
  };

  useEffect(() => {
    let alive = true;
    fetchMarketStatus().then(
      (s) => {
        if (!alive) return;
        setStatus({ s });
        if (s.sources.find((x) => x.id === 'naver-datalab-shopping')?.status === 'connected') run(query);
      },
      (e: Error) => {
        if (alive) setStatus({ err: e.message });
      },
    );
    return () => {
      alive = false;
    };
    // run once per screen; later runs come from the buttons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (refresh = false) => {
    const keywords = [...new Set(draft.split(',').map((k) => k.trim()).filter(Boolean))].slice(0, 5);
    const q = { ...query, keywords };
    setQuery(q);
    setDraft(keywords.join(', '));
    update((p) => ({ ...p, marketQuery: q }));
    run(q, refresh);
  };

  const naver = status.s?.sources.find((x) => x.id === 'naver-datalab-shopping');

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Database size={15} className="text-sky-700" /> 실제 데이터 · 네이버 데이터랩 쇼핑인사이트
        </span>
      }
      subtitle={`${FOCUS_TEXT[focus]} · 상대지표이며 판매량·매출·점유율이 아닙니다`}
      action={naver?.status === 'connected' ? <KindBadge kind="EXTERNAL" /> : <NotConnectedBadge />}
      className="border-sky-100"
    >
      {status.err ? (
        <Notice tone="error" icon={<AlertTriangle size={15} />} title="서버 API 연결 실패">
          {status.err}
        </Notice>
      ) : !status.s ? (
        <Spinner label="데이터 소스 연결 상태 확인 중" />
      ) : naver?.status !== 'connected' ? (
        <SetupGuide />
      ) : (
        <div className="space-y-5">
          <QueryForm query={query} setQuery={setQuery} draft={draft} setDraft={setDraft} busy={load.state === 'loading'} onSubmit={() => submit(false)} onRefresh={() => submit(true)} />
          {load.state === 'loading' && <Spinner label="네이버 데이터랩에서 데이터를 가져오는 중" />}
          {load.state === 'error' && (
            <Notice tone="error" icon={<AlertTriangle size={15} />} title={load.code === 'RATE_LIMIT' ? '호출 한도 초과' : load.code === 'AUTH' ? 'API 인증 실패' : '데이터를 가져오지 못했습니다'}>
              {load.message}
              <div className="mt-1 text-xs">가상 수치로 대신 채우지 않았습니다.{load.code === 'RATE_LIMIT' ? ' 한도가 초기화된 뒤 다시 조회하세요.' : ''}</div>
            </Notice>
          )}
          {load.state === 'done' && <Result data={load.data} focus={focus} />}
        </div>
      )}
      {focus === 'market' && status.s && <SourceList status={status.s} />}
    </Section>
  );
}

const NotConnectedBadge = () => <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">미연결</span>;

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

function Notice({ tone, icon, title, children }: { tone: 'error' | 'empty' | 'warn'; icon: ReactNode; title: string; children: ReactNode }) {
  const cls = tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={clsx('rounded-xl border px-4 py-3 text-sm', cls)}>
      <div className="flex items-center gap-1.5 font-semibold">
        {icon} {title}
      </div>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}

function SetupGuide() {
  return (
    <Notice tone="empty" icon={<KeyRound size={15} />} title="아직 연결되지 않았습니다 · 실제 데이터 없음">
      <p>네이버 데이터랩 API Key가 서버에 설정되지 않아 실제 데이터를 가져오지 않았습니다. 이 화면의 아래 수치는 모두 데모 데이터입니다.</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
        <li>
          <a className="underline" href="https://developers.naver.com/apps/#/register" target="_blank" rel="noreferrer">
            네이버 개발자센터
          </a>
          에서 애플리케이션을 등록하고 사용 API에 <b>데이터랩(쇼핑인사이트)</b>을 추가합니다.
        </li>
        <li>
          Vercel → Settings → Environment Variables에 <code>NAVER_CLIENT_ID</code>, <code>NAVER_CLIENT_SECRET</code>을 넣고 다시 배포합니다. (로컬은 <code>.env.local</code>)
        </li>
        <li>NAVER Cloud의 NAVER API HUB 키를 쓰면 <code>NAVER_DATALAB_GATEWAY=apihub</code>도 함께 넣습니다.</li>
      </ol>
    </Notice>
  );
}

function QueryForm({ query, setQuery, draft, setDraft, busy, onSubmit, onRefresh }: { query: MarketQueryInput; setQuery: (q: MarketQueryInput) => void; draft: string; setDraft: (s: string) => void; busy: boolean; onSubmit: () => void; onRefresh: () => void }) {
  const input = 'w-full rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:border-ink-300';
  return (
    <form
      className="grid gap-3 rounded-xl bg-ink-50/60 p-3 sm:grid-cols-[1fr_2.4fr_0.9fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="text-[11px] font-semibold text-slate-500">
        카테고리 (표시용)
        <input className={clsx(input, 'mt-1')} value={query.category} maxLength={30} onChange={(e) => setQuery({ ...query, category: e.target.value })} />
      </label>
      <label className="text-[11px] font-semibold text-slate-500">
        키워드 (제품 유형·효능·원료, 쉼표로 최대 5개)
        <input className={clsx(input, 'mt-1')} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="예: 앰플, 탄력 앰플, PDRN" />
      </label>
      <label className="text-[11px] font-semibold text-slate-500">
        기간
        <select className={clsx(input, 'mt-1')} value={query.months} onChange={(e) => setQuery({ ...query, months: Number(e.target.value) })}>
          {[6, 12, 24, 36].map((m) => (
            <option key={m} value={m}>
              최근 {m}개월
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          <Search size={14} /> 조회
        </Button>
        <Button onClick={onRefresh} disabled={busy} title="저장된 결과 대신 API에서 새로 수집">
          <RefreshCw size={14} />
        </Button>
      </div>
      <label className="text-[11px] font-semibold text-slate-500 sm:col-span-4">
        네이버 쇼핑 분야 코드
        <input className={clsx(input, 'mt-1 max-w-[12rem] font-mono')} value={query.categoryCode} maxLength={8} onChange={(e) => setQuery({ ...query, categoryCode: e.target.value.replace(/\D/g, '') })} />
        <span className="ml-2 font-normal text-slate-400">50000002 = 화장품/미용. 하위 분야는 네이버쇼핑 분류 URL의 cat_id 값을 넣으세요.</span>
      </label>
    </form>
  );
}

function Result({ data, focus }: { data: MarketDataResult; focus: Focus }) {
  const obs = data.observations;
  const byId = useMemo(() => new Map(obs.map((o) => [o.id, o])), [obs]);
  const [keyword, setKeyword] = useState(data.query.keywords[0] ?? '');
  const metricsUsed = [...new Set(obs.map((o) => o.metricName))];

  if (data.status === 'NO_DATA' || !obs.length) {
    return (
      <>
        <Notice tone="empty" icon={<CircleSlash size={15} />} title="데이터 부족">
          조회 조건에 해당하는 클릭 데이터가 없습니다. 키워드나 분야 코드를 바꿔 다시 조회해 보세요.
        </Notice>
        <Meta data={data} metrics={metricsUsed} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {data.stale && (
        <Notice tone="warn" icon={<AlertTriangle size={15} />} title="최신 수집 실패 · 이전 수집 결과 표시">
          {data.message} 아래는 {fmtDate(data.fetchedAt)}에 실제로 수집해 저장한 값입니다.
        </Notice>
      )}

      {focus === 'market' && (
        <>
          <TrendChart title={`${data.query.category} 분야 전체 클릭 추이`} obs={obs.filter((o) => o.metricName === 'category_click_index')} seriesOf={() => '분야 전체'} />
          <TrendChart title="키워드별 클릭 추이 (같은 조회 안에서 비교)" obs={obs.filter((o) => o.metricName === 'keyword_click_index')} seriesOf={(o) => o.keyword ?? ''} order={data.query.keywords} />
        </>
      )}
      {focus === 'trend' && (
        <>
          <TrendChart title="키워드별 클릭 추이 비교" obs={obs.filter((o) => o.metricName === 'keyword_click_index')} seriesOf={(o) => o.keyword ?? ''} order={data.query.keywords} />
          <KeywordChangeTable obs={obs.filter((o) => o.metricName === 'keyword_click_index')} keywords={data.query.keywords} />
        </>
      )}
      {focus === 'consumer' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <GroupBars title={`${data.query.category} 분야 · 연령별 평균 클릭 상대지표`} obs={obs.filter((o) => o.metricName === 'category_click_index_by_age')} prefix="age:" labels={AGE_KO} />
            <GroupBars title={`${data.query.category} 분야 · 성별 평균 클릭 상대지표`} obs={obs.filter((o) => o.metricName === 'category_click_index_by_gender')} prefix="gender:" labels={GENDER_KO} />
          </div>
          {data.query.keywords.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500">키워드별 보기</span>
                {data.query.keywords.slice(0, 3).map((k) => (
                  <button key={k} type="button" onClick={() => setKeyword(k)} className={clsx('rounded-full px-2.5 py-1 font-medium', k === keyword ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100')}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <GroupBars title={`"${keyword}" · 연령별`} obs={obs.filter((o) => o.metricName === 'keyword_click_index_by_age' && o.keyword === keyword)} prefix="age:" labels={AGE_KO} />
                <GroupBars title={`"${keyword}" · 성별`} obs={obs.filter((o) => o.metricName === 'keyword_click_index_by_gender' && o.keyword === keyword)} prefix="gender:" labels={GENDER_KO} />
              </div>
            </div>
          )}
        </>
      )}

      <Analysis data={data} byId={byId} focus={focus} />
      {data.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {data.warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      )}
      <Meta data={data} metrics={metricsUsed} />
    </div>
  );
}

function TrendChart({ title, obs, seriesOf, order }: { title: string; obs: MarketObservation[]; seriesOf: (o: MarketObservation) => string; order?: string[] }) {
  if (!obs.length) return <EmptyBlock title={title} />;
  const names = order?.filter((k) => obs.some((o) => seriesOf(o) === k)) ?? [...new Set(obs.map(seriesOf))];
  const periods = [...new Set(obs.map((o) => o.periodStart))].sort();
  const rows = periods.map((p) => Object.fromEntries([['period', p.slice(0, 7)], ...names.map((n) => [n, obs.find((o) => o.periodStart === p && seriesOf(o) === n)?.metricValue ?? null])]));
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold text-ink-900">{title}</div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={36} domain={[0, 100]} />
            <Tooltip content={({ active, payload, label }) => (active && payload?.length ? <TipBox title={String(label)} rows={payload.map((x) => ({ label: String(x.name), value: x.value == null ? '-' : r1(Number(x.value)), color: String(x.color) }))} /> : null)} />
            {names.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {names.map((n, i) => (
              <Line key={n} dataKey={n} name={n} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GroupBars({ title, obs, prefix, labels }: { title: string; obs: MarketObservation[]; prefix: string; labels: Record<string, string> }) {
  if (!obs.length) return <EmptyBlock title={title} />;
  const groups = Object.keys(labels)
    .map((g) => {
      const v = obs.filter((o) => o.dimension === `${prefix}${g}`).map((o) => o.metricValue);
      return { name: labels[g], value: v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null };
    })
    .filter((g): g is { name: string; value: number } => g.value !== null);
  const max = Math.max(...groups.map((g) => g.value));
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold text-ink-900">{title}</div>
      <div style={{ height: Math.max(90, groups.length * 30) }}>
        <ResponsiveContainer>
          <BarChart data={groups} layout="vertical" margin={{ left: 4, right: 40, top: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, 'auto']} />
            <YAxis type="category" dataKey="name" width={52} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip cursor={{ fill: '#f7f5fa' }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox rows={[{ label: `${payload[0].payload.name} 기간 평균`, value: payload[0].value as number }]} /> : null)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
              {groups.map((g) => (
                <Cell key={g.name} fill={g.value === max ? ACCENT : MUTED} />
              ))}
              <LabelList dataKey="value" position="right" style={{ fill: '#261b36', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">기간 평균 상대지표 · 인원수나 구매 비율이 아닙니다</p>
    </div>
  );
}

function KeywordChangeTable({ obs, keywords }: { obs: MarketObservation[]; keywords: string[] }) {
  const rows = keywords.map((k) => {
    const s = obs.filter((o) => o.keyword === k).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const w = s.length >= 6 ? 3 : 1;
    const mean = (xs: MarketObservation[]) => r1(xs.reduce((a, o) => a + o.metricValue, 0) / (xs.length || 1));
    return { k, n: s.length, avg: mean(s), from: mean(s.slice(0, w)), to: mean(s.slice(-w)), w };
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr className="border-b border-ink-50">
            <th className="py-1.5 pr-3 font-semibold">키워드</th>
            <th className="py-1.5 pr-3 font-semibold">기간 평균</th>
            <th className="py-1.5 pr-3 font-semibold">처음 → 최근 (평균)</th>
            <th className="py-1.5 font-semibold">변화</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className="border-b border-ink-50/70">
              <td className="py-1.5 pr-3 font-medium text-ink-900">{r.k}</td>
              {r.n === 0 || r.avg === 0 ? (
                <td colSpan={3} className="py-1.5 text-slate-400">
                  데이터 부족
                </td>
              ) : (
                <>
                  <td className="py-1.5 pr-3 tabular-nums">{r.avg}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {r.from} → {r.to}
                  </td>
                  <td className={clsx('py-1.5 tabular-nums font-semibold', r.to >= r.from ? 'text-emerald-700' : 'text-rose-700')}>
                    {r.to >= r.from ? '+' : ''}
                    {r1(r.to - r.from)}p
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-400">처음·최근은 각각 {rows[0]?.w ?? 1}개 기간 평균. 변화는 상대지표 포인트 차이이며 성장률이 아닙니다.</p>
    </div>
  );
}

function EmptyBlock({ title }: { title: string }) {
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold text-ink-900">{title}</div>
      <div className="grid h-24 place-items-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">데이터 부족</div>
    </div>
  );
}

const FOCUS_METRICS: Record<Focus, RegExp> = {
  market: /^(category|keyword)_click_index$/,
  consumer: /_by_(age|gender)$/,
  trend: /^keyword_click_index/,
};

function Analysis({ data, byId, focus }: { data: MarketDataResult; byId: Map<string, MarketObservation>; focus: Focus }) {
  const n = data.narrative;
  const relevant = data.findings.statements.filter((s) => s.observationIds.some((id) => FOCUS_METRICS[focus].test(byId.get(id)?.metricName ?? '')));
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          데이터 계산 결과 <span className="text-[11px] font-normal text-slate-400">수집값만으로 계산 · 문장마다 근거 데이터 ID</span>
        </div>
        <ul className="space-y-1.5">
          {relevant.map((s) => (
            <StatementRow key={s.id} s={s} byId={byId} />
          ))}
          {data.findings.gaps.map((g) => (
            <li key={g} className="flex items-start gap-2 text-sm text-slate-500">
              <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold">데이터 부족</span> {g}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          AI 해석 {n.status === 'OK' && <KindBadge kind="AI_ANALYSIS" />}
          {n.model && <span className="text-[11px] font-normal text-slate-400">{n.model}</span>}
        </div>
        {n.status === 'OK' && n.statements.length ? (
          <ul className="space-y-1.5">
            {n.statements.map((s) => (
              <StatementRow key={s.id} s={s} byId={byId} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{n.status === 'OK' ? '근거를 인용한 해석 문장이 없어 표시하지 않습니다.' : n.message}</p>
        )}
        {n.dropped > 0 && <p className="mt-1 text-[11px] text-slate-400">근거 ID가 없거나 데이터에 없는 숫자를 쓴 AI 문장 {n.dropped}개를 제외했습니다.</p>}
      </div>
    </div>
  );
}

function StatementRow({ s, byId }: { s: Statement; byId: Map<string, MarketObservation> }) {
  const [open, setOpen] = useState(false);
  const refs = s.observationIds.map((id) => byId.get(id)).filter((o): o is MarketObservation => !!o);
  return (
    <li className="text-sm text-ink-900">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        {s.kind && <span className="mt-0.5 rounded bg-ink-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700">{KIND_KO[s.kind] ?? s.kind}</span>}
        <span className="min-w-0 flex-1 leading-relaxed">{s.text}</span>
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200 hover:bg-sky-100">
          근거 데이터 {refs.length}개 {open ? '닫기' : '보기'}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 max-h-48 overflow-auto rounded-lg border border-ink-50 bg-ink-50/40">
          <table className="w-full text-left text-[11px]">
            <tbody>
              {refs.map((o) => (
                <tr key={o.id} className="border-b border-white">
                  <td className="px-2 py-1 font-mono text-slate-500">{o.id}</td>
                  <td className="px-2 py-1">{o.keyword ?? '분야 전체'}</td>
                  <td className="px-2 py-1">{o.dimension === 'all' ? '전체' : o.dimension.replace('age:', '연령 ').replace('gender:f', '여성').replace('gender:m', '남성')}</td>
                  <td className="px-2 py-1 tabular-nums">
                    {o.periodStart} ~ {o.periodEnd}
                  </td>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">{r1(o.metricValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

function Meta({ data, metrics }: { data: MarketDataResult; metrics: string[] }) {
  const src = data.source;
  return (
    <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-3 text-xs text-slate-600">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        <MetaRow label="출처">{src.name}</MetaRow>
        <MetaRow label="조사 기간">
          {data.query.startDate} ~ {data.query.endDate} ({data.query.timeUnit === 'month' ? '월별' : data.query.timeUnit === 'week' ? '주별' : '일별'})
        </MetaRow>
        <MetaRow label="국가">{src.country === 'KR' ? '대한민국 (KR)' : src.country}</MetaRow>
        <MetaRow label="수집일">
          {new Date(data.fetchedAt).toLocaleString('ko-KR')}
          {data.fromCache === 'database' ? ' · 저장된 수집 결과' : data.fromCache === 'memory' ? ' · 캐시' : ''}
        </MetaRow>
        <MetaRow label="단위">{src.unit}</MetaRow>
        <MetaRow label="원문 링크">
          <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-800 underline underline-offset-2">
            데이터랩 쇼핑인사이트 <ExternalLink size={11} />
          </a>
          <a href={src.docsUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-sky-800 underline underline-offset-2">
            API 문서 <ExternalLink size={11} />
          </a>
        </MetaRow>
      </div>
      <div>
        <div className="font-semibold text-slate-700">지표 정의</div>
        <ul className="mt-0.5 space-y-0.5">
          {metrics.map((m) => (
            <li key={m}>
              <span className="font-mono text-[10px] text-slate-500">{m}</span> · {src.metrics[m] ?? '정의 없음'}
            </li>
          ))}
        </ul>
      </div>
      <p className="font-medium text-slate-700">{src.caution}</p>
      <p className="text-[11px] text-slate-400">
        조회 분야 코드 {data.query.categoryCode} · 수집 값 {data.observations.length}개 · API 호출 {data.calls}회 · 저장소 {data.storage === 'saved' ? 'Supabase 저장됨' : data.storage === 'error' ? '저장 실패' : '미설정 (저장 안 함)'}
        {data.rejected > 0 && ` · 검증 탈락 ${data.rejected}개`}
      </p>
    </div>
  );
}

const MetaRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <span className="font-semibold text-slate-700">{label}</span> <span>{children}</span>
  </div>
);

function SourceList({ status }: { status: MarketDataStatus }) {
  const label = { connected: '연결됨', not_configured: '키 미설정', planned: '미연결 (예정)' } as const;
  const cls = { connected: 'bg-emerald-50 text-emerald-800 ring-emerald-200', not_configured: 'bg-amber-50 text-amber-800 ring-amber-200', planned: 'bg-slate-100 text-slate-600 ring-slate-200' } as const;
  return (
    <div className="mt-5 border-t border-ink-50 pt-4">
      <div className="mb-2 text-[13px] font-semibold text-ink-900">데이터 소스 연결 상태</div>
      <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
        {status.sources.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <span className={clsx('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', cls[s.status])}>{label[s.status]}</span>
            <span>
              <span className="font-medium text-ink-900">{s.name}</span> <span className="text-slate-500">· {s.description}</span>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2">
          <span className={clsx('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', status.storage.supabase ? cls.connected : cls.not_configured)}>{status.storage.supabase ? '연결됨' : '키 미설정'}</span>
          <span>
            <span className="font-medium text-ink-900">Supabase 저장소</span> <span className="text-slate-500">· 수집값 저장과 24시간 캐시</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className={clsx('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', status.ai.configured ? cls.connected : cls.not_configured)}>{status.ai.configured ? '연결됨' : '키 미설정'}</span>
          <span>
            <span className="font-medium text-ink-900">AI 해석 (Claude)</span> <span className="text-slate-500">· 수집 데이터만 근거로 해석 문장 작성</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

/** Shown above the existing demo sections so mock values are never read as real data. */
export function DemoDataNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <div>
        <b>여기부터는 데모 데이터입니다.</b> 아래 시장 규모, 비중, 리뷰 수, 성장률은 화면 설명용 가상 값이며 실제 조사 결과가 아닙니다. 실제 수집 데이터는 위의 "실제 데이터" 영역에만 표시됩니다.
      </div>
    </div>
  );
}
