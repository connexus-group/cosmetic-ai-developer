import type { ClarifyQuestion, Intake, Spec, SpecFieldId, SpecGroupId } from './types';

/**
 * Detailed intake (Product Blueprint) definition: 6 groups shown as a wizard.
 *
 * "데모 추천" values come from the rules below, not from an AI API. They are hypotheses built
 * from the idea text and earlier answers, and the UI always labels them that way.
 * TODO(Phase 6): replace `demo` with an LLM call that receives the idea + current spec.
 */

export interface SpecOption {
  value: string;
  label: string;
}

export type SpecInput = 'single' | 'multi' | 'text' | 'tags' | 'slider' | 'markets';

export interface SpecCtx {
  idea: string;
  intake: Intake;
  spec: Spec;
}

export interface SpecField {
  id: SpecFieldId;
  group: SpecGroupId;
  label: string;
  hint?: string;
  input: SpecInput;
  options?: SpecOption[];
  /** single/multi: the user may add their own option */
  allowCustom?: boolean;
  placeholder?: string;
  required?: boolean;
  /** the old 7 follow-up questions this field replaces (kept in Project.answers for older screens) */
  legacy?: ClarifyQuestion['id'];
  demo: (ctx: SpecCtx) => { value: string[]; reason: string };
}

export const SPEC_GROUPS: { id: SpecGroupId; no: number; label: string; en: string; desc: string }[] = [
  { id: 'product', no: 1, label: 'Product', en: 'Product Information', desc: '어떤 제품을, 왜 만드는지 정해요.' },
  { id: 'target', no: 2, label: 'Target', en: 'Target Consumer', desc: '누가, 언제 쓰는 제품인지 정해요.' },
  { id: 'formula', no: 3, label: 'Formula', en: 'Formula & Sensory', desc: '바르는 느낌과 제형 조건을 정해요.' },
  { id: 'ingredients', no: 4, label: 'Ingredients', en: 'Ingredient Strategy', desc: '꼭 넣을 원료와 뺄 원료를 정해요.' },
  { id: 'commercial', no: 5, label: 'Commercial', en: 'Commercial & Packaging', desc: '가격·원가·수량·용기 조건을 정해요.' },
  { id: 'global', no: 6, label: 'Global', en: 'Global & Regulatory', desc: '판매 국가와 규제·광고 조건을 정해요.' },
];

const o = (...labels: string[]): SpecOption[] => labels.map((l) => ({ value: l, label: l }));

export const MARKETS: SpecOption[] = [
  { value: 'KR', label: '대한민국' },
  { value: 'US', label: '미국' },
  { value: 'CN', label: '중국' },
  { value: 'JP', label: '일본' },
  { value: 'EU', label: 'EU' },
  { value: 'UK', label: '영국' },
  { value: 'SEA', label: '동남아시아' },
];
export const marketLabel = (code: string) => MARKETS.find((m) => m.value === code)?.label ?? code;

export const SLIDER_LABELS: Partial<Record<SpecFieldId, string[]>> = {
  priceSensitivity: ['매우 낮음', '낮음', '보통', '높음', '매우 높음'],
  stickiness: ['전혀 허용 안 함', '거의 없어야 함', '약간 허용', '어느 정도 허용', '상관없음'],
};

// ── context helpers for demo rules ──────────────────────────────────────────

const benefitsOf = (c: SpecCtx) => c.spec.benefits?.value ?? c.intake.benefit.value.split(/\s*\/\s*/).filter(Boolean);
const has = (c: SpecCtx, ...words: string[]) => {
  const text = [c.idea, ...benefitsOf(c), ...(c.spec.concerns?.value ?? []), ...(c.spec.skinTypes?.value ?? [])].join(' ');
  return words.some((w) => text.includes(w));
};
const categoryOf = (c: SpecCtx) => c.spec.category?.value[0] ?? c.intake.category.value.split(' > ')[0] ?? '스킨케어';
const subtypeOf = (c: SpecCtx) => c.spec.subtype?.value[0] ?? c.intake.category.value.split(' > ')[1] ?? '';
const priceMid = (c: SpecCtx) => {
  const typed = Number((c.spec.targetPrice?.value[0] ?? '').replace(/[^\d]/g, ''));
  if (typed > 1000) return typed;
  const nums = (c.intake.price.value.match(/[\d,]{4,}/g) ?? []).map((n) => Number(n.replace(/,/g, '')));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 32000;
};
const ageOf = (c: SpecCtx) => {
  const m = c.intake.target.value.match(/(\d)\d\s*~/);
  return m ? Number(m[1]) * 10 : 30;
};
const won = (n: number) => `${(Math.round(n / 100) * 100).toLocaleString('ko-KR')}원`;
const sensitive = (c: SpecCtx) => has(c, '민감', '진정');
const withRetinoid = (c: SpecCtx) => /레티|retin/i.test(c.idea) || (c.spec.mustInclude?.value ?? []).some((x) => /retin|레티/i.test(x));

