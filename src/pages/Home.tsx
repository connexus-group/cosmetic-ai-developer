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
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(55%_60%_at_50%_0%,#f4e6e9_0%,rgba(248,245,240,0)_70%)]" />
      <section className="mx-auto max-w-3xl px-4 pb-12 pt-20 text-center sm:pt-28">
        <div className="font-display text-[22px] italic text-wine-700">AI Product Developer</div>
        <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[52px]">어떤 화장품을 만들고 싶으세요?</h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-500 sm:text-[17px]">
          아이디어를 자연어로 적어 주세요. 시장조사부터 제조사에 전달할 제품개발의뢰서까지 AI가 함께 설계합니다.
        </p>

        <Card className="mt-10 p-2 text-left shadow-[0_1px_2px_rgba(28,25,23,0.04),0_12px_32px_-16px_rgba(81,32,49,0.18)]">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze();
            }}
            rows={3}
            placeholder={`예: ${EXAMPLE_IDEA}`}
            className="w-full resize-none rounded-lg bg-transparent px-4 py-4 text-base leading-relaxed text-ink-900 outline-none placeholder:text-ink-400"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-2 pt-2">
            <button type="button" onClick={() => analyze(EXAMPLE_IDEA)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-600 hover:bg-ink-50 hover:text-wine-700">
              <Wand2 size={13} /> 예시로 체험하기
            </button>
            <Button variant="primary" onClick={() => analyze()} disabled={phase === 'analyzing'}>
              {phase === 'analyzing' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} 분석하기
            </Button>
          </div>
        </Card>

        {phase === 'input' && (
          <div className="mt-12">
            <div className="text-[12px] text-ink-400">아이디어 하나로 이어지는 개발 과정</div>
            <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-x-1 gap-y-2">
              {FLOW.map((s, i) => (
                <span key={s} className="flex items-center gap-1 text-[13px] text-ink-500">
                  {s}
                  {i < FLOW.length - 1 && <span className="mx-1 h-px w-3 bg-ink-200" />}
                </span>
              ))}
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-6 sm:px-8">
              <div>
                <div className="text-[13px] font-medium text-wine-700">AI 요구사항 분석 결과</div>
                <div className="font-display mt-1 text-[36px] leading-tight text-ink-900">{result.productName}</div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-500">
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
                      <div className="text-[12px] font-medium text-ink-500">
                        {INTAKE_LABELS[k].en} <span className="normal-case tracking-normal text-ink-400">· {INTAKE_LABELS[k].ko}</span>
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
                        <Pencil size={12} className="text-ink-300 opacity-0 transition group-hover:opacity-100" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="mb-1 text-lg font-semibold text-ink-900">조금 더 알려주시면 더 정확해져요</div>
            <p className="mb-5 text-xs text-ink-500">모르는 항목은 "잘 모르겠어요" 또는 "AI 추천"을 선택하세요. 언제든 나중에 수정할 수 있습니다.</p>
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
          <div className="mb-3 text-[13px] font-medium text-ink-500">최근 프로젝트</div>
          <div className="divide-y divide-ink-100 rounded-xl border border-ink-100/80 bg-white">
            {projects.slice(0, 4).map((p) => (
              <button key={p.id} type="button" onClick={() => navigate(`/projects/${p.id}/overview`)} className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-ink-50/60">
                <span className="font-display text-xl text-ink-900">{p.name}</span>
                <ArrowRight size={14} className="text-ink-400" />
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
    <div className={clsx('rounded-xl border p-4 transition', answer ? 'border-wine-200 bg-wine-50/40' : 'border-ink-100')}>
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
        <button type="button" onClick={() => onChange({ mode: 'unknown', value: '' })} className={clsx('rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', mode === 'unknown' ? 'bg-wine-700 text-white ring-wine-700' : 'text-ink-600 ring-ink-100 hover:bg-white')}>
          잘 모르겠어요
        </button>
        <button type="button" onClick={() => onChange({ mode: 'ai', value: q.aiRecommendation })} className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', mode === 'ai' ? 'bg-wine-700 text-white ring-wine-700' : 'text-ink-700 ring-ink-200 hover:bg-white')}>
          <Sparkles size={11} /> AI 추천
        </button>
      </div>
      {mode === 'ai' && <div className="mt-2 text-xs text-ink-700">AI 추천: {q.aiRecommendation} <KindBadge kind="AI_ESTIMATE" className="ml-1" /></div>}
      {mode === 'unknown' && <div className="mt-2 text-xs text-ink-500">이후 단계에서 AI가 분석 결과를 바탕으로 제안합니다.</div>}
    </div>
  );
}
