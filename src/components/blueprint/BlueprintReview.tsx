import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Check, Cpu, FlaskConical, Loader2 } from 'lucide-react';
import { CORE_KEYS } from '@/data/blueprintFields';
import type { Blueprint, BlueprintEntry } from '@/data/types';
import { Card } from '@/components/ui';
import { isUndecided } from '@/lib/blueprint';

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
    { id: 'generating', label: demo && at > 0 ? '규칙 기반 Demo 초안 작성' : `AI가 핵심 ${CORE_KEYS.length}개 항목과 상세 항목 작성`, done: '' },
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
