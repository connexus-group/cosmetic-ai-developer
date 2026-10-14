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
  const f = blueprintField(key)!;
  const val = (k: string) => current[k]?.value ?? '';
  const benefits = splitList(val('benefits') || intake.benefit.value).filter((b) => b !== '안티에이징');
  const sensitive = /민감|저자극|진정/.test(idea + val('skinTypes') + val('concerns'));
  const markets = marketCodes(val('markets'));
  const overseas = markets.filter((m) => m !== 'KR');
  const productType = val('productType') || '앰플/세럼';
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
    return [{ value: '저자극 설계 (무향·자극 우려 원료 최소화, 피부 자극 시험 진행 희망)', reason: '아이디어 문장에 "저자극"을 직접 적었습니다.', origin: 'USER_PROVIDED' }];

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
          { value: `${ages} ${sensitive ? '민감 피부도 ' : ''}매일 부담 없이 쓰는 ${benefits.slice(0, 2).join('·') || '데일리'} ${productType}. ${ing('hero')[0] ?? '핵심 원료'} 중심의 집중 처방으로 ${val('concerns') ? splitList(val('concerns')).slice(0, 2).join('·') + ' 고민을' : '피부 고민을'} 꾸준히 관리하는 제품입니다.`, reason: '타깃·효능·제품 유형·대표 원료를 컨셉 문장으로 묶었습니다.' },
          { value: `${benefits[0] ?? '핵심'} 효능에 집중한 고농축 ${productType}`, reason: '효능 집중형 컨셉 후보입니다.' },
          { value: `가볍게 바르는 ${benefits[0] ?? '데일리'} 루틴 ${productType}`, reason: '사용감 중심 컨셉 후보입니다.' },
        ];
      case 'differentiation':
        return [
          { value: `${sensitive ? '저자극 설계와 ' : ''}${ing('hero')[0] ?? '핵심 원료'} 중심의 단순한 처방. 효능 원료 수를 늘리기보다 핵심 원료에 집중하고${sensitive ? ', 향료와 자극 우려 원료를 빼서 민감 피부도 매일 쓸 수 있게' : ', 가벼운 사용감으로 매일 손이 가게'} 만듭니다.`, reason: '효능 원료와 자극 우려를 함께 다룬 차별화 후보입니다.' },
          { value: '흡수가 빠른 가벼운 제형으로 레이어링 부담을 줄임', reason: '사용감 중심 차별화 후보입니다.' },
        ];
      case 'usp':
        return [
          { value: `${benefits[0] ?? '피부'} 고민을 ${sensitive ? '자극 걱정 없이 ' : ''}매일 관리하는 ${productType}. 바르는 순간 ${val('finish') ? splitList(val('finish'))[0] : '촉촉'}하게 마무리되고, 꾸준히 쓸수록 ${benefits.slice(0, 2).join('·') || '피부결'} 변화를 기대할 수 있는 제품`, reason: '핵심 효능과 타깃 니즈를 한 줄로 정리했습니다. 효능 표현은 실증 자료 확인이 필요합니다.' },
          { value: `${ing('hero')[0] ?? '핵심 원료'}로 완성하는 ${benefits[0] ?? '데일리'} 케어`, reason: '원료 중심 USP 후보입니다.' },
        ];
      case 'motivation':
        return [{ value: `${benefits[0] ?? '피부'} 변화를 체감하고 싶지만 ${sensitive ? '자극은 피하고 싶어서' : '복잡한 루틴은 싫어서'}. ${ages} 소비자는 ${sensitive ? '새 제품을 쓸 때 트러블이 생길까 걱정하는 경우가 많아, 성분이 단순하고 자극 시험을 거친 제품에 끌릴 것으로 보입니다.' : '여러 제품을 겹쳐 바르기보다 한 제품으로 효과를 보고 싶어 할 것으로 보입니다.'}`, reason: '타깃과 효능에서 추정한 구매 동기입니다. 실제 소비자 데이터로 확인이 필요합니다.' }];
      case 'needs':
        return [{ value: `${benefits.join('·') || '보습'} 효과를 눈에 보이게 느끼고 싶고, ${sensitive ? '자극 없이 매일 쓸 수 있으며, ' : ''}끈적임 없이 다음 단계 제품이나 메이크업이 잘 올라가는 사용감을 원합니다.`, reason: '효능·피부 타입에서 추정한 니즈입니다.' }];
      case 'sensory':
        return [
          { value: `${val('textureType') || '가벼운'} 제형이 피부에 부드럽게 퍼지며 ${val('absorption') === '느림' ? '천천히' : '빠르게'} 흡수되고, ${val('finish') ? splitList(val('finish')).join('·') : '촉촉한'} 마무리감을 남깁니다. 바른 뒤에도 ${/없/.test(val('stickiness')) || /안 함/.test(val('stickiness')) ? '끈적임이 거의 없어' : '부담이 적어'} 다음 단계 제품을 바로 덧바를 수 있습니다.`, reason: '제형·흡수·끈적임·마무리감 항목과 맞춘 설명입니다.' },
          { value: '첫 터치는 촉촉하고 마무리는 끈적임 없이 정돈됨', reason: '다른 사용감 표현 후보입니다.' },
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
        return [{ value: sensitive ? '무향·저자극 원료 위주, 피부 자극 시험 진행 희망' : '일반 처방 기준, 자극 우려 원료 최소화', reason: sensitive ? '민감·저자극 조건에서 정한 방향입니다.' : '자극 관련 언급이 없어 기본 방향으로 두었습니다.' }];
      case 'rationale':
        return [{ value: `${benefits.join('·') || '보습'} 효능에 자주 쓰이는 원료를 중심에 두고, ${sensitive ? '민감 피부 타깃을 고려해 자극 우려가 있는 원료(고농도 레티노이드, 향료 등)는 후보에서 뺐습니다' : '사용감을 해치지 않는 원료 조합을 우선했습니다'}. 보조 원료는 보습과 제형 안정성을 위해 넣었습니다.`, reason: '원료 후보를 고른 기준입니다.' }];
      case 'compatibility':
        return [{ value: `${val('hero') || '대표 원료'}의 ${val('textureType') || '제형'} 내 안정성, 권장 함량, pH 범위를 제조사와 확인`, reason: '원료와 제형 조합은 실제 처방 테스트가 필요합니다.' }];
      case 'material':
        return [
          { value: val('container') === '에어리스' ? 'PP 에어리스 용기' : val('container') === '스포이드' ? '유리 병 + 스포이드' : 'PETG 또는 PP', reason: '권장 패키지와 맞는 일반적인 재질 후보입니다.' },
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
  워터리: '물처럼 가볍게 퍼지고 다른 제품과 레이어링하기 쉽습니다',
  밀키: '로션처럼 부드럽게 퍼지면서 보습감과 가벼움의 균형을 맞추기 좋습니다',
  젤: '산뜻하고 시원한 사용감이라 지성·복합성 피부가 선호하는 편입니다',
  크림: '피부 위에 보습막을 남겨 건조한 피부에 잘 맞습니다',
  밤: '고체에 가까운 질감이라 부분 집중 보습에 적합합니다',
  오일: '흡수 후 윤기를 남기고 건조한 피부의 유분을 보충합니다',
  캡슐: '눈에 띄는 차별화가 되지만 캡슐 안정성과 분산 확인이 더 필요합니다',
};
const CONTAINER_NOTE: Record<string, string> = {
  에어리스: '공기 접촉을 줄여 산화에 민감한 효능 원료를 보호하는 데 유리하고, 끝까지 덜어 쓰기 좋습니다.',
  스포이드: '앰플·세럼에 익숙한 형태로 적정량을 덜기 쉽지만, 공기와 손 접촉이 있어 방부 설계를 함께 봐야 합니다.',
  펌프: '사용이 편하고 위생적이지만 제형 점도에 맞는 펌프 사양을 골라야 토출이 안정적입니다.',
  튜브: '휴대성이 좋고 단가 부담이 적은 편이며, 크림·젤 제형에 잘 맞습니다.',
  단지: '크림·밤 제형에 어울리지만 위생을 위해 스패출러 동봉을 검토합니다.',
  스프레이: '미스트 형태에 적합하며 분사량과 분사 입자 크기 테스트가 필요합니다.',
};

function demoDetail(key: string, entries: Record<string, BlueprintEntry>): string {
  const e = entries[key];
  const f = blueprintField(key)!;
  if (isUndecided(e)) return `아이디어에 근거가 부족해 아직 정하지 않았어요. "${f.label}"은(는) 직접 입력하거나 아이디어 문장에 조건을 더 적으면 채워집니다.`;
  const v = e.value;
  const val = (k: string, d = '') => (isUndecided(entries[k]) ? d : entries[k].value);
  const ages = splitList(val('ages', '30대')).join('·');
  const gender = val('gender');
  const benefits = splitList(val('benefits', '보습'));
  const b0 = benefits[0];
  const productType = val('productType', '앰플/세럼');
  const hero = splitList(val('hero', '대표 원료'))[0];
  const sensitive = /민감|저자극/.test(val('skinTypes') + val('lowIrritation') + val('concerns'));
  const marketList = marketCodes(val('markets')).map(marketLabel);
  const overseas = marketCodes(val('markets')).some((m) => m !== 'KR');
  const regulated = benefits.some((b) => ['탄력', '주름', '미백'].includes(b));
  const verifyTail = '일반 지식을 바탕으로 정리한 내용이라, 판매 국가의 공식 규제 자료로 확인이 필요합니다.';
  switch (key) {
    case 'category':
      return `${productType}을(를) 포함한 ${v} 카테고리로 기획합니다. 카테고리에 따라 제조사의 생산 라인, 필요한 안정성 시험, 판매 채널의 진열 위치가 달라지므로 가장 먼저 확정해 두는 것이 좋습니다.`;
    case 'productType':
      return `${v} 형태는 ${b0} 효능 원료를 집중해서 담기 좋고, ${ages} 소비자가 지금 쓰는 스킨케어 루틴에 한 단계로 더하기 부담이 적습니다. 1회 사용량과 사용 순서(예: 토너 다음 단계)를 정해 두면 용량과 용기를 고르기가 쉬워집니다.`;
    case 'purpose':
      return `${v} 기준으로 일정과 예산을 잡습니다. ${v === '신규 출시' ? '신규 출시는 처방 개발부터 시제품 평가, 안정성 시험까지 모든 과정을 거치므로 리뉴얼보다 기간이 길어질 수 있습니다(제조사 확인 필요).' : '기존 제품 대비 무엇을 바꾸는지(처방, 용기, 효능 표현)를 먼저 정리하면 제조사와 범위를 맞추기 쉽습니다.'}`;
    case 'benefits':
      return `핵심 효능은 ${benefits.join(', ')}입니다. 효능을 2~3개로 좁혀야 원료 배합과 광고 문구가 선명해집니다. ${regulated ? '주름·미백·탄력 관련 표현은 기능성화장품 보고·심사 대상인지 확인이 필요합니다.' : '일반 화장품 범위의 효능 표현으로 운영할 수 있는지 함께 확인합니다.'}`;
    case 'concept':
      return `제품명, 패키지 문구, 상세페이지 첫 문장이 모두 이 컨셉에서 나오도록 맞추면 메시지가 흔들리지 않습니다. ${ages} ${gender && gender !== '성별 무관' ? gender + ' ' : ''}소비자가 매장이나 상세페이지에서 몇 초 안에 이해할 수 있는지를 기준으로 다듬어 주세요.`;
    case 'differentiation':
      return `${hero} 중심 처방에 ${sensitive ? '자극 우려 원료를 줄인 설계를' : '가벼운 사용감을'} 더하는 방향으로 차별화합니다. 실제 경쟁 제품과 얼마나 다른지는 Competitors 단계에서 확인이 필요하고, 차별화 근거가 되는 사용감 평가나 자극 시험은 처방 단계에서 함께 계획합니다.`;
    case 'usp':
      return `상세페이지와 패키지 전면 카피의 기준이 되는 한 줄입니다. "${b0}" 효능 표현은 실증 자료가 있어야 광고에 쓸 수 있으므로, 시험 계획과 함께 표현 수위를 정합니다.`;
    case 'keywords':
      return `검색어, SNS 해시태그, 상세페이지 태그에 공통으로 쓸 후보입니다. 실제 검색량과 경쟁 정도는 Trend 단계의 데이터로 확인한 뒤 우선순위를 정합니다.`;
    case 'ages':
      return `${ages} 소비자를 1차 타깃으로 잡습니다. 연령대에 따라 좋아하는 사용감, 가격에 대한 민감도, 정보를 얻는 채널이 달라지므로 판매가·채널 항목과 함께 맞춥니다.`;
    case 'gender':
      return v === '성별 무관' ? '성별 구분 없이 쓰는 제품으로 기획합니다. 패키지 색감과 향, 광고 모델 선택에서 특정 성별에 치우치지 않도록 톤을 맞춥니다.' : `${v} 소비자를 기준으로 패키지 톤, 향, 광고 문구를 정합니다. 다른 성별로의 확장은 출시 후 반응을 보고 검토하는 것이 일반적입니다.`;
    case 'skinTypes':
      return `${v} 피부를 기준으로 처방 방향을 잡습니다. ${sensitive ? '민감성 피부가 포함되면 향료, 에센셜 오일, 고농도 산을 줄이고 피부 자극 시험을 계획하는 것이 일반적입니다.' : '피부 타입별로 사용감 차이가 크지 않도록 유분감과 보습력을 조절합니다.'}`;
    case 'concerns':
      return `${v}을(를) 이 제품이 해결할 피부 고민으로 정했습니다. 고민마다 효능 원료와 광고 표현이 연결되므로, 상세페이지의 "이런 분께 추천" 문구와 원료 선택의 기준으로 씁니다.`;
    case 'usage':
      return `${v} 사용을 기준으로 흡수 속도와 메이크업 전 밀림 여부를 확인합니다. 아침 사용이 포함되면 햇빛에 민감한 원료(예: 레티노이드류)는 함량과 사용 안내를 따로 검토합니다.`;
    case 'motivation':
      return `${ages} 타깃이 이 제품을 사는 이유를 가정한 것입니다. Consumer 단계의 리뷰·소비자 데이터로 이 가설이 맞는지 확인하고, 맞다면 광고 첫 문장에 반영합니다.`;
    case 'needs':
      return `제품이 반드시 충족해야 할 조건입니다. 제조사에 처방 개발의 필수 요구사항으로 전달하고, 시제품을 평가할 때 체크리스트로 씁니다.`;
    case 'textureType':
      return `${v} 제형은 ${TEXTURE_NOTE[v] ?? '원하는 사용감에 맞춰 조정할 수 있습니다'}. 제조사에는 원하는 점도 범위와 참고하고 싶은 질감을 함께 전달하면 시제품 수정 횟수를 줄일 수 있습니다.`;
    case 'viscosity':
      return `점도는 "${v}" 수준을 목표로 합니다. 점도는 용기(스포이드, 펌프, 에어리스)의 토출과 직접 연결되므로 용기 후보를 정한 뒤 실제 토출 테스트로 확인합니다.`;
    case 'absorption':
      return `흡수 속도는 "${v}"을(를) 목표로 합니다. 시제품 평가 때 바른 직후, 1분 후, 5분 후의 잔여감을 비교하면 기준을 객관적으로 맞출 수 있습니다.`;
    case 'stickiness':
      return `끈적임은 "${v}" 수준으로 정했습니다. 글리세린이나 히알루론산 같은 보습 원료가 많을수록 끈적임이 커지므로, 보습력과 사용감 사이의 균형을 제조사와 조율합니다.`;
    case 'finish':
      return `마무리감은 ${v}을(를) 목표로 합니다. 같은 제형이라도 오일·실리콘 배합에 따라 마무리감이 달라지므로, 시제품 단계에서 2~3가지 버전을 비교해 보는 것이 좋습니다.`;
    case 'scent':
      return v === '무향' ? '향료를 넣지 않는 방향입니다. 원료 고유의 냄새가 날 수 있으므로 "무향"과 "무향료" 표기 차이를 확인하고, 원료 냄새를 줄이는 방법을 제조사와 협의합니다.' : `향은 "${v}" 방향입니다. 향료 속 알레르기 유발 성분은 표시 대상이 될 수 있어 판매 국가별 표시 기준 확인이 필요합니다.`;
    case 'appearance':
      return `제품 색상은 ${v}을(를) 목표로 합니다. 원료에 따라 시간이 지나며 색이 변할 수 있으므로 안정성 시험에서 색 변화도 함께 확인합니다.`;
    case 'sensory':
      return '이 문장을 시제품 평가 기준으로 쓰고, 상세페이지의 사용감 설명에도 그대로 활용할 수 있습니다. 평가할 때는 여러 명이 같은 조건에서 써 보고 표현이 맞는지 확인하는 것이 좋습니다.';
    case 'hero':
      return `${v}을(를) 대표 원료 후보로 제안합니다. 대표 원료는 제품명과 패키지에 드러나는 핵심 메시지가 되므로, 원료사에 권장 함량, 단가, 효능 근거 자료를 요청해 비교한 뒤 확정합니다(확인 필요).`;
    case 'actives':
      return `${v}을(를) 효능 원료 후보로 제안합니다. 원료끼리 적정 pH와 안정성이 맞는지, 판매 국가에서 사용 제한이 있는지 확인이 필요합니다.`;
    case 'supporting':
      return `${v}은(는) 보습과 피부 컨디셔닝, 제형 안정성을 돕는 보조 원료 후보입니다. 전성분 앞쪽에 오는 경우가 많아 사용감에 큰 영향을 주므로 시제품에서 함께 조정합니다.`;
    case 'exclude':
      return `${v}을(를) 빼는 방향을 제안합니다. 빼는 원료는 "무첨가" 표기로 활용할 수 있지만, 표시·광고 기준에 맞는 표현인지 확인이 필요합니다.`;
    case 'functional':
      return /없음/.test(v) ? '기능성 심사 없이 일반 화장품으로 출시하는 방향입니다. 이 경우 주름 개선이나 미백 같은 기능성 효능 표현은 광고에 쓸 수 없어 문구를 조정해야 합니다.' : `${v} 기능성 방향입니다. 식약처 기능성화장품 보고·심사 대상인지, 고시 원료와 함량 기준을 맞출 수 있는지 확인이 필요하고, 일정에 심사 기간을 반영해야 합니다.`;
    case 'lowIrritation':
      return '저자극을 내세우려면 피부 자극 시험 같은 근거 자료가 필요하므로 Testing 단계 계획에 포함합니다. 무향, 알코올 최소화, 자극 우려 원료 제외 같은 기준을 제조사와 처방 조건으로 정리합니다.';
    case 'rationale':
      return '원료 선택 근거는 제조사 미팅에서 처방 의도를 설명하는 자료가 되고, 나중에 원료를 바꿀 때 판단 기준이 됩니다.';
    case 'compatibility':
      return '원료와 제형의 조합은 실제 처방 테스트로만 확인할 수 있어 확정값이 아닙니다. 시제품 단계에서 분리, 변색, 냄새 변화가 없는지 함께 확인합니다.';
    case 'targetPrice':
      return `목표 판매가를 기준으로 원가, 용량, 채널 수수료를 거꾸로 계산합니다. ${val('channels') ? `${val('channels')} 채널의 수수료와 할인 행사 비율에 따라 남는 금액이 크게 달라지므로` : '판매 채널의 수수료와 할인 행사 비율에 따라 남는 금액이 달라지므로'} Cost 단계에서 함께 계산합니다.`;
    case 'targetCost':
      return '판매가에서 거꾸로 계산한 추정치일 뿐 실제 견적이 아닙니다. 원료비, 용기·부자재, 충전·포장비, 초도 수량에 따라 크게 달라지므로 제조사 견적으로 확인이 필요합니다.';
    case 'size':
      return `${v} 용량을 제안합니다. ${productType}의 1회 사용량과 다 쓰는 데 걸리는 기간을 고려하고, 같은 가격대 제품과 ml당 가격을 비교해 확정합니다.`;
    case 'firstRun':
      return `초도 ${v} 생산을 가정했습니다. 실제 최소 주문 수량(MOQ)은 제조사와 용기 공급사마다 다르고, 수량이 적을수록 개당 원가가 올라가므로 견적 비교가 필요합니다(확인 필요).`;
    case 'container':
      return `${v} 용기를 제안합니다. ${CONTAINER_NOTE[v] ?? ''} 내용물과 용기가 맞는지(변형, 원료 흡착, 누액)는 용기 적합성 시험으로 확인합니다.`;
    case 'material':
      return `${v} 재질을 제안합니다. 재질은 내용물 적합성, 차광, 재활용 표시, 단가에 영향을 주므로 용기 공급사 샘플로 확인합니다(확인 필요).`;
    case 'channels':
      return `${v} 채널을 우선 검토합니다. 채널마다 입점 조건, 수수료, 잘 팔리는 가격대와 용량이 달라서 판매가와 용량을 정할 때 함께 봐야 합니다.`;
    case 'positioning':
      return '포지셔닝은 가격, 패키지 디자인, 광고 톤을 한 방향으로 맞추는 기준입니다. 같은 가격대 경쟁 제품의 실제 이미지는 Competitors 단계에서 확인합니다.';
    case 'benchmark':
      return '참고할 제품 유형을 정리한 것입니다. 실제 제품명, 가격, 전성분은 Competitors 단계에서 확인이 필요합니다.';
    case 'launchTiming':
      return `${v} 출시를 목표로 합니다. 처방 개발, 안정성 시험, ${overseas ? '해외 등록 절차' : '기능성 심사 여부'}에 따라 일정이 달라지므로 Timeline 단계에서 거꾸로 계산해 확인합니다.`;
    case 'markets':
      return `${marketList.join(', ') || v} 판매를 목표로 합니다. 국가마다 금지·제한 원료, 기능성 분류, 라벨 표기, 등록 절차가 달라서 처방을 확정하기 전에 국가별 규제 확인이 필요합니다.${marketList.includes('중국') ? ' 중국은 사용 가능한 원료 목록과 등록·신고 절차를 먼저 확인하고 일정에 여유를 두는 것이 좋습니다.' : ''}`;
    case 'priorityMarket':
      return `${v}을(를) 첫 출시 국가로 가정했습니다. 첫 국가의 규제 기준에 맞춰 처방을 정하면 다른 국가로 넓힐 때 수정 범위를 줄일 수 있습니다.`;
    case 'countryIngredients':
    case 'functionalClass':
    case 'claims':
    case 'procedures':
    case 'extraRegulatory':
      return `${verifyTail} 확인 결과에 따라 원료, 효능 표현, 일정이 바뀔 수 있습니다.`;
    case 'tests':
      return `${v}을(를) 권장합니다. 시험 항목, 기간, 비용은 시험기관과 판매 국가 요구사항에 따라 달라지므로 확인이 필요합니다.`;
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
    if (f.spec && e.origin !== 'UNDETERMINED') spec[f.spec] = spec[f.spec]?.mode === 'idea' ? spec[f.spec] : { mode: 'ai', value: f.spec === 'markets' ? marketCodes(e.value) : f.multi ? splitList(e.value) : [e.value] };
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
  if (!isUndecided(e.category)) next.category = { value: isUndecided(e.productType) ? e.category.value : `${e.category.value} > ${e.productType.value}`, kind: kind('category') };
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
  const regulatory = Array.isArray(b.regulatory)
    ? b.regulatory.filter((r) => r && typeof r.country === 'string').map((r) => ({ country: r.country, status: r.status === 'VERIFIED' && r.source && r.checkedAt ? ('VERIFIED' as const) : ('REVIEW_REQUIRED' as const), items: Array.isArray(r.items) ? r.items : [], source: r.source ?? null, checkedAt: r.checkedAt ?? null, conditions: Array.isArray(r.conditions) ? r.conditions : [] }))
    : [];
  return { idea: b.idea, mode: b.mode === 'ai' ? 'ai' : 'demo', model: b.model, generatedAt: typeof b.generatedAt === 'string' ? b.generatedAt : new Date().toISOString(), productName: typeof b.productName === 'string' ? b.productName : 'New Product', entries, regulatory, notice: b.notice, confirmedAt: b.confirmedAt };
}
