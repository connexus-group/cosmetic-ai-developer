/**
 * Domain model for the AI Product Developer.
 *
 * Every number shown in the UI is wrapped with its data kind and source so the
 * mock data source can be replaced by real APIs without touching pages
 * (see `src/data/source.ts`).
 */

/** Data trust classes. The UI shows each as a badge so estimates never look like facts. */
export type DataKind = 'VERIFIED' | 'EXTERNAL' | 'AI_ANALYSIS' | 'AI_ESTIMATE' | 'USER_INPUT' | 'DEMO' | 'DEMO_RECOMMEND';

export interface SourceRef {
  sourceName: string;
  sourceUrl: string | null;
  sourceType: 'MOCK_DATASET' | 'RULE_ENGINE' | 'USER_INPUT' | 'OFFICIAL_API' | 'REPORT' | 'PUBLIC_DATA';
  publishedDate: string | null;
  collectedDate: string | null;
  lastUpdated: string | null;
  /** 0–1. null = unknown */
  confidenceScore: number | null;
  dataPeriod?: { from: string; to: string };
}

export type Level = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type TrendStage = 'EMERGING' | 'GROWING' | 'MAINSTREAM' | 'SATURATED';

// ── Project & intake ────────────────────────────────────────────────────────

export interface IntakeField {
  value: string;
  kind: DataKind; // AI_ANALYSIS when parsed, USER_INPUT when edited, AI_ESTIMATE when recommended
}

export interface Intake {
  category: IntakeField;
  target: IntakeField;
  benefit: IntakeField;
  price: IntakeField;
  channel: IntakeField;
  position: IntakeField;
  concept: IntakeField;
}
export type IntakeKey = keyof Intake;

export interface ClarifyQuestion {
  id: 'targetPrice' | 'targetCost' | 'size' | 'texture' | 'benchmark' | 'country' | 'firstRun';
  question: string;
  placeholder: string;
  aiRecommendation: string;
}

export type ClarifyAnswer = { mode: 'user' | 'unknown' | 'ai'; value: string };

// ── Detailed intake (6-step wizard) ─────────────────────────────────────────

export type SpecGroupId = 'product' | 'target' | 'formula' | 'ingredients' | 'commercial' | 'global';

export type SpecFieldId =
  // A. Product
  | 'category' | 'subtype' | 'purpose' | 'benefits' | 'differentiation' | 'keywords'
  // B. Target
  | 'ages' | 'gender' | 'skinTypes' | 'concerns' | 'usage' | 'priceSensitivity'
  // C. Formula & sensory
  | 'textureType' | 'viscosity' | 'absorption' | 'stickiness' | 'finish' | 'scent' | 'appearance'
  // D. Ingredients
  | 'mustInclude' | 'exclude' | 'functional' | 'vegan' | 'lowIrritation' | 'natural' | 'supplier'
  // E. Commercial & packaging
  | 'targetPrice' | 'targetCost' | 'size' | 'firstRun' | 'launchTiming' | 'container' | 'designDirection' | 'benchmark' | 'channels'
  // F. Global & regulatory
  | 'markets' | 'priorityMarket' | 'overseasReview' | 'certifications' | 'claimCopy' | 'adReview';

/**
 * One answer in the detailed intake.
 * - user: typed or picked by the user
 * - idea: extracted from the free-text idea by the demo analyzer
 * - ai: demo recommendation (rule-based, no AI API) — always shown as "데모 추천", a hypothesis
 * - unknown: the user said "잘 모르겠어요"; later steps treat it as 미정
 * Values are always a list so single and multi selects share one shape.
 */
export interface SpecAnswer {
  mode: 'user' | 'idea' | 'ai' | 'unknown';
  value: string[];
  /** why the demo recommendation was made */
  reason?: string;
}
export type Spec = Partial<Record<SpecFieldId, SpecAnswer>>;

