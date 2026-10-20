import type {
  ChecklistItem,
  ClarifyQuestion,
  Competitor,
  ConceptId,
  ConceptOption,
  ConsumerData,
  FormulaOption,
  GapPosition,
  IngredientInfo,
  IngredientTrend,
  MarketData,
  PackageOption,
  SourceRef,
  TestItem,
  TimelineTask,
} from './types';

/**
 * DEMO DATA — every brand, product and number in this file is fictional.
 * It describes one demo scenario (an anti-aging / firming ampoule for women in their 30s in Korea)
 * so the whole flow can be experienced end-to-end before real APIs are connected.
 */
export const DEMO_AS_OF = '2026-10-06';

export const DEMO_SOURCE: SourceRef = {
  sourceName: 'Demo dataset (fictional)',
  sourceUrl: null,
  sourceType: 'MOCK_DATASET',
  publishedDate: null,
  collectedDate: DEMO_AS_OF,
  lastUpdated: DEMO_AS_OF,
  confidenceScore: null,
  dataPeriod: { from: '2022-01-01', to: '2026-09-30' },
};

export const RULE_SOURCE: SourceRef = {
  sourceName: 'Demo rule engine',
  sourceUrl: null,
  sourceType: 'RULE_ENGINE',
  publishedDate: null,
  collectedDate: DEMO_AS_OF,
  lastUpdated: DEMO_AS_OF,
  confidenceScore: null,
};

// ── Intake follow-up questions ──────────────────────────────────────────────

export const CLARIFY_QUESTIONS: ClarifyQuestion[] = [
  { id: 'targetPrice', question: '목표 판매가는 얼마인가요?', placeholder: '예: 32,000원', aiRecommendation: '32,000원 (경쟁제품 중앙값 기준)' },
  { id: 'targetCost', question: '목표 원가가 있나요?', placeholder: '예: 4,000원 이하', aiRecommendation: '판매가의 12% 내외 (약 3,800원)' },
  { id: 'size', question: '원하는 용량이 있나요?', placeholder: '예: 30ml', aiRecommendation: '30ml (앰플 주력 용량)' },
  { id: 'texture', question: '원하는 제형이 있나요?', placeholder: '예: 가벼운 밀키 제형', aiRecommendation: '밀키 에센스 (끈적임 Pain 대응)' },
  { id: 'benchmark', question: '벤치마킹 제품이 있나요?', placeholder: '예: ○○ PDRN 앰플', aiRecommendation: '경쟁제품 분석 단계에서 자동 선정' },
  { id: 'country', question: '주요 판매 국가는 어디인가요?', placeholder: '예: 한국, 일본', aiRecommendation: '한국 우선 출시 후 일본 검토' },
  { id: 'firstRun', question: '예상 초도 생산수량은 얼마인가요?', placeholder: '예: 5,000개', aiRecommendation: '5,000개 (원가와 재고 리스크 균형)' },
];

// ── Market ──────────────────────────────────────────────────────────────────

export const MARKET: MarketData = {
  title: '국내 안티에이징 앰플·세럼 시장',
  unit: '억원',
  attractiveness: {
    score: 82,
    label: 'HIGH POTENTIAL',
    factors: [
      { label: '시장 규모', score: 88 },
      { label: '성장성', score: 85 },
      { label: '타깃 적합도', score: 90 },
      { label: '경쟁 강도 (낮을수록 높음)', score: 58 },
    ],
  },
  series: [
    { year: '2022', value: 6200, estimate: false },
    { year: '2023', value: 6800, estimate: false },
    { year: '2024', value: 7500, estimate: false },
    { year: '2025', value: 8300, estimate: false },
    { year: '2026E', value: 9100, estimate: true },
  ],
  kpis: [
    { id: 'size', label: 'Market Size', value: '9,100억원', sub: '2026E 시장 규모', kind: 'AI_ESTIMATE' },
    { id: 'growth', label: 'Growth Rate', value: '+9.6%', sub: '2026E 전년 대비', kind: 'AI_ESTIMATE' },
    { id: 'cagr', label: 'CAGR', value: '10.1%', sub: '2022 → 2026E', kind: 'AI_ESTIMATE' },
    { id: 'competition', label: 'Competition', value: 'HIGH', sub: '최근 1년 신제품 140여 개', kind: 'AI_ANALYSIS', level: 'HIGH' },
    { id: 'opportunity', label: 'Opportunity', value: 'MEDIUM–HIGH', sub: '저자극·복합 효능 영역', kind: 'AI_ANALYSIS', level: 'MEDIUM' },
  ],
  channels: [
    { name: '올리브영', share: 34 },
    { name: '쿠팡', share: 22 },
    { name: '해외 역직구', share: 14 },
    { name: '자사몰', share: 13 },
    { name: '백화점·면세', share: 11 },
    { name: '기타', share: 6 },
  ],
  priceBands: [
    { band: '~1만원', share: 8 },
    { band: '1~2만원', share: 24 },
    { band: '2~3만원', share: 31 },
    { band: '3~4만원', share: 21 },
    { band: '4~5만원', share: 9 },
    { band: '5만원~', share: 7 },
  ],
  ageGroups: [
    { group: '20대', share: 21 },
    { group: '30대', share: 38 },
    { group: '40대', share: 27 },
    { group: '50대+', share: 14 },
  ],
  source: DEMO_SOURCE,
  insight: {
    finding: '해당 카테고리는 최근 4년간 연평균 약 10%씩 지속적으로 성장하고 있습니다.',
    why: '안티에이징 수요가 기존 40대 이상에서 20~30대로 확대되고 있습니다. 30대 구매 비중(38%)이 가장 높습니다.',
    opportunity: '"Early Anti-aging" 포지션의 성장 가능성이 있습니다. 올리브영과 자사몰 두 채널만으로 시장의 약 47%에 접근할 수 있습니다.',
    risk: 'PDRN 기반 제품 출시가 늘면서 경쟁이 빠르게 높아지고 있습니다 (최근 1년 신제품 140여 개).',
    recommendation: '단순 PDRN 제품보다는 추가적인 차별화 성분 또는 제형 전략이 필요합니다.',
  },
};

