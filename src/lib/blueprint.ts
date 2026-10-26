import { BLUEPRINT_DEPENDENTS, BLUEPRINT_FIELDS, blueprintField, MARKET_NAMES, type BlueprintFieldDef } from '@/data/blueprintFields';
import { fieldById, MARKETS, marketLabel } from '@/data/intakeSpec';
import type { Blueprint, BlueprintEntry, Intake, RegulatoryCheck, Spec, SpecAnswer } from '@/data/types';
import { analyzeIdea } from './intake';
import { initialSpec } from './spec';

// ── small helpers ───────────────────────────────────────────────────────────

export const UNDECIDED = '미정';
export const splitList = (v: string) =>
  v
    .split(/\s*[,，、/]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
export const isUndecided = (e: BlueprintEntry | undefined) => !e || e.origin === 'UNDETERMINED' || !e.value.trim() || e.value.trim() === UNDECIDED;

/** "3만원대" / "3.2만 원" → "32,000원" so later steps can read the amount; other text is kept */
export function wonText(v: string): string {
  const full = v.match(/\d{1,3}(?:,\d{3})+|\d{4,}/);
  if (full) return `${Number(full[0].replace(/,/g, '')).toLocaleString('ko-KR')}원`;
  const man = v.match(/(\d+(?:\.\d+)?)\s*만/);
  if (man) return `${Math.round(Number(man[1]) * 10000).toLocaleString('ko-KR')}원`;
  return v;
}

/** market names typed by the user or the AI → spec codes (KR, US, ...) */
export function marketCodes(v: string): string[] {
  const out: string[] = [];
  for (const part of splitList(v)) {
    const p = part.toLowerCase();
    const code = Object.entries(MARKET_NAMES).find(([c, names]) => c.toLowerCase() === p || names.some((n) => p.includes(n)))?.[0] ?? MARKETS.find((m) => m.label === part)?.value;
    const v2 = code ?? part;
    if (!out.includes(v2)) out.push(v2);
  }
  return out;
}
const marketsIn = (text: string) => Object.entries(MARKET_NAMES).filter(([, names]) => names.some((n) => (/^[a-z]+$/.test(n) ? new RegExp(`\\b${n}\\b`, 'i') : new RegExp(n)).test(text))).map(([c]) => c);

/** "스킨케어 > 앰플/세럼" → { category: '스킨케어', type: '앰플/세럼' } */
export function splitKind(v: string): { category: string; type: string } {
  const [a, b] = v.split(/\s*>\s*/);
  return b === undefined ? { category: '', type: a.trim() } : { category: a.trim(), type: b.trim() };
}

// ── API (server side AI) ────────────────────────────────────────────────────

export interface AiStatus {
  configured: boolean;
  model: string | null;
}

/** null when the API route does not exist (local preview) or cannot be reached. */
export async function aiStatus(signal?: AbortSignal): Promise<AiStatus | null> {
  try {
    const r = await fetch('/api/blueprint', { signal, headers: { accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null;
    const j = (await r.json()) as Partial<AiStatus>;
    return { configured: j.configured === true, model: typeof j.model === 'string' ? j.model : null };
  } catch {
    return null;
  }
}

interface AiAnswer {
  mode: 'ai';
  model: string;
  productName: string;
  entries: BlueprintEntry[];
  regulatory: RegulatoryCheck[];
}

const fieldPayload = (f: BlueprintFieldDef) => ({ key: f.key, label: f.label, guide: f.guide, options: f.options, multi: f.multi, verify: f.verify });

/**
 * Collected competitor products (Competitors screen) sent with AI refresh requests so the model can
 * cite them. Set by the competitor evidence panel; empty until real products are collected.
 */
export interface CompetitorContext {
  brand: string;
  product: string;
  price: string;
  size: string;
  per100Krw: number | null;
  keyIngredients: string[];
  usp: string[];
  url: string;
  collectedAt: string;
}
let competitorContext: CompetitorContext[] = [];
export const setCompetitorContext = (list: CompetitorContext[]) => {
  competitorContext = list.slice(0, 10);
};

async function callAi(idea: string, opts: { keys?: string[]; context?: Blueprint; avoid?: Record<string, string[]> } = {}): Promise<AiAnswer> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 290_000);
  try {
    const r = await fetch('/api/blueprint', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idea,
        fields: BLUEPRINT_FIELDS.map(fieldPayload),
        keys: opts.keys,
        context: opts.context ? Object.fromEntries(Object.values(opts.context.entries).map((e) => [e.fieldKey, { value: e.value, origin: e.origin }])) : undefined,
        avoid: opts.avoid,
        competitors: competitorContext.length ? competitorContext : undefined,
      }),
    });
    const j = (await r.json().catch(() => null)) as (AiAnswer & { message?: string }) | null;
    if (!r.ok || !j || j.mode !== 'ai') throw new Error(j?.message ?? `AI 서버 응답 오류 (${r.status})`);
    return j;
  } catch (e) {
    throw new Error(e instanceof DOMException && e.name === 'AbortError' ? 'AI 응답 시간이 초과되었습니다.' : e instanceof Error ? e.message : 'AI 서버에 연결하지 못했습니다.');
  } finally {
    window.clearTimeout(timer);
  }
}

// ── Demo Mode (rule-based, clearly labeled; not an AI analysis) ─────────────

interface Candidate {
  value: string;
  reason: string;
  origin?: BlueprintEntry['origin'];
}

