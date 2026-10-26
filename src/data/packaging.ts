import type { BlueprintEntry, DataKind, DesignDirection, DesignDirectionSet, MockupMeta, MockupOptions, PackagingReference, PackagingStudio, Project } from './types';
import { marketLabel } from './intakeSpec';
import { isUndecided, splitList } from '@/lib/blueprint';
import { first, vals } from '@/lib/spec';
import { formulaOf } from '@/lib/engine';

/**
 * AI Packaging & Design Studio · data layer.
 * - Planning inputs come from the confirmed Product Blueprint (then the detailed intake), never typed again.
 * - Server calls go to /api/packaging. When a service is not connected the UI says so; nothing pretends to work.
 * - Demo design directions are rule based and always labeled "데모 제안".
 */

// ── planning inputs ─────────────────────────────────────────────────────────

export type InputKey = 'productName' | 'category' | 'concept' | 'usp' | 'target' | 'price' | 'cost' | 'texture' | 'size' | 'markets' | 'firstRun' | 'benefits' | 'keywords' | 'positioning' | 'container';

export interface PlanningInput {
  key: InputKey;
  label: string;
  value: string;
  kind: DataKind | null;
  /** shown in the 9-item strip (the rest are extra context for the AI) */
  core: boolean;
}

const LABELS: Record<InputKey, string> = {
  productName: '제품명',
  category: '카테고리',
  concept: '컨셉',
  usp: 'USP',
  target: '타깃',
  price: '판매가',
  cost: '목표 원가',
  texture: '제형',
  size: '용량',
  markets: '판매 국가',
  firstRun: '초도 수량',
  benefits: '핵심 효능',
  keywords: '키워드',
  positioning: '포지셔닝',
  container: '기획 용기',
};
const CORE: InputKey[] = ['category', 'concept', 'usp', 'target', 'price', 'cost', 'texture', 'size', 'markets', 'firstRun'];

export function planningInputs(p: Project): PlanningInput[] {
  const bp = p.blueprint;
  const e = bp?.entries ?? {};
  const kindOf = (x: BlueprintEntry | undefined): DataKind | null => (!x || isUndecided(x) ? null : x.origin === 'USER_PROVIDED' ? 'USER_INPUT' : bp?.mode === 'ai' ? 'AI_ESTIMATE' : 'DEMO_RECOMMEND');
  const specKind = (id: Parameters<typeof first>[1]): DataKind | null => {
    const a = p.spec?.[id];
    return !a || a.mode === 'unknown' ? null : a.mode === 'user' ? 'USER_INPUT' : a.mode === 'idea' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND';
  };
  const fromBp = (key: string): [string, DataKind | null] | null => (e[key] && !isUndecided(e[key]) ? [e[key].value, kindOf(e[key])] : null);
  const s = p.spec ?? {};
  const pick = (...c: ([string, DataKind | null] | null | undefined)[]) => c.find((x) => x && x[0].trim()) ?? ['', null];
  const sp = (id: Parameters<typeof first>[1], join = ', '): [string, DataKind | null] | null => (vals(s, id).length ? [vals(s, id).join(join), specKind(id)] : null);
  const intake = (k: keyof Project['intake']): [string, DataKind | null] | null => (p.intake?.[k]?.value ? [p.intake[k].value, p.intake[k].kind] : null);

  const target = (() => {
    const parts = ['ages', 'gender', 'skinTypes', 'concerns'].map((k) => fromBp(k)?.[0]).filter(Boolean) as string[];
    if (parts.length) return [parts.join(' · '), kindOf(e.ages) ?? kindOf(e.skinTypes)] as [string, DataKind | null];
    const sparts = [vals(s, 'ages').join('·'), first(s, 'gender'), vals(s, 'skinTypes').join('·'), vals(s, 'concerns').join('·')].filter(Boolean);
    return sparts.length ? ([sparts.join(' · '), specKind('ages')] as [string, DataKind | null]) : intake('target');
  })();
  const markets = (() => {
    const b = fromBp('markets');
    if (b) return b;
    const m = vals(s, 'markets');
    return m.length ? ([m.map(marketLabel).join(', '), specKind('markets')] as [string, DataKind | null]) : null;
  })();
  const f = formulaOf(p);
  const raw: Record<InputKey, [string, DataKind | null]> = {
    productName: [bp?.productName || p.name, bp?.productName ? (bp.mode === 'ai' ? 'AI_ESTIMATE' : 'DEMO_RECOMMEND') : 'USER_INPUT'],
    category: pick(fromBp('productType'), s.subtype ? [[first(s, 'category'), first(s, 'subtype')].filter(Boolean).join(' > '), specKind('subtype')] : null, intake('category')),
    concept: pick(fromBp('concept'), intake('concept')),
    usp: pick(fromBp('differentiation'), sp('differentiation')),
    target: pick(target),
    price: pick(fromBp('targetPrice'), sp('targetPrice'), intake('price')),
    cost: pick(fromBp('targetCost'), sp('targetCost')),
    texture: pick(fromBp('textureType'), sp('textureType'), f ? [`${f.nameKo} (${f.name})`, 'USER_INPUT'] : null),
    size: pick(fromBp('size'), sp('size')),
    markets: pick(markets),
    firstRun: pick(fromBp('firstRun'), sp('firstRun')),
    benefits: pick(fromBp('benefits'), sp('benefits'), intake('benefit')),
    keywords: pick(fromBp('keywords'), sp('keywords')),
    positioning: pick(fromBp('positioning'), intake('position')),
    container: pick(fromBp('container'), sp('container')),
  };
  return (Object.keys(LABELS) as InputKey[]).map((key) => ({ key, label: LABELS[key], value: raw[key][0], kind: raw[key][0] ? raw[key][1] : null, core: CORE.includes(key) }));
}

