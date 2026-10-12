import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, HelpCircle, Lightbulb, PencilLine, Plus, Search, Sparkles, X } from 'lucide-react';
import { fieldsOf, MARKETS, marketLabel, SLIDER_LABELS, SPEC_GROUPS, type SpecCtx, type SpecField, type SpecOption } from '@/data/intakeSpec';
import type { Spec, SpecAnswer, SpecFieldId, SpecGroupId } from '@/data/types';
import { answerKind, isSet } from '@/lib/spec';
import { Button, Card, KindBadge } from '../ui';

type SetAnswer = (id: SpecFieldId, a: SpecAnswer | undefined) => void;

// ── stepper ─────────────────────────────────────────────────────────────────

export function WizardStepper({ current, spec, onJump }: { current: number | 'summary'; spec: Spec; onJump: (n: number | 'summary') => void }) {
  const nav = useRef<HTMLElement>(null);
  // On narrow screens the step list scrolls sideways: keep the current step in view.
  useEffect(() => {
    const el = nav.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="step"]') ?? (current === 'summary' ? el?.querySelector<HTMLElement>('li:last-child') : null);
    if (el && active) {
      el.scrollLeft = active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2;
    }
  }, [current]);
  return (
    <nav ref={nav} aria-label="상세 기획 단계" className="no-scrollbar relative -mx-4 overflow-x-auto px-4">
      <ol className="flex min-w-max items-center gap-1.5 sm:min-w-0 sm:justify-between">
        {SPEC_GROUPS.map((g, i) => {
          const fields = fieldsOf(g.id);
          const answered = fields.filter((f) => spec[f.id]).length;
          const active = current === g.no;
          const done = current === 'summary' || (typeof current === 'number' && g.no < current);
          return (
            <li key={g.id} className="flex items-center gap-1.5 sm:flex-1">
              <button
                type="button"
                onClick={() => onJump(g.no)}
                aria-current={active ? 'step' : undefined}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition',
                  active ? 'bg-ink-900 text-white' : 'text-ink-800 hover:bg-ink-50',
                )}
              >
                <span
                  className={clsx(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                    active ? 'bg-champagne-500 text-ink-900' : done ? 'bg-ink-100 text-ink-800' : 'bg-white text-slate-500 ring-1 ring-inset ring-ink-100',
                  )}
                >
                  {done && !active ? <Check size={12} /> : g.no}
                </span>
                <span className="min-w-0">
                  <span className={clsx('block text-[10px] font-bold tracking-[0.14em]', active ? 'text-champagne-300' : 'text-slate-400')}>STEP {g.no}</span>
                  <span className="block text-[13px] font-semibold leading-tight">{g.label}</span>
                </span>
                <span className={clsx('ml-auto hidden text-[10px] tabular-nums lg:inline', active ? 'text-ink-200' : 'text-slate-400')}>
                  {answered}/{fields.length}
                </span>
              </button>
              {i < SPEC_GROUPS.length - 1 && <span className="hidden h-px w-3 shrink-0 bg-ink-100 sm:block" />}
            </li>
          );
        })}
        <li className="flex items-center sm:flex-none">
          <button
            type="button"
            onClick={() => onJump('summary')}
            className={clsx('rounded-xl px-3 py-2 text-[13px] font-semibold transition', current === 'summary' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-50')}
          >
            요약
          </button>
        </li>
      </ol>
    </nav>
  );
}

// ── wizard page for one group ───────────────────────────────────────────────