const INGREDIENTS: Record<string, { hero: string[]; actives: string[] }> = {
  탄력: { hero: ['펩타이드 복합체', 'PDRN'], actives: ['아데노신', '콜라겐 유래 펩타이드', '레티날(저농도)'] },
  주름: { hero: ['아데노신', '레티놀 유도체'], actives: ['아데노신', '바쿠치올', '펩타이드'] },
  미백: { hero: ['나이아신아마이드', '알부틴'], actives: ['나이아신아마이드', '알부틴', '비타민C 유도체'] },
  진정: { hero: ['병풀 추출물(시카)', '마데카소사이드'], actives: ['마데카소사이드', '판테놀', '알란토인'] },
  보습: { hero: ['히알루론산 복합체', '세라마이드'], actives: ['히알루론산', '글리세린', '베타인'] },
  장벽: { hero: ['세라마이드', '콜레스테롤·지방산 복합체'], actives: ['세라마이드', '판테놀', '스쿠알란'] },
  모공: { hero: ['나이아신아마이드', 'PHA'], actives: ['나이아신아마이드', '아연 PCA', 'PHA'] },
  피지: { hero: ['아연 PCA', '나이아신아마이드'], actives: ['아연 PCA', '티트리 추출물', '나이아신아마이드'] },
  광채: { hero: ['비타민C 유도체', '나이아신아마이드'], actives: ['비타민C 유도체', '글루타치온', '나이아신아마이드'] },
  각질: { hero: ['PHA', '효소'], actives: ['PHA', '파파인 효소', '판테놀'] },
};
const REG_ITEMS: Record<string, string[]> = {
  KR: ['식약처 기능성화장품 보고·심사 해당 여부 확인', '표시·광고 실증 대상 표현 확인'],
  US: ['MoCRA 시설 등록·제품 리스팅 대상 여부 확인', 'OTC 의약품 해당 표현·성분 여부 확인', 'INCI 전성분 표기 확인'],
  CN: ['NMPA 일반/특수 화장품 등록·신고 구분 확인', '사용 원료가 기사용 원료 목록에 있는지 확인', '효능 표시 근거 자료 요건 확인'],
  JP: ['화장품/의약부외품 구분 확인', '전성분 표시·수입 판매업 허가 확인'],
  EU: ['CPNP 등록과 책임자(RP) 지정 확인', '사용 제한 원료(Annex) 해당 여부 확인', 'CPSR 안전성 평가 확인'],
  UK: ['SCPN 등록과 책임자 지정 확인', '사용 제한 원료 확인'],
  SEA: ['국가별 ASEAN 화장품 신고(Notification) 확인', '할랄 요구 여부 확인'],
};
const regItemsOf = (code: string) => REG_ITEMS[code] ?? ['해당 국가의 화장품 등록·원료·표시 규정 확인'];

function ruleSpec(idea: string, intake: Intake): Spec {
  const spec = initialSpec(intake);
  const user = (value: string[]): SpecAnswer => ({ mode: 'idea', value });
  const found = (re: RegExp) => re.test(idea);
  const markets = marketsIn(idea);
  if (markets.length) spec.markets = user(markets);
  const texture = ['워터리', '밀키', '젤', '크림', '밤', '오일', '캡슐'].find((t) => idea.includes(t));
  if (texture) spec.textureType = user([texture]);
  const skins = [found(/민감/) && '민감성', found(/건성|건조/) && '건성', found(/지성/) && '지성', found(/복합/) && '복합성'].filter(Boolean) as string[];
  if (skins.length) spec.skinTypes = user(skins);
  if (found(/무향/)) spec.scent = user(['무향']);
  const size = idea.match(/(\d{2,3})\s*ml/i);
  if (size) spec.size = user([`${size[1]}ml`]);
  const container = ['에어리스', '펌프', '스포이드', '튜브', '단지', '스프레이'].find((t) => idea.includes(t));
  if (container) spec.container = user([container]);
  const cost = idea.match(/원가[^\d]{0,6}([\d,.]+)\s*(만)?\s*원/);
  if (cost) spec.targetCost = user([`${Math.round(Number(cost[1].replace(/,/g, '')) * (cost[2] ? 10000 : 1)).toLocaleString('ko-KR')}원`]);
  const run = idea.match(/(?:초도|MOQ)[^\d]{0,6}([\d,]+)\s*개?/i);
  if (run) spec.firstRun = user([`${Number(run[1].replace(/,/g, '')).toLocaleString('ko-KR')}개`]);
  return spec;
}

function demoCandidates(key: string, idea: string, intake: Intake, spec: Spec, current: Record<string, BlueprintEntry>): Candidate[] {
  const out = demoCandidatesRaw(key, idea, intake, spec, current);
  if (key !== 'productType') return out;
  // one item holds "카테고리 > 세부 유형"
  const cat = spec.category?.value[0] || fieldById('category').demo({ idea, intake, spec }).value[0] || '스킨케어';
  return out.map((c) => (c.value.includes('>') ? c : { ...c, value: `${cat} > ${c.value}` }));
}

