import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { blueprintField } from '@/data/blueprintFields';
import type { Project, StepId } from '@/data/types';
import { isUndecided } from '@/lib/blueprint';
import { OriginBadges } from './BlueprintReview';

/** Which confirmed AI Product Blueprint items each analysis step builds on. */
const STEP_KEYS: Partial<Record<StepId, string[]>> = {
  market: ['ages', 'gender', 'markets', 'channels', 'positioning'],
  competitors: ['benchmark', 'targetPrice', 'differentiation', 'positioning'],
  consumer: ['needs', 'motivation', 'concerns', 'skinTypes', 'usage'],
  trend: ['keywords', 'hero', 'benefits'],
  opportunity: ['differentiation', 'usp', 'positioning'],
  concept: ['concept', 'usp', 'keywords', 'benefits'],
  formula: ['textureType', 'viscosity', 'absorption', 'stickiness', 'finish', 'scent', 'appearance', 'sensory'],
  ingredients: ['hero', 'actives', 'supporting', 'exclude', 'functional', 'lowIrritation', 'rationale', 'compatibility', 'countryIngredients'],
  packaging: ['container', 'material', 'size'],
  cost: ['targetCost', 'targetPrice', 'firstRun', 'container'],
  regulation: ['markets', 'functionalClass', 'claims', 'procedures', 'extraRegulatory'],
  testing: ['tests', 'lowIrritation', 'skinTypes'],
  timeline: ['launchTiming', 'procedures', 'markets'],
};

export function BlueprintNotes({ project: p, step }: { project: Project; step: StepId }) {
  const bp = p.blueprint;
  const keys = STEP_KEYS[step];
  if (!bp || !keys) return null;
  const rows = keys.map((k) => bp.entries[k]).filter((e) => e && !isUndecided(e));
  if (!rows.length) return null;
  return (
    <div data-testid="blueprint-notes" className="rounded-2xl border border-ink-100 bg-white px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <FileText size={15} className="text-champagne-700" /> 확정한 AI 제품 기획안 반영
          {bp.mode === 'demo' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Demo Mode 초안</span>}
        </div>
        <Link to={`/projects/${p.id}/overview`} className="text-xs text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline">
          기획안 수정
        </Link>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((e) => (
          <div key={e.fieldKey} className="min-w-0 text-[13px] leading-relaxed">
            <dt className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              {blueprintField(e.fieldKey)?.label} <OriginBadges e={e} mode={bp.mode} />
            </dt>
            <dd className="text-ink-900">{e.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-slate-400">"확인 필요" 항목은 실제 견적·규제 자료로 확인하기 전까지 확정값이 아닙니다.</p>
    </div>
  );
}
