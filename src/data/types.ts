/**
 * Domain model for the AI Product Developer.
 *
 * Every number shown in the UI is wrapped with its data kind and source so the
 * mock data source can be replaced by real APIs without touching pages
 * (see `src/data/source.ts`).
 */

/** Data trust classes. The UI shows each as a badge so estimates never look like facts. */
export type DataKind = 'VERIFIED' | 'EXTERNAL' | 'AI_ANALYSIS' | 'AI_ESTIMATE' | 'USER_INPUT' | 'DEMO';

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

export type CostKey = 'content' | 'container' | 'pump' | 'carton' | 'label' | 'filling' | 'packing' | 'testing' | 'logistics';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  idea: string;
  intake: Intake;
  answers: Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>>;
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
  /** user edits on the brief */
  brief: Record<string, string>;
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