function demoCandidatesRaw(key: string, idea: string, intake: Intake, spec: Spec, current: Record<string, BlueprintEntry>): Candidate[] {
  const f = blueprintField(key)!;
  const val = (k: string) => current[k]?.value ?? '';
  const benefits = splitList(val('benefits') || intake.benefit.value).filter((b) => b !== '안티에이징');
  const sensitive = /민감|저자극|진정/.test(idea + val('skinTypes') + val('concerns'));
  const markets = marketCodes(val('markets'));
  const overseas = markets.filter((m) => m !== 'KR');
  const productType = splitKind(val('productType')).type || '앰플/세럼';
  const ages = val('ages') || '30대';
  const ing = (kind: 'hero' | 'actives') => [...new Set(benefits.flatMap((b) => INGREDIENTS[b]?.[kind] ?? []))].filter((x) => !(sensitive && /레티/.test(x)));
  const stated = spec[f.spec ?? ('' as never)];

  // 1. stated in the idea text → USER_PROVIDED, kept as written
  if (f.spec && stated && stated.mode === 'idea' && stated.value.length) {
    const phrase = key === 'targetPrice' ? idea.match(/\d+(?:\.\d+)?\s*만\s*원대?|[\d,]{4,}\s*원대?/)?.[0] : undefined;
    const value = f.spec === 'markets' ? stated.value.map(marketLabel).join(', ') : phrase ? `${phrase} (중간값 약 ${stated.value[0]})` : stated.value.join(', ');
    return [{ value, reason: '아이디어 문장에 직접 적은 조건입니다.', origin: 'USER_PROVIDED' }];
  }
  if (key === 'lowIrritation' && /저자극/.test(idea))
    return [{ value: '저자극 설계 (무향, 자극 우려 원료 최소화, 피부 자극 시험 진행)', reason: '아이디어 문장에 "저자극"을 직접 적었습니다.', origin: 'USER_PROVIDED' }];

  // 2. items mapped to the detailed intake reuse its demo rules, then the other choices as alternatives
  const fromSpec: Candidate[] = [];
  // these demo rules below fit the blueprint better than the generic wizard suggestion
  const ownRule = key === 'keywords' || (sensitive && (key === 'exclude' || key === 'scent'));
  if (f.spec && !ownRule) {
    const d = fieldById(f.spec).demo({ idea, intake, spec });
    const value = f.spec === 'markets' ? d.value.map(marketLabel).join(', ') : f.spec === 'priorityMarket' ? d.value.map(marketLabel).join(', ') : d.value.join(', ');
    if (value) fromSpec.push({ value, reason: d.reason });
  }

  const cands: Candidate[] = (() => {
    switch (key) {
      case 'exportSafe':
        return [{ value: markets.length ? `${markets.map(marketLabel).join('·')} 공통 사용 가능 원료로만 구성. 국가별 금지·제한 원료 확인 필요.` : '수출 국가 확정 후 원료 사용 기준 확인 필요.', reason: '수출 희망 국가에서 문제없는 원료로만 구성하기 위한 조건입니다. 실제 사용 가능 여부는 공식 규제 자료로 확인해야 합니다.' }];
      case 'marketingChannels': {
        const young = /10대|20대/.test(ages);
        return [
          { value: young ? '인스타그램, 틱톡, 인플루언서 시딩' : sensitive ? '인스타그램, 체험단, 검색 광고' : '인스타그램, 유튜브, 체험단', reason: '타깃 연령과 제품 특성에서 정한 홍보 채널 후보입니다.' },
          { value: '유튜브, 인플루언서 시딩, 검색 광고', reason: '다른 채널 조합 후보입니다.' },
        ];
      }
      case 'launchPromotion': {
        const ch = splitList(val('channels'))[0] ?? '자사몰';
        return [
          { value: `${ch} 런칭 기획전 진행, 체험단 리뷰 선확보 후 ${benefits[0] ?? '핵심'} 효능 중심 콘텐츠 집행.`, reason: '유통채널과 핵심 효능에서 정한 런칭 전략 후보입니다.' },
          { value: '출시 첫 달 1+1 또는 미니 증정으로 첫 구매 유도, 리뷰 이벤트 병행.', reason: '다른 프로모션 후보입니다.' },
        ];
      }
      case 'keywords':
        return [
          { value: [...benefits.slice(0, 2), ...(sensitive ? ['저자극'] : []), productType.split('/')[0], ages].join(', '), reason: '효능·타깃·제품 유형에서 뽑은 키워드 후보입니다.' },
          { value: [`${benefits[0] ?? '데일리'} 루틴`, '가벼운 사용감', ...(sensitive ? ['민감 피부'] : [])].join(', '), reason: '사용 경험 중심 키워드 후보입니다.' },
        ];
      case 'scent':
        return sensitive ? [{ value: '무향', reason: '민감·저자극 조건이라 향료를 빼는 것을 우선 제안했습니다.' }] : [];
      case 'priorityMarket':
        return markets.length ? markets.map((m) => ({ value: marketLabel(m), reason: m === markets[0] ? '판매 국가 중 처음 언급한 국가를 우선 출시로 가정했습니다.' : '다른 판매 국가 후보입니다.' })) : [];
      case 'concept':
        return [
          { value: `${ages} ${sensitive ? '민감 피부 ' : ''}타깃 데일리 ${benefits.slice(0, 2).join('·') || '보습'} ${productType}. ${ing('hero')[0] ?? '핵심 원료'} 중심 집중 처방.`, reason: '타깃·효능·제품 유형·대표 원료를 컨셉 문장으로 묶었습니다.' },
          { value: `${benefits[0] ?? '핵심'} 효능에 집중한 고농축 ${productType}`, reason: '효능 집중형 컨셉 후보입니다.' },
          { value: `가볍게 바르는 ${benefits[0] ?? '데일리'} 루틴 ${productType}`, reason: '사용감 중심 컨셉 후보입니다.' },
        ];
      case 'differentiation':
        return [
          { value: `${ing('hero')[0] ?? '핵심 원료'} 중심 단순 처방${sensitive ? ', 향료·자극 우려 원료 배제' : ', 가벼운 사용감'}. ${sensitive ? '자극 걱정 없는 ' : ''}매일 ${benefits.slice(0, 2).join('·') || '피부'} 케어.`, reason: '차별점과 소비자에게 전달할 핵심 가치를 함께 정리했습니다.' },
          { value: `빠른 흡수의 가벼운 제형으로 레이어링 부담 최소화. ${ing('hero')[0] ?? '핵심 원료'}로 완성하는 ${benefits[0] ?? '데일리'} 케어.`, reason: '사용감 중심 차별화 후보입니다.' },
        ];
      case 'usp':
        return [
          { value: `${sensitive ? '자극 걱정 없는 ' : ''}매일 ${benefits.slice(0, 2).join('·') || '피부'} 케어.`, reason: '핵심 효능과 타깃 니즈를 한 줄로 정리했습니다. 효능 표현은 실증 자료 확인이 필요합니다.' },
          { value: `${ing('hero')[0] ?? '핵심 원료'}로 완성하는 ${benefits[0] ?? '데일리'} 케어.`, reason: '원료 중심 USP 후보입니다.' },
        ];
      case 'motivation':
        return [{ value: `${benefits[0] ?? '피부'} 개선은 원하나 ${sensitive ? '자극·트러블 우려가 큼' : '복잡한 루틴은 원치 않음'}.`, reason: '타깃과 효능에서 추정한 구매 동기입니다. 실제 소비자 데이터로 확인이 필요합니다.' }];
      case 'needs':
        return [{ value: `${benefits.join('·') || '보습'} 효과 체감, ${sensitive ? '낮은 자극, ' : ''}끈적임 없는 마무리.`, reason: '효능·피부 타입에서 추정한 니즈입니다.' }];
      case 'sensory':
        return [
          { value: `${val('textureType') || '가벼운'} 제형, ${val('absorption') === '느림' ? '천천히' : '빠르게'} 흡수 후 ${val('finish') ? splitList(val('finish')).join('·') : '촉촉한'} 마무리.`, reason: '제형·흡수·마무리감 항목과 맞춘 설명입니다.' },
          { value: '첫 터치 촉촉, 마무리는 끈적임 없이 정돈.', reason: '다른 사용감 표현 후보입니다.' },
        ];
      case 'hero': {
        const h = ing('hero');
        return h.length ? [{ value: h.slice(0, 2).join(', '), reason: `핵심 효능(${benefits.join('·')})에 자주 쓰이는 원료 후보입니다.` }, ...h.slice(2).map((x) => ({ value: x, reason: '다른 대표 원료 후보입니다.' }))] : [{ value: '히알루론산 복합체', reason: '효능 정보가 적어 보습 원료를 기본 후보로 두었습니다.' }];
      }
      case 'actives': {
        const a = ing('actives');
        return [{ value: a.slice(0, 3).join(', ') || '판테놀, 글리세린', reason: '핵심 효능별 효능 원료 후보입니다. 함량·단가는 원료사 확인이 필요합니다.' }, { value: a.slice(1, 4).join(', ') || '베타인, 알란토인', reason: '다른 조합 후보입니다.' }];
      }
      case 'supporting':
        return [
          { value: sensitive ? '판테놀, 알란토인, 베타인' : '글리세린, 부틸렌글라이콜, 베타인', reason: '보습·안정성을 돕는 보조 원료 후보입니다.' },
          { value: '스쿠알란, 소듐하이알루로네이트, 알란토인', reason: '다른 보조 원료 후보입니다.' },
        ];
      case 'exclude':
        return [
          { value: sensitive ? '합성 향료, 에센셜 오일, 고농도 산(AHA)' : '합성 향료', reason: sensitive ? '민감 피부 타깃에서 자극 우려로 흔히 제외하는 원료입니다.' : '향 민감도를 고려한 후보입니다.' },
          ...(overseas.length ? [{ value: '판매 국가별 사용 제한 원료 (확인 필요)', reason: '판매 국가 규제 확인 후 정합니다.' }] : []),
        ];
      case 'lowIrritation':
        return [{ value: sensitive ? '무향, 저자극 원료 위주 처방, 피부 자극 시험 진행' : '일반 처방, 자극 우려 원료 최소화', reason: sensitive ? '민감·저자극 조건에서 정한 방향입니다.' : '자극 관련 언급이 없어 기본 방향으로 두었습니다.' }];
      case 'rationale':
        return [{ value: `${benefits.join('·') || '보습'} 효능 원료 중심${sensitive ? ', 자극 우려 원료(고농도 레티노이드·향료) 배제' : ', 사용감 저해 원료 최소화'}.`, reason: '원료 후보를 고른 기준입니다.' }];
      case 'compatibility':
        return [{ value: `${val('hero') || '대표 원료'}의 ${val('textureType') || '제형'} 내 안정성·권장 함량·pH 범위 제조사 확인 필요`, reason: '원료와 제형 조합은 실제 처방 테스트가 필요합니다.' }];
      case 'material':
        return [
          { value: val('container') === '에어리스' ? 'PP' : val('container') === '스포이드' ? '유리' : 'PETG 또는 PP', reason: '권장 패키지와 맞는 일반적인 재질 후보입니다.' },
          { value: '재활용 PP (친환경 옵션)', reason: '친환경 재질 후보입니다.' },
        ];
      case 'positioning':
        return [{ value: intake.position.value ? `${intake.position.value}, ${sensitive ? '더마·저자극 이미지' : '데일리 효능 이미지'}` : '중가 데일리 효능 제품', reason: '목표 판매가와 효능에서 정한 포지셔닝입니다.' }];
      case 'countryIngredients':
        return [{ value: markets.length ? markets.map((m) => `${marketLabel(m)}: 규제 확인 필요`).join(' / ') : '판매 국가 확정 후 확인 필요', reason: '국가별 원료 사용 가능 여부는 공식 규제 자료로 확인해야 합니다.' }];
      case 'functionalClass':
        return [{ value: benefits.some((b) => ['탄력', '주름', '미백'].includes(b)) ? `기능성(${benefits.filter((b) => ['탄력', '주름', '미백'].includes(b)).join('·')}) 해당 여부 확인 필요${overseas.length ? ' · 해외는 국가별 분류 확인 필요' : ''}` : '일반 화장품 가능성 높음 (확인 필요)', reason: '효능 표현에 따라 기능성 분류가 달라집니다.' }];
      case 'claims':
        return [{ value: `"${benefits[0] ?? '효능'}" 관련 효능 표현, "${sensitive ? '저자극' : '피부 개선'}" 표현의 실증 필요 여부 확인`, reason: '효능·저자극 표현은 실증 자료가 필요할 수 있습니다.' }];
      case 'procedures':
        return [{ value: markets.length ? markets.map((m) => `${marketLabel(m)}: ${regItemsOf(m)[0]}`).join(' / ') : '판매 국가 확정 후 확인 필요', reason: '국가별 절차는 공식 자료로 확인해야 합니다.' }];
      case 'tests':
        return [{ value: ['안정성 시험', '피부 자극 시험', ...(sensitive ? ['민감 피부 사용 시험'] : []), ...(benefits.some((b) => ['탄력', '주름', '미백'].includes(b)) ? ['효능 평가 시험'] : [])].join(', '), reason: '제품 유형과 효능 표현에서 정한 권장 시험 후보입니다. 국가별 요구 시험은 확인이 필요합니다.' }];
      case 'extraRegulatory':
        return [{ value: overseas.length ? `${overseas.map(marketLabel).join('·')} 수출 시 라벨 언어·책임자 지정 확인 필요` : '국내 표시·광고 기준 확인 필요', reason: '판매 국가에 따라 추가로 확인할 사항입니다.' }];
      default:
        return [];
    }
  })();

  const alternatives = (f.options ?? []).map((o) => ({ value: o, reason: '다른 선택지입니다.' }));
  return [...fromSpec, ...cands, ...alternatives];
}

