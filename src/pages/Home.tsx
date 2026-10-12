import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, Pencil, Sparkles, Wand2 } from 'lucide-react';
import type { Intake, IntakeKey, Spec, SpecAnswer, SpecFieldId } from '@/data/types';
import { SPEC_GROUPS } from '@/data/intakeSpec';
import { Button, Card, KindBadge } from '@/components/ui';
import { BlueprintSummary } from '@/components/intake/BlueprintSummary';
import { IntakeGroup, WizardStepper } from '@/components/intake/IntakeWizard';
import { analyzeIdea, EXAMPLE_IDEA, INTAKE_LABELS } from '@/lib/intake';
import { initialSpec } from '@/lib/spec';
import { useProjects } from '@/state/ProjectStore';

const FLOW = ['시장조사', '경쟁제품', '소비자 니즈', '트렌드', '제품 컨셉', '제형·원료', '패키지', '원가', '규제·시험', '개발 일정', '개발의뢰서'];

/**
 * Work in progress before a project exists. Kept in localStorage so going back,
 * moving between wizard steps or reloading never loses what was typed.
 */
const DRAFT_KEY = 'cad.draft.v1';
interface Draft {
  idea: string;
  result: { intake: Intake; productName: string } | null;
  spec: Spec;
}
function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null;
    const result = d?.result && typeof d.result.productName === 'string' && d.result.intake && typeof d.result.intake === 'object' ? d.result : null;
    return { idea: typeof d?.idea === 'string' ? d.idea : '', result, spec: d?.spec && typeof d.spec === 'object' ? d.spec : {} };
  } catch {
    return { idea: '', result: null, spec: {} };
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
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(initial.result);
  const [spec, setSpec] = useState<Spec>(initial.spec);
  const [editing, setEditing] = useState<IntakeKey | null>(null);

  // Wizard position lives in the URL (?intake=1..6 | summary) so the browser back button moves between steps.
  const raw = params.get('intake');
  const step: number | 'summary' | null = !result || !raw ? null : raw === 'summary' ? 'summary' : Math.min(SPEC_GROUPS.length, Math.max(1, Number(raw) || 1));
  const focusField = params.get('field');

  useEffect(() => {
    saveDraft(idea || result ? { idea, result, spec } : null);
  }, [idea, result, spec]);

  useEffect(() => {
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

  const analyze = (text = idea) => {
    const t = text.trim() || EXAMPLE_IDEA;
    setIdea(t);
    setAnalyzing(true);
    // Demo Mode: rule-based analysis with a short delay to mimic the AI step.
    window.setTimeout(() => {
      const r = analyzeIdea(t);
      setResult(r);
      setSpec(initialSpec(r.intake));
      setAnalyzing(false);
      go(1);
    }, 1100);
  };

  const setField = (key: IntakeKey, value: string) => setResult((r) => (r ? { ...r, intake: { ...r.intake, [key]: { value, kind: 'USER_INPUT' } } } : r));
  const setAnswer = (id: SpecFieldId, a: SpecAnswer | undefined) =>
    setSpec((s) => {
      const next = { ...s };
      if (a) next[id] = a;
      else delete next[id];
      return next;
    });
  const ctx = useMemo(() => ({ idea, intake: result?.intake ?? analyzeIdea(EXAMPLE_IDEA).intake, spec }), [idea, result, spec]);

  const start = () => {
    if (!result) return;
    const p = create({ name: result.productName, idea, intake: result.intake, spec });
    saveDraft(null);
    navigate(`/projects/${p.id}/overview`);
  };

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,#efe7f7_0%,rgba(250,248,245,0)_70%)]" />
      {step === null && (
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
            <Button variant="primary" onClick={() => analyze()} disabled={analyzing}>
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} 분석하기
            </Button>
          </div>
        </Card>

        {step === null && !analyzing && (
          <div className="mt-8 flex flex-wrap justify-center gap-1.5">
            {FLOW.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-ink-100">{s}</span>
                {i < FLOW.length - 1 && <span className="text-ink-200">›</span>}
              </span>
            ))}
          </div>
        )}
        {!analyzing && result && (
          <button type="button" onClick={() => go(1)} className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm text-ink-800 ring-1 ring-ink-100 hover:ring-ink-300">
            작성 중인 상세 기획 이어서 입력하기 <ArrowRight size={14} />
          </button>
        )}
      </section>
      )}

      {analyzing && (
        <section className="mx-auto max-w-4xl px-4 pb-20">
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-700">
              <Loader2 size={16} className="animate-spin" /> AI가 요구사항을 분석하고 있어요
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-ink-50" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </Card>
        </section>
      )}

      {step !== null && result && (
        <section className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-8 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI PRODUCT DEVELOPMENT INTAKE</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{result.productName}</h1>
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-500">“{idea}”</p>
            </div>
            <Button variant="ghost" onClick={() => setParams({})}>
              <Pencil size={13} /> 아이디어 다시 입력
            </Button>
          </div>

          <Card className="p-2 sm:p-3">
            <WizardStepper current={step} spec={spec} onJump={(n) => go(n)} />
          </Card>

          {step === 1 && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-50 bg-ink-50/50 px-6 py-4">
                <div>
                  <div className="text-[11px] font-bold tracking-[0.18em] text-champagne-700">AI 요구사항 분석 결과</div>
                  <div className="mt-0.5 text-[13px] text-slate-500">아이디어 문장에서 찾은 기본 조건이에요. 눌러서 고칠 수 있어요.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <KindBadge kind="AI_ANALYSIS" /> 입력에서 찾은 값
                  <KindBadge kind="AI_ESTIMATE" /> 입력에 없어 AI가 추천한 값
                </div>
              </div>
              <div className="grid gap-px bg-ink-50 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.keys(INTAKE_LABELS) as IntakeKey[]).map((k) => {
                  const f = result.intake[k];
                  return (
                    <div key={k} className="group bg-white px-5 py-3">
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
                          className="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1 text-sm text-ink-900 outline-none focus:border-ink-500"
                        />
                      ) : (
                        <button type="button" onClick={() => setEditing(k)} className="mt-1 flex w-full items-center gap-2 text-left text-sm font-medium text-ink-900">
                          {f.value}
                          <Pencil size={12} className="text-slate-300 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

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
                prevLabel={step === 1 ? '아이디어 입력으로' : `이전 · ${SPEC_GROUPS[step - 2].label}`}
                onPrev={() => (step === 1 ? setParams({}) : go(step - 1))}
                onNext={() => go(step === SPEC_GROUPS.length ? 'summary' : step + 1)}
                onSummary={focusField ? () => go('summary') : undefined}
              />
            )}
          </Card>
        </section>
      )}

      {step === null && !analyzing && projects.length > 0 && (
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
    </main>
  );
}
