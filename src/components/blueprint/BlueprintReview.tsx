import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, Cpu, FlaskConical, Lightbulb, Loader2, Lock, Pencil, RefreshCw, Sparkles, Unlock } from 'lucide-react';
import { BLUEPRINT_FIELDS, BLUEPRINT_GROUPS, CELL_LABELS, type BlueprintFieldDef } from '@/data/blueprintFields';
import type { Blueprint, BlueprintEntry, SpecGroupId } from '@/data/types';
import { Button, Card } from '@/components/ui';
import { blueprintCounts, editEntry, isUndecided, keepAsIs, setLocked, splitList } from '@/lib/blueprint';

export interface BlueprintActions {
  /** busy item keys (being re-suggested) */
  busy: Set<string>;
  /** new suggestions for these keys */
  onRefresh: (keys: string[]) => void;
  /** whole blueprint again */
  onRegenerate?: (keepLocked: boolean) => void;
}

/** Status chip next to every item: 사용자 입력 / AI 제안 (or 데모 제안) / 미정, plus 확인 필요. */
export function OriginBadges({ e, mode }: { e: BlueprintEntry; mode: Blueprint['mode'] }) {
  const undecided = isUndecided(e);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {undecided ? (
        <Chip cls="bg-slate-100 text-slate-600 ring-slate-200">미정</Chip>
      ) : e.origin === 'USER_PROVIDED' ? (
        <Chip cls="bg-ink-900 text-white ring-ink-900">사용자 입력</Chip>
      ) : mode === 'ai' ? (
        <Chip cls="bg-violet-50 text-violet-800 ring-violet-200">AI 제안</Chip>
      ) : (
        <Chip cls="bg-amber-50 text-amber-800 ring-amber-200">데모 제안</Chip>
      )}
      {e.needsVerification && !undecided && <Chip cls="bg-rose-50 text-rose-700 ring-rose-200">확인 필요</Chip>}
    </span>
  );
}
const Chip = ({ cls, children }: { cls: string; children: ReactNode }) => <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', cls)}>{children}</span>;

export function ModeBanner({ bp }: { bp: Blueprint }) {
  return bp.mode === 'ai' ? (
    <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-4 py-3 text-[12px] leading-relaxed text-violet-900">
      <Cpu size={15} className="mt-0.5 shrink-0" />
      <div>
        <b>AI 생성 초안</b> · {bp.model ?? 'AI 모델'}이 입력한 아이디어로 작성했어요. 시장 규모·원가·규제·시험 적합성은 검증된 값이 아니며 "확인 필요"로 표시됩니다.
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
      <FlaskConical size={15} className="mt-0.5 shrink-0" />
      <div>
        <b>Demo Mode</b> · 실제 AI 분석이 아니라 규칙 기반으로 채운 초안이에요. 입력 문장에서 찾은 값만 "사용자 입력"이고, 나머지는 검증되지 않은 데모 제안입니다.
        {bp.notice && <div className="mt-0.5 text-amber-800/90">{bp.notice}</div>}
      </div>
    </div>
  );
}

