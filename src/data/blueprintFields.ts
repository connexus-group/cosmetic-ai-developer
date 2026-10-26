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
  /** shown together with the other items of the same cell (one row on screen) */
  cell?: string;
}

export const BLUEPRINT_FIELDS: BlueprintFieldDef[] = [
  // A. PRODUCT INFORMATION
  { key: 'productType', group: 'product', label: '제품 카테고리 · 유형', guide: '"카테고리 > 세부 유형" 형식 하나 (예: 스킨케어 > 앰플/세럼)', options: ['스킨케어 > 앰플/세럼', '스킨케어 > 에센스', '스킨케어 > 크림', '스킨케어 > 토너', '스킨케어 > 로션', '스킨케어 > 패드', '스킨케어 > 마스크팩', '선케어 > 선크림', '클렌징 > 클렌저'], spec: 'subtype' },
  { key: 'benefits', group: 'product', label: '핵심 효능', guide: '핵심 효능 1~3개', options: ['탄력', '주름', '미백', '진정', '보습', '장벽', '모공', '피지', '광채', '각질'], multi: true, spec: 'benefits' },
  { key: 'concept', group: 'product', label: '제품 컨셉', guide: '한 문장 제품 컨셉' },
  { key: 'differentiation', group: 'product', label: '차별화 포인트 · USP', guide: '경쟁 제품 대비 차별점과 소비자에게 전달할 핵심 가치를 한 문장으로' },
  { key: 'keywords', group: 'product', label: '핵심 마케팅 키워드', guide: '마케팅 키워드 3~5개', multi: true, spec: 'keywords' },
  // product conditions, shown together in one cell
  { key: 'targetPrice', group: 'product', cell: 'conditions', label: '목표 판매가', guide: '원 단위 금액 (예: 32,000원)', spec: 'targetPrice' },
  { key: 'targetCost', group: 'product', cell: 'conditions', label: '희망 제조원가', guide: '원 단위 금액. 실제 견적이 아니므로 확인 필요', spec: 'targetCost', verify: true },
  { key: 'size', group: 'product', cell: 'conditions', label: '용량', guide: '하나', options: ['15ml', '30ml', '50ml', '100ml', '150ml'], spec: 'size' },
  { key: 'firstRun', group: 'product', cell: 'conditions', label: 'MOQ', guide: '희망 최소 생산 수량 하나. 실제 MOQ는 제조사 확인 필요', options: ['3,000개', '5,000개', '10,000개'], spec: 'firstRun', verify: true },
  { key: 'container', group: 'product', cell: 'conditions', label: '추천 패키지', guide: '용기 형태 하나', options: ['에어리스', '펌프', '스포이드', '튜브', '단지', '스프레이'], spec: 'container' },
  { key: 'material', group: 'product', cell: 'conditions', label: '용기 재질', guide: '용기 재질 (예: PP, PETG, 유리)' },
  { key: 'benchmark', group: 'product', cell: 'conditions', label: '벤치마킹 제품 후보', guide: '참고할 제품 유형 (실제 제품명은 확인 필요)', spec: 'benchmark', verify: true },
  { key: 'launchTiming', group: 'product', cell: 'conditions', label: '목표 출시 일정', guide: '하나', options: ['3개월 내', '6개월 내', '9개월 내', '12개월 내'], spec: 'launchTiming' },

  // B. TARGET CONSUMER
  { key: 'ages', group: 'target', label: '타깃 연령', guide: '연령대', options: ['10대', '20대', '30대', '40대', '50대 이상'], multi: true, spec: 'ages' },
  { key: 'gender', group: 'target', label: '타깃 성별', guide: '하나', options: ['여성', '남성', '성별 무관'], spec: 'gender' },
  { key: 'skinTypes', group: 'target', label: '피부 타입', guide: '피부 타입', options: ['건성', '지성', '복합성', '민감성', '모든 피부'], multi: true, spec: 'skinTypes' },
  { key: 'concerns', group: 'target', label: '주요 피부 고민', guide: '피부 고민 1~3개', options: ['탄력 저하', '잔주름', '건조함', '칙칙함', '붉은기·민감', '넓은 모공', '트러블', '피부결'], multi: true, spec: 'concerns' },
  { key: 'needs', group: 'target', label: '소비자 니즈', guide: '타깃의 핵심 니즈 1문장' },

  // C. FORMULA & SENSORY
  { key: 'textureType', group: 'formula', label: '제형 유형', guide: '제형 하나', options: ['워터리', '밀키', '젤', '크림', '밤', '오일', '캡슐'], spec: 'textureType' },
  { key: 'absorption', group: 'formula', label: '흡수 속도', guide: '하나', options: ['빠름', '보통', '느림'], spec: 'absorption' },
  { key: 'stickiness', group: 'formula', label: '끈적임', guide: '끈적임 허용 정도 하나', options: ['전혀 허용 안 함', '거의 없어야 함', '약간 허용', '어느 정도 허용', '상관없음'], spec: 'stickiness' },
  { key: 'finish', group: 'formula', label: '마무리감', guide: '마무리감 1~2개', options: ['산뜻', '촉촉', '보송', '윤광', '쫀쫀함'], multi: true, spec: 'finish' },
  { key: 'scent', group: 'formula', label: '향', guide: '하나', options: ['무향', '향료 사용', '천연 유래 향 선호'], spec: 'scent' },
  { key: 'appearance', group: 'formula', label: '제품 색상', guide: '외관·색상 하나', options: ['투명', '반투명', '유백색', '펄감', '컬러'], spec: 'appearance' },
  { key: 'sensory', group: 'formula', label: '사용감 특징', guide: '사용감 설명 1문장' },
  { key: 'targetProduct', group: 'formula', label: '타깃 제품', guide: '제형·사용감을 비슷하게 가고 싶은 제품명. 사용자가 아이디어에 적은 경우만 그대로 옮기고, 없으면 "미정"으로 둠 (실제 제품명을 지어내지 말 것)' },

  // D. INGREDIENT STRATEGY
  { key: 'hero', group: 'ingredients', label: 'Main Ingredient 후보', guide: '메인 원료 후보 1~3개 (원료명)', multi: true },
  { key: 'supporting', group: 'ingredients', label: 'Supporting Ingredient 후보', guide: '보조 원료 후보 2~4개', multi: true },
  { key: 'exclude', group: 'ingredients', label: '제외 권장 원료 후보', guide: '빼는 것을 권장하는 원료', multi: true, spec: 'exclude' },
  { key: 'functional', group: 'ingredients', label: '기능성 방향', guide: '식약처 기능성 방향', options: ['미백', '주름 개선', '자외선 차단', '여드름성 피부 완화', '탈모 증상 완화', '기능성 없음'], multi: true, spec: 'functional', verify: true },
  { key: 'lowIrritation', group: 'ingredients', label: '저자극 설계 방향', guide: '저자극 설계 방향 1문장' },
  { key: 'markets', group: 'ingredients', label: '수출 희망 국가', guide: '국가명', options: ['한국', '미국', '중국', '일본', '유럽연합', '영국', '동남아'], multi: true, spec: 'markets' },
  { key: 'exportSafe', group: 'ingredients', label: '수출 국가 기준 원료 구성', guide: '수출 희망 국가 모두에서 사용할 수 있는 원료로만 구성하는 조건. 국가별로 확인할 원료 항목을 적고, 적합 여부를 단정하지 말 것', verify: true },

  // E. MARKETING & DISTRIBUTION
  { key: 'channels', group: 'commercial', label: '유통채널', guide: '판매 채널', options: ['자사몰', '올리브영', '쿠팡', '약국', '백화점', '면세점', '해외 플랫폼'], multi: true, spec: 'channels' },
  { key: 'positioning', group: 'commercial', label: '브랜드 포지셔닝', guide: '가격대·이미지 포지셔닝 1문장' },
  { key: 'marketingChannels', group: 'commercial', label: '마케팅 채널', guide: '홍보 채널 2~4개', options: ['인스타그램', '유튜브', '틱톡', '인플루언서 시딩', '체험단', '검색 광고', '오프라인 팝업'], multi: true },
  { key: 'launchPromotion', group: 'commercial', label: '런칭 프로모션', guide: '출시 초기 판매 전략 1문장' },
];