function demoEntry(key: string, cands: Candidate[], avoid: string[] = []): BlueprintEntry {
  const f = blueprintField(key)!;
  const pick = cands.find((c) => c.value && !avoid.includes(c.value)) ?? cands.find((c) => c.value);
  if (!pick) return { fieldKey: key, value: UNDECIDED, origin: 'UNDETERMINED', reason: '입력한 아이디어에 근거가 없어 정하지 않았습니다.', confidence: 0, needsVerification: true, sourceReferences: [] };
  const origin = pick.origin ?? 'AI_SUGGESTED';
  return {
    fieldKey: key,
    value: pick.value,
    origin,
    reason: pick.reason,
    confidence: origin === 'USER_PROVIDED' ? 0.95 : 0.4,
    needsVerification: !!f.verify,
    sourceReferences: origin === 'USER_PROVIDED' ? ['사용자 입력'] : [],
  };
}

// Longer explanation for every item (Demo Mode). Built from the values decided so far; never states a cost,
// regulation or test result as confirmed.
const TEXTURE_NOTE: Record<string, string> = {
  워터리: '가벼운 발림, 레이어링 용이',
  밀키: '보습감과 가벼움의 균형',
  젤: '산뜻한 쿨링감, 지성·복합성 선호',
  크림: '보습막 형성, 건성 피부 적합',
  밤: '고체 질감, 부분 집중 보습',
  오일: '흡수 후 윤기, 유분 보충',
  캡슐: '시각적 차별화, 캡슐 안정성 확인 필요',
};
const CONTAINER_NOTE: Record<string, string> = {
  에어리스: '효능 원료 산화 방지, 잔량 최소화 목적.',
  스포이드: '정량 사용 용이. 공기·손 접촉으로 방부 설계 함께 검토.',
  펌프: '사용 편의·위생. 제형 점도에 맞는 펌프 사양 선정.',
  튜브: '휴대성·단가 유리.',
  단지: '크림·밤 제형용. 스패출러 동봉 검토.',
  스프레이: '분사량·입자 크기 테스트 필요.',
};

