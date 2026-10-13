import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { FileText } from 'lucide-react';
import { blueprintField } from '@/data/blueprintFields';
import type { Blueprint, Project, StepId } from '@/data/types';
import { editEntry, isUndecided, splitList, UNDECIDED } from '@/lib/blueprint';
import { OriginBadges } from './BlueprintReview';
import { useBlueprintUpdate } from './useBlueprintUpdate';

/**
 * The detailed AI Product Blueprint items each analysis step builds on.
 * The first screen shows only the 12 core items; the detail lives here, next to the step that uses it.
 */
const STEP_KEYS: Partial<Record<StepId, string[]>> = {
  market: ['ages', 'gender', 'markets', 'channels', 'positioning'],
  competitors: ['benchmark', 'targetPrice', 'differentiation', 'positioning'],
  consumer: ['needs', 'motivation', 'concerns', 'skinTypes', 'usage'],
  trend: ['keywords', 'hero', 'benefits'],
  opportunity: ['differentiation', 'usp', 'positioning'],
  concept: ['concept', 'usp', 'keywords', 'benefits'],
  formula: ['textureType', 'viscosity', 'absorption', 'stickiness', 'finish', 'sensory', 'scent', 'appearance'],
  ingredients: ['exclude', 'functional', 'lowIrritation', 'rationale', 'compatibility', 'countryIngredients'],
  packaging: ['size', 'container', 'material'],
  cost: ['targetCost', 'targetPrice', 'firstRun', 'container'],
  regulation: ['markets', 'countryIngredients', 'functionalClass', 'claims', 'procedures', 'extraRegulatory'],
  testing: ['tests', 'lowIrritation', 'skinTypes'],
  timeline: ['launchTiming', 'procedures', 'markets'],
};

/** Things this step must still confirm with a manufacturer, supplier or official source (never filled with a made-up value). */
const STEP_CHECKS: Partial<Record<StepId, string[]>> = {
  formula: ['제형 안정성 (온도·분리·변색)'],
  ingredients: ['원료별 함량 범위', 'INCI 명칭', '원료 간 배합 적합성'],
  packaging: ['차광성', '내용물과 용기의 적합성'],
  cost: ['상세 원가 (원료·용기·충전·포장)', '제조사 MOQ', '유통 마진'],
  regulation: ['국가별 원료 사용 가능 여부', '기능성 해당 여부', '표시·광고 문구 규제'],
  testing: ['안정성 시험', '미생물 시험', '용기 적합성 시험', '인체적용시험'],
};

const ROLE: Record<string, string> = { hero: '대표 효능 원료', actives: '효능 원료', supporting: '보조 (보습·안정)' };

export function BlueprintNotes({ project: p, step }: { project: Project; step: StepId }) {
  const bp = p.blueprint;
  const keys = STEP_KEYS[step];
  if (!bp || !keys) return null;
  return <Notes p={p} bp={bp} step={step} keys={keys} />;
}

function Notes({ p, bp, step, keys }: { p: Project; bp: Blueprint; step: StepId; keys: string[] }) {
  const { updateBlueprint } = useBlueprintUpdate();
  const save = (k: string, v: string) => updateBlueprint((cur) => editEntry(cur, k, v));
  const checks = STEP_CHECKS[step] ?? [];
  return (
    <div data-testid="blueprint-notes" className="rounded-2xl border border-ink-100 bg-white px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <FileText size={15} className="text-champagne-700" /> AI 제품 기획안 · 이 단계의 상세 항목
          {bp.mode === 'demo' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Demo Mode 초안</span>}
        </div>
        <Link to={`/projects/${p.id}/overview`} className="text-xs text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline">
          핵심 기획안 보기
        </Link>
      </div>

      {step === 'ingredients' && <IngredientTable bp={bp} onSave={save} />}

      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {keys.map((k) => (
          <DetailField key={k} k={k} bp={bp} onSave={(v) => save(k, v)} />
        ))}
      </dl>

      {checks.length > 0 && (
        <div className="mt-3 border-t border-ink-50 pt-3">
          <div className="mb-1.5 text-[11px] font-medium text-slate-500">제조사·원료사·공식 자료로 확인할 항목</div>
          <ul className="flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <li key={c} className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
                {c} · 확인 필요
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400">"확인 필요" 항목은 실제 견적·시험·규제 자료로 확인하기 전까지 확정값이 아닙니다.</p>
    </div>
  );
}

function DetailField({ k, bp, onSave }: { k: string; bp: Blueprint; onSave: (v: string) => void }) {
  const e = bp.entries[k];
  const f = blueprintField(k);
  const [draft, setDraft] = useState<string | null>(null);
  if (!e || !f) return null;
  const value = isUndecided(e) ? '' : e.value;
  return (
    <div data-testid={`detail-field-${k}`} className="min-w-0">
      <dt className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        {f.label} <OriginBadges e={e} mode={bp.mode} />
        {e.review && <span className="text-sky-800">· 재검토 필요</span>}
      </dt>
      <dd>
        <input
          aria-label={f.label}
          value={draft ?? value}
          placeholder={`${UNDECIDED} · 직접 입력`}
          title={draft ?? value}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={() => {
            if (draft !== null && draft.trim() !== value) onSave(draft);
            setDraft(null);
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) (ev.target as HTMLInputElement).blur();
            if (ev.key === 'Escape') setDraft(null);
          }}
          className={clsx('h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-slate-400 focus:border-ink-400 focus:ring-2 focus:ring-ink-100', draft !== null ? 'border-champagne-500' : 'border-ink-100')}
        />
      </dd>
    </div>
  );
}

/** Ingredient candidates with their role; amount and INCI are never made up. */
function IngredientTable({ bp, onSave }: { bp: Blueprint; onSave: (k: string, v: string) => void }) {
  const rows = (['hero', 'actives', 'supporting'] as const).flatMap((k) => (isUndecided(bp.entries[k]) ? [] : splitList(bp.entries[k].value).map((name) => ({ k, name }))));
  return (
    <div className="mb-4">
      <div className="overflow-x-auto">
        <table data-testid="ingredient-table" className="w-full min-w-[520px] text-left text-[12px]">
          <thead className="text-[11px] text-slate-500">
            <tr className="border-b border-ink-50">
              <th className="py-1.5 pr-3 font-medium">원료 후보</th>
              <th className="py-1.5 pr-3 font-medium">역할</th>
              <th className="py-1.5 pr-3 font-medium">함량 범위</th>
              <th className="py-1.5 pr-3 font-medium">INCI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.k}-${r.name}`} className="border-b border-ink-50">
                <td className="py-1.5 pr-3 font-medium text-ink-900">{r.name}</td>
                <td className="py-1.5 pr-3 text-ink-800">{ROLE[r.k]}</td>
                <td className="py-1.5 pr-3 text-rose-700">원료사 확인 필요</td>
                <td className="py-1.5 pr-3 text-rose-700">확인 필요</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-2 text-slate-400">
                  원료 후보가 아직 미정이에요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-3">
        {(['hero', 'actives', 'supporting'] as const).map((k) => (
          <DetailField key={k} k={k} bp={bp} onSave={(v) => onSave(k, v)} />
        ))}
      </dl>
    </div>
  );
}
