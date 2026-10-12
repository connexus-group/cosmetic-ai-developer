import { fieldById, marketLabel, SPEC_FIELDS, type SpecField } from '@/data/intakeSpec';
import type {
  ClarifyAnswer,
  ClarifyQuestion,
  ConceptOption,
  DataKind,
  FormulaId,
  IngredientInfo,
  Intake,
  Moq,
  PackageId,
  Project,
  Spec,
  SpecAnswer,
  SpecFieldId,
  StepId,
} from '@/data/types';

/**
 * Helpers that turn the detailed intake (Project.spec) into signals for the analysis steps.
 * Inputs only steer what is highlighted, warned about or pre-filled. They never confirm
 * safety or regulatory compliance: every regulatory output stays "검토 필요".
 */

// ── reading answers ─────────────────────────────────────────────────────────

/** Values the later steps may use. "잘 모르겠어요" and empty answers count as 미정. */
export const vals = (spec: Spec | undefined, id: SpecFieldId): string[] => {
  const a = spec?.[id];
  return a && a.mode !== 'unknown' ? a.value.filter((v) => v.trim() !== '') : [];
};
export const first = (spec: Spec | undefined, id: SpecFieldId) => vals(spec, id)[0];
export const isSet = (a: SpecAnswer | undefined) => !!a && a.mode !== 'unknown' && a.value.some((v) => v.trim() !== '');

export function displayValue(field: SpecField, a: SpecAnswer | undefined): string {
  if (!a || a.mode === 'unknown' || !isSet(a)) return '미정';
  const list = field.input === 'markets' || field.id === 'priorityMarket' ? a.value.map(marketLabel) : a.value;
  return list.join(', ');
}

/** Badge kind for an answer's source. */
export const answerKind = (a: SpecAnswer | undefined): DataKind | null =>
  !a || !isSet(a) ? null : a.mode === 'user' ? 'USER_INPUT' : a.mode === 'idea' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND';

