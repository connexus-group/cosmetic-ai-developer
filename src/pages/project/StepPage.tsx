import { Suspense, type ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import type { StepId } from '@/data/types';
import { AnalyzingState } from '@/components/ui';
import { lazyWithRetry as lazy } from '@/lib/lazy';

const PAGES: Record<StepId, ComponentType> = {
  overview: lazy(() => import('./steps/Overview')),
  market: lazy(() => import('./steps/Market')),
  competitors: lazy(() => import('./steps/Competitors')),
  consumer: lazy(() => import('./steps/Consumer')),
  trend: lazy(() => import('./steps/Trend')),
  opportunity: lazy(() => import('./steps/Opportunity')),
  concept: lazy(() => import('./steps/Concept')),
  formula: lazy(() => import('./steps/Formula')),
  ingredients: lazy(() => import('./steps/Ingredients')),
  packaging: lazy(() => import('./steps/Packaging')),
  cost: lazy(() => import('./steps/Cost')),
  regulation: lazy(() => import('./steps/Regulation')),
  testing: lazy(() => import('./steps/Testing')),
  timeline: lazy(() => import('./steps/Timeline')),
  brief: lazy(() => import('./steps/Brief')),
};

export default function StepPage() {
  const { step } = useParams();
  const Page = PAGES[step as StepId];
  return (
    <Suspense key={step} fallback={<AnalyzingState label="화면을 불러오는 중" />}>
      <Page />
    </Suspense>
  );
}
