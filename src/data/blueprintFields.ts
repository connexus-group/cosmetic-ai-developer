import type { SpecFieldId, SpecGroupId } from './types';

/**
 * Every item of the AI Product Blueprint (AI 제품 기획 초안).
 * The same list is sent to the server so the AI fills exactly these keys, and is used on the client
 * to map the confirmed values onto the existing project spec (so every later step keeps working).
 */
export interface BlueprintFieldDef {
  key: string;
  group: SpecGroupId;
  label: string;
  /** what a good answer looks like (also given to the AI) */
  guide: string;
  /** preferred choices; values outside the list are still allowed */
  options?: string[];
  /** comma separated list of values */
  multi?: boolean;
  /** the matching detailed-intake field, so later steps read the confirmed value */
  spec?: SpecFieldId;
  /** regulatory/verification items: never shown as confirmed */
  verify?: boolean;
}

export const BLUEPRINT_FIELDS: BlueprintFieldDef[] = [
  // A. PRODUCT INFORMATION
  { key: 'category', group: 'product', label: '제품 카테고리', guide: '대분류 하나', options: ['스킨케어', '선케어', '클렌징', '헤어', '바디', '메이크업'], spec: 'category' },
  { key: 'productType', group: 'product', label: '세부 제품 유형', guide: '세부 유형 하나', options: ['앰플/세럼', '에센스', '크림', '토너', '로션', '패드', '마스크팩', '선크림', '클렌저'], spec: 'subtype' },
  { key: 'purpose', group: 'product', label: '개발 목적', guide: '신규 출시/리뉴얼/라인 확장 중 하나', options: ['신규 출시', '리뉴얼', '라인 확장'], spec: 'purpose' },
  { key: 'benefits', group: 'product', label: '핵심 효능', guide: '핵심 효능 1~3개', options: ['탄력', '주름', '미백', '진정', '보습', '장벽', '모공', '피지', '광채', '각질'], multi: true, spec: 'benefits' },
  { key: 'concept', group: 'product', label: '제품 컨셉', guide: '한 문장 제품 컨셉' },
  { key: 'differentiation', group: 'product', label: '차별화 포인트', guide: '경쟁 제품 대비 차별화 포인트 1~2문장' },
  { key: 'usp', group: 'product', label: '제품 USP', guide: '소비자에게 전달할 단 하나의 핵심 가치' },
  { key: 'keywords', group: 'product', label: '핵심 마케팅 키워드', guide: '마케팅 키워드 3~5개', multi: true, spec: 'keywords' },

  // B. TARGET CONSUMER
  { key: 'ages', group: 'target', label: '타깃 연령', guide: '연령대', options: ['10대', '20대', '30대', '40대', '50대 이상'], multi: true, spec: 'ages' },
  { key: 'gender', group: 'target', label: '타깃 성별', guide: '하나', options: ['여성', '남성', '성별 무관'], spec: 'gender' },
  { key: 'skinTypes', group: 'target', label: '피부 타입', guide: '피부 타입', options: ['건성', '지성', '복합성', '민감성', '모든 피부'], multi: true, spec: 'skinTypes' },
  { key: 'concerns', group: 'target', label: '주요 피부 고민', guide: '피부 고민 1~3개', options: ['탄력 저하', '잔주름', '건조함', '칙칙함', '붉은기·민감', '넓은 모공', '트러블', '피부결'], multi: true, spec: 'concerns' },
  { key: 'usage', group: 'target', label: '사용 상황', guide: '사용 시점·상황', options: ['아침', '저녁', '데일리', '집중 케어', '메이크업 전'], multi: true, spec: 'usage' },
  { key: 'motivation', group: 'target', label: '구매 동기', guide: '타깃이 이 제품을 사는 이유 1문장' },
  { key: 'needs', group: 'target', label: '소비자 니즈', guide: '타깃의 핵심 니즈 1~2문장' },

  // C. FORMULA & SENSORY
  { key: 'textureType', group: 'formula', label: '제형 유형', guide: '제형 하나', options: ['워터리', '밀키', '젤', '크림', '밤', '오일', '캡슐'], spec: 'textureType' },
  { key: 'viscosity', group: 'formula', label: '점도', guide: '하나', options: ['낮음', '중간', '높음'], spec: 'viscosity' },
  { key: 'absorption', group: 'formula', label: '흡수 속도', guide: '하나', options: ['빠름', '보통', '느림'], spec: 'absorption' },
  { key: 'stickiness', group: 'formula', label: '끈적임', guide: '끈적임 허용 정도 하나', options: ['전혀 허용 안 함', '거의 없어야 함', '약간 허용', '어느 정도 허용', '상관없음'], spec: 'stickiness' },
  { key: 'finish', group: 'formula', label: '마무리감', guide: '마무리감 1~2개', options: ['산뜻', '촉촉', '보송', '윤광', '쫀쫀함'], multi: true, spec: 'finish' },
  { key: 'scent', group: 'formula', label: '향', guide: '하나', options: ['무향', '향료 사용', '천연 유래 향 선호'], spec: 'scent' },
  { key: 'appearance', group: 'formula', label: '제품 색상', guide: '외관·색상 하나', options: ['투명', '반투명', '유백색', '펄감', '컬러'], spec: 'appearance' },
  { key: 'sensory', group: 'formula', label: '사용감 특징', guide: '사용감 설명 1문장' },

  // D. INGREDIENT STRATEGY
  { key: 'hero', group: 'ingredients', label: 'Hero Ingredient 후보', guide: '대표 원료 후보 1~2개 (원료명)', multi: true },
  { key: 'actives', group: 'ingredients', label: 'Active Ingredient 후보', guide: '효능 원료 후보 2~4개', multi: true },
  { key: 'supporting', group: 'ingredients', label: 'Supporting Ingredient 후보', guide: '보조 원료 후보 2~4개', multi: true },
  { key: 'exclude', group: 'ingredients', label: '제외 권장 원료 후보', guide: '빼는 것을 권장하는 원료', multi: true, spec: 'exclude' },
  { key: 'functional', group: 'ingredients', label: '기능성 방향', guide: '식약처 기능성 방향', options: ['미백', '주름 개선', '자외선 차단', '여드름성 피부 완화', '탈모 증상 완화', '기능성 없음'], multi: true, spec: 'functional', verify: true },
  { key: 'lowIrritation', group: 'ingredients', label: '저자극 설계 방향', guide: '저자극 설계 방향 1문장' },
  { key: 'rationale', group: 'ingredients', label: '원료 선택 이유', guide: '원료를 고른 이유 1~2문장' },
  { key: 'compatibility', group: 'ingredients', label: '원료 및 제형 적합성 확인 사항', guide: '제조사·원료사와 확인할 사항', verify: true },

  // E. COMMERCIAL & PACKAGING
  { key: 'targetPrice', group: 'commercial', label: '목표 판매가', guide: '원 단위 금액 (예: 32,000원)', spec: 'targetPrice' },
  { key: 'targetCost', group: 'commercial', label: '목표 제조원가', guide: '원 단위 금액. 실제 견적이 아니므로 확인 필요', spec: 'targetCost', verify: true },
  { key: 'size', group: 'commercial', label: '권장 용량', guide: '하나', options: ['15ml', '30ml', '50ml', '100ml', '150ml'], spec: 'size' },
  { key: 'firstRun', group: 'commercial', label: '초도 생산수량', guide: '하나', options: ['3,000개', '5,000개', '10,000개'], spec: 'firstRun' },
  { key: 'container', group: 'commercial', label: '권장 패키지', guide: '용기 형태 하나', options: ['에어리스', '펌프', '스포이드', '튜브', '단지', '스프레이'], spec: 'container' },
  { key: 'material', group: 'commercial', label: '용기 재질', guide: '용기 재질 (예: PP, PETG, 유리)' },
  { key: 'channels', group: 'commercial', label: '유통채널', guide: '판매 채널', options: ['자사몰', '올리브영', '쿠팡', '약국', '백화점', '면세점', '해외 플랫폼'], multi: true, spec: 'channels' },
  { key: 'positioning', group: 'commercial', label: '브랜드 포지셔닝', guide: '가격대·이미지 포지셔닝 1문장' },
  { key: 'benchmark', group: 'commercial', label: '벤치마킹 제품 후보', guide: '참고할 제품 유형 (실제 제품명은 확인 필요)', spec: 'benchmark', verify: true },
  { key: 'launchTiming', group: 'commercial', label: '목표 출시 일정', guide: '하나', options: ['3개월 내', '6개월 내', '9개월 내', '12개월 내'], spec: 'launchTiming' },

  // F. GLOBAL & REGULATORY
  { key: 'markets', group: 'global', label: '주요 판매 국가', guide: '국가명', options: ['한국', '미국', '중국', '일본', '유럽연합', '영국', '동남아'], multi: true, spec: 'markets' },
  { key: 'priorityMarket', group: 'global', label: '우선 출시 국가', guide: '판매 국가 중 하나', spec: 'priorityMarket' },
  { key: 'countryIngredients', group: 'global', label: '국가별 원료 검토', guide: '국가별로 확인할 원료 항목. 적합 여부를 단정하지 말 것', verify: true },
  { key: 'functionalClass', group: 'global', label: '기능성 분류 검토', guide: '국가별 기능성/특수 화장품 분류 확인 사항', verify: true },
  { key: 'claims', group: 'global', label: '표시·광고 문구 검토', guide: '검토가 필요한 표시·광고 표현', verify: true },
  { key: 'procedures', group: 'global', label: '국가별 필수 절차 확인', guide: '국가별로 확인할 등록·신고 절차', verify: true },
  { key: 'tests', group: 'global', label: '권장 시험', guide: '권장 시험 (예: 피부 자극 시험, 안정성 시험)', multi: true, verify: true },
  { key: 'extraRegulatory', group: 'global', label: '추가 규제 확인 사항', guide: '그 밖에 확인할 규제 사항', verify: true },
];