export function BlueprintReview({ bp, onChange, actions, footer }: { bp: Blueprint; onChange: (bp: Blueprint) => void; actions: BlueprintActions; footer?: ReactNode }) {
  const [open, setOpen] = useState<Set<SpecGroupId>>(() => new Set<SpecGroupId>(['product']));
  const [confirmRegen, setConfirmRegen] = useState(false);
  const c = blueprintCounts(bp);
  const reviewKeys = Object.values(bp.entries)
    .filter((e) => e.review && !e.locked)
    .map((e) => e.fieldKey);
  const toggle = (g: SpecGroupId) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  const allOpen = open.size === BLUEPRINT_GROUPS.length;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="border-b border-ink-50 bg-ink-50/50 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI PRODUCT BLUEPRINT · AI 제품 기획 초안</div>
              <div className="mt-1 text-xl font-semibold text-ink-900">{bp.productName}</div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">"{bp.idea}"</p>
            </div>
            {actions.onRegenerate && (
              <Button onClick={() => (c.locked > 0 ? setConfirmRegen(true) : actions.onRegenerate!(true))} disabled={actions.busy.size > 0}>
                <RefreshCw size={14} /> 전체 다시 생성
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            <Count label="사용자 입력" n={c.user} cls="bg-ink-900 text-white" />
            <Count label={bp.mode === 'ai' ? 'AI 제안' : '데모 제안'} n={c.ai} cls={bp.mode === 'ai' ? 'bg-violet-50 text-violet-800' : 'bg-amber-50 text-amber-800'} />
            <Count label="미정" n={c.undecided} cls="bg-slate-100 text-slate-600" />
            <Count label="확인 필요" n={c.verify} cls="bg-rose-50 text-rose-700" />
            {c.review > 0 && <Count label="재검토 필요" n={c.review} cls="bg-sky-50 text-sky-800" />}
          </div>
        </div>
        <div className="space-y-3 px-6 py-4">
          <ModeBanner bp={bp} />
          {confirmRegen && actions.onRegenerate && (
            <div role="dialog" aria-label="전체 다시 생성 확인" className="rounded-xl border border-ink-200 bg-white p-4">
              <div className="text-sm font-semibold text-ink-900">기획 초안을 전체 다시 생성할까요?</div>
              <p className="mt-1 text-xs text-slate-500">직접 수정하거나 잠근 항목이 {c.locked}개 있어요. 기본적으로 그대로 두고 나머지만 새로 작성합니다.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => (setConfirmRegen(false), actions.onRegenerate!(true))}>
                  수정한 {c.locked}개는 유지하고 다시 생성
                </Button>
                <Button onClick={() => (setConfirmRegen(false), actions.onRegenerate!(false))}>수정한 내용까지 모두 새로 생성</Button>
                <Button variant="ghost" onClick={() => setConfirmRegen(false)}>
                  취소
                </Button>
              </div>
            </div>
          )}
          {reviewKeys.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-4 py-3 text-[12px] text-sky-900">
              <span>
                <b>재검토 필요 {reviewKeys.length}개</b> · 주요 조건이 바뀌어 영향을 받는 항목이에요. 자동으로 바꾸지 않았어요.
              </span>
              <Button className="px-2.5 py-1.5 text-xs" onClick={() => actions.onRefresh(reviewKeys)} disabled={actions.busy.size > 0}>
                <Sparkles size={12} /> 재검토 항목 다시 추천
              </Button>
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(BLUEPRINT_GROUPS.map((g) => g.id)))} className="text-xs text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline">
              {allOpen ? '모두 접기' : '모두 펼치기'}
            </button>
          </div>
        </div>
      </Card>

      {BLUEPRINT_GROUPS.map((g) => {
        const fields = BLUEPRINT_FIELDS.filter((f) => f.group === g.id);
        const isOpen = open.has(g.id);
        const groupReview = fields.filter((f) => bp.entries[f.key]?.review).length;
        const groupUndecided = fields.filter((f) => isUndecided(bp.entries[f.key])).length;
        return (
          <Card key={g.id} className="overflow-hidden">
            <button type="button" onClick={() => toggle(g.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-ink-50/40">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-champagne-300">{String(g.no).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-ink-900">
                  {g.label} <span className="text-xs font-normal text-slate-400">{g.en}</span>
                </span>
                {!isOpen && (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {fields
                      .slice(0, 3)
                      .map((f) => bp.entries[f.key]?.value)
                      .filter((v) => v && v !== '미정')
                      .join(' · ')}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
                {groupReview > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">재검토 {groupReview}</span>}
                {groupUndecided > 0 && <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 sm:inline">미정 {groupUndecided}</span>}
                <span>{fields.length}개 항목</span>
                <ChevronDown size={16} className={clsx('transition', isOpen && 'rotate-180')} />
              </span>
            </button>
            {isOpen && (
              <div className="divide-y divide-ink-50 border-t border-ink-50">
                {fields
                  .filter((f) => !f.cell)
                  .map((f) => (
                    <EntryRow key={f.key} f={f} bp={bp} onChange={onChange} actions={actions} />
                  ))}
                {[...new Set(fields.filter((f) => f.cell).map((f) => f.cell!))].map((cell) => (
                  <CellRow key={cell} cell={cell} fields={fields.filter((f) => f.cell === cell)} bp={bp} onChange={onChange} actions={actions} />
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {footer}
    </div>
  );
}

/** Several short items in one row (e.g. price, cost, volume, MOQ, package, benchmark, launch). */
function CellRow({ cell, fields, bp, onChange, actions }: { cell: string; fields: BlueprintFieldDef[]; bp: Blueprint; onChange: (bp: Blueprint) => void; actions: BlueprintActions }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [why, setWhy] = useState(false);
  const open = fields.filter((f) => !bp.entries[f.key]?.locked).map((f) => f.key);
  const busy = fields.some((f) => actions.busy.has(f.key));
  const save = (k: string) => {
    onChange(editEntry(bp, k, draft));
    setEditing(null);
  };
  return (
    <div id={`bp-cell-${cell}`} className={clsx('px-5 py-4', busy && 'opacity-60')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="w-full shrink-0 sm:w-44">
          <div className="text-[13px] font-semibold text-ink-900">{CELL_LABELS[cell] ?? cell}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{fields.length}개 항목 · 값을 눌러 수정</div>
        </div>
        <div className="min-w-0 flex-1">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-100 lg:grid-cols-4">
            {fields.map((f) => {
              const e = bp.entries[f.key];
              if (!e) return null;
              const undecided = isUndecided(e);
              return (
                <div key={f.key} id={`bp-${f.key}`} data-origin={e.origin} className={clsx('min-w-0 bg-white px-3 py-2', e.review && 'bg-sky-50/60')}>
                  <dt className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    {f.label}
                    {e.origin === 'USER_PROVIDED' && <span className="rounded bg-ink-900 px-1 text-[9px] font-semibold text-white">사용자</span>}
                    {e.needsVerification && !undecided && <span className="rounded bg-rose-50 px-1 text-[9px] font-semibold text-rose-700">확인 필요</span>}
                    {e.review && <span className="rounded bg-sky-100 px-1 text-[9px] font-semibold text-sky-800">재검토</span>}
                  </dt>
                  <dd className="mt-0.5">
                    {editing === f.key ? (
                      <input
                        autoFocus
                        value={draft}
                        list={f.options ? `opts-${f.key}` : undefined}
                        aria-label={`${f.label} 수정`}
                        onChange={(ev) => setDraft(ev.target.value)}
                        onBlur={() => save(f.key)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) save(f.key);
                          if (ev.key === 'Escape') setEditing(null);
                        }}
                        className="w-full rounded border border-ink-200 px-1.5 py-0.5 text-[13px] outline-none focus:border-ink-500"
                      />
                    ) : (
                      <button
                        type="button"
                        title={e.detail || e.reason}
                        onClick={() => {
                          setDraft(undecided ? '' : e.value);
                          setEditing(f.key);
                        }}
                        className={clsx('w-full text-left text-[13px] leading-snug hover:underline', undecided ? 'text-slate-400' : 'text-ink-900')}
                      >
                        {undecided ? '미정' : e.value}
                      </button>
                    )}
                    {f.options && (
                      <datalist id={`opts-${f.key}`}>
                        {f.options.map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          {why && (
            <ul className="mt-2 space-y-1 rounded-lg bg-ink-50/70 px-3 py-2 text-[12px] leading-relaxed text-ink-800">
              {fields.map((f) => {
                const e = bp.entries[f.key];
                return e ? (
                  <li key={f.key}>
                    <b>{f.label}</b> · {e.detail || e.reason || '설명 없음'}
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-col sm:items-stretch">
          <RowButton onClick={() => setWhy((w) => !w)} icon={<Lightbulb size={12} />} active={why}>
            {bp.mode === 'ai' ? 'AI 설명' : '데모 설명'}
          </RowButton>
          <RowButton onClick={() => actions.onRefresh(open)} icon={busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} disabled={busy || !open.length}>
            다시 추천
          </RowButton>
        </div>
      </div>
    </div>
  );
}

const Count = ({ label, n, cls }: { label: string; n: number; cls: string }) => (
  <span className={clsx('rounded-full px-2.5 py-1 font-medium', cls)}>
    {label} <b>{n}</b>
  </span>
);

function EntryRow({ f, bp, onChange, actions }: { f: BlueprintFieldDef; bp: Blueprint; onChange: (bp: Blueprint) => void; actions: BlueprintActions }) {
  const e = bp.entries[f.key];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [why, setWhy] = useState(false);
  if (!e) return null;
  const busy = actions.busy.has(f.key);
  const undecided = isUndecided(e);
  const save = (v: string) => {
    onChange(editEntry(bp, f.key, v));
    setEditing(false);
  };
  const values = f.multi ? splitList(e.value) : [e.value];
  const toggleOption = (o: string) => {
    const cur = splitList(draft);
    setDraft(f.multi ? (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]).join(', ') : o);
  };

  return (
    <div id={`bp-${f.key}`} data-origin={e.origin} className={clsx('px-5 py-4 transition', e.review && 'bg-sky-50/40', busy && 'opacity-60')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="w-full shrink-0 sm:w-44">
          <div className="text-[13px] font-semibold text-ink-900">{f.label}</div>
          <div className="mt-1">
            <OriginBadges e={e} mode={bp.mode} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              {f.options && (
                <div className="flex flex-wrap gap-1.5">
                  {f.options.map((o) => {
                    const on = splitList(draft).includes(o);
                    return (
                      <button key={o} type="button" onClick={() => toggleOption(o)} className={clsx('rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', on ? 'bg-ink-800 text-white ring-ink-800' : 'text-ink-700 ring-ink-100 hover:ring-ink-300')}>
                        {on && f.multi && <Check size={11} className="mr-0.5 inline" />}
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}
              <textarea
                autoFocus
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault();
                    save(draft);
                  } else if (ev.key === 'Escape') setEditing(false);
                }}
                rows={Math.max(1, Math.ceil(draft.length / 50))}
                aria-label={`${f.label} 수정`}
                placeholder={f.multi ? '쉼표로 구분해 입력' : '내용 입력'}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink-500"
              />
              <div className="flex gap-1.5">
                <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => save(draft)}>
                  <Check size={12} /> 저장
                </Button>
                <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setEditing(false)}>
                  취소
                </Button>
              </div>
            </div>
          ) : undecided ? (
            <div className="text-sm text-slate-400">{e.value && e.value !== '미정' ? e.value : f.key === 'targetProduct' ? '미정 · 비슷하게 가고 싶은 제품명을 입력해 주세요' : '미정 · 근거가 부족해 아직 정하지 않았어요'}</div>
          ) : f.multi && values.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {values.map((v) => (
                <span key={v} className="rounded-full bg-ink-50 px-2.5 py-1 text-[13px] text-ink-800">
                  {v}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[14px] leading-relaxed text-ink-900">{e.value}</div>
          )}

          {e.detail && !editing && !undecided && (
            <p data-testid="bp-detail" className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
              <span className={clsx('mr-1 text-[10px] font-semibold', bp.mode === 'ai' ? 'text-violet-700' : 'text-amber-700')}>{bp.mode === 'ai' ? 'AI 설명' : '데모 설명'}</span>
              {e.detail}
            </p>
          )}

          {e.review && !editing && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
              <AlertTriangle size={13} /> <b>재검토 필요</b> · {e.review}
              <span className="ml-auto flex gap-1.5">
                {!e.locked && (
                  <button type="button" onClick={() => actions.onRefresh([f.key])} className="rounded-md bg-white px-2 py-0.5 font-medium ring-1 ring-sky-200 hover:bg-sky-100">
                    갱신
                  </button>
                )}
                <button type="button" onClick={() => onChange(keepAsIs(bp, f.key))} className="rounded-md bg-white px-2 py-0.5 font-medium ring-1 ring-sky-200 hover:bg-sky-100">
                  그대로 유지
                </button>
              </span>
            </div>
          )}

          {why && !editing && (
            <div className="mt-2 rounded-lg bg-ink-50/70 px-3 py-2 text-[12px] leading-relaxed text-ink-800">
              <div className="flex items-start gap-1.5">
                <Lightbulb size={13} className="mt-0.5 shrink-0 text-champagne-700" />
                <div>
                  <b>{e.origin === 'USER_PROVIDED' ? '근거' : '추천 이유'}</b> · {e.reason || '설명 없음'}
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    신뢰도 {Math.round(e.confidence * 100)}% (생성기 자체 평가, 검증 아님) · 출처: {e.sourceReferences.length ? e.sourceReferences.join(', ') : bp.mode === 'ai' ? 'AI 일반 지식 (출처 없음)' : '데모 규칙 (출처 없음)'}
                  </div>
                  {e.previous && e.previous.length > 0 && <div className="mt-0.5 text-[11px] text-slate-500">이전 값: {e.previous.join(' → ')}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-col sm:items-stretch">
            <RowButton
              onClick={() => {
                setDraft(undecided ? '' : e.value);
                setEditing(true);
              }}
              icon={<Pencil size={12} />}
            >
              수정
            </RowButton>
            {e.origin !== 'USER_PROVIDED' && (
              <RowButton onClick={() => setWhy((w) => !w)} icon={<Lightbulb size={12} />} active={why}>
                추천 이유 보기
              </RowButton>
            )}
            {e.origin === 'USER_PROVIDED' && (
              <RowButton onClick={() => setWhy((w) => !w)} icon={<Lightbulb size={12} />} active={why}>
                근거 보기
              </RowButton>
            )}
            {e.locked ? (
              <RowButton onClick={() => onChange(setLocked(bp, f.key, false))} icon={<Unlock size={12} />} title="잠금을 풀면 다시 추천과 전체 다시 생성에서 바뀔 수 있어요">
                잠금 해제
              </RowButton>
            ) : (
              <RowButton onClick={() => actions.onRefresh([f.key])} icon={busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} disabled={busy}>
                다시 추천
              </RowButton>
            )}
          </div>
        )}
      </div>
      {e.locked && !editing && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400 sm:pl-48">
          <Lock size={10} /> 잠김 · 전체 다시 생성해도 유지돼요
        </div>
      )}
    </div>
  );
}

function RowButton({ onClick, icon, children, disabled, active, title }: { onClick: () => void; icon: ReactNode; children: ReactNode; disabled?: boolean; active?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx('flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition disabled:opacity-50', active ? 'bg-ink-900 text-white ring-ink-900' : 'text-ink-700 ring-ink-100 hover:bg-ink-50')}
    >
      {icon} {children}
    </button>
  );
}

export function RegulatoryTable({ bp }: { bp: Blueprint }) {
  if (!bp.regulatory.length) return <div className="px-5 py-4 text-xs text-slate-500">판매 국가가 정해지면 국가별 규제 확인 항목이 표시돼요.</div>;
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">국가별 규제 확인</div>
      <p className="mb-3 text-[11px] text-slate-500">공식 규제 자료로 확인된 경우에만 적합으로 표시합니다. 아직 연결된 규제 데이터가 없어 모든 국가가 "규제 확인 필요"예요.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead className="text-[11px] text-slate-500">
            <tr className="border-b border-ink-50">
              <th className="py-1.5 pr-3 font-semibold">국가</th>
              <th className="py-1.5 pr-3 font-semibold">상태</th>
              <th className="py-1.5 pr-3 font-semibold">확인할 사항</th>
              <th className="py-1.5 pr-3 font-semibold">제한 조건</th>
              <th className="py-1.5 pr-3 font-semibold">출처 · 확인일</th>
            </tr>
          </thead>
          <tbody>
            {bp.regulatory.map((r) => (
              <tr key={r.country} className="border-b border-ink-50 align-top">
                <td className="py-2 pr-3 font-medium text-ink-900">{r.country}</td>
                <td className="py-2 pr-3">
                  {r.status === 'VERIFIED' ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">공식 자료 확인</span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">규제 확인 필요</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-ink-800">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {r.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </td>
                <td className="py-2 pr-3 text-ink-800">{r.conditions.length ? r.conditions.map((x) => <div key={x}>{x} (확인 필요)</div>) : <span className="text-slate-400">미확인</span>}</td>
                <td className="py-2 pr-3 text-slate-500">{r.source ? `${r.source.title} · ${r.checkedAt}` : '미연결 · —'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GeneratingCard({ stage, ai, notice, elapsed }: { stage: 'connect' | 'generating' | 'validating' | 'done'; ai: { configured: boolean; model: string | null } | null; notice?: string; elapsed: number }) {
  const order = ['connect', 'generating', 'validating', 'done'];
  const at = order.indexOf(stage);
  const demo = !ai?.configured;
  const steps = [
    { id: 'connect', label: 'AI 서버 연결 확인', done: ai ? (ai.configured ? `연결됨 · ${ai.model}` : 'API Key 미설정 · Demo Mode') : at > 0 ? '연결 안 됨 · Demo Mode' : '' },
    { id: 'generating', label: demo && at > 0 ? '규칙 기반 Demo 초안 작성' : `AI가 ${BLUEPRINT_FIELDS.length}개 기획 항목 작성`, done: '' },
    { id: 'validating', label: '응답 구조 검증 (JSON Schema)', done: '' },
  ];
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <Loader2 size={16} className="animate-spin" /> AI 제품 기획 초안을 만들고 있어요 <span className="text-xs text-slate-400">{elapsed}초</span>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const state = at > i ? 'done' : at === i ? 'active' : 'todo';
          return (
            <li key={s.id} className="flex items-center gap-2 text-[13px]">
              {state === 'done' ? <Check size={14} className="text-emerald-600" /> : state === 'active' ? <Loader2 size={14} className="animate-spin text-ink-700" /> : <span className="h-3.5 w-3.5 rounded-full border border-ink-200" />}
              <span className={clsx(state === 'todo' ? 'text-slate-400' : 'text-ink-900')}>{s.label}</span>
              {s.done && <span className="text-xs text-slate-500">{s.done}</span>}
            </li>
          );
        })}
      </ol>
      {notice && <div className="mt-3 text-xs text-amber-800">{notice}</div>}
      {!demo && stage === 'generating' && <p className="mt-3 text-[11px] text-slate-400">실제 AI 모델이 작성 중이라 수십 초가 걸릴 수 있어요.</p>}
    </Card>
  );
}