// ── Competitors ─────────────────────────────────────────────────────────────

export const COMPETITORS: Competitor[] = [
  { id: 'c1', brand: 'Lumière Lab', product: 'PDRN 100 Firming Ampoule', price: 34000, sizeMl: 30, hero: 'PDRN', claims: ['탄력', '재생감', '광채'], rating: 4.7, reviews: 18420, channels: ['올리브영', '자사몰'], texture: '젤 앰플', premiumScore: 72, positiveKeywords: ['탄력', '광채', '흡수'], negativeKeywords: ['끈적임', '가격'] },
  { id: 'c2', brand: 'Dermaholic', product: 'Salmon DNA Booster Serum', price: 28000, sizeMl: 50, hero: 'PDRN', claims: ['보습', '탄력'], rating: 4.5, reviews: 26310, channels: ['올리브영', '쿠팡'], texture: '워터리 세럼', premiumScore: 48, positiveKeywords: ['촉촉함', '가성비'], negativeKeywords: ['효과 미미', '향'] },
  { id: 'c3', brand: 'Vera Clinic', product: 'Collagen Lifting Ampoule', price: 39000, sizeMl: 30, hero: 'Collagen', claims: ['탄력', '주름'], rating: 4.4, reviews: 9870, channels: ['백화점', '자사몰'], texture: '크리미 앰플', premiumScore: 80, positiveKeywords: ['탄력', '고급스러움'], negativeKeywords: ['무거움', '밀림'] },
  { id: 'c4', brand: 'Purecell', product: 'Retinal 0.1 Night Serum', price: 32000, sizeMl: 30, hero: 'Retinal', claims: ['주름', '피부결'], rating: 4.3, reviews: 7240, channels: ['올리브영', '쿠팡'], texture: '오일 세럼', premiumScore: 76, positiveKeywords: ['피부결', '효과 빠름'], negativeKeywords: ['자극', '각질'] },
  { id: 'c5', brand: 'Hanul Derm', product: 'Peptide Bounce Serum', price: 26000, sizeMl: 50, hero: 'Peptide', claims: ['탄력', '보습'], rating: 4.6, reviews: 14560, channels: ['쿠팡', '자사몰'], texture: '젤 세럼', premiumScore: 55, positiveKeywords: ['순함', '흡수'], negativeKeywords: ['효과 약함'] },
  { id: 'c6', brand: 'Oddly Skin', product: 'Ceramide Barrier Ampoule', price: 24000, sizeMl: 40, hero: 'Ceramide', claims: ['장벽', '진정', '보습'], rating: 4.6, reviews: 21080, channels: ['올리브영'], texture: '밀키 앰플', premiumScore: 42, positiveKeywords: ['저자극', '촉촉함'], negativeKeywords: ['탄력 효과 약함'] },
  { id: 'c7', brand: 'Atelier B', product: 'NAD+ Longevity Essence', price: 48000, sizeMl: 30, hero: 'NAD+', claims: ['안티에이징', '광채'], rating: 4.2, reviews: 1830, channels: ['자사몰', '백화점'], texture: '에센스', premiumScore: 90, positiveKeywords: ['광채', '새로운 성분'], negativeKeywords: ['가격', '체감 느림'] },
  { id: 'c8', brand: 'Clean Theory', product: 'Bakuchiol Firming Serum', price: 29000, sizeMl: 30, hero: 'Bakuchiol', claims: ['탄력', '저자극'], rating: 4.4, reviews: 5620, channels: ['올리브영', '자사몰'], texture: '세럼', premiumScore: 60, positiveKeywords: ['순함', '비건'], negativeKeywords: ['효과 체감 느림'] },
];

export const COMPETITOR_INSIGHT = {
  finding: '탄력 앰플 경쟁제품 8개 중 5개가 PDRN·콜라겐·펩타이드 단일 히어로 성분이며, ml당 가격은 520~1,600원에 분포합니다.',
  why: '같은 성분과 같은 효능 문구가 반복되어 소비자 입장에서는 제품 간 차이를 느끼기 어렵습니다.',
  opportunity: '리뷰가 많은 상위 제품들의 부정 키워드가 "끈적임·무거움·자극"에 몰려 있어, 사용감과 저자극을 개선한 제품이 들어갈 자리가 있습니다.',
  risk: 'Retinal 제품은 효과 만족도가 높지만 자극 리뷰가 많아, 같은 성분을 쓸 경우 저자극 설계가 반드시 필요합니다.',
  recommendation: '가격은 30ml 3만원 초반(ml당 약 1,070원)으로 PDRN 상위 제품과 비슷하게 두고, 저자극 레티날 조합으로 차별화하세요.',
};

// ── Consumer ────────────────────────────────────────────────────────────────

const months = ['25.10', '25.11', '25.12', '26.01', '26.02', '26.03', '26.04', '26.05', '26.06', '26.07', '26.08', '26.09'];
const wave = (base: number, slope: number, season = 0) => months.map((_, i) => Math.round(base * (1 + slope * i) * (1 + season * Math.sin(((i + 7) / 12) * Math.PI * 2))));

