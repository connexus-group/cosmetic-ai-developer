/**
 * Packaging Studio helpers (server): planning inputs, AI design-direction prompt, reference
 * filtering / image checks, and the mockup prompt.
 */
import { blockedDomain } from './robots.js';

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// ── planning inputs (from the Product Blueprint, read on the client) ──────────

export const INPUT_KEYS = ['productName', 'category', 'concept', 'usp', 'target', 'price', 'cost', 'texture', 'size', 'markets', 'firstRun', 'benefits', 'keywords', 'positioning', 'container'] as const;
export type InputKey = (typeof INPUT_KEYS)[number];
export type Inputs = Record<InputKey, string>;

export const INPUT_LABELS: Record<InputKey, string> = {
  productName: '제품명(가칭)',
  category: '제품 카테고리',
  concept: '제품 컨셉',
  usp: 'USP',
  target: '타깃 소비자',
  price: '판매가',
  cost: '목표 제조원가',
  texture: '제형',
  size: '용량',
  markets: '주요 판매 국가',
  firstRun: '초도 생산수량',
  benefits: '핵심 효능',
  keywords: '마케팅 키워드',
  positioning: '브랜드 포지셔닝',
  container: '기획안의 용기 형태',
};

export function parseInputs(raw: unknown): Inputs {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(INPUT_KEYS.map((k) => [k, str(b[k], 300)])) as Inputs;
}

const shown = (v: string) => (v && v !== '미정' ? v : '미정');

// ── AI design directions ─────────────────────────────────────────────────────

export const DESIGN_SYSTEM = `당신은 화장품 브랜드의 패키지 디자인 디렉터입니다. 상품기획자가 확정한 제품 기획 조건으로 용기와 단상자 디자인 방향 3개를 제안합니다.

원칙:
- 한국어로 씁니다. 브랜드사 기획서 문체(짧은 개조식)로 쓰고 "제안합니다", "~하는 것이 좋습니다"는 쓰지 않습니다.
- 3개 방향은 서로 분명히 다르게 만듭니다 (예: 미니멀 클리니컬 / 감성 내추럴 / 프리미엄 럭셔리 등, 조건에 맞게).
- reason은 반드시 기획 조건 값(판매가, 타깃, 제형, 용량, 국가, 원가, 초도수량, USP 등)을 직접 인용해 1~2문장으로 씁니다. basis에는 근거로 쓴 조건 이름을 넣습니다.
- 색상은 HEX 코드(#RRGGBB)와 짧은 색 이름으로 씁니다. 메인 1~2개, 서브 2~3개.
- 용기 형태는 제형·용량과 맞는 일반적인 유형(에어리스, 스포이드, 펌프, 튜브, 단지 등)과 재질 후보를 함께 씁니다. 제형 적합성은 확정하지 않고 "용기 적합성 시험 필요"로 둡니다.
- 인쇄·후가공은 일반적인 방식 이름(실크스크린, 핫스탬핑, 엠보싱, 무광 코팅, UV 부분 코팅 등)으로 쓰고, 단가나 MOQ 수치는 쓰지 않습니다. 목표 원가가 낮으면 비용 부담이 큰 후가공은 "원가 확인 필요"라고 씁니다.
- 실제 브랜드나 제품 디자인을 베끼라고 쓰지 않고, 실존 브랜드명을 쓰지 않습니다.
- imagePrompt는 이미지 생성용 영어 키워드 한 줄(용기 형태, 재질, 색, 스타일, 조명)입니다. 글자·로고·브랜드명은 넣지 않습니다.`;

export function designPrompt(inp: Inputs) {
  const lines = INPUT_KEYS.map((k) => `- ${INPUT_LABELS[k]}: ${shown(inp[k])}`);
  return `제품 기획 조건 (Product Blueprint에서 가져온 값, "미정"은 아직 정하지 않은 값):\n${lines.join('\n')}\n\n이 조건으로 디자인 방향 3개를 작성하세요.`;
}

export const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['directions'],
  properties: {
    directions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'summary', 'reason', 'basis', 'mainColors', 'subColors', 'container', 'material', 'carton', 'typography', 'finishing', 'targetFit', 'imagePrompt'],
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          reason: { type: 'string' },
          basis: { type: 'array', items: { type: 'string' } },
          mainColors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'hex'], properties: { name: { type: 'string' }, hex: { type: 'string' } } } },
          subColors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'hex'], properties: { name: { type: 'string' }, hex: { type: 'string' } } } },
          container: { type: 'string' },
          material: { type: 'string' },
          carton: { type: 'string' },
          typography: { type: 'string' },
          finishing: { type: 'string' },
          targetFit: { type: 'string' },
          imagePrompt: { type: 'string' },
        },
      },
    },
  },
} as const;