/** A short planning note for every item (Demo Mode), written the way a brand planner notes a plan. */
function demoDetail(key: string, entries: Record<string, BlueprintEntry>): string {
  const e = entries[key];
  if (isUndecided(e)) return key === 'targetProduct' ? '유사하게 가고 싶은 제품명 직접 입력. 입력 시 제형·사용감 비교 기준으로 사용.' : '근거 부족으로 미정. 직접 입력 필요.';
  const v = e.value;
  const val = (k: string, d = '') => (isUndecided(entries[k]) ? d : entries[k].value);
  const ages = splitList(val('ages', '30대')).join('·');
  const benefits = splitList(val('benefits', '보습'));
  const b0 = benefits[0];
  const productType = splitKind(val('productType', '앰플/세럼')).type;
  const sensitive = /민감|저자극/.test(val('skinTypes') + val('lowIrritation') + val('concerns'));
  const marketList = marketCodes(val('markets')).map(marketLabel);
  const overseas = marketCodes(val('markets')).some((m) => m !== 'KR');
  const regulated = benefits.some((b) => ['탄력', '주름', '미백'].includes(b));
  switch (key) {
    case 'category':
      return '생산 라인·안정성 시험·채널 진열 기준이 되므로 우선 확정.';
    case 'productType':
      return `생산 라인·안정성 시험·채널 진열 기준. ${b0} 원료 집중 배합. 1회 사용량·사용 순서 확정 후 용량·용기 결정.`;
    case 'purpose':
      return v === '신규 출시' ? '처방 개발부터 안정성 시험까지 전 과정 진행. 일정 제조사 확인 필요.' : '변경 범위(처방·용기·표현) 먼저 정리.';
    case 'benefits':
      return regulated ? '효능 2~3개로 압축. 주름·미백·탄력 표현은 기능성 보고·심사 대상 여부 확인 필요.' : '효능 2~3개로 압축. 일반 화장품 범위 표현으로 운영.';
    case 'concept':
      return '제품명·패키지 문구·상세페이지 첫 문장의 기준 문장.';
    case 'differentiation':
      return `패키지 전면·상세페이지 메인 카피 기준. 경쟁 제품 대비 차이는 Competitors 단계에서 확인, "${b0}" 표현은 실증 자료 확인 필요.`;
    case 'usp':
      return `패키지 전면·상세페이지 메인 카피 기준. "${b0}" 표현은 실증 자료 확인 필요.`;
    case 'keywords':
      return '검색·SNS·상세페이지 공통 태그. 검색량은 Trend 단계 데이터로 우선순위 확정.';
    case 'ages':
      return `${ages} 1차 타깃. 사용감·가격대·채널을 이 연령 기준으로 설정.`;
    case 'gender':
      return v === '성별 무관' ? '패키지 색감·향·모델을 성별 중립 톤으로 설정.' : `${v} 기준 패키지 톤·향·카피 설정.`;
    case 'skinTypes':
      return sensitive ? '향료·에센셜 오일·고농도 산 배제, 피부 자극 시험 진행.' : '피부 타입별 사용감 편차 최소화(유분감·보습력 조절).';
    case 'concerns':
      return '효능 원료 선정과 상세페이지 "추천 대상" 문구의 기준.';
    case 'usage':
      return '흡수 속도·메이크업 밀림 확인. 아침 사용 시 광민감 원료 사용 여부 검토.';
    case 'motivation':
      return '구매 동기 가설. Consumer 단계 리뷰·소비자 데이터로 검증 후 광고 카피 반영.';
    case 'needs':
      return '처방 필수 요구사항으로 제조사 전달, 시제품 평가 체크리스트로 사용.';
    case 'textureType':
      return `${TEXTURE_NOTE[v] ?? '목표 사용감 기준'}. 목표 점도·참고 질감 제조사 전달.`;
    case 'viscosity':
      return '용기 토출과 직결. 용기 확정 후 토출 테스트로 확인.';
    case 'absorption':
      return '시제품 평가 시 도포 직후·1분·5분 후 잔여감 비교.';
    case 'stickiness':
      return '보습 원료 함량과 상충. 보습력·사용감 균형 제조사와 조율.';
    case 'finish':
      return '오일·실리콘 배합으로 조정. 시제품 2~3종 비교 후 확정.';
    case 'scent':
      return v === '무향' ? '원료 고유 냄새 저감 방안 협의. "무향/무향료" 표기 기준 확인 필요.' : '알레르기 유발 향료 성분 표시 기준 국가별 확인 필요.';
    case 'appearance':
      return '원료에 따른 변색 가능성. 안정성 시험에서 색 변화 확인.';
    case 'sensory':
      return '시제품 평가 기준 문장. 상세페이지 사용감 설명에 활용.';
    case 'hero':
      return '제품명·패키지 노출 원료. 권장 함량·단가·효능 근거 원료사 확인 필요.';
    case 'actives':
      return '원료 간 pH·안정성 적합성, 판매 국가 사용 제한 확인 필요.';
    case 'supporting':
      return '보습·컨디셔닝·제형 안정 목적. 시제품에서 사용감과 함께 조정.';
    case 'exclude':
      return '"무첨가" 표기 활용 여부 검토. 표시·광고 기준 확인 필요.';
    case 'functional':
      return /없음/.test(v) ? '일반 화장품으로 출시. 기능성 효능 표현은 광고에 사용 불가.' : '기능성 보고·심사 대상 여부, 고시 원료·함량 기준 확인 필요. 심사 기간 일정 반영.';
    case 'lowIrritation':
      return '저자극 표방 시 피부 자극 시험 자료 필요. Testing 단계 계획에 포함.';
    case 'rationale':
      return '제조사 미팅 시 처방 의도 설명 자료, 원료 변경 시 판단 기준.';
    case 'compatibility':
      return '처방 테스트로만 확인 가능. 시제품 단계에서 분리·변색·냄새 변화 확인.';
    case 'targetPrice':
      return '원가·용량·채널 수수료 역산 기준. 행사 할인율 포함해 Cost 단계에서 계산.';
    case 'targetCost':
      return '판매가 역산 추정치, 실제 견적 아님. 원료·용기·충전·포장비 제조사 견적 확인 필요.';
    case 'size':
      return `${productType} 1회 사용량·사용 기간 기준. 동일 가격대 ml당 가격 비교 후 확정.`;
    case 'firstRun':
      return '희망 수량. 제조사·용기사 MOQ와 수량별 개당 원가 견적 확인 필요.';
    case 'container':
      return `${CONTAINER_NOTE[v] ?? ''} 용기 적합성 시험(변형·흡착·누액) 진행.`.trim();
    case 'material':
      return '내용물 적합성·차광·재활용 표시·단가 기준. 용기사 샘플로 확인 필요.';
    case 'channels':
      return '채널별 입점 조건·수수료·주력 가격대 확인 후 판매가·용량과 함께 확정.';
    case 'positioning':
      return '가격·패키지 디자인·광고 톤 정렬 기준.';
    case 'benchmark':
      return '참고 제품 유형. 실제 제품명·가격·전성분은 Competitors 단계에서 확인.';
    case 'launchTiming':
      return `처방 개발·안정성 시험·${overseas ? '해외 등록' : '기능성 심사 여부'}에 따라 변동. Timeline 단계에서 역산.`;
    case 'exportSafe':
      return '국가별 금지·제한 원료 목록과 대조 후 처방 확정. 공식 규제 자료로 확인 필요.';
    case 'marketingChannels':
      return '채널별 콘텐츠 형식·예산 배분은 런칭 3개월 전 확정.';
    case 'launchPromotion':
      return '할인율·증정 비용은 원가와 함께 Cost 단계에서 검토.';
    case 'targetProduct':
      return '제형·사용감 비교 기준 제품. 시제품 평가 시 함께 비교.';
    case 'markets':
      return `수출 희망 국가 기준으로 원료 구성. 국가별 금지·제한 원료, 기능성 분류, 라벨, 등록 절차 확인 필요.${marketList.includes('중국') ? ' 중국은 원료 목록·등록 절차 우선 확인.' : ''}`;
    case 'priorityMarket':
      return '첫 출시 국가 규제 기준으로 처방 확정, 이후 국가 확장.';
    case 'countryIngredients':
    case 'functionalClass':
    case 'claims':
    case 'procedures':
    case 'extraRegulatory':
      return '공식 규제 자료로 확인 필요. 결과에 따라 원료·표현·일정 조정.';
    case 'tests':
      return '시험 항목·기간·비용은 시험기관·판매 국가 요구사항 확인 필요.';
    default:
      return '';
  }
}
const withDetail = (entries: Record<string, BlueprintEntry>) => {
  for (const k of Object.keys(entries)) entries[k] = { ...entries[k], detail: entries[k].detail || demoDetail(k, entries) || undefined };
};