export function IntakeGroup({
  group,
  spec,
  ctx,
  setAnswer,
  onPrev,
  onNext,
  onSummary,
  prevLabel,
}: {
  group: SpecGroupId;
  spec: Spec;
  ctx: SpecCtx;
  setAnswer: SetAnswer;
  onPrev: () => void;
  onNext: () => void;
  onSummary?: () => void;
  prevLabel: string;
}) {
  const g = SPEC_GROUPS.find((x) => x.id === group)!;
  const fields = fieldsOf(group);
  const [tried, setTried] = useState(false);
  const missing = fields.filter((f) => f.required && !isSet(spec[f.id]));
  const next = () => {
    if (missing.length) {
      setTried(true);
      document.getElementById(`field-${missing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onNext();
  };
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">
            STEP {g.no} · {g.en.toUpperCase()}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-ink-900">{g.desc}</h2>
          <p className="mt-1 text-xs text-slate-500">
            <b className="text-ink-700">필수</b> 표시가 없는 항목은 비워 두고 넘어가도 돼요. 모르는 항목은 "잘 모르겠어요"를 누르면 이후 단계에서 미정으로 다룹니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <FieldCard key={f.id} field={f} answer={spec[f.id]} spec={spec} ctx={ctx} setAnswer={setAnswer} error={tried && f.required && !isSet(spec[f.id])} />
        ))}
      </div>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={onPrev}>
          <ArrowLeft size={14} /> {prevLabel}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {onSummary && (
            <Button onClick={onSummary}>
              요약으로 돌아가기
            </Button>
          )}
          {missing.length > 0 && tried && <span className="text-xs text-rose-600">필수 항목 {missing.map((m) => m.label).join(', ')}을(를) 입력해 주세요.</span>}
          <Button variant="primary" className="px-5" onClick={next}>
            {g.no === SPEC_GROUPS.length ? '입력 조건 요약 보기' : `다음 · ${SPEC_GROUPS[g.no].label}`} <ArrowRight size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── one question ────────────────────────────────────────────────────────────

function FieldCard({ field, answer, spec, ctx, setAnswer, error }: { field: SpecField; answer?: SpecAnswer; spec: Spec; ctx: SpecCtx; setAnswer: SetAnswer; error?: boolean }) {
  const [custom, setCustom] = useState(false);
  const mode = answer?.mode;
  const kind = answerKind(answer);
  const value = answer && answer.mode !== 'unknown' ? answer.value : [];
  const setUser = (v: string[]) => setAnswer(field.id, v.length ? { mode: 'user', value: v } : undefined);
  const recommend = () => {
    const r = field.demo(ctx);
    setAnswer(field.id, { mode: 'ai', value: r.value, reason: r.reason });
    setCustom(false);
  };
  // Priority market: choose among the markets picked above when there are any.
  const options =
    field.id === 'priorityMarket' && (spec.markets?.value.length ?? 0) > 0 ? MARKETS.filter((m) => spec.markets!.value.includes(m.value)) : field.options ?? [];

  return (
    <div id={`field-${field.id}`} className={clsx('scroll-mt-28 rounded-xl border bg-white p-4 transition', error ? 'border-rose-300 ring-2 ring-rose-100' : isSet(answer) ? 'border-ink-200' : 'border-ink-100')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink-900">
            {field.label}
            {field.required && <span className="rounded bg-ink-900 px-1.5 py-px text-[10px] font-bold text-white">필수</span>}
          </div>
          {field.hint && <div className="mt-0.5 text-[11px] text-slate-500">{field.hint}</div>}
        </div>
        {kind ? (
          <KindBadge kind={kind} />
        ) : mode === 'unknown' ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">미정</span>
        ) : null}
      </div>

      <div className="mt-3">
        {field.input === 'markets' ? (
          <MarketSelect value={value} onChange={setUser} />
        ) : field.input === 'slider' ? (
          <SliderInput labels={SLIDER_LABELS[field.id] ?? []} value={value[0]} onChange={(v) => setUser([v])} />
        ) : field.input === 'text' ? (
          <input
            value={value.join(', ')}
            onChange={(e) => setAnswer(field.id, e.target.value ? { mode: 'user', value: [e.target.value] } : undefined)}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-ink-400"
            aria-label={field.label}
          />
        ) : field.input === 'tags' ? (
          <TagInput value={value} onChange={setUser} placeholder={field.placeholder} label={field.label} />
        ) : (
          <ChipSelect
            options={options}
            multi={field.input === 'multi'}
            value={value}
            onChange={setUser}
            custom={custom && !!field.allowCustom}
            label={field.label}
          />
        )}
      </div>

      {mode === 'ai' && answer?.reason && (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          <Lightbulb size={14} className="mt-0.5 shrink-0" />
          <div>
            <b>데모 추천 이유</b> · {answer.reason}
            <div className="mt-0.5 text-[11px] text-amber-800/80">실제 AI가 아닌 규칙 기반 데모 추천이며, 검증된 시장조사 결과가 아닌 가설입니다.</div>
          </div>
        </div>
      )}
      {mode === 'unknown' && <div className="mt-3 text-[12px] text-slate-500">이후 분석 단계에서 미정으로 표시하고 AI 분석 결과(데모)로 후보를 제안합니다.</div>}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-50 pt-3">
        <ModeButton
          active={mode === 'user'}
          onClick={() => {
            if (field.allowCustom) setCustom((c) => !c);
            if (answer && answer.mode !== 'user' && answer.mode !== 'unknown') setAnswer(field.id, { mode: 'user', value: answer.value });
            if (field.input === 'text' || field.input === 'tags') document.querySelector<HTMLInputElement>(`#field-${field.id} input`)?.focus();
          }}
          icon={<PencilLine size={11} />}
        >
          직접 입력
        </ModeButton>
        <ModeButton active={mode === 'unknown'} onClick={() => setAnswer(field.id, mode === 'unknown' ? undefined : { mode: 'unknown', value: [] })} icon={<HelpCircle size={11} />}>
          잘 모르겠어요
        </ModeButton>
        <ModeButton active={mode === 'ai'} onClick={recommend} icon={<Sparkles size={11} />}>
          데모 추천
        </ModeButton>
        {answer && (
          <button type="button" onClick={() => setAnswer(field.id, undefined)} className="ml-auto text-[11px] text-slate-400 hover:text-ink-700">
            지우기
          </button>
        )}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition', active ? 'bg-ink-900 text-white ring-ink-900' : 'text-ink-600 ring-ink-100 hover:bg-ink-50')}
    >
      {icon} {children}
    </button>
  );
}

// ── inputs ──────────────────────────────────────────────────────────────────