export const STEP_IDS = [
  'overview',
  'market',
  'competitors',
  'consumer',
  'trend',
  'opportunity',
  'concept',
  'formula',
  'ingredients',
  'packaging',
  'cost',
  'regulation',
  'testing',
  'timeline',
  'brief',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export type ConceptId = 'A' | 'B' | 'C';
export type FormulaId = 'milky' | 'gel' | 'capsule';
export type PackageId = 'airless' | 'dropper' | 'pump';
export type Moq = 3000 | 5000 | 10000;

export type CostKey = 'container' | 'carton' | 'sealLabel' | 'innerBox' | 'outerBox' | 'content' | 'processing';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  idea: string;
  intake: Intake;
  answers: Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>>;
  /** detailed intake from the 6-step wizard (Product Blueprint) */
  spec: Spec;
  /** AI Product Blueprint confirmed with "이 기획안으로 제품 개발 시작" (absent on older projects) */
  blueprint?: Blueprint;
  /** when each step was last opened (ISO) */
  visited: Partial<Record<StepId, string>>;
  /** when each upstream decision last changed (ISO) — drives "재검토 필요" */
  changed: Partial<Record<'intake' | 'concept' | 'formula' | 'package', string>>;
  conceptId?: ConceptId;
  formulaId?: FormulaId;
  packageId?: PackageId;
  moq: Moq;
  retailPrice: number;
  channelFeeRate: number;
  /** user-edited unit costs (KRW, at MOQ 5,000) */
  costOverrides: Partial<Record<CostKey, number>>;
  tests: Record<string, boolean>;
  checklist: Record<string, boolean>;
  claimCopy: string;
  /** last real-data query (Naver DataLab) the user ran on Market / Consumer / Trend */
  marketQuery?: { category: string; categoryCode: string; keywords: string[]; months: number };
  /** competitor product page URLs the user asked to collect with Firecrawl (Competitors screen) */
  competitorUrls?: string[];
  /** user edits on the brief */
  brief: Record<string, string>;
  /** AI Packaging & Design Studio (Packaging screen, added 2026-10-21; absent on older projects) */
  packagingStudio?: PackagingStudio;
}

// ── Analysis payloads ───────────────────────────────────────────────────────

export interface Insight {
  finding: string;
  why: string;
  opportunity: string;
  risk: string;
  recommendation: string;
}

export interface MarketData {
  title: string;
  unit: string;
  /** Overall market attractiveness on a 0-100 scale, with the factors behind it. */
  attractiveness: { score: number; label: string; factors: { label: string; score: number }[] };
  series: { year: string; value: number; estimate: boolean }[];
  kpis: { id: string; label: string; value: string; sub: string; kind: DataKind; level?: Level }[];
  channels: { name: string; share: number }[];
  priceBands: { band: string; share: number }[];
  ageGroups: { group: string; share: number }[];
  source: SourceRef;
  insight: Insight;
}

export interface Competitor {
  id: string;
  brand: string;
  product: string;
  price: number;
  sizeMl: number;
  hero: string;
  claims: string[];
  rating: number;
  reviews: number;
  channels: string[];
  texture: string;
  /** 0–100: mass/basic → premium/high-functionality (AI estimate) */
  premiumScore: number;
  positiveKeywords: string[];
  negativeKeywords: string[];
}

export interface KeywordStat {
  term: string;
  mentions: number;
  change: number; // % vs previous 6 months
  monthly: number[]; // 12 months
}

export interface ConsumerData {
  months: string[];
  positives: KeywordStat[];
  pains: KeywordStat[];
  skinTypes: string[];
  /** skin type × pain share of mentions, % */
  heatmap: number[][];
  sampleSize: number;
  insight: Insight;
}

export interface IngredientTrend {
  id: string;
  name: string;
  group: 'Regeneration' | 'Retinoid' | 'Barrier' | 'Longevity';
  stage: TrendStage;
  trendScore: number;
  searchGrowth: number;
  competition: Level;
  competitionScore: number;
  launchGrowth: number;
  marketingPotential: Level;
  snsMentions: number;
  note: string;
}

export interface GapPosition {
  id: string;
  name: string;
  demand: number;
  competition: number;
  growth: number;
  demandLevel: Level;
  competitionLevel: Level;
  opportunityLevel: Level;
  opportunityScore: number;
  recommended?: boolean;
  why: string;
}