function demoRegulatory(markets: string[]): RegulatoryCheck[] {
  return markets.map((m) => ({ country: marketLabel(m), status: 'REVIEW_REQUIRED', items: regItemsOf(m), source: null, checkedAt: null, conditions: [] }));
}

export function demoBlueprint(idea: string, notice?: string): Blueprint {
  const { intake, productName } = analyzeIdea(idea);
  const spec = ruleSpec(idea, intake);
  const entries: Record<string, BlueprintEntry> = {};
  for (const f of BLUEPRINT_FIELDS) {
    const e = demoEntry(f.key, demoCandidates(f.key, idea, intake, spec, entries));
    entries[f.key] = e;
    // later demo rules read the values decided so far
    if (f.key === 'productType' && e.origin !== 'UNDETERMINED') {
      const { category, type } = splitKind(e.value);
      if (category && spec.category?.mode !== 'idea') spec.category = { mode: 'ai', value: [category] };
      if (spec.subtype?.mode !== 'idea') spec.subtype = { mode: 'ai', value: [type] };
    } else if (f.spec && e.origin !== 'UNDETERMINED') spec[f.spec] = spec[f.spec]?.mode === 'idea' ? spec[f.spec] : { mode: 'ai', value: f.spec === 'markets' ? marketCodes(e.value) : f.multi ? splitList(e.value) : [e.value] };
  }
  // second pass: sentence-type items (concept, USP, ...) read the finished target / formula values
  for (const f of BLUEPRINT_FIELDS) if ((!f.spec || f.key === 'keywords') && entries[f.key].origin !== 'USER_PROVIDED') entries[f.key] = demoEntry(f.key, demoCandidates(f.key, idea, intake, spec, entries));
  // conditions the user stated are never replaced by a suggestion
  for (const e of Object.values(entries)) if (e.origin === 'USER_PROVIDED') e.locked = true;
  withDetail(entries);
  return { idea, mode: 'demo', generatedAt: new Date().toISOString(), productName, entries, regulatory: demoRegulatory(marketCodes(entries.markets.value)), notice };
}

function demoRefresh(bp: Blueprint, keys: string[], avoid: Record<string, string[]>): BlueprintEntry[] {
  const { intake } = analyzeIdea(bp.idea);
  const spec = blueprintToSpec({ ...bp, entries: Object.fromEntries(Object.entries(bp.entries).filter(([k]) => !keys.includes(k))) });
  // Re-suggesting never turns a value back into "stated by the user".
  for (const k of Object.keys(spec) as (keyof Spec)[]) if (spec[k]?.mode === 'idea') spec[k] = { ...spec[k]!, mode: 'ai' };
  const merged = { ...bp.entries };
  for (const k of keys) {
    const cands = demoCandidates(k, bp.idea, intake, spec, bp.entries).map((c) => ({ ...c, origin: undefined }));
    merged[k] = demoEntry(k, cands, avoid[k]);
  }
  return keys.map((k) => ({ ...merged[k], detail: demoDetail(k, merged) || undefined }));
}

// ── generation entry points ─────────────────────────────────────────────────

export type GenStage = 'connect' | 'generating' | 'validating' | 'done';
export interface GenProgress {
  stage: GenStage;
  ai: AiStatus | null;
  /** set when Demo Mode is used instead */
  notice?: string;
}

const normalizeAi = (a: AiAnswer, idea: string, fallbackName: string): Blueprint => {
  const entries: Record<string, BlueprintEntry> = {};
  for (const e of a.entries) entries[e.fieldKey] = e;
  for (const f of BLUEPRINT_FIELDS)
    if (!entries[f.key]) entries[f.key] = { fieldKey: f.key, value: UNDECIDED, origin: 'UNDETERMINED', reason: 'AI 응답에 이 항목이 없어 미정으로 두었습니다.', confidence: 0, needsVerification: true, sourceReferences: [] };
  for (const e of Object.values(entries)) if (e.origin === 'USER_PROVIDED') e.locked = true;
  const markets = marketCodes(entries.markets.value);
  return { idea, mode: 'ai', model: a.model, generatedAt: new Date().toISOString(), productName: a.productName || fallbackName, entries, regulatory: syncRegulatory(a.regulatory, markets) };
};