export const blueprintField = (key: string) => BLUEPRINT_FIELDS.find((f) => f.key === key);

/** Changing a key condition marks these items "재검토 필요" (never overwritten automatically). */
export const BLUEPRINT_DEPENDENTS: Record<string, string[]> = {
  category: ['productType', 'textureType', 'container', 'size', 'tests'],
  productType: ['textureType', 'container', 'size'],
  benefits: ['concept', 'usp', 'keywords', 'hero', 'actives', 'functional'],
  ages: ['concept', 'usp', 'keywords', 'motivation', 'needs', 'sensory', 'finish'],
  gender: ['concept', 'keywords', 'motivation', 'needs'],
  skinTypes: ['concept', 'sensory', 'textureType', 'finish', 'lowIrritation', 'exclude'],
  concerns: ['concept', 'usp', 'needs', 'hero', 'actives'],
  textureType: ['container', 'material', 'sensory', 'viscosity', 'absorption', 'compatibility'],
  container: ['material', 'compatibility', 'targetCost'],
  hero: ['rationale', 'compatibility', 'countryIngredients', 'claims'],
  actives: ['rationale', 'compatibility', 'countryIngredients', 'functionalClass'],
  functional: ['functionalClass', 'claims', 'tests'],
  lowIrritation: ['exclude', 'scent', 'tests'],
  targetPrice: ['targetCost', 'positioning', 'benchmark'],
  targetCost: ['hero', 'actives', 'supporting', 'container', 'material'],
  markets: ['priorityMarket', 'countryIngredients', 'functionalClass', 'claims', 'procedures', 'tests', 'extraRegulatory', 'hero', 'actives', 'exclude'],
};

export const MARKET_NAMES: Record<string, string[]> = {
  KR: ['한국', '국내', 'korea'],
  US: ['미국', 'usa', 'us', '북미'],
  CN: ['중국', 'china'],
  JP: ['일본', 'japan'],
  EU: ['유럽연합', '유럽', 'eu'],
  UK: ['영국', 'uk'],
  SEA: ['동남아', '동남아시아', 'asean'],
};
