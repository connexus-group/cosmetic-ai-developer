import { BLUEPRINT_DEPENDENTS, BLUEPRINT_FIELDS, blueprintField, CORE_DEPENDENTS, CORE_SHOWN, MARKET_NAMES, type BlueprintFieldDef } from '@/data/blueprintFields';
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

const fieldPayload = (f: BlueprintFieldDef) => ({ key: f.key, label: f.label, guide: f.guide, options: f.options, multi: f.multi, verify: f.verify, core: !!f.parts });

async function callAi(idea: string, opts: { keys?: string[]; context?: Blueprint; avoid?: Record<string, string[]> } = {}): Promise<AiAnswer> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 240_000);
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
          { value: `${ages} ${sensitive ? '민감 피부도 ' : ''}매일 쓰는 ${benefits.slice(0, 2).join('·') || '데일리'} ${productType}`, reason: '타깃·효능·제품 유형을 한 문장으로 묶었습니다.' },
          { value: `${benefits[0] ?? '핵심'} 효능에 집중한 고농축 ${productType}`, reason: '효능 집중형 컨셉 후보입니다.' },
          { value: `가볍게 바르는 ${benefits[0] ?? '데일리'} 루틴 ${productType}`, reason: '사용감 중심 컨셉 후보입니다.' },
        ];
      case 'differentiation':
        return [
          { value: `${sensitive ? '저자극 설계와 ' : ''}${ing('hero')[0] ?? '핵심 원료'} 중심의 단순한 처방`, reason: '효능 원료와 자극 우려를 함께 다룬 차별화 후보입니다.' },
          { value: '흡수가 빠른 가벼운 제형으로 레이어링 부담을 줄임', reason: '사용감 중심 차별화 후보입니다.' },
        ];
      case 'usp':
        return [
          { value: `${benefits[0] ?? '피부'} 고민을 ${sensitive ? '자극 걱정 없이 ' : ''}매일 관리`, reason: '핵심 효능과 타깃 니즈를 한 줄로 정리했습니다.' },
          { value: `${ing('hero')[0] ?? '핵심 원료'}로 완성하는 ${benefits[0] ?? '데일리'} 케어`, reason: '원료 중심 USP 후보입니다.' },
        ];
      case 'motivation':
        return [{ value: `${benefits[0] ?? '피부'} 변화를 체감하고 싶지만 ${sensitive ? '자극은 피하고 싶어서' : '복잡한 루틴은 싫어서'}`, reason: '타깃과 효능에서 추정한 구매 동기입니다.' }];
      case 'needs':
        return [{ value: `${benefits.join('·') || '보습'} 효과, ${sensitive ? '낮은 자극, ' : ''}끈적임 없는 사용감`, reason: '효능·피부 타입에서 추정한 니즈입니다.' }];
      case 'sensory':
        return [
          { value: `${val('textureType') || '가벼운'} 제형이 빠르게 흡수되고 ${val('finish') || '촉촉한'} 마무리`, reason: '제형·마무리감 항목과 맞춘 설명입니다.' },
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
        return [{ value: `${benefits.join('·') || '보습'} 효능과 ${sensitive ? '저자극 조건을' : '사용감을'} 함께 고려해 원료 후보를 골랐습니다`, reason: '원료 후보를 고른 기준입니다.' }];
      case 'compatibility':
        return [{ value: `${val('hero') || '대표 원료'}의 ${val('textureType') || '제형'} 내 안정성, 권장 함량, pH 범위를 제조사와 확인`, reason: '원료와 제형 조합은 실제 처방 테스트가 필요합니다.' }];
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

function demoRegulatory(markets: string[]): RegulatoryCheck[] {
  return markets.map((m) => ({ country: marketLabel(m), status: 'REVIEW_REQUIRED', items: regItemsOf(m), source: null, checkedAt: null, conditions: [] }));
}

export function demoBlueprint(idea: string, notice?: string): Blueprint {
  const { intake, productName } = analyzeIdea(idea);
  const spec = ruleSpec(idea, intake);
  const entries: Record<string, BlueprintEntry> = {};
  for (const f of BLUEPRINT_FIELDS) {
    if (f.parts) continue;
    const e = demoEntry(f.key, demoCandidates(f.key, idea, intake, spec, entries));
    entries[f.key] = e;
    // later demo rules read the values decided so far
    if (f.spec && e.origin !== 'UNDETERMINED') spec[f.spec] = spec[f.spec]?.mode === 'idea' ? spec[f.spec] : { mode: 'ai', value: f.spec === 'markets' ? marketCodes(e.value) : f.multi ? splitList(e.value) : [e.value] };
  }
  // second pass: sentence-type items (concept, USP, ...) read the finished target / formula values
  for (const f of BLUEPRINT_FIELDS) if (!f.parts && (!f.spec || f.key === 'keywords') && entries[f.key].origin !== 'USER_PROVIDED') entries[f.key] = demoEntry(f.key, demoCandidates(f.key, idea, intake, spec, entries));
  // conditions the user stated are never replaced by a suggestion
  for (const e of Object.values(entries)) if (e.origin === 'USER_PROVIDED') e.locked = true;
  // the first-screen summary items are built from the detailed items
  syncSummaries(entries, [], true);
  // insertion order = field order
  const ordered = Object.fromEntries(BLUEPRINT_FIELDS.map((f) => [f.key, entries[f.key]]));
  return { idea, mode: 'demo', generatedAt: new Date().toISOString(), productName, entries: ordered, regulatory: demoRegulatory(marketCodes(entries.markets.value)), notice };
}

function demoRefresh(bp: Blueprint, keys: string[], avoid: Record<string, string[]>): BlueprintEntry[] {
  const { intake } = analyzeIdea(bp.idea);
  const spec = blueprintToSpec({ ...bp, entries: Object.fromEntries(Object.entries(bp.entries).filter(([k]) => !keys.includes(k))) });
  // Re-suggesting never turns a value back into "stated by the user".
  for (const k of Object.keys(spec) as (keyof Spec)[]) if (spec[k]?.mode === 'idea') spec[k] = { ...spec[k]!, mode: 'ai' };
  return keys.map((k) => {
    const cands = demoCandidates(k, bp.idea, intake, spec, bp.entries).map((c) => ({ ...c, origin: undefined }));
    return demoEntry(k, cands, avoid[k]);
  });
}

// ── summary items (first screen) ────────────────────────────────────────────

const SUMMARY_KEYS = BLUEPRINT_FIELDS.filter((f) => f.parts).map((f) => f.key);
export const isSummary = (key: string) => SUMMARY_KEYS.includes(key);
const summariesOf = (part: string) => SUMMARY_KEYS.filter((k) => blueprintField(k)!.parts!.includes(part));

const STICKY_TEXT: Record<string, string> = { '전혀 허용 안 함': '끈적임 없음', '거의 없어야 함': '끈적임 거의 없음', '약간 허용': '약간의 끈적임 허용', '어느 정도 허용': '끈적임 어느 정도 허용', 상관없음: '끈적임 무관' };
const ABSORB_TEXT: Record<string, string> = { 빠름: '빠른 흡수', 보통: '보통 흡수', 느림: '천천히 흡수' };

/** One line built from the detailed items (used in Demo Mode, when the AI left it out, and after a detailed item changes). */
function summaryText(key: string, entries: Record<string, BlueprintEntry>): string {
  const v = (k: string) => (isUndecided(entries[k]) ? '' : entries[k].value.trim());
  const join = (xs: string[], sep = ' · ') => xs.filter(Boolean).join(sep);
  switch (key) {
    case 'productKind':
      return join([v('category'), v('productType')]);
    case 'target':
      return join([join([splitList(v('ages')).join('·'), v('gender') === '성별 무관' ? '' : v('gender')], ' '), splitList(v('skinTypes')).join('·'), splitList(v('concerns')).join('·')]);
    case 'texture':
      return join([v('textureType') && `${v('textureType')} 제형`, ABSORB_TEXT[v('absorption')] ?? v('absorption'), STICKY_TEXT[v('stickiness')] ?? v('stickiness'), v('finish') && `${splitList(v('finish')).join('·')} 마무리`]);
    case 'keyIngredients':
      return join([v('hero') && `Hero: ${v('hero')}`, v('actives') && `Active: ${v('actives')}`], ' / ');
    case 'pack':
      return join([v('size'), v('container'), v('material')]);
    case 'pitch': {
      const kw = splitList(v('keywords')).slice(0, 4).map((k) => `#${k.replace(/\s+/g, '')}`).join(' ');
      return join([v('usp') && `${v('usp').replace(/[.。]$/, '')}.`, v('differentiation') && `${v('differentiation').replace(/[.。]$/, '')}.`, kw], ' ');
    }
    default:
      return '';
  }
}

function composeSummary(key: string, entries: Record<string, BlueprintEntry>): BlueprintEntry {
  const f = blueprintField(key)!;
  const shown = CORE_SHOWN[key] ?? f.parts!;
  const decided = shown.filter((k) => !isUndecided(entries[k]));
  const value = summaryText(key, entries);
  if (!decided.length || !value) return { fieldKey: key, value: UNDECIDED, origin: 'UNDETERMINED', reason: '관련 상세 항목이 모두 미정이라 정하지 않았습니다.', confidence: 0, needsVerification: true, sourceReferences: [] };
  const user = decided.filter((k) => entries[k].origin === 'USER_PROVIDED');
  const allUser = user.length === decided.length && decided.length === shown.length;
  const label = (k: string) => blueprintField(k)!.label;
  return {
    fieldKey: key,
    value,
    origin: allUser ? 'USER_PROVIDED' : 'AI_SUGGESTED',
    reason: allUser ? '아이디어 문장에 직접 적은 조건입니다.' : `${decided.map(label).join('·')} 항목을 한 줄로 묶었습니다.${user.length ? ` 그중 ${user.map(label).join('·')}은(는) 사용자 입력입니다.` : ''}`,
    confidence: Math.min(...decided.map((k) => entries[k].confidence)),
    needsVerification: !!f.verify || decided.some((k) => entries[k].needsVerification),
    sourceReferences: user.length ? ['사용자 입력'] : [],
    locked: allUser || undefined,
  };
}

const optionIn = (text: string, key: string) => (blueprintField(key)?.options ?? []).filter((o) => text.includes(o) || text.includes(o.split(/[·/ ]/)[0]));

/** A summary line the user wrote → the detailed items it states (only what can be read reliably). */
export function parseSummary(key: string, text: string): Record<string, string> {
  const t = text.trim();
  const out: Record<string, string> = {};
  const set = (k: string, xs: string[]) => {
    const u = [...new Set(xs)];
    if (u.length) out[k] = u.join(', ');
  };
  switch (key) {
    case 'productKind':
      set('category', optionIn(t, 'category').slice(0, 1));
      set('productType', optionIn(t, 'productType').slice(0, 1));
      if (!out.productType) {
        const rest = t.split(/\s*[·>,/]\s*/).filter((x) => x && !(blueprintField('category')!.options ?? []).includes(x));
        if (rest.length) out.productType = rest[rest.length - 1];
      }
      break;
    case 'target': {
      const ages = [...t.matchAll(/(\d0)\s*대(\s*이상)?/g)].map((m) => (m[2] ? `${m[1]}대 이상` : `${m[1]}대`));
      set('ages', ages);
      set('gender', /남녀|성별\s*무관|젠더리스/.test(t) ? ['성별 무관'] : /여성/.test(t) ? ['여성'] : /남성/.test(t) ? ['남성'] : []);
      set('skinTypes', [/민감/.test(t) && '민감성', /건성|건조한 피부/.test(t) && '건성', /지성/.test(t) && '지성', /복합/.test(t) && '복합성', /모든 피부|전\s*피부/.test(t) && '모든 피부'].filter(Boolean) as string[]);
      const concerns = (blueprintField('concerns')!.options ?? []).filter((o) => o.split(/[·\s]/).some((w) => w.length > 1 && w !== '민감' && t.includes(w)));
      set('concerns', concerns);
      break;
    }
    case 'texture': {
      set('textureType', optionIn(t, 'textureType').slice(0, 1));
      const ab = /(빠른|빠르게)\s*흡수|흡수\s*(빠름|빠른)/.test(t) ? '빠름' : /(천천히|느린|느리게)\s*흡수|흡수\s*느림/.test(t) ? '느림' : /흡수\s*보통|보통\s*흡수/.test(t) ? '보통' : '';
      if (ab) out.absorption = ab;
      const st = /끈적임\s*(없음|없이|없는|없게|0)|논\s*스티키|안\s*끈적/.test(t) ? '전혀 허용 안 함' : /끈적임\s*(거의|적은|적게|최소)/.test(t) ? '거의 없어야 함' : /약간(의)?\s*끈적/.test(t) ? '약간 허용' : '';
      if (st) out.stickiness = st;
      set('finish', optionIn(t, 'finish'));
      break;
    }
    case 'keyIngredients': {
      const hero = t.match(/hero\s*[:：]\s*([^/|]+)/i)?.[1];
      const act = t.match(/active\s*[:：]\s*([^/|]+)/i)?.[1];
      if (hero || act) {
        if (hero) out.hero = splitList(hero).join(', ');
        if (act) out.actives = splitList(act).join(', ');
      } else {
        const xs = splitList(t.replace(/\s*\+\s*/g, ', '));
        if (xs.length) out.hero = xs[0];
        if (xs.length > 1) out.actives = xs.slice(1).join(', ');
      }
      break;
    }
    case 'pack': {
      const ml = t.match(/(\d{1,4})\s*(ml|mL|ML|g)/);
      if (ml) out.size = `${ml[1]}${ml[2].toLowerCase()}`;
      set('container', optionIn(t, 'container').slice(0, 1));
      const mat = t.match(/(재활용\s*)?(PETG|PET|PP|PE|PCR|유리|알루미늄|아크릴|종이)[^·,/]*/i)?.[0];
      if (mat) out.material = mat.trim();
      break;
    }
    case 'pitch': {
      out.differentiation = t.replace(/#\S+/g, '').trim() || t;
      const tags = [...t.matchAll(/#(\S+)/g)].map((m) => m[1]);
      if (tags.length) out.keywords = tags.join(', ');
      break;
    }
  }
  return out;
}

const userEntry = (key: string, v: string, prev: BlueprintEntry | undefined, reason = '사용자가 직접 수정한 값입니다.'): BlueprintEntry => ({
  fieldKey: key,
  value: v || UNDECIDED,
  origin: v ? 'USER_PROVIDED' : 'UNDETERMINED',
  reason: v ? reason : '사용자가 값을 비웠습니다.',
  confidence: v ? 1 : 0,
  needsVerification: !!blueprintField(key)?.verify || !v,
  sourceReferences: v ? ['사용자 입력'] : [],
  locked: !!v,
  previous: prev ? [...new Set([...(prev.previous ?? []), prev.value])].slice(-6) : [],
});

/** Summary items follow their detailed items unless the user wrote or locked the summary. */
function syncSummaries(entries: Record<string, BlueprintEntry>, changedParts: string[], force = false) {
  for (const k of SUMMARY_KEYS) {
    const cur = entries[k];
    if (cur?.locked && !force) continue;
    if (!force && !changedParts.some((p) => blueprintField(k)!.parts!.includes(p)) && cur && !isUndecided(cur)) continue;
    const next = composeSummary(k, entries);
    entries[k] = { ...next, previous: cur && cur.value !== next.value ? [...new Set([...(cur.previous ?? []), cur.value])].slice(-6) : cur?.previous };
  }
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
    if (!entries[f.key] && !f.parts) entries[f.key] = { fieldKey: f.key, value: UNDECIDED, origin: 'UNDETERMINED', reason: 'AI 응답에 이 항목이 없어 미정으로 두었습니다.', confidence: 0, needsVerification: true, sourceReferences: [] };
  for (const k of SUMMARY_KEYS) if (!entries[k] || isUndecided(entries[k])) entries[k] = composeSummary(k, entries);
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
export async function refreshEntries(bp: Blueprint, keys: string[]): Promise<{ bp: Blueprint; error?: string; keys: string[] }> {
  const open = (k: string) => bp.entries[k] && !bp.entries[k].locked;
  const asked = keys.filter(open);
  // a summary item is re-suggested together with the detailed items it is built from (locked ones stay)
  const todo = [...new Set(asked.flatMap((k) => (isSummary(k) ? [k, ...blueprintField(k)!.parts!.filter(open)] : [k])))];
  if (!todo.length) return { bp, keys: [] };
  const avoid = Object.fromEntries(todo.map((k) => [k, [...(bp.entries[k].previous ?? []), bp.entries[k].value].filter((v) => v && v !== UNDECIDED)]));
  let fresh: BlueprintEntry[];
  let regulatory = bp.regulatory;
  let error: string | undefined;
  const details = todo.filter((k) => !isSummary(k));
  if (bp.mode === 'ai') {
    try {
      const a = await callAi(bp.idea, { keys: todo, context: bp, avoid });
      fresh = a.entries.map((e) => ({ ...e, origin: e.origin === 'USER_PROVIDED' ? 'AI_SUGGESTED' : e.origin }));
      if (a.regulatory.length) regulatory = a.regulatory;
    } catch (e) {
      error = `AI 재추천에 실패해 데모 규칙으로 추천했어요. (${e instanceof Error ? e.message : '오류'})`;
      fresh = demoRefresh(bp, details, avoid);
    }
  } else {
    await new Promise((r) => window.setTimeout(r, 350));
    fresh = demoRefresh(bp, details, avoid);
  }
  const entries = { ...bp.entries };
  for (const e of fresh) {
    const prev = entries[e.fieldKey];
    if (!prev || prev.locked || !todo.includes(e.fieldKey)) continue;
    entries[e.fieldKey] = { ...e, needsVerification: e.needsVerification || !!blueprintField(e.fieldKey)?.verify, previous: [...new Set([...(prev.previous ?? []), prev.value])].slice(-6), review: undefined };
  }
  // summaries the AI did not answer (or Demo Mode) are rebuilt from the new detailed values
  const answered = new Set(fresh.map((e) => e.fieldKey));
  for (const k of todo)
    if (isSummary(k) && (!answered.has(k) || isUndecided(entries[k]))) {
      const prev = bp.entries[k];
      entries[k] = { ...composeSummary(k, entries), locked: undefined, previous: [...new Set([...(prev.previous ?? []), prev.value])].slice(-6) };
    }
  syncSummaries(entries, details.filter((k) => !todo.some((s) => isSummary(s) && blueprintField(s)!.parts!.includes(k))));
  const changed = Object.keys(entries).filter((k) => entries[k] !== bp.entries[k]);
  return { bp: { ...bp, entries, regulatory: syncRegulatory(regulatory, marketCodes(entries.markets.value)) }, error, keys: changed };
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

/**
 * The user's own value: shown as 사용자 입력, locked, and related items get "재검토 필요" (never overwritten).
 * A summary line is also read into the detailed items it states, so later steps get the user's condition.
 */
export function editEntry(bp: Blueprint, key: string, value: string): Blueprint {
  const prev = bp.entries[key];
  const f = blueprintField(key)!;
  const v = value.trim();
  if (prev && prev.value === v) return bp;
  const entries = { ...bp.entries };
  entries[key] = userEntry(key, v, prev);
  const changed = [key];
  const why = `${f.label} 변경`;
  if (f.parts && v) {
    const parsed = parseSummary(key, v);
    for (const p of f.parts) {
      if (parsed[p]) {
        if (parsed[p] !== entries[p]?.value) {
          entries[p] = userEntry(p, parsed[p], entries[p], `"${f.label}"에 직접 적은 값입니다.`);
          changed.push(p);
        }
      } else if (entries[p] && !entries[p].locked) entries[p] = { ...entries[p], review: why };
    }
  }
  // a detailed item changed (from a later step) → summary lines built from it follow, unless the user wrote them
  if (!f.parts) syncSummaries(entries, [key]);
  const dependents = new Set(changed.flatMap((k) => [...(BLUEPRINT_DEPENDENTS[k] ?? []), ...(CORE_DEPENDENTS[k] ?? []), ...summariesOf(k).flatMap((s) => (s === key ? [] : CORE_DEPENDENTS[s] ?? []))]));
  for (const d of dependents) if (entries[d] && !changed.includes(d)) entries[d] = { ...entries[d], review: why };
  return { ...bp, entries, regulatory: changed.includes('markets') ? syncRegulatory(bp.regulatory, marketCodes(entries.markets.value)) : bp.regulatory };
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

export function blueprintCounts(bp: Blueprint, keys?: string[]) {
  const all = keys ? keys.map((k) => bp.entries[k]).filter(Boolean) : Object.values(bp.entries);
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
        ? { fieldKey: f.key, value: e.value, origin: e.origin === 'USER_PROVIDED' || e.origin === 'AI_SUGGESTED' ? e.origin : 'UNDETERMINED', reason: typeof e.reason === 'string' ? e.reason : '', confidence: typeof e.confidence === 'number' ? e.confidence : 0, needsVerification: e.needsVerification !== false, sourceReferences: Array.isArray(e.sourceReferences) ? e.sourceReferences.filter((s) => typeof s === 'string') : [], locked: e.locked === true, review: typeof e.review === 'string' ? e.review : undefined, previous: Array.isArray(e.previous) ? e.previous.filter((s) => typeof s === 'string') : [] }
        : { fieldKey: f.key, value: UNDECIDED, origin: 'UNDETERMINED', reason: '', confidence: 0, needsVerification: true, sourceReferences: [] };
  }
  for (const k of SUMMARY_KEYS) if (!(b.entries as Record<string, unknown>)[k]) entries[k] = composeSummary(k, entries);
  const regulatory = Array.isArray(b.regulatory)
    ? b.regulatory.filter((r) => r && typeof r.country === 'string').map((r) => ({ country: r.country, status: r.status === 'VERIFIED' && r.source && r.checkedAt ? ('VERIFIED' as const) : ('REVIEW_REQUIRED' as const), items: Array.isArray(r.items) ? r.items : [], source: r.source ?? null, checkedAt: r.checkedAt ?? null, conditions: Array.isArray(r.conditions) ? r.conditions : [] }))
    : [];
  return { idea: b.idea, mode: b.mode === 'ai' ? 'ai' : 'demo', model: b.model, generatedAt: typeof b.generatedAt === 'string' ? b.generatedAt : new Date().toISOString(), productName: typeof b.productName === 'string' ? b.productName : 'New Product', entries, regulatory, notice: b.notice, confirmedAt: b.confirmedAt };
}