export const CONSUMER: ConsumerData = {
  months,
  positives: [
    { term: '빠른 흡수', mentions: 4820, change: 18, monthly: wave(330, 0.025) },
    { term: '촉촉함', mentions: 6210, change: 6, monthly: wave(490, 0.008, 0.12) },
    { term: '탄력', mentions: 5340, change: 22, monthly: wave(360, 0.03) },
    { term: '광채', mentions: 3180, change: 15, monthly: wave(220, 0.022) },
    { term: '저자극', mentions: 3960, change: 31, monthly: wave(240, 0.04) },
  ],
  pains: [
    { term: '끈적임', mentions: 2870, change: 26, monthly: wave(190, 0.02, 0.35) },
    { term: '밀림', mentions: 1640, change: 12, monthly: wave(120, 0.015) },
    { term: '자극', mentions: 2210, change: 19, monthly: wave(150, 0.025) },
    { term: '향', mentions: 980, change: -8, monthly: wave(90, -0.008) },
    { term: '무거운 사용감', mentions: 1920, change: 14, monthly: wave(130, 0.015, 0.25) },
  ],
  skinTypes: ['건성', '지성', '복합성', '민감성'],
  // rows = skin types, cols = pains (same order as `pains`)
  heatmap: [
    [12, 18, 14, 8, 10],
    [41, 22, 9, 7, 33],
    [32, 25, 12, 9, 24],
    [14, 10, 48, 21, 12],
  ],
  sampleSize: 12000,
  insight: {
    finding: '긍정 키워드 중 "저자극"(+31%)과 "탄력"(+22%), 불만 키워드 중 "끈적임"(+26%)이 가장 빠르게 늘고 있습니다.',
    why: '30대 소비자는 효능과 함께 "매일 아침에도 바를 수 있는 가벼운 사용감"을 중요하게 보기 시작했습니다.',
    opportunity: '지성·복합성 피부의 끈적임 불만, 민감성 피부의 자극 불만이 뚜렷해 "가볍고 순한 고효능"이 비어 있는 니즈입니다.',
    risk: '"끈적임"은 여름철에 크게 늘어나는 계절성이 있어, 출시 시점에 따라 리뷰 반응이 달라질 수 있습니다.',
    recommendation: '흡수가 빠른 밀키 또는 젤 제형에 저자극 테스트를 더해 "가볍고 순한 탄력 앰플"로 메시지를 잡으세요.',
  },
};

// ── Trend radar ─────────────────────────────────────────────────────────────

export const TRENDS: IngredientTrend[] = [
  { id: 'pdrn', name: 'PDRN', group: 'Regeneration', stage: 'MAINSTREAM', trendScore: 84, searchGrowth: 38, competition: 'VERY_HIGH', competitionScore: 92, launchGrowth: 64, marketingPotential: 'MEDIUM', snsMentions: 48200, note: '검색과 출시가 모두 많은 대표 성분. 단독 사용 시 차별화가 어렵습니다.' },
  { id: 'retinal', name: 'Retinal', group: 'Retinoid', stage: 'GROWING', trendScore: 78, searchGrowth: 72, competition: 'MEDIUM', competitionScore: 54, launchGrowth: 58, marketingPotential: 'HIGH', snsMentions: 21400, note: '레티놀보다 빠른 효과로 주목받고 있지만 자극 이슈가 있어 저자극 설계가 핵심입니다.' },
  { id: 'ectoin', name: 'Ectoin', group: 'Barrier', stage: 'GROWING', trendScore: 69, searchGrowth: 55, competition: 'LOW', competitionScore: 34, launchGrowth: 41, marketingPotential: 'MEDIUM', snsMentions: 9600, note: '진정·장벽 보조 성분으로 레티날·각질 케어 제품과 조합이 늘고 있습니다.' },
  { id: 'peptide', name: 'Peptide', group: 'Regeneration', stage: 'MAINSTREAM', trendScore: 74, searchGrowth: 21, competition: 'HIGH', competitionScore: 78, launchGrowth: 26, marketingPotential: 'MEDIUM', snsMentions: 31800, note: '탄력 제품의 기본 조합. 보조 성분으로 쓰기 좋습니다.' },
  { id: 'ceramide', name: 'Ceramide', group: 'Barrier', stage: 'SATURATED', trendScore: 58, searchGrowth: 4, competition: 'VERY_HIGH', competitionScore: 88, launchGrowth: 6, marketingPotential: 'LOW', snsMentions: 39500, note: '익숙한 장벽 성분. 히어로보다는 서포팅 성분으로 적합합니다.' },
  { id: 'bakuchiol', name: 'Bakuchiol', group: 'Retinoid', stage: 'SATURATED', trendScore: 49, searchGrowth: -6, competition: 'MEDIUM', competitionScore: 50, launchGrowth: -3, marketingPotential: 'LOW', snsMentions: 7200, note: '"식물성 레티놀" 메시지의 관심이 줄어드는 중입니다.' },
  { id: 'spicule', name: 'Spicule', group: 'Regeneration', stage: 'GROWING', trendScore: 71, searchGrowth: 64, competition: 'MEDIUM', competitionScore: 58, launchGrowth: 52, marketingPotential: 'HIGH', snsMentions: 16300, note: '즉각적인 체감으로 SNS 반응이 좋지만 자극 리뷰 관리가 필요합니다.' },
  { id: 'nad', name: 'NAD+', group: 'Longevity', stage: 'EMERGING', trendScore: 63, searchGrowth: 118, competition: 'LOW', competitionScore: 18, launchGrowth: 95, marketingPotential: 'HIGH', snsMentions: 3400, note: '"롱제비티(Longevity)" 컨셉으로 해외에서 먼저 떠오르는 신흥 성분. 원료 정보 확인이 더 필요합니다.' },
];

