import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, Loader2, Pencil, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { CLARIFY_QUESTIONS } from '@/data/mock';
import type { ClarifyAnswer, ClarifyQuestion, Intake, IntakeKey } from '@/data/types';
import { Button, Card, KindBadge } from '@/components/ui';
import { analyzeIdea, EXAMPLE_IDEA, INTAKE_LABELS } from '@/lib/intake';
import { useProjects } from '@/state/ProjectStore';

const FLOW = ['시장조사', '경쟁제품', '소비자 니즈', '트렌드', '제품 컨셉', '제형·원료', '패키지', '원가', '규제·시험', '개발 일정', '개발의뢰서'];

export default function Home() {
  const navigate = useNavigate();
  const { create, projects } = useProjects();
  const [idea, setIdea] = useState('');
  const [phase, setPhase] = useState<'input' | 'analyzing' | 'result'>('input');
  const [result, setResult] = useState<{ intake: Intake; productName: string } | null>(null);
  const [editing, setEditing] = useState<IntakeKey | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<ClarifyQuestion['id'], ClarifyAnswer>>>({});

  const analyze = (text = idea) => {
    const t = text.trim() || EXAMPLE_IDEA;
    setIdea(t);
    setPhase('analyzing');
    // Demo Mode: rule-based analysis with a short delay to mimic the AI step.
    window.setTimeout(() => {
      setResult(analyzeIdea(t));
      setPhase('result');
    }, 1100);
  };

  const setField = (key: IntakeKey, value: string) => setResult((r) => (r ? { ...r, intake: { ...r.intake, [key]: { value, kind: 'USER_INPUT' } } } : r));

  const start = () => {
    if (!result) return;
    const p = create({ name: result.productName, idea, intake: result.intake, answers });
    navigate(`/projects/${p.id}/overview`);
  };

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,#efe7f7_0%,rgba(250,248,245,0)_70%)]" />
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

      {phase === 'result' && result && (
        <section className="mx-auto max-w-5xl space-y-6 px-4 pb-24">
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
                <ClarifyCard key={q.id} q={q} answer={answers[q.id]} onChange={(a) => setAnswers((s) => ({ ...s, [q.id]: a }))} />
              ))}
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