export async function generateBlueprint(idea: string, onProgress: (p: GenProgress) => void): Promise<Blueprint> {
  onProgress({ stage: 'connect', ai: null });
  const ai = await aiStatus();
  if (!ai?.configured) {
    const notice = ai ? 'AI API Key가 서버에 설정되지 않아 Demo Mode로 작성했어요.' : 'AI 서버 경로에 연결할 수 없어 Demo Mode로 작성했어요.';
    onProgress({ stage: 'generating', ai, notice });
    await new Promise((r) => window.setTimeout(r, 700));
    onProgress({ stage: 'done', ai, notice });
    return demoBlueprint(idea, notice);
  }
  onProgress({ stage: 'generating', ai });
  try {
    const a = await callAi(idea);
    onProgress({ stage: 'validating', ai });
    const bp = normalizeAi(a, idea, analyzeIdea(idea).productName);
    onProgress({ stage: 'done', ai });
    return bp;
  } catch (e) {
    const notice = `AI 생성에 실패해 Demo Mode로 작성했어요. (${e instanceof Error ? e.message : '알 수 없는 오류'})`;
    onProgress({ stage: 'done', ai, notice });
    return demoBlueprint(idea, notice);
  }
}

/**
 * New suggestions for some items ("다시 추천", or refreshing items marked for review).
 * Locked items are skipped; nothing else in the blueprint changes.
 */
export async function refreshEntries(bp: Blueprint, keys: string[]): Promise<{ bp: Blueprint; error?: string }> {
  const todo = keys.filter((k) => bp.entries[k] && !bp.entries[k].locked);
  if (!todo.length) return { bp };
  const avoid = Object.fromEntries(todo.map((k) => [k, [...(bp.entries[k].previous ?? []), bp.entries[k].value].filter((v) => v && v !== UNDECIDED)]));
  let fresh: BlueprintEntry[];
  let regulatory = bp.regulatory;
  let error: string | undefined;
  if (bp.mode === 'ai') {
    try {
      const a = await callAi(bp.idea, { keys: todo, context: bp, avoid });
      fresh = a.entries.map((e) => ({ ...e, origin: e.origin === 'USER_PROVIDED' ? 'AI_SUGGESTED' : e.origin }));
      if (a.regulatory.length) regulatory = a.regulatory;
    } catch (e) {
      error = `AI 재추천에 실패해 데모 규칙으로 추천했어요. (${e instanceof Error ? e.message : '오류'})`;
      fresh = demoRefresh(bp, todo, avoid);
    }
  } else {
    await new Promise((r) => window.setTimeout(r, 350));
    fresh = demoRefresh(bp, todo, avoid);
  }
  const entries = { ...bp.entries };
  for (const e of fresh) {
    const prev = entries[e.fieldKey];
    if (!prev || prev.locked) continue;
    entries[e.fieldKey] = { ...e, needsVerification: e.needsVerification || !!blueprintField(e.fieldKey)?.verify, previous: [...new Set([...(prev.previous ?? []), prev.value])].slice(-6), review: undefined };
  }
  const next = { ...bp, entries };
  return { bp: { ...next, regulatory: syncRegulatory(regulatory, marketCodes(entries.markets.value)) }, error };
}

/** Whole blueprint again. keepLocked=true keeps every value the user wrote or locked. */
export async function regenerateBlueprint(bp: Blueprint, keepLocked: boolean, onProgress: (p: GenProgress) => void): Promise<Blueprint> {
  const fresh = await generateBlueprint(bp.idea, onProgress);
  if (!keepLocked) return fresh;
  const entries = { ...fresh.entries };
  for (const e of Object.values(bp.entries)) if (e.locked) entries[e.fieldKey] = { ...e, review: undefined };
  return { ...fresh, productName: bp.productName, entries, regulatory: syncRegulatory(fresh.regulatory, marketCodes(entries.markets.value)) };
}

// ── editing ─────────────────────────────────────────────────────────────────

/** The user's own value: shown as 사용자 입력, locked, and related items get "재검토 필요". */
export function editEntry(bp: Blueprint, key: string, value: string): Blueprint {
  const prev = bp.entries[key];
  const f = blueprintField(key)!;
  const v = value.trim();
  if (prev && prev.value === v) return bp;
  const entries = { ...bp.entries };
  entries[key] = {
    fieldKey: key,
    value: v || UNDECIDED,
    origin: v ? 'USER_PROVIDED' : 'UNDETERMINED',
    reason: v ? '사용자가 직접 수정한 값입니다.' : '사용자가 값을 비웠습니다.',
    detail: undefined,
    confidence: v ? 1 : 0,
    needsVerification: !!f.verify || !v,
    sourceReferences: v ? ['사용자 입력'] : [],
    locked: !!v,
    previous: prev ? [...new Set([...(prev.previous ?? []), prev.value])].slice(-6) : [],
  };
  for (const d of BLUEPRINT_DEPENDENTS[key] ?? []) if (entries[d] && d !== key) entries[d] = { ...entries[d], review: `${f.label} 변경` };
  return { ...bp, entries, regulatory: key === 'markets' ? syncRegulatory(bp.regulatory, marketCodes(entries.markets.value)) : bp.regulatory };
}

export const setLocked = (bp: Blueprint, key: string, locked: boolean): Blueprint => ({ ...bp, entries: { ...bp.entries, [key]: { ...bp.entries[key], locked } } });
export const keepAsIs = (bp: Blueprint, key: string): Blueprint => ({ ...bp, entries: { ...bp.entries, [key]: { ...bp.entries[key], review: undefined } } });

/** One check per sales country; existing findings are kept, new countries start as REVIEW_REQUIRED. */
export function syncRegulatory(list: RegulatoryCheck[], markets: string[]): RegulatoryCheck[] {
  return markets.map((m) => {
    const label = marketLabel(m);
    const found = list.find((r) => r.country === label || marketCodes(r.country)[0] === m);
    return found
      ? { ...found, country: label, status: found.source && found.checkedAt ? found.status : 'REVIEW_REQUIRED' }
      : { country: label, status: 'REVIEW_REQUIRED', items: regItemsOf(m), source: null, checkedAt: null, conditions: [] };
  });
}

// ── into the project ────────────────────────────────────────────────────────

