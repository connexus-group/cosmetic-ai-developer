import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, Info, Loader2, Lock, RefreshCw, RotateCw, Save, Unlock } from 'lucide-react';
import { CORE_KEYS, CORE_SECTIONS, coreLabel } from '@/data/blueprintFields';
import type { Blueprint } from '@/data/types';
import { Button, Card } from '@/components/ui';
import { blueprintCounts, editEntry, isUndecided, keepAsIs, marketCodes, setLocked, UNDECIDED } from '@/lib/blueprint';
import { MARKETS, marketLabel } from '@/data/intakeSpec';
import { OriginBadges, type BlueprintActions } from './BlueprintReview';

/**
 * Compact Product Blueprint Editor: the 12 core items in 4 sections, each value editable in place.
 * The detailed items behind them stay in the blueprint and show up in the matching analysis steps.
 */
export function CompactBlueprintEditor({ bp, onChange, actions, footer }: { bp: Blueprint; onChange: (bp: Blueprint) => void; actions: BlueprintActions; footer?: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const c = blueprintCounts(bp, CORE_KEYS);
  const locked = Object.values(bp.entries).filter((e) => e.locked).length;
  const reviewKeys = CORE_KEYS.filter((k) => bp.entries[k]?.review && !bp.entries[k].locked);
  const dirty = Object.keys(drafts).filter((k) => drafts[k].trim() !== shown(bp, k));

  const commit = (keys: string[]) => {
    let next = bp;
    for (const k of keys) next = editEntry(next, k, drafts[k] ?? '');
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k))));
    if (next !== bp) {
      onChange(next);
      setSavedAt(new Date());
    }
  };
  const setValue = (k: string, v: string) => {
    const next = editEntry(bp, k, v);
    if (next !== bp) {
      onChange(next);
      setSavedAt(new Date());
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div data-testid="compact-blueprint" className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-50 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI PRODUCT BLUEPRINT</span>
              {bp.mode === 'ai' ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">AI 생성 · {bp.model ?? 'AI'}</span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Demo Mode · 규칙 기반 초안</span>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold text-ink-900">{bp.productName}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>사용자 입력 {c.user}</span>
              <span>{bp.mode === 'ai' ? 'AI 제안' : '데모 제안'} {c.ai}</span>
              {c.undecided > 0 && <span>미정 {c.undecided}</span>}
              <span className="text-rose-700">확인 필요 {c.verify}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {actions.onRegenerate && (
              <Button className="h-9 px-3 py-0 text-xs" onClick={() => (locked > 0 ? setConfirmRegen(true) : actions.onRegenerate!(true))} disabled={actions.busy.size > 0}>
                <RefreshCw size={13} /> 전체 다시 생성
              </Button>
            )}
            <Button variant={dirty.length ? 'primary' : 'secondary'} className="h-9 px-3 py-0 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => commit(Object.keys(drafts))} disabled={!dirty.length && !savedAt}>
              {dirty.length ? <Save size={13} /> : <Check size={13} />} {dirty.length ? `변경사항 저장 (${dirty.length})` : savedAt ? `저장됨 ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '변경사항 저장'}
            </Button>
          </div>
        </div>

        {bp.mode === 'demo' && (
          <div className="border-b border-ink-50 bg-amber-50/60 px-5 py-2 text-[11px] text-amber-900">
            실제 AI 분석이 아니라 입력 문장과 규칙으로 채운 초안이에요.{bp.notice ? ` ${bp.notice}` : ''}
          </div>
        )}
        {confirmRegen && actions.onRegenerate && (
          <div role="dialog" aria-label="전체 다시 생성 확인" className="flex flex-wrap items-center gap-2 border-b border-ink-50 bg-ink-50/40 px-5 py-3 text-xs text-ink-800">
            <span className="mr-auto">직접 수정한 항목 {locked}개가 있어요.</span>
            <Button variant="primary" className="h-8 px-3 py-0 text-xs" onClick={() => (setConfirmRegen(false), actions.onRegenerate!(true))}>
              수정한 {locked}개는 유지하고 다시 생성
            </Button>
            <Button className="h-8 px-3 py-0 text-xs" onClick={() => (setConfirmRegen(false), actions.onRegenerate!(false))}>
              모두 새로 생성
            </Button>
            <Button variant="ghost" className="h-8 px-3 py-0 text-xs" onClick={() => setConfirmRegen(false)}>
              취소
            </Button>
          </div>
        )}
        {reviewKeys.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-50 bg-sky-50/70 px-5 py-2 text-[11px] text-sky-900">
            <span>조건이 바뀌어 다시 볼 항목 {reviewKeys.length}개 · 자동으로 바꾸지 않았어요</span>
            <button type="button" className="font-semibold underline-offset-2 hover:underline disabled:opacity-50" onClick={() => actions.onRefresh(reviewKeys)} disabled={actions.busy.size > 0}>
              모두 다시 추천
            </button>
          </div>
        )}

        <div className="divide-y divide-ink-50">
          {CORE_SECTIONS.map((s) => (
            <section key={s.id} data-testid={`core-section-${s.id}`} className="px-5 py-4">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-ink-900">
                <span className="text-champagne-700">{s.no}</span> {s.title}
              </h3>
              <div className="grid gap-x-5 gap-y-3 md:grid-cols-3">
                {s.keys.map((k) => (
                  <CoreField
                    key={k}
                    k={k}
                    bp={bp}
                    draft={drafts[k]}
                    busy={actions.busy.has(k)}
                    onDraft={(v) => setDrafts((d) => ({ ...d, [k]: v }))}
                    onCommit={() => commit([k])}
                    onCancel={() => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([x]) => x !== k)))}
                    onSet={(v) => setValue(k, v)}
                    onRefresh={() => actions.onRefresh([k])}
                    onLock={(l) => onChange(setLocked(bp, k, l))}
                    onKeep={() => onChange(keepAsIs(bp, k))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>
      {footer}
    </div>
  );
}

const shown = (bp: Blueprint, k: string) => (isUndecided(bp.entries[k]) ? '' : bp.entries[k].value);

function CoreField({
  k,
  bp,
  draft,
  busy,
  onDraft,
  onCommit,
  onCancel,
  onSet,
  onRefresh,
  onLock,
  onKeep,
}: {
  k: string;
  bp: Blueprint;
  draft: string | undefined;
  busy: boolean;
  onDraft: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onSet: (v: string) => void;
  onRefresh: () => void;
  onLock: (locked: boolean) => void;
  onKeep: () => void;
}) {
  const [why, setWhy] = useState(false);
  const e = bp.entries[k];
  if (!e) return null;
  const label = coreLabel(k);
  const value = draft ?? shown(bp, k);
  const iconBtn = 'grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-40';

  return (
    <div data-testid={`core-field-${k}`} className="min-w-0">
      <div className="mb-1 flex min-h-6 items-center gap-1.5">
        <label htmlFor={`core-${k}`} className="truncate text-[11px] font-medium text-slate-500">
          {label}
        </label>
        <OriginBadges e={e} mode={bp.mode} />
        <span className="ml-auto flex items-center">
          <button type="button" className={clsx(iconBtn, why && 'bg-ink-50 text-ink-900')} title="근거 보기" aria-label={`${label} 근거 보기`} onClick={() => setWhy((w) => !w)}>
            <Info size={13} />
          </button>
          {e.locked ? (
            <button type="button" className={iconBtn} title="잠금 해제 (다시 추천·전체 다시 생성에서 바뀔 수 있어요)" aria-label={`${label} 잠금 해제`} onClick={() => onLock(false)}>
              <Lock size={12} />
            </button>
          ) : (
            <button type="button" className={iconBtn} title="이 항목만 다시 추천" aria-label={`${label} 다시 추천`} onClick={onRefresh} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={12} />}
            </button>
          )}
          {e.origin === 'USER_PROVIDED' && !e.locked && (
            <button type="button" className={iconBtn} title="잠그기" aria-label={`${label} 잠그기`} onClick={() => onLock(true)}>
              <Unlock size={12} />
            </button>
          )}
        </span>
      </div>

      {k === 'markets' ? (
        <MarketPicker value={e.value} onChange={onSet} />
      ) : (
        <textarea
          id={`core-${k}`}
          rows={Math.min(3, Math.max(1, Math.ceil(value.length / 34)))}
          value={value}
          placeholder={`${UNDECIDED} · 직접 입력`}
          onChange={(ev) => onDraft(ev.target.value)}
          onBlur={() => draft !== undefined && onCommit()}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) {
              ev.preventDefault();
              (ev.target as HTMLTextAreaElement).blur();
            }
            if (ev.key === 'Escape') onCancel();
          }}
          className={clsx(
            'block min-h-9 w-full resize-none rounded-lg border bg-white px-2.5 py-[7px] text-[13px] leading-5 field-sizing-content text-ink-900 outline-none transition placeholder:text-slate-400 focus:border-ink-400 focus:ring-2 focus:ring-ink-100',
            draft !== undefined && draft.trim() !== shown(bp, k) ? 'border-champagne-500' : 'border-ink-100',
          )}
        />
      )}

      {e.review && !e.locked && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-sky-800">
          <span>재검토 필요 · {e.review}</span>
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={onKeep}>
            유지
          </button>
        </div>
      )}
      {k === 'markets' && bp.regulatory.length > 0 && (
        <div className="mt-1 text-[11px] text-rose-700">{bp.regulatory.map((r) => r.country).join(' · ')} 규제 확인 필요</div>
      )}
      {why && (
        <div className="mt-1 rounded-md bg-ink-50/60 px-2 py-1.5 text-[11px] leading-relaxed text-slate-600">
          {e.reason || '근거 정보가 없어요.'}
          {e.origin !== 'USER_PROVIDED' && e.confidence > 0 && <span className="text-slate-400"> · 생성기 자체 신뢰도 {Math.round(e.confidence * 100)}% (검증값 아님)</span>}
          {e.sourceReferences.length > 0 && <span className="text-slate-400"> · 근거: {e.sourceReferences.join(', ')}</span>}
        </div>
      )}
    </div>
  );
}

/** Sales countries: multiple choice; changing them re-flags ingredients and regulation for review. */
function MarketPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const codes = value === UNDECIDED ? [] : marketCodes(value);
  const options = [...MARKETS.map((m) => m.value), ...codes.filter((c) => !MARKETS.some((m) => m.value === c))];
  const toggle = (code: string) => onChange((codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]).map(marketLabel).join(', '));
  return (
    <div role="group" aria-label="주요 판매 국가" className="flex min-h-9 flex-wrap items-center gap-1">
      {options.map((c) => {
        const on = codes.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c)}
            className={clsx('h-7 rounded-md px-2 text-[12px] ring-1 ring-inset transition', on ? 'bg-ink-900 font-medium text-white ring-ink-900' : 'bg-white text-slate-600 ring-ink-100 hover:bg-ink-50')}
          >
            {marketLabel(c)}
          </button>
        );
      })}
    </div>
  );
}
