/**
 * UN Comtrade public preview API — Korea's cosmetics exports by destination. Free, no key.
 *   https://comtradeapi.un.org/public/v1/preview/C/A/HS
 * The keyless preview returns up to 500 rows per call and is rate limited; results are cached.
 *
 * Values are customs-reported export values (FOB, US$) for a whole HS heading, e.g. HS 3304 covers
 * all skin care and make-up preparations. They are not sales of a specific product type.
 */
import { observationId, type Observation } from '../observation.js';
import { AdapterError, type AdapterInfo } from './types.js';

export const COMTRADE_SOURCE_NAME = 'UN Comtrade (국제무역통계)';
export const COMTRADE_DOCS_URL = 'https://comtradeplus.un.org/';
const BASE = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';
export const KOREA = 410;

export const HS: Record<string, string> = {
  '3304': 'HS 3304 · 기초·색조 화장품 (스킨케어, 선케어, 메이크업)',
  '3305': 'HS 3305 · 헤어 제품',
  '3307': 'HS 3307 · 바디·향 관련 제품 (면도용, 데오드란트, 입욕제 등)',
};

/** Korean label → UN M49 partner codes (groups are summed from their members) */
export const MARKET_GROUPS: Record<string, { label: string; codes: number[] }> = {
  US: { label: '미국', codes: [842] },
  CN: { label: '중국', codes: [156] },
  JP: { label: '일본', codes: [392] },
  GB: { label: '영국', codes: [826] },
  EU: { label: 'EU 27개국 합계', codes: [40, 56, 100, 191, 196, 203, 208, 233, 246, 251, 276, 300, 348, 372, 380, 428, 440, 442, 470, 528, 616, 620, 642, 703, 705, 724, 752] },
  ASEAN: { label: '동남아 (ASEAN 10개국 합계)', codes: [96, 104, 116, 360, 418, 458, 608, 702, 704, 764] },
  HK: { label: '홍콩', codes: [344] },
  TW: { label: '대만', codes: [490] },
};

export const PARTNER_KO: Record<number, string> = {
  842: '미국', 156: '중국', 392: '일본', 344: '홍콩', 490: '대만', 704: '베트남', 764: '태국', 702: '싱가포르', 360: '인도네시아', 458: '말레이시아',
  608: '필리핀', 116: '캄보디아', 104: '미얀마', 418: '라오스', 96: '브루나이', 826: '영국', 251: '프랑스', 276: '독일', 380: '이탈리아', 724: '스페인',
  528: '네덜란드', 56: '벨기에', 616: '폴란드', 203: '체코', 233: '에스토니아', 208: '덴마크', 246: '핀란드', 752: '스웨덴', 40: '오스트리아', 100: '불가리아',
  643: '러시아', 398: '카자흐스탄', 860: '우즈베키스탄', 496: '몽골', 124: '캐나다', 36: '호주', 554: '뉴질랜드', 484: '멕시코', 76: '브라질', 152: '칠레',
  784: 'UAE', 682: '사우디아라비아', 414: '쿠웨이트', 368: '이라크', 376: '이스라엘', 792: '튀르키예', 699: '인도', 50: '방글라데시', 586: '파키스탄',
  804: '우크라이나', 112: '벨라루스', 417: '키르기스스탄', 762: '타지키스탄', 51: '아르메니아', 268: '조지아', 31: '아제르바이잔', 710: '남아프리카공화국', 818: '이집트', 566: '나이지리아',
};

export const comtradeInfo = (): AdapterInfo => ({
  id: 'un-comtrade',
  name: COMTRADE_SOURCE_NAME,
  homepage: COMTRADE_DOCS_URL,
  status: 'connected',
  description: '한국 화장품(HS 코드) 국가별 수출액 · 공개 미리보기 API, 키 불필요',
  env: [],
  costNote: '무료 (키 없는 공개 미리보기, 1회 500행·호출 빈도 제한)',
});

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

interface Row {
  refYear: number;
  partnerCode: number;
  primaryValue: number | null;
  fobvalue: number | null;
  netWgt: number | null;
  partner2Code?: number;
  motCode?: number;
  customsCode?: string;
}

async function call(year: number, hs: string): Promise<Row[]> {
  const url = `${process.env.COMTRADE_BASE_URL || BASE}?reporterCode=${KOREA}&period=${year}&cmdCode=${hs}&flowCode=X&partner2Code=0&customsCode=C00&motCode=0`;
  for (let attempt = 0; ; attempt++) {
    let r: Response;
    try {
      r = await http.fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    } catch {
      if (attempt === 0) continue;
      throw new AdapterError('NETWORK', 'UN Comtrade 서버에 연결하지 못했습니다.');
    }
    if (r.status === 429) throw new AdapterError('RATE_LIMIT', 'UN Comtrade 무료 호출 한도를 잠시 초과했습니다. 잠시 후 다시 시도하세요.', 429);
    if (r.status >= 500 && attempt === 0) {
      await new Promise((res) => setTimeout(res, 1000));
      continue;
    }
    if (!r.ok) throw new AdapterError('UPSTREAM', `UN Comtrade 오류 (${r.status})`, r.status);
    const j = (await r.json().catch(() => null)) as { data?: Row[]; error?: string } | null;
    if (!j || !Array.isArray(j.data)) throw new AdapterError('UPSTREAM', 'UN Comtrade 응답 형식을 읽지 못했습니다.');
    if (j.error) throw new AdapterError('UPSTREAM', `UN Comtrade: ${j.error}`);
    return j.data.filter((d) => (d.partner2Code ?? 0) === 0 && (d.motCode ?? 0) === 0 && (d.customsCode ?? 'C00') === 'C00');
  }
}

/**
 * Latest two years with data. Tries last year first; a year not yet published returns no rows.
 * Returns observations: export_value_usd per partner (partner 0 = world) per year.
 */
export async function fetchKoreaExports(hs: string, queryHash: string, today = new Date()) {
  const collectedAt = new Date().toISOString();
  const years: { year: number; rows: Row[] }[] = [];
  let calls = 0;
  for (let y = today.getUTCFullYear() - 1; y >= today.getUTCFullYear() - 4 && years.length < 2; y--) {
    calls++;
    const rows = await call(y, hs);
    if (rows.some((r) => r.partnerCode === 0)) years.push({ year: y, rows });
  }
  const out: Observation[] = [];
  for (const { year, rows } of years) {
    for (const r of rows) {
      const v = Number(r.primaryValue ?? r.fobvalue);
      const o: Observation = {
        id: '',
        sourceName: COMTRADE_SOURCE_NAME,
        sourceUrl: COMTRADE_DOCS_URL,
        country: 'KR',
        category: HS[hs] ?? `HS ${hs}`,
        keyword: null,
        metricName: 'export_value_usd',
        dimension: `partner:${r.partnerCode}`,
        metricValue: v,
        unit: 'US$ (FOB, 연간 수출액)',
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        collectedAt,
        publishedAt: null,
        dataType: 'COLLECTED',
        verificationStatus: 'OFFICIAL_SOURCE',
        queryHash,
      };
      o.id = observationId(o);
      out.push(o);
    }
  }
  return { observations: out, years: years.map((y) => y.year), calls };
}