export const TREND_INSIGHT = {
  finding: 'Retinal·Spicule은 성장 단계, NAD+는 신흥 단계이며 PDRN·Peptide는 이미 주류, Ceramide·Bakuchiol은 포화 단계입니다.',
  why: '주류·포화 성분은 소비자에게 익숙해 신뢰는 높지만, 신제품의 "새로움"을 만들기 어렵습니다.',
  opportunity: '주류 성분(PDRN)의 신뢰도에 성장 성분(Retinal)을 더하면 익숙함과 새로움을 동시에 줄 수 있습니다.',
  risk: 'NAD+는 검색 성장은 크지만 국내 수요와 원료 정보가 아직 충분하지 않습니다.',
  recommendation: 'PDRN을 히어로로 유지하되 Retinal을 액티브로 결합하고, Ectoin으로 자극을 보완하는 조합을 추천합니다.',
};

// ── Opportunity / market gap ────────────────────────────────────────────────

const oppScore = (d: number, g: number, c: number) => Math.round(d * 0.4 + g * 0.3 + (100 - c) * 0.3);

const GAP_RAW: Omit<GapPosition, 'opportunityScore'>[] = [
  { id: 'pdrn-collagen', name: 'PDRN + Collagen', demand: 88, competition: 94, growth: 30, demandLevel: 'HIGH', competitionLevel: 'VERY_HIGH', opportunityLevel: 'LOW', why: '수요는 가장 크지만 비슷한 제품이 이미 너무 많습니다.' },
  { id: 'pdrn-retinal', name: 'PDRN + Retinal', demand: 82, competition: 52, growth: 72, demandLevel: 'HIGH', competitionLevel: 'MEDIUM', opportunityLevel: 'HIGH', recommended: true, why: '익숙한 PDRN에 성장 성분 Retinal을 더해, 수요는 크고 경쟁은 중간 수준입니다.' },
  { id: 'barrier-antiaging', name: 'Barrier + Anti-aging', demand: 64, competition: 28, growth: 48, demandLevel: 'MEDIUM', competitionLevel: 'LOW', opportunityLevel: 'HIGH', why: '민감 피부의 자극 불만을 해결하는 영역으로 경쟁이 낮습니다.' },
  { id: 'gentle-retinoid', name: 'Low-irritation Retinoid', demand: 72, competition: 46, growth: 58, demandLevel: 'HIGH', competitionLevel: 'MEDIUM', opportunityLevel: 'HIGH', why: '"순한 레티날" 검색이 늘고 있지만 확실한 대표 제품이 없습니다.' },
  { id: 'peptide-firming', name: 'Peptide Firming', demand: 70, competition: 78, growth: 24, demandLevel: 'MEDIUM', competitionLevel: 'HIGH', opportunityLevel: 'LOW', why: '안정적이지만 이미 많은 브랜드가 같은 메시지를 씁니다.' },
  { id: 'nad-longevity', name: 'NAD+ Longevity', demand: 46, competition: 16, growth: 96, demandLevel: 'LOW', competitionLevel: 'LOW', opportunityLevel: 'MEDIUM', why: '성장은 가장 빠르지만 아직 국내 수요가 작습니다.' },
];

export const GAP: GapPosition[] = GAP_RAW.map((g) => ({ ...g, opportunityScore: oppScore(g.demand, g.growth, g.competition) }));
export const OPP_FORMULA = 'Opportunity Score = Demand × 0.4 + Growth × 0.3 + (100 − Competition) × 0.3';

export const GAP_INSIGHT = {
  finding: '"PDRN + Retinal"과 "Barrier + Anti-aging"은 수요 대비 경쟁이 낮은 영역이고, "PDRN + Collagen"은 경쟁이 가장 치열합니다.',
  why: '같은 수요라도 경쟁이 낮은 곳에 출시해야 광고비를 덜 쓰고도 눈에 띌 수 있습니다.',
  opportunity: 'PDRN + Retinal은 수요(82)가 높으면서 경쟁(52)은 중간이라 신규 브랜드가 진입하기 가장 좋은 위치입니다.',
  risk: 'Retinal은 자극·광 안정성 이슈가 있어 제형·용기·시험 설계가 함께 따라와야 합니다.',
  recommendation: '"저자극 PDRN + Retinal 탄력 앰플"을 1순위 출시 영역으로, Barrier + Anti-aging을 메시지 보완 요소로 활용하세요.',
};

// ── Concepts ────────────────────────────────────────────────────────────────

