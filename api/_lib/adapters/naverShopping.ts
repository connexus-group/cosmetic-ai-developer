/**
 * Naver DataLab Shopping Insight (네이버 데이터랩 쇼핑인사이트) — the first real data source.
 *
 * Two official gateways serve the same API; pick one with NAVER_DATALAB_GATEWAY:
 *   openapi (default)  https://openapi.naver.com/v1/datalab/shopping   · app from developers.naver.com
 *   apihub             https://naverapihub.apigw.ntruss.com/shopping/v1 · NAVER API HUB on NAVER Cloud
 *
 * Every value it returns is a RELATIVE click index (the largest value in one query's result = 100).
 * It is not sales, revenue or market share, and values from different queries are not comparable.
 */
import { observationId, type Observation } from '../observation.js';
import { AdapterError, type AdapterInfo, type DataAdapter, type FetchResult, type MarketQuery } from './types.js';

export const NAVER_SOURCE_NAME = '네이버 데이터랩 쇼핑인사이트';
/** where a person can look at the same figures */
export const NAVER_SOURCE_URL = 'https://datalab.naver.com/shoppingInsight/sCategory.naver';
export const NAVER_DOCS_URL = 'https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md';
/** 화장품/미용 top-level category. Sub-category codes are the cat_id in a Naver Shopping category URL. */
export const NAVER_COSMETICS_CATEGORY = '50000002';
export const NAVER_UNIT = '상대지표 (조회 결과 안 최댓값 = 100)';
/** the API keeps data from this date */
export const NAVER_EARLIEST = '2017-08-01';
/** per-keyword age/gender breakdowns cost 2 calls each; cap them to protect the daily quota */
const BREAKDOWN_KEYWORDS = 3;

export const NAVER_METRICS: Record<string, string> = {
  category_click_index: '선택한 쇼핑 분야에서 네이버쇼핑 검색 후 클릭이 일어난 양을 기간별로 나타낸 상대지표입니다. 조회 기간 중 가장 많은 시점을 100으로 둡니다.',
  category_click_index_by_age: '같은 분야의 클릭 상대지표를 연령대별로 나눈 값입니다. 연령대별 실제 인원이나 구매 비율이 아닙니다.',
  category_click_index_by_gender: '같은 분야의 클릭 상대지표를 성별로 나눈 값입니다. 실제 구매자 성비가 아닙니다.',
  keyword_click_index: '분야 안에서 해당 키워드로 검색 후 클릭한 양의 상대지표입니다. 함께 조회한 키워드들 중 가장 많은 시점을 100으로 둡니다.',
  keyword_click_index_by_age: '키워드 클릭 상대지표를 연령대별로 나눈 값입니다.',
  keyword_click_index_by_gender: '키워드 클릭 상대지표를 성별로 나눈 값입니다.',
};

type Gateway = 'openapi' | 'apihub';

function config() {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  const gateway: Gateway = process.env.NAVER_DATALAB_GATEWAY === 'apihub' ? 'apihub' : 'openapi';
  return { id, secret, gateway };
}

interface NaverPoint {
  period: string;
  ratio: number;
  group?: string;
}
interface NaverResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: { title: string; keyword?: string[]; category?: string[]; data: NaverPoint[] }[];
}

/** test seam: replaced in tests to avoid real network calls */
export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