export const parseWon = (s: string | undefined) => {
  const n = Number((s ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const MOQS: Moq[] = [3000, 5000, 10000];
/** Nearest MOQ step the cost simulator supports. */
export function moqFrom(spec: Spec): Moq | null {
  const n = parseWon(first(spec, 'firstRun'));
  if (!n) return null;
  return MOQS.reduce((best, m) => (Math.abs(m - n) < Math.abs(best - n) ? m : best), MOQS[0]);
}

// ── building the spec from the idea ─────────────────────────────────────────

const AGE_BUCKETS = ['10대', '20대', '30대', '40대', '50대 이상'];

/** Pre-fill fields the idea analyzer actually found in the user's text (marked "아이디어에서 추출"). */
export function initialSpec(intake: Intake): Spec {
  const spec: Spec = {};
  const found = (k: keyof Intake) => intake[k].kind === 'AI_ANALYSIS';
  const idea = (value: string[]): SpecAnswer => ({ mode: 'idea', value });
  if (found('category')) {
    const [main, sub] = intake.category.value.split(' > ');
    spec.category = idea([main]);
    if (sub) spec.subtype = idea([sub]);
  }
  if (found('benefit')) spec.benefits = idea(intake.benefit.value.split(/\s*\/\s*/).filter((b) => b && b !== '안티에이징'));
  if (found('target')) {
    const m = intake.target.value.match(/(\d)\d\s*~/);
    if (m) spec.ages = idea([AGE_BUCKETS[Math.min(4, Math.max(0, Number(m[1]) - 1))]]);
    const g = /여성·남성/.test(intake.target.value) ? null : /여성/.test(intake.target.value) ? '여성' : /남성/.test(intake.target.value) ? '남성' : null;
    if (g) spec.gender = idea([g]);
  }
  if (found('price')) {
    const nums = (intake.price.value.match(/[\d,]{4,}/g) ?? []).map((n) => Number(n.replace(/,/g, '')));
    if (nums.length) spec.targetPrice = idea([`${(Math.round(nums.reduce((a, b) => a + b, 0) / nums.length / 1000) * 1000).toLocaleString('ko-KR')}원`]);
  }
  if (found('channel')) spec.channels = idea(intake.channel.value.split(/\s*\/\s*/).filter(Boolean));
  return spec;
}

/** Keep the old 7 follow-up answers filled so existing screens keep working. */
export function specToAnswers(spec: Spec): Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>> {
  const out: Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>> = {};
  for (const f of SPEC_FIELDS) {
    const a = spec[f.id];
    if (!f.legacy || !a) continue;
    out[f.legacy] =
      a.mode === 'unknown' ? { mode: 'unknown', value: '' } : { mode: a.mode === 'ai' ? 'ai' : 'user', value: displayValue(f, a) };
  }
  return out;
}

/** Header facts (category / target / benefit / price / channel) follow the wizard when the user answered there. */
export function intakeFromSpec(intake: Intake, spec: Spec): Intake {
  const next = { ...intake };
  const kindOf = (id: SpecFieldId) => (spec[id]?.mode === 'user' ? 'USER_INPUT' : spec[id]?.mode === 'ai' ? 'AI_ESTIMATE' : 'AI_ANALYSIS') as DataKind;
  const cat = first(spec, 'category');
  const sub = first(spec, 'subtype');
  if (cat && spec.category?.mode !== 'idea') next.category = { value: sub ? `${cat} > ${sub}` : cat, kind: kindOf('category') };
  const benefits = vals(spec, 'benefits');
  if (benefits.length && spec.benefits?.mode !== 'idea') next.benefit = { value: benefits.join(' / '), kind: kindOf('benefits') };
  const ages = vals(spec, 'ages');
  if (ages.length && spec.ages?.mode !== 'idea') {
    const g = first(spec, 'gender');
    next.target = { value: `${ages.join('·')} ${g && g !== '성별 무관' ? g : '여성·남성'}`, kind: kindOf('ages') };
  }
  const channels = vals(spec, 'channels');
  if (channels.length && spec.channels?.mode !== 'idea') next.channel = { value: channels.join(' / '), kind: kindOf('channels') };
  const price = parseWon(first(spec, 'targetPrice'));
  if (price && spec.targetPrice?.mode !== 'idea') next.price = { value: `${price.toLocaleString('ko-KR')}원`, kind: kindOf('targetPrice') };
  return next;
}

// ── signals ─────────────────────────────────────────────────────────────────

const TEXTURE_TO_FORMULA: Record<string, FormulaId> = { 밀키: 'milky', 젤: 'gel', 캡슐: 'capsule' };
const CONTAINER_TO_PACKAGE: Record<string, PackageId> = { 에어리스: 'airless', 스포이드: 'dropper', 펌프: 'pump' };

const ALIASES: Record<string, string[]> = {
  pdrn: ['pdrn', '피디알엔', 'sodium dna'],
  retinal: ['retinal', '레티날', '레티놀', 'retinol', '레티노이드'],
  peptide: ['peptide', '펩타이드'],
  adenosine: ['adenosine', '아데노신'],
  ectoin: ['ectoin', '엑토인'],
  panthenol: ['panthenol', '판테놀'],
  ceramide: ['ceramide', '세라마이드'],
  nad: ['nad'],
  niacinamide: ['niacinamide', '나이아신아마이드'],
  collagen: ['collagen', '콜라겐'],
  glycerin: ['glycerin', '글리세린'],
  bg: ['butylene glycol', '부틸렌글라이콜'],
  hexanediol: ['hexanediol', '헥산다이올'],
  squalane: ['squalane', '스쿠알란'],
};
/** Does a typed ingredient name refer to this ingredient id? */
export const mentions = (typed: string[], id: string) =>
  typed.some((raw) => {
    const t = raw.toLowerCase().trim();
    return t.length >= 2 && (ALIASES[id] ?? [id]).some((a) => t.includes(a) || a.includes(t));
  });

const ANIMAL_ORIGIN_POSSIBLE = ['pdrn', 'collagen'];
const IRRITATION_REVIEW = ['retinal'];

export function signals(p: Pick<Project, 'spec'>) {
  const s = p.spec ?? {};
  const skin = vals(s, 'skinTypes');
  const markets = vals(s, 'markets');
  const texture = first(s, 'textureType');
  const container = first(s, 'container');
  return {
    any: Object.values(s).some(isSet),
    sensitive: skin.includes('민감성') || vals(s, 'concerns').includes('붉은기·민감'),
    lowIrritation: first(s, 'lowIrritation') === '예',
    vegan: first(s, 'vegan') === '예',
    natural: first(s, 'natural') === '예',
    scent: first(s, 'scent'),
    texture,
    formulaId: texture ? TEXTURE_TO_FORMULA[texture] : undefined,
    container,
    packageId: container ? CONTAINER_TO_PACKAGE[container] : undefined,
    finish: vals(s, 'finish'),
    stickiness: first(s, 'stickiness'),
    targetPrice: parseWon(first(s, 'targetPrice')),
    targetCost: parseWon(first(s, 'targetCost')),
    firstRun: parseWon(first(s, 'firstRun')),
    sizeMl: parseWon(first(s, 'size')),
    markets,
    overseas: markets.filter((m) => m !== 'KR'),
    certifications: vals(s, 'certifications').filter((c) => c !== '인증 없음'),
    functional: vals(s, 'functional').filter((f) => f !== '기능성 없음'),
    mustInclude: vals(s, 'mustInclude'),
    exclude: vals(s, 'exclude'),
    launchMonths: parseWon(first(s, 'launchTiming')),
    design: first(s, 'designDirection'),
    benchmark: first(s, 'benchmark'),
    concerns: vals(s, 'concerns'),
    skin,
    ages: vals(s, 'ages'),
    channels: vals(s, 'channels'),
    differentiation: vals(s, 'differentiation'),
    claimCopy: first(s, 'claimCopy'),
    adReview: first(s, 'adReview'),
  };
}
export type Signals = ReturnType<typeof signals>;

export interface Flag {
  text: string;
  tone: 'warn' | 'info' | 'good';
}

/** Warnings and matches for one ingredient, from the user's conditions. */
export function ingredientFlags(p: Pick<Project, 'spec'>, ing: Pick<IngredientInfo, 'id' | 'name'>): Flag[] {
  const g = signals(p);
  const out: Flag[] = [];
  if (mentions(g.exclude, ing.id)) out.push({ text: '제외 요청한 원료입니다. 대체 원료 검토 필요', tone: 'warn' });
  if (mentions(g.mustInclude, ing.id)) out.push({ text: '반드시 사용 요청한 원료', tone: 'good' });
  if ((g.sensitive || g.lowIrritation) && IRRITATION_REVIEW.includes(ing.id)) out.push({ text: '민감 피부·저자극 조건: 자극 가능성 검토 필요', tone: 'warn' });
  if (g.vegan && ANIMAL_ORIGIN_POSSIBLE.includes(ing.id)) out.push({ text: '비건 조건: 원료 유래(동물성 여부) 확인 필요', tone: 'warn' });
  if (g.overseas.length) out.push({ text: `${g.overseas.map(marketLabel).join('·')} 판매: 국가별 사용 가능 여부 확인 필요`, tone: 'warn' });
  return out;
}

/** Warnings for a concept option, from the user's conditions. */
export function conceptFlags(p: Pick<Project, 'spec'>, c: ConceptOption): Flag[] {
  const g = signals(p);
  const out: Flag[] = [];
  const ids = [c.hero, ...c.actives].map((n) => n.toLowerCase().replace('+', ''));
  const excluded = ids.filter((id) => mentions(g.exclude, id));
  if (excluded.length) out.push({ text: `제외 요청 원료 포함: ${excluded.join(', ')}`, tone: 'warn' });
  const included = g.mustInclude.filter((m) => ids.some((id) => mentions([m], id)));
  if (included.length) out.push({ text: `요청한 필수 원료 포함: ${included.join(', ')}`, tone: 'good' });
  if ((g.sensitive || g.lowIrritation) && c.actives.includes('Retinal')) out.push({ text: '민감·저자극 조건: Retinal 자극 검토 필요', tone: 'warn' });
  if (g.targetPrice) {
    const diff = c.retailPrice - g.targetPrice;
    if (Math.abs(diff) >= 3000) out.push({ text: `목표 판매가 대비 ${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString()}원`, tone: diff > 0 ? 'warn' : 'info' });
    else out.push({ text: '목표 판매가와 비슷한 가격대', tone: 'good' });
  }
  if (g.targetCost && c.estimatedCost > g.targetCost) out.push({ text: `예상 원가가 목표 제조원가보다 ${(c.estimatedCost - g.targetCost).toLocaleString()}원 높음`, tone: 'warn' });
  return out;
}

// ── per-step notes ──────────────────────────────────────────────────────────

export interface Impact {
  field: SpecFieldId;
  value: string;
  effect: string;
  tone: 'warn' | 'info' | 'good';
}

const show = (p: Project, id: SpecFieldId) => displayValue(fieldById(id), p.spec?.[id]);
const set = (p: Project, id: SpecFieldId) => isSet(p.spec?.[id]);

/** Which conditions a step used and what they changed there. Only answered fields appear. */
export function stepImpacts(p: Project, step: StepId, ctx: { costTotal?: number; weeks?: number } = {}): Impact[] {
  const g = signals(p);
  const out: Impact[] = [];
  const add = (field: SpecFieldId, effect: string, tone: Impact['tone'] = 'info') => {
    if (set(p, field)) out.push({ field, value: show(p, field), effect, tone });
  };
  const abroad = g.overseas.length > 0;
  switch (step) {
    case 'market':
      add('ages', '연령대별 구매 비중 차트에서 타깃 연령을 강조했습니다.');
      add('channels', '채널별 비중 차트에서 선택한 판매 채널을 강조했습니다.');
      add('markets', abroad ? '시장 데이터(데모)는 국내 기준입니다. 해외 시장 데이터는 아직 연결되지 않았습니다.' : '국내 시장 데이터(데모)를 기준으로 분석합니다.', abroad ? 'warn' : 'info');
      break;
    case 'competitors':
      add('targetPrice', '포지셔닝 차트에 목표 판매가 기준선을 표시합니다. 근처 가격대 제품을 우선 비교하세요.');
      add('benchmark', '입력한 벤치마킹 제품은 데모 경쟁제품 목록에 없을 수 있어 별도 확인이 필요합니다.');
      add('differentiation', '선택한 차별화 방향으로 경쟁제품과의 차이를 확인하세요.');
      break;
    case 'consumer':
      add('skinTypes', g.sensitive ? '민감 피부 관련 불만 키워드(자극·따가움)를 우선 확인하세요.' : '선택한 피부 타입 관점에서 리뷰 키워드를 확인하세요.', g.sensitive ? 'warn' : 'info');
      add('concerns', '입력한 피부 고민을 리뷰 니즈 키워드와 함께 확인하세요.');
      add('stickiness', '끈적임 관련 불만 키워드를 제형 조건과 함께 확인하세요.');
      break;
    case 'trend':
      add('mustInclude', '필수 원료의 트렌드 단계와 경쟁 강도를 확인하세요.');
      add('exclude', '제외 원료는 트렌드가 높아도 컨셉 후보에서 경고로 표시됩니다.', 'warn');
      break;
    case 'opportunity':
      add('differentiation', '선택한 차별화 방향에 맞는 빈 영역을 우선 확인하세요.');
      add('priceSensitivity', '가격 민감도가 높을수록 고가 영역 진입 리스크를 함께 검토하세요.');
      break;
    case 'concept':
      add('targetPrice', '컨셉별 권장가와 목표 판매가의 차이를 각 카드에 표시합니다.');
      add('targetCost', '컨셉별 예상 원가가 목표 제조원가를 넘으면 경고합니다.');
      add('exclude', '제외 원료가 들어간 컨셉은 경고합니다.', 'warn');
      add('mustInclude', '필수 원료가 들어간 컨셉을 표시합니다.');
      if (g.sensitive || g.lowIrritation) add(g.sensitive ? 'skinTypes' : 'lowIrritation', '자극 가능성이 있는 액티브 성분은 검토 필요로 표시합니다.', 'warn');
      break;
    case 'formula':
      add('textureType', g.formulaId ? '희망 제형과 일치하는 제형 후보에 "입력 조건 일치"를 표시합니다.' : '희망 제형이 데모 제형 후보(밀키·젤·캡슐)에 없어 제조사와 별도 협의가 필요합니다.', g.formulaId ? 'good' : 'warn');
      add('stickiness', '끈적임 점수가 높은 제형은 조건과 맞는지 확인하세요.');
      add('finish', '마무리감 조건을 제형 선택 기준으로 함께 확인하세요.');
      add('scent', g.scent === '무향' ? '무향 조건: 향료 미사용 처방을 제조사에 요청하세요.' : '향 조건을 개발의뢰서 추가 요청사항에 반영합니다.');
      if (g.sensitive) add('skinTypes', '민감 피부: 자극 가능성 검토가 필요합니다 (안전성을 확정하지 않습니다).', 'warn');
      break;
    case 'ingredients':
      add('mustInclude', '필수 원료는 원료 카드에 표시합니다. 함량·원료사는 확인 필요.', 'good');
      add('exclude', '제외 원료가 추천 목록에 있으면 경고하고 대체 원료 검토를 권합니다.', 'warn');
      add('functional', '희망 기능성에 필요한 고시 성분 사용 여부를 확인하세요 (규제 검토 필요).');
      add('vegan', g.vegan ? '비건: 동물 유래 가능 원료(PDRN·콜라겐 등)는 유래 확인이 필요합니다.' : '비건 조건 없음.', g.vegan ? 'warn' : 'info');
      add('lowIrritation', g.lowIrritation ? '저자극: 자극 가능 원료는 검토 필요로 표시합니다.' : '저자극 조건 없음.', g.lowIrritation ? 'warn' : 'info');
      add('natural', '천연 유래 선호는 원료사 규격서로 확인해야 합니다.');
      add('supplier', '지정한 원료사·특허 원료는 확인된 데이터가 없어 제조사 확인이 필요합니다.');
      add('markets', abroad ? '선택한 해외 국가의 원료 사용 가능 여부는 규제 데이터가 연결되지 않아 모두 "확인 필요"입니다.' : '국내 기준으로 검토합니다.', abroad ? 'warn' : 'info');
      break;
    case 'packaging':
      add('container', g.packageId ? '희망 용기와 일치하는 패키지 후보에 "입력 조건 일치"를 표시합니다.' : '희망 용기가 데모 패키지 후보(에어리스·스포이드·펌프)에 없어 용기사 확인이 필요합니다.', g.packageId ? 'good' : 'warn');
      add('designDirection', g.design === '친환경' ? '친환경 방향: 지속가능성 점수가 높은 용기를 우선 보세요.' : '디자인 방향을 개발의뢰서에 반영합니다.');
      add('size', '희망 용량을 개발의뢰서 용량에 반영했습니다. 용기 규격 선택 시 확인하세요.');
      break;
    case 'cost':
      if (g.targetCost && ctx.costTotal) {
        const gap = ctx.costTotal - g.targetCost;
        add('targetCost', gap > 0 ? `현재 예상 원가가 목표보다 ${gap.toLocaleString()}원 높습니다. 원료·용기 조정 검토가 필요합니다.` : `현재 예상 원가가 목표 이내입니다 (여유 ${Math.abs(gap).toLocaleString()}원, 데모 추정).`, gap > 0 ? 'warn' : 'good');
      } else add('targetCost', '목표 제조원가와 예상 원가를 비교합니다.');
      add('targetPrice', '목표 판매가를 판매가 기본값으로 사용했습니다.');
      add('firstRun', `초도 수량을 MOQ 시뮬레이션 기본값(${p.moq.toLocaleString()}개)으로 사용했습니다.`);
      break;
    case 'regulation':
      add('markets', abroad ? '선택한 국가별 규제 확인 항목을 추가했습니다. 실제 규제 데이터가 연결되지 않아 판정하지 않습니다.' : '국내 기준 규제 항목입니다.', abroad ? 'warn' : 'info');
      add('functional', '희망 기능성은 심사·보고 절차 확인 항목으로 추가했습니다.', 'warn');
      add('certifications', '희망 인증은 인증 기관 요건 확인 항목으로 추가했습니다.');
      add('claimCopy', '입력한 마케팅 문구를 표시·광고 Risk Checker 기본값으로 사용했습니다.');
      add('adReview', '표시·광고 문구는 최종적으로 규제 검토가 필요합니다.');
      add('scent', g.scent === '향료 사용' ? '향료 사용 시 알레르기 유발 성분 표시 기준 확인이 필요합니다.' : '향 조건을 표시사항 검토에 참고하세요.');
      break;
    case 'testing':
      if (g.sensitive || g.lowIrritation) add(g.sensitive ? 'skinTypes' : 'lowIrritation', '피부 자극·민감 피부 사용 시험을 기본 선택했습니다.', 'warn');
      add('certifications', '인증에 필요한 시험·서류는 인증 기관 확인이 필요합니다.');
      add('functional', '기능성 근거 시험(인체적용 등)은 규제 검토 후 확정하세요.');
      add('markets', abroad ? '국가별로 요구 시험·서류가 다를 수 있어 확인이 필요합니다.' : '국내 기준 시험 계획입니다.', abroad ? 'warn' : 'info');
      break;
    case 'timeline':
      if (g.launchMonths && ctx.weeks) {
        const targetWeeks = Math.round(g.launchMonths * 4.3);
        add('launchTiming', ctx.weeks > targetWeeks ? `예상 일정(${ctx.weeks}주)이 목표(약 ${targetWeeks}주)보다 깁니다. 일정 조정이 필요합니다.` : `예상 일정(${ctx.weeks}주)이 목표(약 ${targetWeeks}주) 안에 있습니다 (데모 추정).`, ctx.weeks > targetWeeks ? 'warn' : 'good');
      } else add('launchTiming', '목표 출시 시기와 예상 일정을 비교합니다.');
      add('markets', abroad ? '해외 출시는 국가별 등록·규제 확인 기간이 추가될 수 있습니다.' : '국내 출시 기준 일정입니다.', abroad ? 'warn' : 'info');
      break;
    default:
      break;
  }
  return out;
}

/** Projects saved before the wizard only have the 7 follow-up answers: carry them over. */
export function specFromAnswers(answers: Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>>): Spec {
  const spec: Spec = {};
  for (const f of SPEC_FIELDS) {
    const a = f.legacy ? answers[f.legacy] : undefined;
    if (!a) continue;
    if (a.mode === 'unknown') {
      spec[f.id] = { mode: 'unknown', value: [] };
      continue;
    }
    let value = [a.value];
    if (f.input === 'markets') {
      const byName: Record<string, string> = { 한국: 'KR', 대한민국: 'KR', 미국: 'US', 중국: 'CN', 일본: 'JP', 유럽: 'EU', EU: 'EU', 영국: 'UK', 동남아: 'SEA', 동남아시아: 'SEA' };
      const codes = Object.entries(byName)
        .filter(([name]) => a.value.includes(name))
        .map(([, code]) => code);
      value = codes.length ? [...new Set(codes)] : [a.value];
    }
    spec[f.id] = { mode: a.mode === 'ai' ? 'ai' : 'user', value };
  }
  return spec;
}
