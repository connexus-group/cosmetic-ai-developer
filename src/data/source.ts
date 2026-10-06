import * as mock from './mock';
import type {
  ClarifyQuestion,
  Competitor,
  ConceptId,
  ConceptOption,
  ConsumerData,
  FormulaOption,
  GapPosition,
  IngredientInfo,
  IngredientTrend,
  Insight,
  MarketData,
  PackageOption,
  TestItem,
} from './types';

/**
 * DATA LAYER — pages never import mock data directly; they call `dataSource`.
 *
 * Today `dataSource` is the demo implementation over `mock.ts`. To go live, write an
 * implementation of `DevDataSource` that calls real APIs (market data, review analytics,
 * LLM) and assign it below. Page components do not change.
 */
export interface DevDataSource {
  readonly mode: 'demo' | 'live';
  clarifyQuestions(): Promise<ClarifyQuestion[]>;
  market(): Promise<MarketData>;
  competitors(): Promise<{ items: Competitor[]; insight: Insight }>;
  consumer(): Promise<ConsumerData>;
  trends(): Promise<{ items: IngredientTrend[]; others: typeof mock.OTHER_TRENDS; insight: Insight }>;
  gap(): Promise<{ items: GapPosition[]; formula: string; insight: Insight }>;
  concepts(): Promise<ConceptOption[]>;
  formulas(): Promise<{ items: FormulaOption[]; recommended: Record<ConceptId, FormulaOption['id']> }>;
  ingredients(concept: ConceptId): Promise<IngredientInfo[]>;
  packages(): Promise<PackageOption[]>;
  tests(): Promise<TestItem[]>;
}

/** Simulated network / analysis latency so loading states are visible in the demo. */
const delay = <T,>(value: T, ms = 380) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export const demoDataSource: DevDataSource = {
  mode: 'demo',
  clarifyQuestions: () => delay(mock.CLARIFY_QUESTIONS, 0),
  market: () => delay(mock.MARKET),
  competitors: () => delay({ items: mock.COMPETITORS, insight: mock.COMPETITOR_INSIGHT }),
  consumer: () => delay(mock.CONSUMER),
  trends: () => delay({ items: mock.TRENDS, others: mock.OTHER_TRENDS, insight: mock.TREND_INSIGHT }),
  gap: () => delay({ items: mock.GAP, formula: mock.OPP_FORMULA, insight: mock.GAP_INSIGHT }),
  concepts: () => delay(mock.CONCEPTS, 650),
  formulas: () => delay({ items: mock.FORMULAS, recommended: mock.FORMULA_RECOMMEND }),
  ingredients: (concept) => delay(mock.ingredientsFor(concept)),
  packages: () => delay(mock.PACKAGES),
  tests: () => delay(mock.TESTS, 200),
};

// TODO(Phase 6): replace with `apiDataSource` once real data / AI APIs exist.
export const dataSource: DevDataSource = demoDataSource;