function ChipSelect({ options, multi, value, onChange, custom, label }: { options: SpecOption[]; multi: boolean; value: string[]; onChange: (v: string[]) => void; custom: boolean; label: string }) {
  const [draft, setDraft] = useState('');
  const extra = value.filter((v) => !options.some((o) => o.value === v));
  const toggle = (v: string) => onChange(multi ? (value.includes(v) ? value.filter((x) => x !== v) : [...value, v]) : value[0] === v ? [] : [v]);
  const addCustom = () => {
    const v = draft.trim();
    if (!v) return;
    onChange(multi ? [...value.filter((x) => x !== v), v] : [v]);
    setDraft('');
  };
  return (
    <div>
      <div role={multi ? 'group' : 'radiogroup'} aria-label={label} className="flex flex-wrap gap-1.5">
        {[...options, ...extra.map((v) => ({ value: v, label: v }))].map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => toggle(o.value)}
              className={clsx(
                'flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] ring-1 ring-inset transition',
                on ? 'bg-ink-800 font-medium text-white ring-ink-800' : 'bg-white text-ink-700 ring-ink-100 hover:ring-ink-300',
              )}
            >
              {on && multi && <Check size={12} />}
              {o.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <div className="mt-2 flex gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="직접 입력 후 Enter"
            aria-label={`${label} 직접 입력`}
            className="min-w-0 flex-1 rounded-lg border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-ink-400"
          />
          <Button onClick={addCustom} className="px-2.5 py-1.5">
            <Plus size={14} /> 추가
          </Button>
        </div>
      )}
    </div>
  );
}

function TagInput({ value, onChange, placeholder, label }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; label: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const items = draft
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!items.length) return;
    onChange([...value, ...items.filter((x) => !value.includes(x))]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-100 px-2 py-1.5 focus-within:border-ink-400">
      {value.map((v) => (
        <span key={v} className="flex items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-[13px] text-ink-800">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${v} 삭제`} className="text-slate-400 hover:text-ink-800">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        aria-label={label}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
      />
    </div>
  );
}

function SliderInput({ labels, value, onChange }: { labels: string[]; value?: string; onChange: (v: string) => void }) {
  const idx = value ? labels.indexOf(value) : -1;
  return (
    <div>
      <input
        type="range"
        min={0}
        max={labels.length - 1}
        step={1}
        value={idx < 0 ? Math.floor(labels.length / 2) : idx}
        onChange={(e) => onChange(labels[Number(e.target.value)])}
        aria-valuetext={idx < 0 ? '미정' : labels[idx]}
        className={clsx('w-full accent-ink-800', idx < 0 && 'opacity-40')}
      />
      <div className="mt-1 flex justify-between gap-1 text-[10px] text-slate-500">
        {labels.map((l, i) => (
          <button key={l} type="button" onClick={() => onChange(l)} className={clsx('flex-1 text-center leading-tight', i === idx && 'font-semibold text-ink-900', i === 0 && 'text-left', i === labels.length - 1 && 'text-right')}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-2 text-sm font-medium text-ink-900">{idx < 0 ? <span className="text-slate-400">슬라이더를 움직여 선택하세요</span> : labels[idx]}</div>
    </div>
  );
}

function MarketSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const found = MARKETS.filter((m) => !value.includes(m.value) && (m.label.includes(q.trim()) || m.value.toLowerCase().includes(q.trim().toLowerCase())));
  const add = (v: string) => {
    onChange([...value, v]);
    setQ('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-ink-800 px-3 py-1.5 text-[13px] font-medium text-white">
            {marketLabel(v)}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${marketLabel(v)} 삭제`} className="text-ink-200 hover:text-white">
              <X size={12} />
            </button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen((x) => !x)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] border border-dashed border-ink-200 text-ink-700 hover:bg-ink-50">
          <Plus size={13} /> 국가 추가
        </button>
      </div>
      {open && (
        <Card className="mt-2 p-2">
          <div className="flex items-center gap-2 rounded-lg bg-ink-50/60 px-2.5 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && found[0]) {
                  e.preventDefault();
                  add(found[0].value);
                }
              }}
              placeholder="국가 검색 (예: 미국, CN)"
              aria-label="판매 국가 검색"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 p-1">
            {found.map((m) => (
              <button key={m.value} type="button" onClick={() => add(m.value)} className="rounded-full px-3 py-1.5 text-[13px] text-ink-800 ring-1 ring-inset ring-ink-100 hover:bg-ink-50">
                {m.label} <span className="text-[10px] text-slate-400">{m.value}</span>
              </button>
            ))}
            {!found.length && <span className="px-1 py-1 text-xs text-slate-500">일치하는 국가가 없어요.</span>}
          </div>
        </Card>
      )}
      {value.length >= 2 && (
        <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-[12px] text-sky-900">선택한 모든 판매 국가의 규제 조건을 고려하여 원료와 제품 개발 방향을 추천합니다. 국가별 규제 데이터는 아직 연결되지 않아 "확인 필요"로 표시됩니다.</div>
      )}
    </div>
  );
}