export const inputMap = (list: PlanningInput[]) => Object.fromEntries(list.map((x) => [x.key, x.value])) as Record<InputKey, string>;
export const basisKeyOf = (list: PlanningInput[]) => list.filter((x) => x.core).map((x) => x.value).join('|');

// ── server status ───────────────────────────────────────────────────────────

export interface AdapterRow {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'planned';
  description: string;
  env: string[];
  costNote: string;
}
export interface StudioStatus {
  ai: { configured: boolean; model: string | null };
  firecrawl: { configured: boolean; costs: { perImageSearch10: number; perPage: number } };
  imageGen: { configured: boolean; adapters: AdapterRow[] };
  storage: { supabase: boolean };
}

/** null = the API route is not reachable (e.g. a static local preview): every service counts as not connected. */
export async function fetchStudioStatus(signal?: AbortSignal): Promise<StudioStatus | null> {
  try {
    const r = await fetch('/api/packaging', { signal, headers: { accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null;
    return (await r.json()) as StudioStatus;
  } catch {
    return null;
  }
}

export class StudioError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('/api/packaging', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (!r.ok || !j) throw new StudioError(j?.error ?? 'HTTP', j?.message ?? `서버 응답 오류 (${r.status})`);
    return j;
  } catch (e) {
    if (e instanceof StudioError) throw e;
    throw new StudioError('NETWORK', (e as Error).name === 'AbortError' ? '응답 시간이 초과됐습니다.' : '서버에 연결하지 못했습니다.');
  } finally {
    window.clearTimeout(timer);
  }
}

// ── design directions ───────────────────────────────────────────────────────

export async function generateDirections(inputs: PlanningInput[], aiConfigured: boolean): Promise<DesignDirectionSet> {
  const basisKey = basisKeyOf(inputs);
  if (aiConfigured) {
    try {
      const j = await post<{ mode: 'ai'; model: string; directions: DesignDirection[] }>({ action: 'design', inputs: inputMap(inputs) }, 200_000);
      return { mode: 'ai', model: j.model, generatedAt: new Date().toISOString(), basisKey, items: j.directions };
    } catch (e) {
      return { ...demoDirections(inputs), notice: `AI 호출 실패로 데모 규칙을 사용했습니다: ${(e as Error).message}` };
    }
  }
  return demoDirections(inputs, 'ANTHROPIC_API_KEY가 연결되지 않아 규칙 기반 데모 제안을 표시합니다. AI 분석 결과가 아닙니다.');
}

const has = (v: string, re: RegExp) => re.test(v);
const won = (v: string) => {
  const n = Number((v.match(/\d{1,3}(?:,\d{3})+|\d{4,}/)?.[0] ?? '').replace(/,/g, ''));
  if (n) return n;
  const man = v.match(/(\d+(?:\.\d+)?)\s*만/);
  return man ? Math.round(Number(man[1]) * 10000) : null;
};

function defaultContainer(m: Record<InputKey, string>): string {
  if (m.container) return splitList(m.container)[0];
  const t = `${m.texture} ${m.category}`;
  if (has(t, /크림|밤/)) return '단지';
  if (has(t, /캡슐|젤/)) return '펌프';
  if (has(t, /선|클렌|토너|로션/)) return has(t, /토너/) ? '펌프' : '튜브';
  if (has(t, /오일|워터리|앰플|세럼/)) return '스포이드';
  return '에어리스';
}

/** Palette by the main benefit (demo rules). */
function benefitPalette(benefits: string) {
  if (has(benefits, /진정|민감|장벽/)) return { main: { name: '세이지 그린', hex: '#8FA89A' }, soft: { name: '오트 베이지', hex: '#E9E1D3' }, deep: { name: '포레스트', hex: '#2F4A3F' } };
  if (has(benefits, /미백|광채|브라이트/)) return { main: { name: '펄 아이보리', hex: '#F3EDE2' }, soft: { name: '샴페인', hex: '#E3CFAE' }, deep: { name: '웜 그레이', hex: '#6E6259' } };
  if (has(benefits, /탄력|주름|리프팅/)) return { main: { name: '딥 플럼', hex: '#4F3A6B' }, soft: { name: '로즈 골드', hex: '#D8A68F' }, deep: { name: '미드나잇', hex: '#1F1A2E' } };
  if (has(benefits, /보습|수분/)) return { main: { name: '아쿠아 블루', hex: '#9CC5D6' }, soft: { name: '클리어 화이트', hex: '#F5F8FA' }, deep: { name: '딥 네이비', hex: '#1E3A52' } };
  if (has(benefits, /모공|피지|트러블|각질/)) return { main: { name: '쿨 민트', hex: '#A8D5C8' }, soft: { name: '라이트 그레이', hex: '#E6E8EA' }, deep: { name: '차콜', hex: '#33383D' } };
  return { main: { name: '라벤더 그레이', hex: '#BFB1D4' }, soft: { name: '소프트 화이트', hex: '#F7F5FA' }, deep: { name: '잉크 퍼플', hex: '#3B2B51' } };
}

const MATERIAL: Record<string, string> = {
  에어리스: 'PP 또는 PETG 에어리스 (이중 구조 검토)',
  스포이드: '유리 (차광 코팅 또는 앰버) + 스포이드 캡',
  펌프: 'PETG 또는 PET 용기 + PP 펌프',
  튜브: 'PE 튜브 또는 라미네이트 튜브',
  단지: 'PP 이중 단지 또는 유리 단지',
  스프레이: 'PET 용기 + 미스트 펌프',
};
export const materialOf = (container: string) => MATERIAL[container] ?? '공급사와 재질 확인 필요';

const CONTAINER_EN: Record<string, string> = { 에어리스: 'airless pump bottle', 스포이드: 'glass dropper bottle', 펌프: 'pump bottle', 튜브: 'squeeze tube', 단지: 'cream jar', 스프레이: 'mist spray bottle' };

export function demoDirections(inputs: PlanningInput[], notice?: string): DesignDirectionSet {
  const m = inputMap(inputs);
  const price = won(m.price);
  const cost = won(m.cost);
  const pal = benefitPalette(`${m.benefits} ${m.concept} ${m.usp}`);
  const container = defaultContainer(m);
  const premium = price !== null && price >= 40000;
  const budget = price !== null && price < 20000;
  const lowCost = cost !== null && cost < 4000;
  const cite = (k: InputKey) => (m[k] ? `${LABELS[k]} ${m[k]}` : `${LABELS[k]} 미정`);
  const sensitive = has(`${m.target} ${m.benefits}`, /민감|진정/);
  const overseas = m.markets && has(m.markets, /미국|중국|일본|유럽|영국|동남아/);
  const costNote = lowCost ? ' · 목표 원가가 낮아 후가공은 1종으로 제한, 원가 확인 필요' : '';

  const items: DesignDirection[] = [
    {
      id: 'd1',
      name: 'Clinical Minimal',
      summary: '화이트 베이스, 성분·효능 정보를 앞세운 더마 미니멀',
      reason: `${cite('usp')} 전달을 우선. ${cite('target')} 기준 신뢰감 중심${sensitive ? ', 민감 피부 타깃이라 자극 없는 인상' : ''}.`,
      basis: ['USP', '타깃', '제형'],
      mainColors: [{ name: '클리어 화이트', hex: '#F7F7F5' }, pal.main],
      subColors: [{ name: '쿨 그레이', hex: '#9AA0A6' }, pal.deep],
      container: `${container} · ${m.size || '용량 미정'}`,
      material: materialOf(container),
      carton: '화이트 단상자, 정면 상단 제품명·하단 핵심 성분 함량 표기 영역, 측면 사용법',
      typography: '산세리프 (가는 굵기), 성분명은 대문자 영문 강조',
      finishing: `용기 1도 실크스크린, 단상자 무광 코팅${lowCost ? '' : ' + 부분 UV'}${costNote}`,
      targetFit: `${cite('target')}: 정보 확인형 구매에 맞는 정돈된 레이아웃`,
      imagePrompt: `minimal clinical dermatology ${CONTAINER_EN[container] ?? 'bottle'}, matte white, ${pal.main.hex} accent, clean sans-serif label area`,
    },
    {
      id: 'd2',
      name: sensitive ? 'Calm Botanical' : 'Soft Everyday',
      summary: '저채도 컬러와 둥근 형태로 부드러운 사용감을 표현',
      reason: `${cite('texture')} 사용감과 ${cite('concept')}을 색·형태로 연결. ${budget ? `${cite('price')}대 데일리 제품에 맞는 가벼운 인상.` : '일상 루틴 제품 이미지.'}`,
      basis: ['컨셉', '제형', '판매가'],
      mainColors: [pal.main, pal.soft],
      subColors: [{ name: '웜 화이트', hex: '#FBF8F3' }, pal.deep],
      container: `${container} (라운드 숄더) · ${m.size || '용량 미정'}`,
      material: materialOf(container).replace('유리', 'PET 또는 유리'),
      carton: `${pal.soft.name} 크라프트 질감 단상자, 일러스트 또는 패턴 1종, FSC 인증 용지 검토`,
      typography: '라운드 산세리프 + 한글 고딕, 여백 넉넉하게',
      finishing: `용기 컬러 사출 또는 소프트 터치 코팅, 단상자 2도 인쇄${costNote}`,
      targetFit: `${cite('target')}: 편안함·순함을 직관적으로 전달`,
      imagePrompt: `soft botanical skincare ${CONTAINER_EN[container] ?? 'bottle'}, muted ${pal.main.hex} and ${pal.soft.hex}, rounded shape, matte soft-touch finish`,
    },
    {
      id: 'd3',
      name: premium ? 'Premium Lab Luxe' : 'Bold Signature',
      summary: '딥 컬러와 메탈 포인트로 고기능·고가 이미지',
      reason: `${cite('price')} 가격대와 ${cite('benefits')} 효능을 고급감으로 표현${overseas ? `. ${cite('markets')} 진열 시 눈에 띄는 대비` : ''}${lowCost ? `. 단 ${cite('cost')}에서는 후가공 비용 확인 필요` : ''}.`,
      basis: ['판매가', '핵심 효능', '판매 국가', '목표 원가'],
      mainColors: [pal.deep, { name: '샴페인 골드', hex: '#C8A97E' }],
      subColors: [pal.main, { name: '오프 화이트', hex: '#F4F1EC' }],
      container: `${container === '튜브' ? '에어리스' : container} (무게감 있는 형태) · ${m.size || '용량 미정'}`,
      material: materialOf(container === '튜브' ? '에어리스' : container),
      carton: '딥 컬러 단상자, 정면 박(골드) 로고, 형압으로 패턴 표현, 내부 인서트 검토',
      typography: '세리프 영문 로고 + 가는 산세리프 본문',
      finishing: `용기 증착 또는 핫스탬핑, 단상자 박 + 형압 + 무광 라미네이팅 (원가 확인 필요)`,
      targetFit: `${cite('target')}: 선물·프리미엄 구매 동기 강화`,
      imagePrompt: `luxury premium skincare ${CONTAINER_EN[container === '튜브' ? '에어리스' : container] ?? 'bottle'}, deep ${pal.deep.hex} with champagne gold metallic accents, elegant serif label area`,
    },
  ];
  return { mode: 'demo', generatedAt: new Date().toISOString(), basisKey: basisKeyOf(inputs), notice, items };
}

// ── references ──────────────────────────────────────────────────────────────

export interface ReferenceSearchResult {
  queries: string[];
  runs: { query: string; fromCache: boolean; results: number; credits: number; searchedAt: string }[];
  creditsUsed: number;
  references: PackagingReference[];
  excluded: { pageUrl: string; reason: string }[];
  unchecked: number;
  warnings: string[];
}

export function searchReferences(inputs: PlanningInput[], direction: DesignDirection | undefined, queries?: string[], refresh = false) {
  return post<ReferenceSearchResult>({ action: 'references', inputs: inputMap(inputs), direction: direction ? { name: direction.name, container: direction.container, imagePrompt: direction.imagePrompt } : null, queries, refresh }, 110_000);
}

export function collectPage(url: string) {
  return post<{ references: PackagingReference[]; creditsUsed: number; robots: string }>({ action: 'page', url }, 110_000);
}

export const KIND_LABEL: Record<PackagingReference['kind'], string> = { container: '용기', carton: '단상자', set: '용기+단상자', unknown: '구분 미확인' };

// ── mockups ─────────────────────────────────────────────────────────────────

export const CONTAINER_OPTIONS = ['에어리스', '스포이드', '펌프', '튜브', '단지', '스프레이'];
export const STYLE_OPTIONS: { id: string; label: string }[] = [
  { id: 'minimal clinical', label: '미니멀 · 클리니컬' },
  { id: 'soft botanical natural', label: '내추럴 · 보태니컬' },
  { id: 'luxury premium metallic', label: '프리미엄 · 럭셔리' },
  { id: 'playful colorful pop', label: '컬러풀 · 팝' },
  { id: 'vintage apothecary', label: '빈티지 · 아포테카리' },
];
export const LAYOUT_OPTIONS = ['중앙', '상단', '하단', '세로'];
export const MOCKUP_KINDS: { id: MockupMeta['kind']; label: string }[] = [
  { id: 'container', label: '용기 단독' },
  { id: 'carton', label: '단상자 단독' },
  { id: 'set', label: '용기 + 단상자 세트' },
  { id: 'colorway', label: '컬러 변형안' },
];

export function defaultMockupOptions(d: DesignDirection | undefined): MockupOptions {
  const container = CONTAINER_OPTIONS.find((c) => d?.container.includes(c)) ?? '에어리스';
  const style = d ? (STYLE_OPTIONS.find((s) => /luxe|premium|signature/i.test(d.name) && s.id.startsWith('luxury')) ?? STYLE_OPTIONS.find((s) => /botanical|calm|soft/i.test(d.name) && s.id.startsWith('soft')) ?? STYLE_OPTIONS[0]) : STYLE_OPTIONS[0];
  return { container, mainColor: d?.mainColors[0]?.hex ?? '#F7F7F5', subColor: d?.subColors[0]?.hex ?? d?.mainColors[1]?.hex ?? '#C8A97E', style: style.id, labelLayout: '중앙', carton: d?.carton ?? '' };
}

export interface MockupResponse {
  id: string;
  kind: MockupMeta['kind'];
  prompt: string;
  provider: string;
  model: string;
  mime: string;
  image: string;
  stored: 'supabase' | 'none';
  storageError: string | null;
  createdAt: string;
}

export function requestMockup(projectId: string, kind: MockupMeta['kind'], o: MockupOptions & { variantColor?: string }, d: DesignDirection | undefined, size: string, texture: string) {
  return post<MockupResponse>({ action: 'mockup', projectId, options: { kind, ...o, direction: d?.imagePrompt ?? '', size, texture } }, 90_000);
}

// ── manufacturing feasibility (rules, all "확인 필요") ──────────────────────

export interface FitCheck {
  item: string;
  note: string;
}

export function fitChecks(p: Project, container: string, material: string): FitCheck[] {
  const m = inputMap(planningInputs(p));
  const hero = `${p.blueprint?.entries.hero?.value ?? ''} ${p.blueprint?.entries.supporting?.value ?? ''} ${vals(p.spec, 'mustInclude').join(' ')}`;
  const tex = m.texture;
  const out: FitCheck[] = [];
  if (has(hero, /레티|retin|비타민\s?c|아스코빅|ascorb|NAD|나이아신아마이드 고함량/i)) out.push({ item: '산화·광 민감 원료', note: `${hero.match(/레티\S*|retin\S*|비타민\s?C|아스코빅\S*|NAD\+?/i)?.[0] ?? '민감 원료'} 포함 → 차광 재질·공기 차단 구조(에어리스) 검토. 안정성 시험으로 확인 필요` });
  if (has(tex, /오일|밤/) && has(material, /AS|PS|PETG/)) out.push({ item: '오일 제형 × 플라스틱 재질', note: '오일 성분은 일부 플라스틱(AS·PS 등)에 크랙·변형을 일으킬 수 있음 → 재질 호환성 시험 필요' });
  if (has(tex, /크림|밤/) && has(container, /스포이드|스프레이/)) out.push({ item: '점도 × 토출 구조', note: '고점도 제형은 스포이드·스프레이 토출이 어려움 → 에어리스·단지 검토' });
  if (has(tex, /워터리|토너/) && has(container, /단지/)) out.push({ item: '점도 × 토출 구조', note: '저점도 제형은 단지 사용 시 흘러내림 → 펌프·스포이드 검토' });
  if (has(tex, /캡슐/)) out.push({ item: '캡슐 제형', note: '캡슐이 깨지지 않는 넓은 토출구 펌프 구조 필요 → 토출 시험 필요' });
  if (has(tex, /젤/) && has(container, /에어리스|펌프/)) out.push({ item: '젤 점도 × 펌프', note: '펌프 토출량·토출 압력이 점도에 맞는지 확인 필요' });
  if (has(container, /스포이드/)) out.push({ item: '스포이드 고무(벌브)', note: '내용물과 고무 재질(NBR·실리콘 등) 반응·변색 여부 확인 필요' });
  if (has(container, /에어리스/)) out.push({ item: '에어리스 잔량', note: '피스톤 구조에 따라 잔량·토출 불량 가능 → 실제 내용물로 토출 시험 필요' });
  out.push({ item: '누액·변색·중량 변화', note: '용기 적합성 시험(고온·저온·사이클)으로 확인 필요' });
  if (m.markets && has(m.markets, /유럽|영국/)) out.push({ item: '재활용 표기', note: 'EU·영국 포장재 재활용 표기 규정 확인 필요' });
  return out;
}

export const MATERIAL_CANDIDATES: Record<string, string[]> = {
  에어리스: ['PP', 'PETG', 'AS(투명)', 'PCR PP'],
  스포이드: ['유리(투명)', '유리(앰버·차광 코팅)', 'PET'],
  펌프: ['PETG', 'PET', 'PP', 'PCR PET'],
  튜브: ['PE', 'PE 라미네이트(PBL)', '알루미늄 라미네이트(ABL)', 'PCR PE'],
  단지: ['PP 이중', 'PETG', '유리'],
  스프레이: ['PET', 'PP'],
};

export const PRINT_METHODS = {
  container: ['실크스크린', '핫스탬핑(박)', '열전사', '증착(메탈라이징)', '컬러 사출', '소프트 터치 코팅', '라벨 부착'],
  carton: ['오프셋 인쇄', '박 가공', '형압(엠보싱)', '부분 UV', '무광·유광 라미네이팅', '친환경 용지(FSC)'],
};

// ── Packaging Brief ─────────────────────────────────────────────────────────

export const selectedDirection = (s: PackagingStudio | undefined) => s?.directions?.items.find((d) => d.id === s.selectedDirectionId);

export function quoteText(q: { supplier: string; unitPrice: number | null; moq: number | null; date: string } | undefined) {
  if (!q || q.unitPrice == null) return '견적 필요 (공급사 견적 전, 확정 단가 없음)';
  return `${q.unitPrice.toLocaleString('ko-KR')}원 · ${q.supplier || '공급사 미기재'}${q.moq ? ` · MOQ ${q.moq.toLocaleString('ko-KR')}개` : ''}${q.date ? ` · ${q.date} 견적` : ''} (사용자 입력)`;
}

export interface PackagingBriefRow {
  key: string;
  label: string;
  value: string;
  kind: DataKind;
}

/** Rows of the Packaging Brief. Empty until a design direction is selected. */
export function packagingBriefRows(p: Project): PackagingBriefRow[] {
  const s = p.packagingStudio;
  const d = selectedDirection(s);
  if (!s || !d) return [];
  const m = inputMap(planningInputs(p));
  const dirKind: DataKind = s.directions?.mode === 'ai' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND';
  const container = s.mockupOptions?.container ?? CONTAINER_OPTIONS.find((c) => d.container.includes(c)) ?? d.container;
  const refs = (s.references ?? []).filter((r) => r.imageStatus === 'ok');
  const mockups = (s.mockups ?? []).filter((x) => x.pinned);
  const allMockups = s.mockups ?? [];
  const id = s.identity;
  const checks = fitChecks(p, container, s.material ?? d.material);
  return [
    { key: 'pk-name', label: '제품명', value: [id?.brandName, id?.productName || m.productName].filter(Boolean).join(' ') || p.name, kind: id?.productName ? 'USER_INPUT' : 'AI_ESTIMATE' },
    { key: 'pk-concept', label: '디자인 컨셉', value: `${d.name} · ${d.summary}. 근거: ${d.reason}`, kind: dirKind },
    { key: 'pk-palette', label: '컬러 팔레트', value: `메인 ${d.mainColors.map((c) => `${c.name} ${c.hex}`).join(', ')} / 서브 ${d.subColors.map((c) => `${c.name} ${c.hex}`).join(', ')}${s.mockupOptions && s.mockupOptions.mainColor !== d.mainColors[0]?.hex ? ` / 시안 메인 컬러 변경 ${s.mockupOptions.mainColor}` : ''}`, kind: dirKind },
    { key: 'pk-container', label: '용기 사양', value: `${container} · ${m.size || '용량 미정'} · 재질 후보 ${s.material ?? d.material} · 인쇄 ${d.finishing}. 단가 ${quoteText(s.quotes?.container)}`, kind: dirKind },
    { key: 'pk-carton', label: '단상자 사양', value: `${d.carton} · 타이포 ${d.typography}. 단가 ${quoteText(s.quotes?.carton)}`, kind: dirKind },
    { key: 'pk-mockups', label: 'AI 시안', value: allMockups.length ? `AI Concept Mockup ${allMockups.length}장 생성${mockups.length ? ` · 기획서 첨부 ${mockups.length}장 (${mockups.map((x) => MOCKUP_KINDS.find((k) => k.id === x.kind)?.label).join(', ')})` : ''} · ${allMockups[0].provider} ${allMockups[0].model}` : '생성된 시안 없음 (이미지 생성 API 연결 후 생성 가능)', kind: allMockups.length ? 'AI_ESTIMATE' : 'USER_INPUT' },
    { key: 'pk-refs', label: '참고 레퍼런스', value: refs.length ? refs.slice(0, 6).map((r) => `${r.brand ?? r.site}${r.productName ? ` ${r.productName}` : ''} (${KIND_LABEL[r.kind]}, ${r.source}, ${r.collectedAt.slice(0, 10)} 수집) ${r.pageUrl}`).join(' / ') : '저장된 레퍼런스 없음', kind: refs.length ? 'EXTERNAL' : 'USER_INPUT' },
    { key: 'pk-mfg', label: '제조 검토 사항', value: `${checks.map((c) => c.item).join(', ')} → 모두 확인 필요 (용기 적합성 시험 전). 초도 수량 ${m.firstRun || '미정'}: 용기·단상자 MOQ 공급사 확인 필요`, kind: 'AI_ANALYSIS' },
  ];
}