async function call(path: string, body: unknown): Promise<NaverResponse> {
  const { id, secret, gateway } = config();
  if (!id || !secret) throw new AdapterError('NOT_CONFIGURED', 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 서버 환경변수에 없습니다.');
  const base = process.env.NAVER_DATALAB_BASE_URL || (gateway === 'apihub' ? 'https://naverapihub.apigw.ntruss.com/shopping/v1' : 'https://openapi.naver.com/v1/datalab/shopping');
  const headers: Record<string, string> =
    gateway === 'apihub'
      ? { 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret, 'Content-Type': 'application/json' }
      : { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret, 'Content-Type': 'application/json' };

  for (let attempt = 0; ; attempt++) {
    let r: Response;
    try {
      r = await http.fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    } catch {
      if (attempt === 0) continue;
      throw new AdapterError('NETWORK', '네이버 API 서버에 연결하지 못했습니다.');
    }
    if (r.ok) {
      const j = (await r.json().catch(() => null)) as NaverResponse | null;
      if (!j || !Array.isArray(j.results)) throw new AdapterError('UPSTREAM', '네이버 API 응답 형식을 읽지 못했습니다.', r.status);
      return j;
    }
    const err = (await r.json().catch(() => ({}))) as { errorMessage?: string; errorCode?: string; message?: string };
    const detail = [err.errorCode, err.errorMessage ?? err.message].filter(Boolean).join(' ');
    if (r.status === 429) throw new AdapterError('RATE_LIMIT', `네이버 API 호출 한도를 초과했습니다. ${detail}`.trim(), 429);
    if (r.status === 401 || (r.status === 403 && /auth|인증|권한|024|200/i.test(detail))) throw new AdapterError('AUTH', `네이버 API 인증에 실패했습니다. Client ID/Secret과 데이터랩(쇼핑인사이트) 사용 권한을 확인하세요. ${detail}`.trim(), r.status);
    if (r.status >= 500 && attempt === 0) {
      await new Promise((res) => setTimeout(res, 800));
      continue;
    }
    if (r.status === 400 || r.status === 403) throw new AdapterError('BAD_REQUEST', `네이버 API가 요청을 거부했습니다. ${detail}`.trim(), r.status);
    throw new AdapterError('UPSTREAM', `네이버 API 오류 (${r.status}) ${detail}`.trim(), r.status);
  }
}

/** last day covered by a bucket that starts at `period`, clamped to the query end */
function periodEnd(period: string, unit: MarketQuery['timeUnit'], end: string) {
  const d = new Date(`${period}T00:00:00Z`);
  if (unit === 'month') d.setUTCMonth(d.getUTCMonth() + 1, 0);
  else if (unit === 'week') d.setUTCDate(d.getUTCDate() + 6);
  const iso = d.toISOString().slice(0, 10);
  return iso > end ? end : iso;
}

const AGE_GROUPS = ['10', '20', '30', '40', '50', '60'];

export const naverShoppingAdapter: DataAdapter = {
  info(): AdapterInfo {
    const { id, secret, gateway } = config();
    return {
      id: 'naver-datalab-shopping',
      name: NAVER_SOURCE_NAME,
      homepage: NAVER_SOURCE_URL,
      status: id && secret ? 'connected' : 'not_configured',
      description: `네이버쇼핑 분야·키워드별 검색 후 클릭 상대지표 (기간·연령·성별). 게이트웨이: ${gateway}`,
      env: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET', 'NAVER_DATALAB_GATEWAY (선택)'],
      costNote:
        gateway === 'apihub'
          ? 'NAVER API HUB: 현재 한시 무료이나 유료 전환 예정(사전 공지). 무료로만 쓰려면 기본값 openapi 사용.'
          : '네이버 개발자센터 오픈API: 무료, 데이터랩 하루 1,000회 한도.',
    };
  },

  async fetch(q: MarketQuery, queryHash: string): Promise<FetchResult> {
    const code = q.categoryCode || NAVER_COSMETICS_CATEGORY;
    const base = { startDate: q.startDate, endDate: q.endDate, timeUnit: q.timeUnit };
    const collectedAt = new Date().toISOString();
    const out: Observation[] = [];
    const warnings: string[] = [];
    let calls = 0;

    const push = (metricName: string, keyword: string | null, data: NaverPoint[], dim: (p: NaverPoint) => string) => {
      for (const p of data) {
        const o: Observation = {
          id: '',
          sourceName: NAVER_SOURCE_NAME,
          sourceUrl: NAVER_SOURCE_URL,
          country: 'KR',
          category: q.category,
          keyword,
          metricName,
          dimension: dim(p),
          metricValue: Number(p.ratio),
          unit: NAVER_UNIT,
          periodStart: p.period,
          periodEnd: periodEnd(p.period, q.timeUnit, q.endDate),
          collectedAt,
          publishedAt: null,
          dataType: 'COLLECTED',
          verificationStatus: 'OFFICIAL_SOURCE',
          queryHash,
        };
        o.id = observationId(o);
        out.push(o);
      }
    };
    const run = async (path: string, body: unknown) => {
      calls++;
      return call(path, { ...base, ...(body as object) });
    };

    // Category-level series. Auth / quota errors stop the whole query: nothing is filled in.
    const [cat, catAge, catGender, kw] = await Promise.all([
      run('/categories', { category: [{ name: q.category, param: [code] }] }),
      run('/category/age', { category: code }),
      run('/category/gender', { category: code }),
      q.keywords.length ? run('/category/keywords', { category: code, keyword: q.keywords.slice(0, 5).map((k) => ({ name: k, param: [k] })) }) : Promise.resolve(null),
    ]);
    push('category_click_index', null, cat.results[0]?.data ?? [], () => 'all');
    push('category_click_index_by_age', null, (catAge.results[0]?.data ?? []).filter((p) => AGE_GROUPS.includes(String(p.group))), (p) => `age:${p.group}`);
    push('category_click_index_by_gender', null, (catGender.results[0]?.data ?? []).filter((p) => p.group === 'f' || p.group === 'm'), (p) => `gender:${p.group}`);
    for (const r of kw?.results ?? []) push('keyword_click_index', r.title, r.data ?? [], () => 'all');

    // Per-keyword breakdowns. A failure here keeps what was already collected and is reported.
    for (const k of q.keywords.slice(0, BREAKDOWN_KEYWORDS)) {
      try {
        const [age, gender] = await Promise.all([run('/category/keyword/age', { category: code, keyword: k }), run('/category/keyword/gender', { category: code, keyword: k })]);
        push('keyword_click_index_by_age', k, (age.results[0]?.data ?? []).filter((p) => AGE_GROUPS.includes(String(p.group))), (p) => `age:${p.group}`);
        push('keyword_click_index_by_gender', k, (gender.results[0]?.data ?? []).filter((p) => p.group === 'f' || p.group === 'm'), (p) => `gender:${p.group}`);
      } catch (e) {
        if (e instanceof AdapterError && (e.code === 'RATE_LIMIT' || e.code === 'AUTH')) {
          warnings.push(`"${k}" 이후 키워드의 연령·성별 데이터는 ${e.message}`);
          break;
        }
        warnings.push(`"${k}" 연령·성별 데이터를 가져오지 못했습니다: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
      }
    }
    return { observations: out, calls, warnings };
  },
};