/** Section headings of the blueprint screen (the "global" section was removed on 2026-10-20). */
export const BLUEPRINT_GROUPS: { id: SpecGroupId; no: number; label: string; en: string }[] = [
  { id: 'product', no: 1, label: 'Product', en: 'Product Information' },
  { id: 'target', no: 2, label: 'Target', en: 'Target Consumer' },
  { id: 'formula', no: 3, label: 'Formula', en: 'Formula & Sensory' },
  { id: 'ingredients', no: 4, label: 'Ingredients', en: 'Ingredient Strategy' },
  { id: 'commercial', no: 5, label: 'Commercial', en: 'Marketing & Distribution' },
];
/** Label of the one cell that holds the product conditions */
export const CELL_LABELS: Record<string, string> = { conditions: '제품 조건 · 사업 조건' };

export const blueprintField = (key: string) => BLUEPRINT_FIELDS.find((f) => f.key === key);

/** Changing a key condition marks these items "재검토 필요" (never overwritten automatically). */
export const BLUEPRINT_DEPENDENTS: Record<string, string[]> = {
  productType: ['textureType', 'container', 'size'],
  benefits: ['concept', 'differentiation', 'keywords', 'hero', 'functional'],
  ages: ['concept', 'differentiation', 'keywords', 'needs', 'sensory', 'finish'],
  gender: ['concept', 'keywords', 'needs'],
  skinTypes: ['concept', 'sensory', 'textureType', 'finish', 'lowIrritation', 'exclude'],
  concerns: ['concept', 'differentiation', 'needs', 'hero'],
  textureType: ['container', 'material', 'sensory', 'absorption'],
  container: ['material', 'targetCost'],
  hero: ['exportSafe'],
  functional: ['exportSafe'],
  lowIrritation: ['exclude', 'scent'],
  targetPrice: ['targetCost', 'positioning', 'benchmark'],
  targetCost: ['hero', 'supporting', 'container', 'material'],
  markets: ['exportSafe', 'hero', 'supporting', 'exclude', 'channels'],
  channels: ['marketingChannels', 'launchPromotion'],
  positioning: ['marketingChannels', 'launchPromotion'],
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