export const CONCEPTS: ConceptOption[] = [
  {
    id: 'A',
    type: 'MARKET SAFE',
    name: 'PDRN Firming Ampoule',
    nameKo: 'PDRN 탄력 앰플',
    oneLiner: '검증된 PDRN으로 매일 쓰는 가벼운 탄력 앰플',
    target: '30~39세 여성, 첫 안티에이징 앰플 사용자',
    hero: 'PDRN',
    actives: ['Peptide', 'Adenosine'],
    texture: '젤 앰플',
    claims: ['탄력', '보습', '광채'],
    retailPrice: 29000,
    sizeMl: 30,
    estimatedCost: 3400,
    scores: { marketability: 86, differentiation: 48, trend: 62, costEfficiency: 84, difficulty: 30 },
    differentiation: '가벼운 젤 제형과 합리적 가격. 성분 차별화는 약함',
    marketPotential: 'HIGH',
    competition: 'VERY_HIGH',
    reason: '가장 빨리, 가장 낮은 리스크로 출시할 수 있지만 경쟁제품과 비슷해 보일 수 있습니다.',
  },
  {
    id: 'B',
    type: 'DIFFERENTIATED',
    name: 'PDRN + Retinal Firming Ampoule',
    nameKo: 'PDRN 레티날 탄력 앰플',
    oneLiner: '저자극 레티날과 PDRN을 결합한 순한 고효능 탄력 앰플',
    target: '30~39세 여성, 효과는 원하지만 자극이 걱정되는 소비자',
    hero: 'PDRN',
    actives: ['Retinal', 'Peptide', 'Adenosine'],
    texture: '밀키 에센스 세럼',
    claims: ['탄력', '주름 개선', '피부 장벽'],
    retailPrice: 32000,
    sizeMl: 30,
    estimatedCost: 3800,
    scores: { marketability: 80, differentiation: 84, trend: 78, costEfficiency: 72, difficulty: 58 },
    differentiation: '"순한 레티날 + PDRN" 조합. 경쟁제품 대비 자극과 끈적임 Pain을 동시에 해결',
    marketPotential: 'HIGH',
    competition: 'MEDIUM',
    recommended: true,
    reason: '수요가 크고 경쟁이 중간인 영역에서, 소비자 불만(자극·끈적임)을 직접 해결해 가장 균형이 좋습니다.',
  },
  {
    id: 'C',
    type: 'TREND LEADER',
    name: 'NAD+ Peptide Longevity Serum',
    nameKo: 'NAD+ 펩타이드 롱제비티 세럼',
    oneLiner: '새로운 롱제비티 성분 NAD+로 안티에이징을 선점하는 프리미엄 세럼',
    target: '35~45세 여성, 새로운 성분에 관심이 많은 얼리어답터',
    hero: 'NAD+',
    actives: ['Peptide', 'Niacinamide'],
    texture: '캡슐 세럼',
    claims: ['안티에이징', '광채', '탄력'],
    retailPrice: 45000,
    sizeMl: 30,
    estimatedCost: 5600,
    scores: { marketability: 58, differentiation: 92, trend: 94, costEfficiency: 50, difficulty: 82 },
    differentiation: '국내에서 드문 NAD+ 컨셉. 선점 효과가 크지만 시장 교육이 필요',
    marketPotential: 'MEDIUM',
    competition: 'LOW',
    reason: '트렌드 선점 효과는 가장 크지만, 원료 정보 확인과 시장 교육 비용이 큽니다.',
  },
];

// ── Formula ─────────────────────────────────────────────────────────────────

export const FORMULAS: FormulaOption[] = [
  { id: 'milky', name: 'Milky Essence Serum', nameKo: '밀키 에센스 세럼', description: '가벼운 유화 제형. 레티날 같은 지용성 성분을 안정적으로 담기 좋고, 바른 뒤 촉촉하지만 끈적이지 않습니다.', viscosity: '중저점도 (약 3,000~6,000 cps, 예상값)', absorption: 82, moisture: 78, stickiness: 22, finish: 70, residue: 28, difficulty: 55, costPerUnit: 2100, trendScore: 76, skinTypes: '모든 피부, 특히 복합성·민감성' },
  { id: 'gel', name: 'Gel Network Ampoule', nameKo: '젤 네트워크 앰플', description: '수분 젤 구조의 산뜻한 앰플. 흡수가 빠르고 여름에도 부담이 적지만 지용성 성분 배합에는 제약이 있습니다.', viscosity: '중점도 (약 8,000~15,000 cps, 예상값)', absorption: 88, moisture: 66, stickiness: 34, finish: 62, residue: 24, difficulty: 35, costPerUnit: 1850, trendScore: 64, skinTypes: '지성·복합성' },
  { id: 'capsule', name: 'Capsule Serum', nameKo: '캡슐 세럼', description: '눈에 보이는 캡슐에 활성 성분을 담은 세럼. 시각적 차별화가 크지만 제조 난이도와 원가가 높습니다.', viscosity: '중점도 + 캡슐 (예상값)', absorption: 70, moisture: 74, stickiness: 30, finish: 80, residue: 36, difficulty: 82, costPerUnit: 2650, trendScore: 72, skinTypes: '건성·중성' },
];

export const FORMULA_RECOMMEND: Record<ConceptId, FormulaOption['id']> = { A: 'gel', B: 'milky', C: 'capsule' };

// ── Ingredients ─────────────────────────────────────────────────────────────

