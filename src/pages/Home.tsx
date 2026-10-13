import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Loader2, Pencil, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { CLARIFY_QUESTIONS } from '@/data/mock';
import { SPEC_FIELDS, SPEC_GROUPS } from '@/data/intakeSpec';
import type { Blueprint, ClarifyAnswer, ClarifyQuestion, Intake, IntakeKey, Spec, SpecAnswer, SpecFieldId } from '@/data/types';
import { Button, Card, KindBadge } from '@/components/ui';
import { BlueprintSummary } from '@/components/intake/BlueprintSummary';
import { GeneratingCard } from '@/components/blueprint/BlueprintReview';
import { CompactBlueprintEditor } from '@/components/blueprint/CompactBlueprintEditor';
import { BlueprintEvidence } from '@/components/market/RealEvidence';
import { blueprintToIntake, blueprintToSpec, generateBlueprint, readBlueprint, refreshEntries, regenerateBlueprint, type GenProgress } from '@/lib/blueprint';
import { IntakeGroup, WizardStepper } from '@/components/intake/IntakeWizard';
import { analyzeIdea, EXAMPLE_IDEA, INTAKE_LABELS } from '@/lib/intake';
import { initialSpec, isSet, specFromAnswers, specToAnswers } from '@/lib/spec';
import { useProjects } from '@/state/ProjectStore';

const FLOW = ['시장조사', '경쟁제품', '소비자 니즈', '트렌드', '제품 컨셉', '제형·원료', '패키지', '원가', '규제·시험', '개발 일정', '개발의뢰서'];

type Answers = Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>>;

/**
 * Work in progress before a project exists (idea, analysis, the 7 answers and the optional
 * detailed intake). Kept in localStorage so going back, moving between wizard steps or
 * reloading never loses what was typed.
 */