const HEX = /^#[0-9a-f]{6}$/i;
const colors = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .slice(0, 3)
    .map((c) => ({ name: str((c as Record<string, unknown>)?.name, 30), hex: str((c as Record<string, unknown>)?.hex, 7) }))
    .filter((c) => HEX.test(c.hex));

export function sanitizeDirections(raw: unknown) {
  const list = Array.isArray((raw as { directions?: unknown })?.directions) ? ((raw as { directions: unknown[] }).directions as Record<string, unknown>[]) : [];
  return list.slice(0, 3).map((d, i) => ({
    id: `d${i + 1}`,
    name: str(d.name, 40),
    summary: str(d.summary, 160),
    reason: str(d.reason, 400),
    basis: (Array.isArray(d.basis) ? d.basis : []).map((x) => str(x, 30)).filter(Boolean).slice(0, 8),
    mainColors: colors(d.mainColors),
    subColors: colors(d.subColors),
    container: str(d.container, 160),
    material: str(d.material, 120),
    carton: str(d.carton, 240),
    typography: str(d.typography, 200),
    finishing: str(d.finishing, 240),
    targetFit: str(d.targetFit, 240),
    imagePrompt: str(d.imagePrompt, 400).replace(/["<>]/g, ''),
  }));
}

// ── reference library ────────────────────────────────────────────────────────

/** Stock photo sellers and re-posting boards: licensed or unclear rights, never used as references. */
export const EXCLUDED_IMAGE_HOSTS: Record<string, string> = {
  'pinterest.com': 'Pinterest (재게시 이미지, 원저작자 불명)',
  'pinimg.com': 'Pinterest (재게시 이미지, 원저작자 불명)',
  'shutterstock.com': '유료 스톡 이미지',
  'istockphoto.com': '유료 스톡 이미지',
  'gettyimages.com': '유료 스톡 이미지',
  'stock.adobe.com': '유료 스톡 이미지',
  'ftcdn.net': '유료 스톡 이미지',
  'freepik.com': '스톡 이미지 (라이선스 조건)',
  'dreamstime.com': '유료 스톡 이미지',
  'alamy.com': '유료 스톡 이미지',
  '123rf.com': '유료 스톡 이미지',
  'depositphotos.com': '유료 스톡 이미지',
  'vecteezy.com': '스톡 이미지 (라이선스 조건)',
  'aliexpress.com': '오픈마켓 (판매자 이미지, 원저작자 불명)',
  'alibaba.com': '오픈마켓 (판매자 이미지, 원저작자 불명)',
  'temu.com': '오픈마켓 (판매자 이미지, 원저작자 불명)',
};

export function excludedHost(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const [d, why] of Object.entries(EXCLUDED_IMAGE_HOSTS)) if (h === d || h.endsWith(`.${d}`)) return why;
  const blocked = blockedDomain(h);
  return blocked ? `${blocked} (이용약관상 자동 수집 불가)` : null;
}

const CARTON = /\b(box|boxes|carton|outer pack|packaging box|gift set|folding)\b|단상자|박스|케이스/i;
const CONTAINER = /\b(bottle|jar|tube|pump|dropper|airless|vial|ampoule|serum|cream|lotion|essence|toner|container)\b|용기|병|튜브|펌프|스포이드|에어리스/i;

/** Rule-based guess from the title text only. "unknown" unless the words clearly say box vs bottle. */
export function guessKind(text: string): 'container' | 'carton' | 'set' | 'unknown' {
  const box = CARTON.test(text);
  const bottle = /\b(bottle|jar|tube|pump|dropper|airless|vial)\b|용기|병|튜브|펌프|스포이드|에어리스/i.test(text);
  if (box && bottle) return 'set';
  if (box) return 'carton';
  if (bottle || CONTAINER.test(text)) return 'container';
  return 'unknown';
}

/** Site name from the page host: "www.example-brand.com" → "example-brand.com". Not a verified brand name. */
export const siteOf = (pageUrl: string) => {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Does the image address answer with an image? Only these are shown as images.
 * A small ranged GET is used because many CDNs refuse HEAD.
 */
export async function checkImage(url: string): Promise<{ ok: true; mime: string } | { ok: false; reason: string }> {
  try {
    const r = await http.fetch(url, { method: 'GET', headers: { range: 'bytes=0-2047', 'user-agent': 'Mozilla/5.0 (compatible; AIProductDeveloper/1.0; +image-check)' }, redirect: 'follow', signal: AbortSignal.timeout(8_000) });
    const mime = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    await r.body?.cancel().catch(() => undefined);
    if (!r.ok && r.status !== 206) return { ok: false, reason: `이미지 주소 응답 ${r.status}` };
    if (!mime.startsWith('image/')) return { ok: false, reason: `이미지가 아닌 응답 (${mime || '형식 없음'})` };
    return { ok: true, mime };
  } catch {
    return { ok: false, reason: '이미지 주소에 연결하지 못함' };
  }
}

/** Search words from the planning inputs and the chosen direction (English works best for image search). */
const EN: [RegExp, string][] = [
  [/앰플|세럼/, 'serum'],
  [/에센스/, 'essence'],
  [/크림/, 'cream jar'],
  [/토너/, 'toner'],
  [/로션/, 'lotion'],
  [/선크림|선케어/, 'sunscreen'],
  [/클렌/, 'cleanser'],
  [/패드/, 'toner pad'],
  [/마스크/, 'sheet mask'],
  [/에어리스/, 'airless pump bottle'],
  [/스포이드|드롭퍼/, 'dropper bottle'],
  [/펌프/, 'pump bottle'],
  [/튜브/, 'tube'],
  [/단지|자/, 'jar'],
];
const en = (v: string) => EN.find(([re]) => re.test(v))?.[1] ?? '';

export function referenceQueries(inp: Inputs, direction: { name?: string; container?: string; imagePrompt?: string } | null): string[] {
  const product = en(inp.category) || 'skincare';
  const container = en(direction?.container ?? '') || en(inp.container) || '';
  const style = (direction?.imagePrompt ?? '').split(/[,.]/).map((s) => s.trim()).filter((s) => s && s.length < 40).slice(0, 2).join(' ');
  return [
    `${product} ${container} cosmetic packaging design ${style}`.replace(/\s+/g, ' ').trim(),
    `${product} skincare box packaging design ${style}`.replace(/\s+/g, ' ').trim(),
  ];
}

// ── mockup prompt ────────────────────────────────────────────────────────────

export interface MockupRequest {
  kind: 'container' | 'carton' | 'set' | 'colorway';
  container: string;
  mainColor: string;
  subColor: string;
  style: string;
  labelLayout: string;
  carton: string;
  direction: string;
  size: string;
  texture: string;
  variantColor: string;
}

export function parseMockup(raw: unknown): MockupRequest | null {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = ['container', 'carton', 'set', 'colorway'].includes(String(b.kind)) ? (b.kind as MockupRequest['kind']) : null;
  if (!kind) return null;
  const color = (v: unknown) => (HEX.test(str(v, 7)) ? str(v, 7) : '');
  return {
    kind,
    container: str(b.container, 80),
    mainColor: color(b.mainColor),
    subColor: color(b.subColor),
    style: str(b.style, 120),
    labelLayout: str(b.labelLayout, 60),
    carton: str(b.carton, 160),
    direction: str(b.direction, 400).replace(/["<>]/g, ''),
    size: str(b.size, 20),
    texture: str(b.texture, 30),
    variantColor: color(b.variantColor),
  };
}

const CONTAINER_EN: Record<string, string> = {
  에어리스: 'airless pump bottle',
  스포이드: 'glass dropper bottle',
  펌프: 'pump bottle',
  튜브: 'squeeze tube',
  단지: 'cosmetic cream jar',
  스프레이: 'mist spray bottle',
};
const LAYOUT_EN: Record<string, string> = {
  중앙: 'blank label area centered on the front',
  상단: 'blank label area at the top',
  하단: 'blank label area at the bottom',
  세로: 'blank vertical label stripe',
};

/** English prompt for FLUX. Text, logos and brand names are kept OUT of the image; the site overlays them. */
export function mockupPrompt(m: MockupRequest): string {
  const container = CONTAINER_EN[m.container] ?? (en(m.container) || 'cosmetic bottle');
  const color = m.kind === 'colorway' && m.variantColor ? m.variantColor : m.mainColor;
  const palette = [color && `main color ${color}`, m.subColor && `accent color ${m.subColor}`].filter(Boolean).join(', ');
  const layout = LAYOUT_EN[m.labelLayout] ?? 'blank label area';
  const subject =
    m.kind === 'carton'
      ? `a folding paper carton box for a skincare ${container}${m.carton ? `, box design: ${m.carton}` : ''}`
      : m.kind === 'set'
        ? `a skincare ${container} standing next to its matching folding carton box${m.carton ? ` (box: ${m.carton})` : ''}`
        : `a single skincare ${container}${m.size ? ` (${m.size})` : ''}`;
  return [
    `Product packaging concept render of ${subject}`,
    palette,
    m.style && `style: ${m.style}`,
    m.direction && `design direction: ${m.direction}`,
    layout,
    'clean studio background, soft even lighting, centered, photorealistic product shot',
    'no text, no letters, no logo, no brand name, no watermark',
  ]
    .filter(Boolean)
    .join('. ');
}