const ING: Record<string, Omit<IngredientInfo, 'tier'>> = {
  pdrn: { id: 'pdrn', name: 'PDRN', inci: 'Sodium DNA', role: '피부 컨디션 개선·탄력 케어 컨셉의 대표 성분', recommendedRange: null, trend: 'MAINSTREAM', marketingPotential: 'MEDIUM', evidence: null, formulationNotes: '수용성 원료. 원료 등급(유래, 분자량)에 따라 가격과 함량 기준이 크게 달라 원료사 규격서 확인이 필요합니다.', caution: '"재생" 등 의약품 오인 표현과 함께 쓰지 않도록 주의', supplier: null, price: null, moq: null },
  retinal: { id: 'retinal', name: 'Retinal', inci: 'Retinal', role: '주름·피부결 개선 컨셉의 액티브 성분', recommendedRange: null, trend: 'GROWING', marketingPotential: 'HIGH', evidence: null, formulationNotes: '빛·산소에 약해 차광·에어리스 용기와 안정도 시험이 중요합니다. 유화 제형에 안정화 기술과 함께 배합하는 것을 검토하세요.', caution: '자극 가능성. 사용 주의 문구, 야간 사용 권장, 함량은 제조사·원료사 확인 필요', supplier: null, price: null, moq: null },
  peptide: { id: 'peptide', name: 'Peptide', inci: null, role: '탄력 케어 보조 액티브 (펩타이드 종류 선택 필요)', recommendedRange: null, trend: 'MAINSTREAM', marketingPotential: 'MEDIUM', evidence: null, formulationNotes: '펩타이드 종류(예: 팔미토일 계열)에 따라 INCI와 함량이 달라 원료 선정 후 확정합니다.', caution: '원료별 규격 확인 필요', supplier: null, price: null, moq: null },
  adenosine: { id: 'adenosine', name: 'Adenosine', inci: 'Adenosine', role: '주름개선 기능성 고시 성분', recommendedRange: '0.04% (주름개선 기능성 고시 기준, 규제 검토 필요)', trend: 'MAINSTREAM', marketingPotential: 'MEDIUM', evidence: '식약처 주름개선 기능성 고시 원료 (함량·심사 절차는 규제 검토 필요)', formulationNotes: '수용성. 기능성 표시를 하려면 고시 함량과 심사·보고 절차를 따라야 합니다.', caution: '기능성 심사·보고 없이 "주름 개선" 표시 불가', supplier: null, price: null, moq: null },
  ectoin: { id: 'ectoin', name: 'Ectoin', inci: 'Ectoin', role: '진정·장벽 보조, 레티날 자극 완화 컨셉', recommendedRange: null, trend: 'GROWING', marketingPotential: 'MEDIUM', evidence: null, formulationNotes: '수용성. 안정적인 편이며 다른 액티브와 조합하기 쉽습니다.', caution: '함량은 원료사 확인 필요', supplier: null, price: null, moq: null },
  panthenol: { id: 'panthenol', name: 'Panthenol', inci: 'Panthenol', role: '보습·진정 서포팅 성분', recommendedRange: null, trend: 'SATURATED', marketingPotential: 'LOW', evidence: null, formulationNotes: '수용성. 범용 원료로 배합 난이도가 낮습니다.', caution: '특이사항 없음 (제조사 확인)', supplier: null, price: null, moq: null },
  ceramide: { id: 'ceramide', name: 'Ceramide NP', inci: 'Ceramide NP', role: '피부 장벽 서포팅 성분', recommendedRange: null, trend: 'SATURATED', marketingPotential: 'LOW', evidence: null, formulationNotes: '지용성. 유화 제형에 넣기 좋고 젤 제형에는 가용화가 필요합니다.', caution: '원료 등급별 차이 확인 필요', supplier: null, price: null, moq: null },
  nad: { id: 'nad', name: 'NAD+', inci: null, role: '롱제비티 컨셉 히어로 성분', recommendedRange: null, trend: 'EMERGING', marketingPotential: 'HIGH', evidence: null, formulationNotes: '화장품 원료로서의 INCI 등재, 안정성, 공급 가능 여부를 원료사에 먼저 확인해야 합니다.', caution: '원료 사용 가능 여부·규제 검토 필요', supplier: null, price: null, moq: null },
  niacinamide: { id: 'niacinamide', name: 'Niacinamide', inci: 'Niacinamide', role: '광채·피부톤 케어 액티브', recommendedRange: '2% (미백 기능성 고시 기준, 규제 검토 필요)', trend: 'SATURATED', marketingPotential: 'MEDIUM', evidence: '식약처 미백 기능성 고시 원료 (함량·심사 절차는 규제 검토 필요)', formulationNotes: '수용성, 안정적. 고함량 시 일부 소비자 자극 리뷰가 있어 함량 설계에 주의합니다.', caution: '미백 기능성 표시 시 심사·보고 필요', supplier: null, price: null, moq: null },
  collagen: { id: 'collagen', name: 'Hydrolyzed Collagen', inci: 'Hydrolyzed Collagen', role: '보습·탄력 컨셉 서포팅', recommendedRange: null, trend: 'SATURATED', marketingPotential: 'LOW', evidence: null, formulationNotes: '수용성. 유래(어류 등)에 따라 비건 표시 여부가 달라집니다.', caution: '유래 원료 표시 확인', supplier: null, price: null, moq: null },
  glycerin: { id: 'glycerin', name: 'Glycerin', inci: 'Glycerin', role: '보습 베이스', recommendedRange: null, trend: null, marketingPotential: null, evidence: null, formulationNotes: '범용 보습제. 함량이 높으면 끈적임이 생길 수 있어 사용감 목표에 맞춰 조정합니다.', caution: '특이사항 없음', supplier: null, price: null, moq: null },
  bg: { id: 'bg', name: 'Butylene Glycol', inci: 'Butylene Glycol', role: '보습·용매 베이스', recommendedRange: null, trend: null, marketingPotential: null, evidence: null, formulationNotes: '범용 원료.', caution: '특이사항 없음', supplier: null, price: null, moq: null },
  hexanediol: { id: 'hexanediol', name: '1,2-Hexanediol', inci: '1,2-Hexanediol', role: '보존 보조 베이스', recommendedRange: null, trend: null, marketingPotential: null, evidence: null, formulationNotes: '방부 시스템은 방부력 시험 결과로 확정합니다.', caution: '방부력 시험 필요', supplier: null, price: null, moq: null },
  squalane: { id: 'squalane', name: 'Squalane', inci: 'Squalane', role: '유화 제형 오일 베이스', recommendedRange: null, trend: null, marketingPotential: null, evidence: null, formulationNotes: '가벼운 오일. 밀키 제형의 촉촉한 마무리감에 기여합니다.', caution: '특이사항 없음', supplier: null, price: null, moq: null },
};

const tierOf = (tier: IngredientInfo['tier'], ids: string[]): IngredientInfo[] => ids.map((id) => ({ ...ING[id], tier }));