const DRAFT_KEY = 'cad.draft.v1';
interface Draft {
  idea: string;
  result: { intake: Intake; productName: string } | null;
  answers: Answers;
  spec: Spec;
  /** AI Product Blueprint draft (the default screen after "분석하기") */
  blueprint?: Blueprint;
  /** which screen was open: the blueprint review or the classic analysis + questions */
  view?: 'blueprint' | 'classic';
}
function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null;
    const result = d?.result && typeof d.result.productName === 'string' && d.result.intake && typeof d.result.intake === 'object' ? d.result : null;
    const obj = <T,>(v: unknown, fallback: T) => (v && typeof v === 'object' ? (v as T) : fallback);
    return { idea: typeof d?.idea === 'string' ? d.idea : '', result, answers: obj<Answers>(d?.answers, {}), spec: obj<Spec>(d?.spec, {}), blueprint: result ? readBlueprint(d?.blueprint) : undefined, view: d?.view === 'classic' ? 'classic' : 'blueprint' };
  } catch {
    return { idea: '', result: null, answers: {}, spec: {} };
  }
}
function saveDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export default function Home() {
  const navigate = useNavigate();
  const { create, projects } = useProjects();
  const [params, setParams] = useSearchParams();
  const [initial] = useState(loadDraft);
  const [idea, setIdea] = useState(initial.idea);
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'result' | 'blueprint'>(initial.result ? (initial.blueprint && initial.view !== 'classic' ? 'blueprint' : 'result') : 'input');
  const [blueprint, setBlueprint] = useState<Blueprint | undefined>(initial.blueprint);
  const [progress, setProgress] = useState<GenProgress>({ stage: 'connect', ai: null });
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<{ intake: Intake; productName: string } | null>(initial.result);
  const [editing, setEditing] = useState<IntakeKey | null>(null);
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [spec, setSpec] = useState<Spec>(initial.spec);

  // Optional detailed intake. Its position lives in the URL (?intake=1..6 | summary) so the browser back button moves between steps.
  const raw = params.get('intake');
  const step: number | 'summary' | null = !result || !raw || phase === 'analyzing' ? null : raw === 'summary' ? 'summary' : Math.min(SPEC_GROUPS.length, Math.max(1, Number(raw) || 1));
  const focusField = params.get('field');

  useEffect(() => {
    saveDraft(idea || result ? { idea, result, answers, spec, blueprint, view: phase === 'result' ? 'classic' : 'blueprint' } : null);
  }, [idea, result, answers, spec, blueprint, phase]);

  // elapsed seconds while the blueprint is being generated (shown on the progress card)
  useEffect(() => {
    if (phase !== 'analyzing') return;
    setElapsed(0);
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      window.clearInterval(t);
    };
  }, [phase]);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (step === null) return;
    if (focusField) {
      document.getElementById(`field-${focusField}`)?.scrollIntoView({ block: 'center' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [step, focusField]);

  const go = (n: number | 'summary', field?: SpecFieldId) => {
    const next = new URLSearchParams({ intake: String(n) });
    if (field) next.set('field', field);
    setParams(next);
  };

  // The 7 questions above and the matching wizard questions are the same answers: keep both in sync.
  const setClarify = (id: ClarifyQuestion['id'], a: ClarifyAnswer) => {
    setAnswers((s) => ({ ...s, [id]: a }));
    const field = SPEC_FIELDS.find((f) => f.legacy === id);
    if (field) setSpec((s) => ({ ...s, [field.id]: specFromAnswers({ [id]: a })[field.id] }));
  };
  const setAnswer = (id: SpecFieldId, a: SpecAnswer | undefined) => {
    setSpec((s) => {
      const next = { ...s };
      if (a) next[id] = a;
      else delete next[id];
      return next;
    });
    const legacy = SPEC_FIELDS.find((f) => f.id === id)?.legacy;
    if (legacy)
      setAnswers((s) => {
        const next = { ...s };
        const mapped = a ? specToAnswers({ [id]: a })[legacy] : undefined;
        if (mapped) next[legacy] = mapped;
        else delete next[legacy];
        return next;
      });
  };
  const ctx = useMemo(() => ({ idea, intake: result?.intake ?? analyzeIdea(EXAMPLE_IDEA).intake, spec }), [idea, result, spec]);
  const detailCount = SPEC_FIELDS.filter((f) => !f.legacy && isSet(spec[f.id]) && spec[f.id]?.mode !== 'idea').length;

  // "분석하기": the AI (or the labeled Demo Mode) writes the whole Product Blueprint first; the user then reviews it.
  const analyze = async (text = idea) => {
    const t = text.trim() || EXAMPLE_IDEA;
    setIdea(t);
    setPhase('analyzing');
    const r = analyzeIdea(t);
    setResult(r);
    setAnswers({});
    setSpec(initialSpec(r.intake));
    const bp = await generateBlueprint(t, setProgress);
    setBlueprint(bp);
    setPhase('blueprint');
    window.scrollTo(0, 0);
  };

  const refresh = async (keys: string[]) => {
    if (!blueprint) return;
    setBusy(new Set(keys));
    const { bp, error, keys: changed } = await refreshEntries(blueprint, keys);
    // keep edits made while the suggestion was loading: only the refreshed keys are taken from the answer
    setBlueprint((cur) => (cur ? { ...cur, entries: { ...cur.entries, ...Object.fromEntries(changed.filter((k) => !cur.entries[k]?.locked).map((k) => [k, bp.entries[k]])) }, regulatory: bp.regulatory } : bp));
    setBusy(new Set());
    if (error) flash(error);
  };

  const regenerate = async (keepLocked: boolean) => {
    if (!blueprint) return;
    setPhase('analyzing');
    const bp = await regenerateBlueprint(blueprint, keepLocked, setProgress);
    setBlueprint(bp);
    setPhase('blueprint');
  };

  const startFromBlueprint = () => {
    if (!blueprint || !result) return;
    const confirmed = { ...blueprint, confirmedAt: new Date().toISOString() };
    const s = blueprintToSpec(confirmed);
    const p = create({ name: confirmed.productName, idea, intake: blueprintToIntake(confirmed, result.intake), answers: specToAnswers(s), spec: s, blueprint: confirmed });
    saveDraft(null);
    navigate(`/projects/${p.id}/overview`);
  };

  const setField = (key: IntakeKey, value: string) => setResult((r) => (r ? { ...r, intake: { ...r.intake, [key]: { value, kind: 'USER_INPUT' } } } : r));

  const start = () => {
    if (!result) return;
    const p = create({ name: result.productName, idea, intake: result.intake, answers, spec });
    saveDraft(null);
    navigate(`/projects/${p.id}/overview`);
  };

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,#efe7f7_0%,rgba(250,248,245,0)_70%)]" />
      {step === null && (
        <>
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-16 text-center sm:pt-24">
        <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-ink-100 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-wider text-ink-600">
          <Sparkles size={12} className="text-champagne-500" /> AI PRODUCT DEVELOPER
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">어떤 화장품을 만들고 싶으세요?</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:text-base">
          아이디어를 자연어로 적어 주세요. 시장조사부터 제조사에 전달할 제품개발의뢰서까지 AI가 함께 설계합니다.
        </p>

        <Card className="mt-8 p-2 text-left">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze();
            }}
            rows={3}
            placeholder={`예: ${EXAMPLE_IDEA}`}
            className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-[15px] leading-relaxed text-ink-900 outline-none placeholder:text-slate-400"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-50 px-2 pt-2">
            <button type="button" onClick={() => analyze(EXAMPLE_IDEA)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
              <Wand2 size={13} /> 예시로 체험하기
            </button>
            <Button variant="primary" onClick={() => analyze()} disabled={phase === 'analyzing'}>
              {phase === 'analyzing' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} 분석하기
            </Button>
          </div>
        </Card>

        {phase === 'input' && (
          <div className="mt-8 flex flex-wrap justify-center gap-1.5">
            {FLOW.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-ink-100">{s}</span>
                {i < FLOW.length - 1 && <span className="text-ink-200">›</span>}
              </span>
            ))}
          </div>
        )}
      </section>

      {phase === 'analyzing' && (
        <section className="mx-auto max-w-4xl px-4 pb-20">
          <GeneratingCard stage={progress.stage} ai={progress.ai} notice={progress.notice} elapsed={elapsed} />
        </section>
      )}

      {phase === 'blueprint' && blueprint && (
        <section className="mx-auto max-w-5xl px-4 pb-24">
          <CompactBlueprintEditor
            bp={blueprint}
            onChange={setBlueprint}
            actions={{ busy, onRefresh: refresh, onRegenerate: regenerate }}
            footer={
              <div className="flex flex-col-reverse items-stretch justify-between gap-3 pt-2 sm:flex-row sm:items-center">
                <Button variant="ghost" onClick={() => setPhase('input')}>
                  <RotateCcw size={14} /> 아이디어 다시 입력
                </Button>
                <Button variant="primary" className="px-6 py-3 text-[15px]" onClick={startFromBlueprint} disabled={busy.size > 0}>
                  이 기획안으로 제품 개발 시작 <ArrowRight size={16} />
                </Button>
              </div>
            }
          />
          <BlueprintEvidence bp={blueprint} />
        </section>
      )}

      {phase === 'result' && result && (
        <section className="mx-auto max-w-5xl space-y-6 px-4 pb-24">
          {blueprint && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-champagne-300 bg-white px-4 py-3 text-[13px] text-ink-800">
              <span>기존 분석 결과와 질문 화면이에요. AI 제품 기획 초안은 그대로 저장되어 있어요.</span>
              <Button className="px-3 py-1.5 text-xs" onClick={() => setPhase('blueprint')}>
                <ArrowLeft size={13} /> AI 제품 기획 초안으로 돌아가기
              </Button>
            </div>
          )}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-50 bg-ink-50/50 px-6 py-4">
              <div>
                <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI 요구사항 분석 결과</div>
                <div className="mt-0.5 text-lg font-semibold text-ink-900">{result.productName}</div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <KindBadge kind="AI_ANALYSIS" /> 입력에서 찾은 값
                <KindBadge kind="AI_ESTIMATE" /> 입력에 없어 AI가 추천한 값
              </div>
            </div>
            <div className="grid gap-px bg-ink-50 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(INTAKE_LABELS) as IntakeKey[]).map((k) => {
                const f = result.intake[k];
                return (
                  <div key={k} className="group bg-white px-6 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {INTAKE_LABELS[k].en} <span className="normal-case tracking-normal text-slate-400">· {INTAKE_LABELS[k].ko}</span>
                      </div>
                      <KindBadge kind={f.kind} />
                    </div>
                    {editing === k ? (
                      <input
                        autoFocus
                        defaultValue={f.value}
                        onBlur={(e) => {
                          setField(k, e.target.value);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className="mt-1.5 w-full rounded-lg border border-ink-200 px-2 py-1 text-[15px] text-ink-900 outline-none focus:border-ink-500"
                      />
                    ) : (
                      <button type="button" onClick={() => setEditing(k)} className="mt-1.5 flex w-full items-center gap-2 text-left text-[15px] font-medium text-ink-900">
                        {f.value}
                        <Pencil size={12} className="text-slate-300 opacity-0 transition group-hover:opacity-100" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-1 text-[15px] font-semibold text-ink-900">조금 더 알려주시면 더 정확해져요</div>
            <p className="mb-5 text-xs text-slate-500">모르는 항목은 "잘 모르겠어요" 또는 "AI 추천"을 선택하세요. 언제든 나중에 수정할 수 있습니다.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {CLARIFY_QUESTIONS.map((q) => (
                <ClarifyCard key={q.id} q={q} answer={answers[q.id]} onChange={(a) => setClarify(q.id, a)} />
              ))}
            </div>
          </Card>

          <Card className="border-champagne-300 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-champagne-300">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink-900">
                    상세 기획 입력 <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold text-ink-600">선택 · 6단계</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    제품·타깃·제형·원료·상업 조건·판매 국가를 더 자세히 정하면 컨셉·제형·원료·패키지·원가·규제 분석에 반영돼요. 위에서 답한 내용은 자동으로 이어집니다.
                    {detailCount > 0 && <b className="ml-1 text-ink-800">현재 {detailCount}개 입력됨</b>}
                  </p>
                </div>
              </div>
              <Button className="shrink-0" onClick={() => go(1)}>
                {detailCount > 0 ? '상세 기획 이어서 입력' : '상세 기획 입력 시작'} <ArrowRight size={14} />
              </Button>
            </div>
          </Card>

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <Button variant="ghost" onClick={() => setPhase('input')}>
              <RotateCcw size={14} /> 아이디어 다시 입력
            </Button>
            <Button variant="primary" className="px-6 py-3 text-[15px]" onClick={start}>
              이 조건으로 제품 개발 시작 <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      )}

      {phase === 'input' && projects.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-20">
          <div className="mb-2 text-xs font-semibold tracking-wider text-slate-400">최근 프로젝트</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {projects.slice(0, 4).map((p) => (
              <button key={p.id} type="button" onClick={() => navigate(`/projects/${p.id}/overview`)} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3 text-left text-sm hover:border-ink-300">
                <span className="font-medium text-ink-900">{p.name}</span>
                <ArrowRight size={14} className="text-slate-400" />
              </button>
            ))}
          </div>
        </section>
      )}
        </>
      )}

      {step !== null && result && (
        <section className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-8 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI PRODUCT DEVELOPMENT INTAKE · 상세 기획</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{result.productName}</h1>
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-500">“{idea}”</p>
            </div>
            <Button variant="ghost" onClick={() => setParams({})}>
              <ArrowLeft size={14} /> 분석 결과로 돌아가기
            </Button>
          </div>

          <Card className="p-2 sm:p-3">
            <WizardStepper current={step} spec={spec} onJump={(n) => go(n)} />
          </Card>

          <Card className="p-5 sm:p-6">
            {step === 'summary' ? (
              <BlueprintSummary spec={spec} productName={result.productName} onEdit={(n, field) => go(n, field)} onBack={() => go(SPEC_GROUPS.length)} onStart={start} />
            ) : (
              <IntakeGroup
                key={step}
                group={SPEC_GROUPS[step - 1].id}
                spec={spec}
                ctx={ctx}
                setAnswer={setAnswer}
                prevLabel={step === 1 ? '분석 결과로' : `이전 · ${SPEC_GROUPS[step - 2].label}`}
                onPrev={() => (step === 1 ? setParams({}) : go(step - 1))}
                onNext={() => go(step === SPEC_GROUPS.length ? 'summary' : step + 1)}
                onSummary={focusField ? () => go('summary') : undefined}
              />
            )}
          </Card>
        </section>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </main>
  );
}

function ClarifyCard({ q, answer, onChange }: { q: ClarifyQuestion; answer?: ClarifyAnswer; onChange: (a: ClarifyAnswer) => void }) {
  const mode = answer?.mode;
  return (
    <div className={clsx('rounded-xl border p-4 transition', answer ? 'border-ink-200 bg-ink-50/40' : 'border-ink-100')}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-ink-900">
        {q.question}
        {answer && <Check size={14} className="text-emerald-600" />}
      </div>
      <input
        value={mode === 'user' ? answer?.value : ''}
        onChange={(e) => onChange({ mode: 'user', value: e.target.value })}
        placeholder={q.placeholder}
        className="mt-2 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm outline-none focus:border-ink-400"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange({ mode: 'unknown', value: '' })} className={clsx('rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', mode === 'unknown' ? 'bg-ink-900 text-white ring-ink-900' : 'text-slate-600 ring-ink-100 hover:bg-white')}>
          잘 모르겠어요
        </button>
        <button type="button" onClick={() => onChange({ mode: 'ai', value: q.aiRecommendation })} className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', mode === 'ai' ? 'bg-ink-900 text-white ring-ink-900' : 'text-ink-700 ring-ink-200 hover:bg-white')}>
          <Sparkles size={11} /> AI 추천
        </button>
      </div>
      {mode === 'ai' && <div className="mt-2 text-xs text-ink-700">AI 추천: {q.aiRecommendation} <KindBadge kind="AI_ESTIMATE" className="ml-1" /></div>}
      {mode === 'unknown' && <div className="mt-2 text-xs text-slate-500">이후 단계에서 AI가 분석 결과를 바탕으로 제안합니다.</div>}
    </div>
  );
}