export interface ConceptOption {
  id: ConceptId;
  type: 'MARKET SAFE' | 'DIFFERENTIATED' | 'TREND LEADER';
  name: string;
  nameKo: string;
  oneLiner: string;
  target: string;
  hero: string;
  actives: string[];
  texture: string;
  claims: string[];
  retailPrice: number;
  sizeMl: number;
  estimatedCost: number;
  scores: { marketability: number; differentiation: number; trend: number; costEfficiency: number; difficulty: number };
  differentiation: string;
  marketPotential: Level;
  competition: Level;
  recommended?: boolean;
  reason: string;
}

export interface FormulaOption {
  id: FormulaId;
  name: string;
  nameKo: string;
  description: string;
  viscosity: string;
  absorption: number;
  moisture: number;
  stickiness: number; // higher = stickier (worse)
  finish: number; // glow / finish score
  residue: number;
  difficulty: number;
  costPerUnit: number; // 30ml content, KRW
  trendScore: number;
  skinTypes: string;
}

export type IngredientTier = 'HERO' | 'ACTIVE' | 'SUPPORTING' | 'BASE';

export interface IngredientInfo {
  id: string;
  name: string;
  inci: string | null;
  tier: IngredientTier;
  role: string;
  recommendedRange: string | null;
  trend: TrendStage | null;
  marketingPotential: Level | null;
  evidence: string | null;
  formulationNotes: string;
  caution: string;
  supplier: null;
  price: null;
  moq: null;
}

export interface PackageOption {
  id: PackageId;
  name: string;
  nameKo: string;
  material: string;
  description: string;
  compatibility: number;
  protection: number;
  premiumFeel: number;
  sustainability: number;
  unitCost: number;
  pumpCost: number;
  moq: number;
  lightBlocking: boolean;
  airless: boolean;
}

export interface RegulationItem {
  id: string;
  area: 'Functional Cosmetic' | 'Claims Risk' | 'Ingredient Review' | 'Label Review' | 'Export';
  title: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  detail: string;
  action: string;
}

export interface ClaimRiskHit {
  phrase: string;
  risk: 'MEDIUM' | 'HIGH';
  reason: string;
  alternative: string;
}

export interface TestItem {
  id: string;
  group: 'REQUIRED' | 'RECOMMENDED' | 'MARKETING';
  name: string;
  nameKo: string;
  purpose: string;
  necessity: string;
  weeks: string;
  stage: string;
  note: string;
}

export interface TimelineTask {
  id: string;
  name: string;
  nameKo: string;
  start: number; // week, 1-based
  end: number; // inclusive
  phase: 'plan' | 'develop' | 'verify' | 'launch';
}

export interface ChecklistItem {
  id: string;
  label: string;
  group: '기획' | '개발' | '검증' | '생산·출시';
}

// ── AI Product Blueprint (AI 제품 기획 초안) ────────────────────────────────

/** USER_PROVIDED: stated by the user · AI_SUGGESTED: filled in by the AI (or the demo rules) · UNDETERMINED: no basis yet */
export type BlueprintOrigin = 'USER_PROVIDED' | 'AI_SUGGESTED' | 'UNDETERMINED';

export interface BlueprintEntry {
  fieldKey: string;
  value: string;
  origin: BlueprintOrigin;
  reason: string;
  /** longer explanation written by the AI (or the demo rules): how this value applies to this product */
  detail?: string;
  /** 0..1, the generator's own confidence (not a verification) */
  confidence: number;
  needsVerification: boolean;
  sourceReferences: string[];
  /** kept as is when the whole blueprint is generated again */
  locked?: boolean;
  /** set when a related condition changed: why this item should be reviewed */
  review?: string;
  /** values suggested before, so "다시 추천" gives a different candidate */
  previous?: string[];
}