export function ingredientsFor(concept: ConceptId): IngredientInfo[] {
  if (concept === 'A') return [...tierOf('HERO', ['pdrn']), ...tierOf('ACTIVE', ['peptide', 'adenosine']), ...tierOf('SUPPORTING', ['collagen', 'panthenol', 'ceramide']), ...tierOf('BASE', ['glycerin', 'bg', 'hexanediol'])];
  if (concept === 'C') return [...tierOf('HERO', ['nad']), ...tierOf('ACTIVE', ['peptide', 'niacinamide', 'adenosine']), ...tierOf('SUPPORTING', ['ectoin', 'ceramide']), ...tierOf('BASE', ['glycerin', 'squalane', 'hexanediol'])];
  return [...tierOf('HERO', ['pdrn']), ...tierOf('ACTIVE', ['retinal', 'peptide', 'adenosine']), ...tierOf('SUPPORTING', ['ectoin', 'panthenol', 'ceramide']), ...tierOf('BASE', ['glycerin', 'squalane', 'hexanediol'])];
}

// ── Packaging ───────────────────────────────────────────────────────────────

export const PACKAGES: PackageOption[] = [
  { id: 'airless', name: 'Airless Pump', nameKo: '에어리스 펌프', material: 'PP 이중 구조 (불투명)', description: '내용물이 공기에 닿지 않아 산화·광 민감 성분을 보호합니다. 끝까지 남김없이 쓸 수 있습니다.', compatibility: 92, protection: 95, premiumFeel: 80, sustainability: 48, unitCost: 850, pumpCost: 0, moq: 10000, lightBlocking: true, airless: true },
  { id: 'dropper', name: 'Dropper', nameKo: '스포이드 유리병', material: '차광 유리 + 고무 스포이드', description: '앰플다운 고급스러움을 주지만 열 때마다 공기와 접촉해 민감 성분 보호는 약합니다.', compatibility: 64, protection: 52, premiumFeel: 88, sustainability: 72, unitCost: 620, pumpCost: 180, moq: 5000, lightBlocking: true, airless: false },
  { id: 'pump', name: 'Pump Bottle', nameKo: '펌프 보틀', material: 'PET 보틀 + 일반 펌프', description: '가장 경제적이고 사용이 편하지만 공기 유입이 있어 산화 민감 성분에는 적합하지 않습니다.', compatibility: 58, protection: 46, premiumFeel: 56, sustainability: 66, unitCost: 420, pumpCost: 220, moq: 3000, lightBlocking: false, airless: false },
];

// ── Cost defaults (KRW per unit at MOQ 5,000) ───────────────────────────────

export const COST_LABELS = {
  content: '내용물',
  container: '용기',
  pump: '펌프·스포이드',
  carton: '단상자',
  label: '라벨',
  filling: '충진',
  packing: '포장',
  testing: '시험 (단위당 분할)',
  logistics: '물류',
} as const;

export const COST_BASE = { carton: 250, label: 60, filling: 180, packing: 120, testing: 150, logistics: 90 };

/** unit cost multipliers by MOQ (demo assumption) */
export const MOQ_FACTOR = {
  3000: { content: 1.12, packaging: 1.25, process: 1.3 },
  5000: { content: 1, packaging: 1, process: 1 },
  10000: { content: 0.92, packaging: 0.86, process: 0.8 },
} as const;

// ── Testing ─────────────────────────────────────────────────────────────────

export const TESTS: TestItem[] = [
  { id: 'stability', group: 'REQUIRED', name: 'Stability', nameKo: '안정도 시험', purpose: '온도·빛 조건에서 제형·색·향·pH 변화 확인', necessity: '모든 제품 필수. Retinal 배합 시 특히 중요', weeks: '4~12주', stage: '2차 샘플 이후', note: '가속 조건 결과로 사용기한 설정' },
  { id: 'microbial', group: 'REQUIRED', name: 'Microbial', nameKo: '미생물 시험', purpose: '완제품 미생물 한도 확인', necessity: '출고 전 필수', weeks: '1~2주', stage: '생산 후 QC', note: '로트별 진행' },
  { id: 'preservative', group: 'REQUIRED', name: 'Preservative Challenge', nameKo: '방부력 시험', purpose: '사용 중 오염에 대한 방부 시스템 효과 확인', necessity: '방부 시스템 확정에 필수', weeks: '4주', stage: '2차 샘플', note: '저자극 방부 시스템일수록 중요' },
  { id: 'compat', group: 'REQUIRED', name: 'Packaging Compatibility', nameKo: '용기 적합성 시험', purpose: '내용물과 용기의 반응·누액·토출 확인', necessity: '용기 확정 전 필수', weeks: '4~8주', stage: '용기 확정 전', note: '에어리스 토출량 확인 포함' },
  { id: 'irritation', group: 'RECOMMENDED', name: 'Skin Irritation', nameKo: '피부 자극 시험', purpose: '인체 첩포로 자극 여부 확인', necessity: 'Retinal 배합·"저자극" 표현 사용 시 강력 권장', weeks: '2~3주', stage: '최종 샘플', note: '"저자극" 문구의 근거 자료' },
  { id: 'sensitive', group: 'RECOMMENDED', name: 'Sensitive Skin', nameKo: '민감 피부 사용 시험', purpose: '민감 피부 대상 사용감·자극 확인', necessity: '민감성 타깃 메시지 사용 시 권장', weeks: '3~4주', stage: '최종 샘플', note: '' },
  { id: 'moisture', group: 'MARKETING', name: 'Moisture', nameKo: '보습 효능 시험', purpose: '피부 수분량 변화 측정', necessity: '"보습" 수치 광고 시 필요', weeks: '2~4주', stage: '최종 샘플', note: '' },
  { id: 'elasticity', group: 'MARKETING', name: 'Elasticity', nameKo: '탄력 효능 시험', purpose: '피부 탄력 변화 측정', necessity: '"탄력" 수치 광고 시 필요', weeks: '4~8주', stage: '최종 샘플', note: '핵심 메시지 근거' },
  { id: 'wrinkle', group: 'MARKETING', name: 'Wrinkle', nameKo: '주름 개선 인체적용 시험', purpose: '주름 개선 효과 측정', necessity: '주름 기능성 근거 자료로 검토', weeks: '8~12주', stage: '기능성 심사 전', note: '기능성 심사 방식은 규제 검토 필요' },
  { id: 'glow', group: 'MARKETING', name: 'Glow', nameKo: '광채 개선 시험', purpose: '피부 광채 변화 측정', necessity: '"광채" 수치 광고 시', weeks: '2~4주', stage: '최종 샘플', note: '' },
  { id: 'barrier', group: 'MARKETING', name: 'Skin Barrier', nameKo: '피부 장벽 시험', purpose: '경피수분손실(TEWL) 변화 측정', necessity: '"장벽" 메시지 사용 시', weeks: '4주', stage: '최종 샘플', note: '' },
];

