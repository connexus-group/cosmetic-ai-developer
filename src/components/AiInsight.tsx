import { ArrowRight, Sparkles } from 'lucide-react';
import type { Insight } from '@/data/types';
import { KindBadge } from './ui';

const ROWS = [
  { key: 'finding', label: 'Finding', ko: '발견' },
  { key: 'why', label: 'Why it matters', ko: '왜 중요한가' },
  { key: 'opportunity', label: 'Opportunity', ko: '기회' },
  { key: 'risk', label: 'Risk', ko: '리스크' },
] as const;

/** AI INSIGHT block: Finding → Why it matters → Opportunity → Risk → Recommendation. */
export function AiInsight({ insight, title = 'AI INSIGHT' }: { insight: Insight; title?: string }) {
  // "AI CONSUMER INSIGHT" → "AI Consumer Insight": natural case reads calmer than all caps.
  const heading = title
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Ai\b/, 'AI');
  return (
    <section className="overflow-hidden rounded-xl border border-ink-100/80 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-wine-50 text-wine-700">
            <Sparkles size={14} />
          </span>
          <h3 className="font-display text-[28px] leading-none text-ink-900">{heading}</h3>
        </div>
        <KindBadge kind="AI_ANALYSIS" />
      </div>
      <div className="grid gap-x-10 px-6 sm:grid-cols-2 sm:px-8">
        {ROWS.map((r) => (
          <div key={r.key} className="border-t border-ink-100 py-5 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
            <div className="text-[12px] font-medium text-wine-700">
              {r.label} <span className="text-ink-400">· {r.ko}</span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-800">{insight[r.key]}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-start gap-3 border-t border-wine-100 bg-wine-50/70 px-6 py-5 sm:px-8">
        <ArrowRight size={18} className="mt-1 shrink-0 text-wine-600" />
        <div>
          <div className="text-[12px] font-medium text-wine-700">Recommendation · 추천</div>
          <p className="mt-1.5 text-base font-medium leading-relaxed text-ink-900">{insight.recommendation}</p>
        </div>
      </div>
    </section>
  );
}