// ── fields ──────────────────────────────────────────────────────────────────

export const SPEC_FIELDS: SpecField[] = [
  // A. PRODUCT INFORMATION
  {
    id: 'category',
    group: 'product',
    label: '제품 카테고리',
    input: 'single',
    options: o('스킨케어', '선케어', '클렌징', '헤어', '바디', '메이크업'),
    required: true,
    demo: (c) => ({ value: [categoryOf(c)], reason: '입력한 아이디어 문장에서 찾은 제품 유형 기준입니다.' }),
  },
  {
    id: 'subtype',
    group: 'product',
    label: '세부 제품 유형',
    input: 'single',
    options: o('앰플/세럼', '에센스', '크림', '토너', '로션', '패드', '마스크팩', '선크림', '클렌저'),
    allowCustom: true,
    demo: (c) => ({ value: [subtypeOf(c) || '앰플/세럼'], reason: `${categoryOf(c)} 중 아이디어에 가장 가까운 유형입니다.` }),
  },
  {
    id: 'purpose',
    group: 'product',
    label: '개발 목적',
    input: 'single',
    options: o('신규 출시', '리뉴얼', '라인 확장'),
    demo: () => ({ value: ['신규 출시'], reason: '기존 제품 정보가 입력되지 않아 신규 출시로 가정했습니다.' }),
  },
  {
    id: 'benefits',
    group: 'product',
    label: '핵심 효능',
    hint: '복수 선택',
    input: 'multi',
    options: o('탄력', '주름', '미백', '진정', '보습', '장벽', '모공', '피지', '광채', '각질'),
    allowCustom: true,
    required: true,
    demo: (c) => ({ value: benefitsOf(c).filter((b) => b !== '안티에이징').slice(0, 3), reason: '아이디어 문장에 나온 효능 키워드 기준입니다.' }),
  },
  {
    id: 'differentiation',
    group: 'product',
    label: '제품 차별화 방향',
    hint: '복수 선택',
    input: 'multi',
    options: o('성분', '제형', '효능', '가격', '패키지', '브랜드 스토리'),
    demo: (c) => ({
      value: priceMid(c) < 22000 ? ['가격', '효능'] : ['성분', '제형'],
      reason: priceMid(c) < 22000 ? '가성비 가격대에서는 가격·체감 효능 차별화가 일반적이라는 가설입니다.' : '중가 이상 기능성 제품은 성분·제형 조합으로 차별화하는 경우가 많다는 가설입니다.',
    }),
  },
  {
    id: 'keywords',
    group: 'product',
    label: '원하는 제품 컨셉과 키워드',
    input: 'tags',
    placeholder: '예: 순한 레티날, 데일리 탄력 (Enter로 추가)',
    demo: (c) => ({ value: [c.intake.concept.value, sensitive(c) ? '저자극' : '고기능'].filter(Boolean), reason: '분석된 제품 컨셉 문장에서 뽑은 키워드입니다.' }),
  },

  // B. TARGET CONSUMER
  {
    id: 'ages',
    group: 'target',
    label: '타깃 연령대',
    hint: '복수 선택',
    input: 'multi',
    options: o('10대', '20대', '30대', '40대', '50대 이상'),
    demo: (c) => {
      const a = ageOf(c);
      const label = (n: number) => (n >= 50 ? '50대 이상' : `${n}대`);
      return { value: [label(a), label(Math.min(50, a + 10))].filter((v, i, s) => s.indexOf(v) === i), reason: `아이디어의 ${a}대 타깃과 인접 연령까지 포함한 가설입니다.` };
    },
  },
  {
    id: 'gender',
    group: 'target',
    label: '타깃 성별',
    input: 'single',
    options: o('여성', '남성', '성별 무관'),
    demo: (c) => ({ value: [/남성/.test(c.intake.target.value) ? '남성' : /여성/.test(c.intake.target.value) ? '여성' : '성별 무관'], reason: '분석된 타깃 문장 기준입니다.' }),
  },
  {
    id: 'skinTypes',
    group: 'target',
    label: '피부 타입',
    hint: '복수 선택',
    input: 'multi',
    options: o('건성', '지성', '복합성', '민감성', '모든 피부'),
    demo: (c) => ({
      value: has(c, '보습', '건조') ? ['건성', '복합성'] : has(c, '모공', '피지') ? ['지성', '복합성'] : sensitive(c) ? ['민감성'] : ['모든 피부'],
      reason: '선택한 핵심 효능과 자주 함께 나타나는 피부 타입이라는 가설입니다.',
    }),
  },
  {
    id: 'concerns',
    group: 'target',
    label: '주요 피부 고민',
    hint: '복수 선택',
    input: 'multi',
    options: o('탄력 저하', '잔주름', '건조함', '칙칙함', '붉은기·민감', '넓은 모공', '트러블', '피부결'),
    allowCustom: true,
    demo: (c) => {
      const out: string[] = [];
      if (has(c, '탄력')) out.push('탄력 저하');
      if (has(c, '주름')) out.push('잔주름');
      if (has(c, '보습', '수분')) out.push('건조함');
      if (has(c, '미백', '광채')) out.push('칙칙함');
      if (has(c, '진정', '민감')) out.push('붉은기·민감');
      if (has(c, '모공', '피지')) out.push('넓은 모공');
      return { value: out.length ? out : ['피부결'], reason: '핵심 효능에서 거꾸로 추정한 고민입니다.' };
    },
  },
  {
    id: 'usage',
    group: 'target',
    label: '주요 사용 상황',
    hint: '복수 선택',
    input: 'multi',
    options: o('아침', '저녁', '데일리', '집중 케어', '메이크업 전'),
    demo: (c) => ({
      value: withRetinoid(c) ? ['저녁', '집중 케어'] : ['데일리', '아침', '저녁'],
      reason: withRetinoid(c) ? '레티노이드 계열은 저녁 사용이 일반적이라는 가설입니다 (제조사 확인 필요).' : '앰플·세럼은 아침·저녁 데일리 사용이 일반적이라는 가설입니다.',
    }),
  },
  {
    id: 'priceSensitivity',
    group: 'target',
    label: '소비자 가격 민감도',
    input: 'slider',
    demo: (c) => {
      const m = priceMid(c);
      const v = m >= 45000 ? '낮음' : m >= 22000 ? '보통' : '높음';
      return { value: [v], reason: `목표 가격대(약 ${won(m)})를 고르는 소비자층 기준 가설입니다.` };
    },
  },

  // C. FORMULA & SENSORY
  {
    id: 'textureType',
    group: 'formula',
    label: '제형 유형 (희망 제형)',
    input: 'single',
    options: o('워터리', '밀키', '젤', '크림', '밤', '오일', '캡슐'),
    allowCustom: true,
    legacy: 'texture',
    demo: (c) => {
      if (has(c, '보습', '건조') && !has(c, '탄력')) return { value: ['크림'], reason: '건조 고민에는 보습막을 만드는 크림 제형이 후보라는 가설입니다.' };
      if (has(c, '모공', '피지', '진정')) return { value: ['젤'], reason: '지성·진정 니즈에는 산뜻한 젤 제형이 후보라는 가설입니다.' };
      return { value: ['밀키'], reason: `${ageOf(c)}대 ${benefitsOf(c)[0] ?? '기능성'} 케어 제품에서 보습감과 흡수감의 균형을 고려한 제형 후보입니다.` };
    },
  },
  {
    id: 'viscosity',
    group: 'formula',
    label: '점도',
    input: 'single',
    options: o('낮음', '중간', '높음'),
    demo: (c) => ({ value: [/크림|밤/.test(c.spec.textureType?.value[0] ?? '') ? '높음' : '중간'], reason: '선택한 제형 유형의 일반적인 점도 범위입니다.' }),
  },
  {
    id: 'absorption',
    group: 'formula',
    label: '흡수 속도',
    input: 'single',
    options: o('빠름', '보통', '느림'),
    demo: (c) => ({ value: [/크림|밤|오일/.test(c.spec.textureType?.value[0] ?? '') ? '보통' : '빠름'], reason: '앰플·세럼은 빠른 흡수감을 기대하는 경우가 많다는 가설입니다.' }),
  },
  {
    id: 'stickiness',
    group: 'formula',
    label: '끈적임 허용도',
    input: 'slider',
    demo: () => ({ value: ['거의 없어야 함'], reason: '경쟁제품 리뷰(데모)에서 끈적임이 주요 불만으로 나타난다는 가설입니다.' }),
  },
  {
    id: 'finish',
    group: 'formula',
    label: '마무리감',
    hint: '복수 선택',
    input: 'multi',
    options: o('산뜻', '촉촉', '보송', '윤광', '쫀쫀함'),
    demo: (c) => ({ value: has(c, '탄력') ? ['촉촉', '쫀쫀함'] : has(c, '모공', '피지') ? ['산뜻', '보송'] : ['촉촉'], reason: '핵심 효능을 체감하기 쉬운 마무리감 가설입니다.' }),
  },
  {
    id: 'scent',
    group: 'formula',
    label: '향',
    input: 'single',
    options: o('무향', '향료 사용', '천연 유래 향 선호'),
    demo: (c) => ({ value: [sensitive(c) || withRetinoid(c) ? '무향' : '천연 유래 향 선호'], reason: sensitive(c) || withRetinoid(c) ? '자극 우려가 있는 타깃·성분에서는 무향이 후보라는 가설입니다.' : '향 선호가 입력되지 않아 은은한 천연 유래 향을 후보로 두었습니다.' }),
  },
  {
    id: 'appearance',
    group: 'formula',
    label: '색상 및 외관 선호',
    input: 'single',
    options: o('투명', '반투명', '유백색', '펄감', '컬러'),
    allowCustom: true,
    demo: (c) => ({ value: [c.spec.textureType?.value[0] === '밀키' ? '유백색' : '투명'], reason: '선택한 제형에서 자연스럽게 나오는 외관입니다.' }),
  },

  // D. INGREDIENT STRATEGY
  {
    id: 'mustInclude',
    group: 'ingredients',
    label: '반드시 사용하고 싶은 원료',
    input: 'tags',
    placeholder: '예: PDRN, 레티날 (Enter로 추가)',
    demo: (c) => ({ value: has(c, '탄력', '주름') ? ['PDRN'] : has(c, '진정') ? ['Cica'] : ['Hyaluronic Acid'], reason: '효능 키워드와 트렌드 데이터(데모)에서 자주 함께 쓰이는 원료입니다. 원료사 확인 필요.' }),
  },
  {
    id: 'exclude',
    group: 'ingredients',
    label: '제외하고 싶은 원료',
    input: 'tags',
    placeholder: '예: 에탄올, 인공 향료 (Enter로 추가)',
    demo: (c) => ({ value: sensitive(c) || c.spec.lowIrritation?.value[0] === '예' ? ['에탄올', '인공 향료'] : ['인공 색소'], reason: '선택한 피부 타입·향 조건에서 흔히 제외 요청되는 원료입니다.' }),
  },
  {
    id: 'functional',
    group: 'ingredients',
    label: '희망 기능성',
    hint: '복수 선택 · 기능성 표시는 심사·보고가 필요할 수 있어요',
    input: 'multi',
    options: o('미백', '주름 개선', '자외선 차단', '여드름성 피부 완화', '탈모 증상 완화', '기능성 없음'),
    demo: (c) => {
      const out: string[] = [];
      if (has(c, '주름', '탄력')) out.push('주름 개선');
      if (has(c, '미백', '광채')) out.push('미백');
      if (categoryOf(c) === '선케어') out.push('자외선 차단');
      return { value: out.length ? out : ['기능성 없음'], reason: '핵심 효능을 광고하려면 필요한 기능성 후보입니다. 규제 검토 필요.' };
    },
  },
  {
    id: 'vegan',
    group: 'ingredients',
    label: '비건 지향 여부',
    input: 'single',
    options: o('예', '아니오', '상관없음'),
    demo: (c) => ({ value: ['상관없음'], reason: has(c, '탄력') ? 'PDRN 등 동물 유래 가능 원료를 쓸 수 있도록 열어 두었습니다.' : '비건 요구가 입력되지 않았습니다.' }),
  },
  {
    id: 'lowIrritation',
    group: 'ingredients',
    label: '저자극 지향 여부',
    input: 'single',
    options: o('예', '아니오', '상관없음'),
    demo: (c) => ({ value: [sensitive(c) || withRetinoid(c) ? '예' : '상관없음'], reason: sensitive(c) || withRetinoid(c) ? '민감 타깃 또는 레티노이드 사용 시 저자극 설계가 핵심이라는 가설입니다.' : '자극 관련 조건이 입력되지 않았습니다.' }),
  },
  {
    id: 'natural',
    group: 'ingredients',
    label: '천연 유래 원료 선호 여부',
    input: 'single',
    options: o('예', '아니오', '상관없음'),
    demo: () => ({ value: ['상관없음'], reason: '천연 유래 요구가 입력되지 않았습니다.' }),
  },
  {
    id: 'supplier',
    group: 'ingredients',
    label: '특정 특허 원료 또는 원료사 지정',
    input: 'text',
    placeholder: '예: ○○사 PDRN 원료 사용 희망',
    demo: () => ({ value: ['지정 없음 (제조사 제안 받기)'], reason: '원료사 정보는 확인된 데이터가 없어 지정하지 않았습니다.' }),
  },

  // E. COMMERCIAL & PACKAGING
  {
    id: 'targetPrice',
    group: 'commercial',
    label: '목표 판매가',
    input: 'text',
    placeholder: '예: 32,000원',
    legacy: 'targetPrice',
    demo: (c) => ({ value: [won(priceMid(c))], reason: '아이디어에 적은 가격대의 중앙값입니다.' }),
  },
  {
    id: 'targetCost',
    group: 'commercial',
    label: '목표 제조원가',
    input: 'text',
    placeholder: '예: 4,000원',
    legacy: 'targetCost',
    demo: (c) => ({ value: [won(priceMid(c) * 0.12)], reason: '판매가의 약 12%를 가정한 값입니다. 업계 평균 데이터가 아닌 데모 가정입니다.' }),
  },
  {
    id: 'size',
    group: 'commercial',
    label: '희망 용량',
    input: 'single',
    options: o('15ml', '30ml', '50ml', '100ml', '150ml'),
    allowCustom: true,
    legacy: 'size',
    demo: (c) => ({ value: [/크림/.test(subtypeOf(c)) ? '50ml' : /토너|클렌/.test(subtypeOf(c)) ? '150ml' : '30ml'], reason: `${subtypeOf(c) || '앰플/세럼'}에서 많이 쓰는 용량이라는 가설입니다.` }),
  },
  {
    id: 'firstRun',
    group: 'commercial',
    label: '초도 생산수량',
    input: 'single',
    options: o('3,000개', '5,000개', '10,000개'),
    allowCustom: true,
    legacy: 'firstRun',
    demo: () => ({ value: ['5,000개'], reason: '원가와 재고 부담의 균형을 고려한 데모 가정입니다.' }),
  },
  {
    id: 'launchTiming',
    group: 'commercial',
    label: '목표 출시 시기',
    input: 'single',
    options: o('3개월 내', '6개월 내', '9개월 내', '12개월 내'),
    allowCustom: true,
    demo: () => ({ value: ['6개월 내'], reason: '샘플·시험·생산을 고려한 일반적인 개발 기간 가정입니다 (Timeline 단계에서 확인).' }),
  },
  {
    id: 'container',
    group: 'commercial',
    label: '용기 형태',
    input: 'single',
    options: o('에어리스', '펌프', '스포이드', '튜브', '단지', '스프레이'),
    allowCustom: true,
    demo: (c) => ({ value: [withRetinoid(c) || has(c, '탄력') ? '에어리스' : /크림/.test(subtypeOf(c)) ? '단지' : '펌프'], reason: withRetinoid(c) || has(c, '탄력') ? '산화에 민감한 액티브 성분을 보호하기 좋은 용기 후보입니다.' : '선택한 제품 유형에서 많이 쓰는 용기입니다.' }),
  },
  {
    id: 'designDirection',
    group: 'commercial',
    label: '패키지 디자인 방향',
    input: 'single',
    options: o('미니멀', '더마', '럭셔리', '트렌디', '친환경'),
    demo: (c) => ({ value: [priceMid(c) >= 45000 ? '럭셔리' : has(c, '진정', '민감', '장벽') ? '더마' : '미니멀'], reason: '가격대와 효능 메시지에 어울리는 방향이라는 가설입니다.' }),
  },
  {
    id: 'benchmark',
    group: 'commercial',
    label: '벤치마킹 브랜드와 제품',
    input: 'text',
    placeholder: '예: ○○ PDRN 앰플',
    legacy: 'benchmark',
    demo: () => ({ value: ['경쟁제품 분석 단계에서 자동 선정'], reason: '경쟁제품 데이터(데모)에서 가격·효능이 비슷한 제품을 고릅니다.' }),
  },
  {
    id: 'channels',
    group: 'commercial',
    label: '주요 판매 채널',
    hint: '복수 선택',
    input: 'multi',
    options: o('자사몰', '올리브영', '쿠팡', '약국', '백화점', '면세점', '해외 플랫폼'),
    allowCustom: true,
    demo: (c) => ({ value: c.intake.channel.value.split(/\s*\/\s*/).filter(Boolean), reason: '아이디어 문장에서 찾은 채널입니다.' }),
  },

  // F. GLOBAL & REGULATORY
  {
    id: 'markets',
    group: 'global',
    label: '주요 판매 국가',
    hint: '복수 선택',
    input: 'markets',
    legacy: 'country',
    demo: (c) => ({ value: /해외|글로벌|수출|아마존|amazon/i.test(c.idea) ? ['KR', 'US'] : ['KR'], reason: '해외 판매 언급이 없으면 국내 우선 출시로 가정했습니다.' }),
  },
  {
    id: 'priorityMarket',
    group: 'global',
    label: '우선 출시 국가',
    input: 'single',
    options: MARKETS,
    demo: (c) => ({ value: [c.spec.markets?.value[0] ?? 'KR'], reason: '선택한 판매 국가 중 첫 번째 국가입니다.' }),
  },
  {
    id: 'overseasReview',
    group: 'global',
    label: '해외 규제 검토 필요 여부',
    hint: '중국·미국·EU 등',
    input: 'single',
    options: o('필요', '불필요', '모르겠음'),
    demo: (c) => {
      const abroad = (c.spec.markets?.value ?? []).some((m) => m !== 'KR');
      return { value: [abroad ? '필요' : '불필요'], reason: abroad ? '국내 외 판매 국가가 있어 국가별 규제 확인이 필요합니다.' : '국내 판매만 선택되었습니다.' };
    },
  },
  {
    id: 'certifications',
    group: 'global',
    label: '희망 인증',
    hint: '복수 선택',
    input: 'multi',
    options: o('비건', '할랄', '크루얼티 프리', '더마테스트', '인증 없음'),
    allowCustom: true,
    demo: (c) => ({ value: [c.spec.vegan?.value[0] === '예' ? '비건' : c.spec.lowIrritation?.value[0] === '예' ? '더마테스트' : '인증 없음'], reason: '앞에서 선택한 비건·저자극 조건에 맞춘 후보입니다. 인증 기관 확인 필요.' }),
  },
  {
    id: 'claimCopy',
    group: 'global',
    label: '마케팅 소구 문구',
    input: 'text',
    placeholder: '예: 순한 레티날로 매일 쓰는 탄력 케어',
    demo: (c) => ({ value: [`${(c.spec.keywords?.value[0] ?? c.intake.concept.value) || '데일리'} — ${benefitsOf(c).slice(0, 2).join('·') || '보습'} 케어`], reason: '컨셉 키워드로 만든 초안입니다. 표시·광고 규제 검토 필요.' }),
  },
  {
    id: 'adReview',
    group: 'global',
    label: '표시·광고 규제 검토 필요 여부',
    input: 'single',
    options: o('필요', '불필요', '모르겠음'),
    demo: () => ({ value: ['필요'], reason: '효능 문구는 표현에 따라 규제 대상이 될 수 있어 검토를 권장합니다.' }),
  },
];

export const fieldsOf = (g: SpecGroupId) => SPEC_FIELDS.filter((f) => f.group === g);
export const fieldById = (id: SpecFieldId) => SPEC_FIELDS.find((f) => f.id === id)!;