/** Confirmed blueprint values → the detailed-intake spec every later step already reads. */
export function blueprintToSpec(bp: Blueprint): Spec {
  const spec: Spec = {};
  for (const f of BLUEPRINT_FIELDS) {
    const e = bp.entries[f.key];
    if (!f.spec || !e) continue;
    if (isUndecided(e)) {
      spec[f.spec] = { mode: 'unknown', value: [] };
      continue;
    }
    if (f.key === 'productType') {
      const { category, type } = splitKind(e.value);
      const mode = e.origin === 'USER_PROVIDED' ? 'user' : bp.mode === 'ai' ? 'idea' : 'ai';
      if (category) spec.category = { mode, value: [category], reason: e.reason };
      spec.subtype = { mode, value: [type], reason: e.reason };
      continue;
    }
    const value =
      f.spec === 'markets' || f.spec === 'priorityMarket'
        ? marketCodes(e.value)
        : f.multi || ['exclude', 'keywords'].includes(f.spec)
          ? splitList(e.value)
          : f.spec === 'targetPrice' || f.spec === 'targetCost'
            ? [wonText(e.value)]
            : [e.value];
    spec[f.spec] = { mode: e.origin === 'USER_PROVIDED' ? 'user' : bp.mode === 'ai' ? 'idea' : 'ai', value, reason: e.reason };
  }
  // derived yes/no items used by later steps
  const lowIrr = bp.entries.lowIrritation;
  if (lowIrr && /저자극|민감|자극 시험/.test(lowIrr.value)) spec.lowIrritation = { mode: lowIrr.origin === 'USER_PROVIDED' ? 'user' : 'ai', value: ['예'] };
  const userIngredients = ['hero', 'actives'].flatMap((k) => (bp.entries[k]?.origin === 'USER_PROVIDED' ? splitList(bp.entries[k].value) : []));
  if (userIngredients.length) spec.mustInclude = { mode: 'user', value: userIngredients };
  if ((spec.markets?.value ?? []).some((m) => m !== 'KR')) spec.overseasReview = { mode: 'ai', value: ['필요'] };
  spec.adReview = { mode: 'ai', value: ['필요'] };
  return spec;
}

/** Header facts of the project follow the blueprint. */
export function blueprintToIntake(bp: Blueprint, base: Intake): Intake {
  const e = bp.entries;
  const kind = (k: string) => (e[k]?.origin === 'USER_PROVIDED' ? 'USER_INPUT' : 'AI_ESTIMATE') as Intake['category']['kind'];
  const next = { ...base };
  if (!isUndecided(e.productType)) next.category = { value: e.productType.value, kind: kind('productType') };
  if (!isUndecided(e.benefits)) next.benefit = { value: splitList(e.benefits.value).join(' / '), kind: kind('benefits') };
  if (!isUndecided(e.ages)) next.target = { value: `${splitList(e.ages.value).join('·')} ${isUndecided(e.gender) ? '' : e.gender.value}`.trim(), kind: kind('ages') };
  if (!isUndecided(e.targetPrice)) next.price = { value: e.targetPrice.value, kind: kind('targetPrice') };
  if (!isUndecided(e.channels)) next.channel = { value: splitList(e.channels.value).join(' / '), kind: kind('channels') };
  if (!isUndecided(e.positioning)) next.position = { value: e.positioning.value, kind: kind('positioning') };
  if (!isUndecided(e.concept)) next.concept = { value: e.concept.value, kind: kind('concept') };
  return next;
}

export function blueprintCounts(bp: Blueprint) {
  const all = Object.values(bp.entries);
  return {
    user: all.filter((e) => e.origin === 'USER_PROVIDED').length,
    ai: all.filter((e) => e.origin === 'AI_SUGGESTED').length,
    undecided: all.filter((e) => isUndecided(e)).length,
    verify: all.filter((e) => e.needsVerification).length,
    review: all.filter((e) => e.review).length,
    locked: all.filter((e) => e.locked).length,
  };
}

/** Loosely validate a stored blueprint (localStorage can hold anything). */
export function readBlueprint(raw: unknown): Blueprint | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as Partial<Blueprint>;
  if (typeof b.idea !== 'string' || !b.entries || typeof b.entries !== 'object') return undefined;
  const entries: Record<string, BlueprintEntry> = {};
  for (const f of BLUEPRINT_FIELDS) {
    const e = (b.entries as Record<string, Partial<BlueprintEntry>>)[f.key];
    entries[f.key] =
      e && typeof e.value === 'string'
        ? { fieldKey: f.key, value: e.value, origin: e.origin === 'USER_PROVIDED' || e.origin === 'AI_SUGGESTED' ? e.origin : 'UNDETERMINED', reason: typeof e.reason === 'string' ? e.reason : '', detail: typeof e.detail === 'string' && e.detail ? e.detail : undefined, confidence: typeof e.confidence === 'number' ? e.confidence : 0, needsVerification: e.needsVerification !== false, sourceReferences: Array.isArray(e.sourceReferences) ? e.sourceReferences.filter((s) => typeof s === 'string') : [], locked: e.locked === true, review: typeof e.review === 'string' ? e.review : undefined, previous: Array.isArray(e.previous) ? e.previous.filter((s) => typeof s === 'string') : [] }
        : { fieldKey: f.key, value: UNDECIDED, origin: 'UNDETERMINED', reason: '', confidence: 0, needsVerification: true, sourceReferences: [] };
  }
  // blueprints saved before 2026-10-20 kept the category in its own item
  const oldCat = (b.entries as Record<string, Partial<BlueprintEntry>>).category?.value;
  if (typeof oldCat === 'string' && oldCat && oldCat !== UNDECIDED && !isUndecided(entries.productType) && !entries.productType.value.includes('>')) entries.productType = { ...entries.productType, value: `${oldCat} > ${entries.productType.value}` };
  const regulatory = Array.isArray(b.regulatory)
    ? b.regulatory.filter((r) => r && typeof r.country === 'string').map((r) => ({ country: r.country, status: r.status === 'VERIFIED' && r.source && r.checkedAt ? ('VERIFIED' as const) : ('REVIEW_REQUIRED' as const), items: Array.isArray(r.items) ? r.items : [], source: r.source ?? null, checkedAt: r.checkedAt ?? null, conditions: Array.isArray(r.conditions) ? r.conditions : [] }))
    : [];
  return { idea: b.idea, mode: b.mode === 'ai' ? 'ai' : 'demo', model: b.model, generatedAt: typeof b.generatedAt === 'string' ? b.generatedAt : new Date().toISOString(), productName: typeof b.productName === 'string' ? b.productName : 'New Product', entries, regulatory, notice: b.notice, confirmedAt: b.confirmedAt };
}