/** Per-country regulatory check. VERIFIED only with an official source and a check date. */
export interface RegulatoryCheck {
  country: string;
  status: 'REVIEW_REQUIRED' | 'VERIFIED';
  items: string[];
  source: { title: string; url?: string } | null;
  checkedAt: string | null;
  conditions: string[];
}

export interface Blueprint {
  idea: string;
  /** ai: generated by the server AI model · demo: rule-based Demo Mode */
  mode: 'ai' | 'demo';
  model?: string;
  generatedAt: string;
  productName: string;
  entries: Record<string, BlueprintEntry>;
  regulatory: RegulatoryCheck[];
  /** why Demo Mode was used (no API key, connection error, ...) */
  notice?: string;
  confirmedAt?: string;
}

// ── AI Packaging & Design Studio ────────────────────────────────────────────

export interface ColorSwatch {
  name: string;
  hex: string;
}

/** One packaging design direction. `mode` tells whether the AI wrote it or the labeled demo rules. */
export interface DesignDirection {
  id: string;
  name: string;
  summary: string;
  /** why, quoting the planning inputs */
  reason: string;
  /** names of the planning inputs used as the basis */
  basis: string[];
  mainColors: ColorSwatch[];
  subColors: ColorSwatch[];
  container: string;
  material: string;
  carton: string;
  typography: string;
  finishing: string;
  targetFit: string;
  /** English keywords for the image generator (no text / logos) */
  imagePrompt: string;
}

export interface DesignDirectionSet {
  mode: 'ai' | 'demo';
  model?: string;
  generatedAt: string;
  /** why the demo rules were used */
  notice?: string;
  /** fingerprint of the planning inputs used, to flag "기획 변경됨" */
  basisKey: string;
  items: DesignDirection[];
}

/** A real packaging reference. Image addresses only (never copied); null image = text only. */
export interface PackagingReference {
  id: string;
  imageUrl: string | null;
  pageUrl: string;
  site: string;
  title: string;
  /** printed on the source page (page collection) or typed by the user; null = 확인 필요 */
  brand: string | null;
  productName: string | null;
  kind: 'container' | 'carton' | 'set' | 'unknown';
  /** the user corrected the kind */
  kindByUser?: boolean;
  width: number | null;
  height: number | null;
  via: 'image-search' | 'page';
  imageStatus: 'ok' | 'failed' | 'none';
  imageNote: string | null;
  /** phrases copied from the source page (page-text) */
  features: string[];
  featuresBasis: 'page-text' | null;
  /** the user's own note about the design */
  note?: string;
  source: string;
  query: string | null;
  collectedAt: string;
}

export interface MockupOptions {
  container: string;
  mainColor: string;
  subColor: string;
  style: string;
  labelLayout: string;
  carton: string;
}

/** Brand logo, product name, volume and label copy, kept apart from the generated image and laid over it. */
export interface PackageIdentity {
  brandName: string;
  productName: string;
  volume: string;
  copy: string;
  /** IndexedDB key of the uploaded logo (image stays in this browser) */
  logoKey?: string;
}

export interface MockupMeta {
  id: string;
  kind: 'container' | 'carton' | 'set' | 'colorway';
  createdAt: string;
  provider: string;
  model: string;
  prompt: string;
  directionId?: string;
  options: MockupOptions & { variantColor?: string };
  /** where the image file is: this browser (IndexedDB) and/or Supabase Storage */
  stored: 'browser' | 'browser+supabase';
  /** chosen for the Packaging Brief */
  pinned?: boolean;
}

/** A supplier quote typed by the user. The site never makes up unit prices. */
export interface SupplierQuote {
  supplier: string;
  unitPrice: number | null;
  moq: number | null;
  date: string;
  note: string;
}

export interface PackagingStudio {
  directions?: DesignDirectionSet;
  selectedDirectionId?: string;
  selectedAt?: string;
  references?: PackagingReference[];
  identity?: PackageIdentity;
  mockupOptions?: MockupOptions;
  mockups?: MockupMeta[];
  quotes?: { container?: SupplierQuote; carton?: SupplierQuote };
  /** material / finishing the user picked on Manufacturing Feasibility */
  material?: string;
}