export const DEFAULT_TESTS: Record<string, boolean> = { stability: true, microbial: true, preservative: true, compat: true, irritation: true, elasticity: true, wrinkle: true };

// ── Timeline ────────────────────────────────────────────────────────────────

export const TIMELINE_BASE: TimelineTask[] = [
  { id: 'planning', name: 'Planning', nameKo: '제품 기획', start: 1, end: 2, phase: 'plan' },
  { id: 'maker', name: 'Manufacturer Selection', nameKo: '제조사 선정', start: 2, end: 3, phase: 'plan' },
  { id: 'sample1', name: 'Sample 1', nameKo: '1차 샘플', start: 3, end: 5, phase: 'develop' },
  { id: 'sample2', name: 'Sample 2', nameKo: '2차 샘플', start: 5, end: 7, phase: 'develop' },
  { id: 'packaging', name: 'Packaging', nameKo: '패키지 개발', start: 4, end: 8, phase: 'develop' },
  { id: 'testing', name: 'Testing', nameKo: '시험', start: 7, end: 11, phase: 'verify' },
  { id: 'design', name: 'Design', nameKo: '디자인', start: 8, end: 12, phase: 'develop' },
  { id: 'order', name: 'Order', nameKo: '발주', start: 12, end: 12, phase: 'launch' },
  { id: 'production', name: 'Production', nameKo: '생산', start: 13, end: 16, phase: 'launch' },
  { id: 'qc', name: 'QC', nameKo: '품질검사', start: 17, end: 17, phase: 'verify' },
  { id: 'launch', name: 'Launch', nameKo: '입고·출시', start: 18, end: 18, phase: 'launch' },
];

// ── Checklist ───────────────────────────────────────────────────────────────

export const CHECKLIST: ChecklistItem[] = [
  { id: 'concept', label: '제품 컨셉 확정', group: '기획' },
  { id: 'country', label: '판매국가 결정', group: '기획' },
  { id: 'price', label: '목표 판매가 결정', group: '기획' },
  { id: 'cost', label: '목표 원가 결정', group: '기획' },
  { id: 'maker', label: '제조사 선정', group: '개발' },
  { id: 'nda', label: 'NDA 체결', group: '개발' },
  { id: 'sample', label: '샘플 의뢰', group: '개발' },
  { id: 'formula', label: '제형 확정', group: '개발' },
  { id: 'scent', label: '향 확정', group: '개발' },
  { id: 'ingredient', label: '원료 확정', group: '개발' },
  { id: 'functional', label: '기능성 검토', group: '검증' },
  { id: 'container', label: '용기 확정', group: '개발' },
  { id: 'compat', label: '용기 적합성 확인', group: '검증' },
  { id: 'design', label: '디자인', group: '생산·출시' },
  { id: 'label', label: '표시사항 검토', group: '검증' },
  { id: 'clinical', label: '임상(효능) 시험', group: '검증' },
  { id: 'order', label: '발주', group: '생산·출시' },
  { id: 'production', label: '생산', group: '생산·출시' },
  { id: 'qc', label: '품질검사', group: '생산·출시' },
  { id: 'arrival', label: '입고', group: '생산·출시' },
];

export const OTHER_TRENDS: { kind: 'Texture' | 'Claim' | 'Consumer'; title: string; items: { name: string; stage: 'EMERGING' | 'GROWING' | 'MAINSTREAM' | 'SATURATED'; change: number }[] }[] = [
  { kind: 'Texture', title: 'Texture Trend', items: [{ name: '밀키 에센스', stage: 'GROWING', change: 34 }, { name: '젤 앰플', stage: 'MAINSTREAM', change: 8 }, { name: '캡슐 세럼', stage: 'EMERGING', change: 52 }, { name: '오일 세럼', stage: 'SATURATED', change: -4 }] },
  { kind: 'Claim', title: 'Claim Trend', items: [{ name: '저자극 고효능', stage: 'GROWING', change: 41 }, { name: '피부 장벽 + 안티에이징', stage: 'GROWING', change: 29 }, { name: '즉각 탄력', stage: 'MAINSTREAM', change: 6 }, { name: '롱제비티', stage: 'EMERGING', change: 88 }] },
  { kind: 'Consumer', title: 'Consumer Trend', items: [{ name: '아침에도 쓰는 레티날', stage: 'EMERGING', change: 63 }, { name: '스킨케어 단계 줄이기', stage: 'MAINSTREAM', change: 12 }, { name: '성분 함량 확인', stage: 'GROWING', change: 27 }, { name: '더마 브랜드 선호', stage: 'MAINSTREAM', change: 9 }] },
];
