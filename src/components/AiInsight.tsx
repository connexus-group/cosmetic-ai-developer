import { AlertTriangle, ArrowRight, Lightbulb, Search, Sparkles, Target } from 'lucide-react';
import type { Insight } from '@/data/types';
import { KindBadge } from './ui';

const ROWS = [
  { key: 'finding', label: 'Finding', ko: '발견', icon: Search },
  { key: 'why', label: 'Why it matters', ko: '왜 중요한가', icon: Target },
  { key: 'opportunity', label: 'Opportunity', ko: '기회', icon: Lightbulb },
  { key: 'risk', label: 'Risk', ko: '리스크', icon: AlertTriangle },
] as const;

/** AI INSIGHT block: Finding → Why it matters → Opportunity → Risk → Recommendation. */
export function AiInsight({ insight, title = 'AI INSIGHT' }: { insight: Insight; title?: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 text-white shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-champagne-300">
          <Sparkles size={14} /> {title}
        </div>
        <KindBadge kind="AI_ANALYSIS" className="!bg-white/10 !text-white !ring-white/20" />
      </div>
      <div className="grid gap-px bg-white/10 sm:grid-cols-2">
        {ROWS.map((r) => (
          <div key={r.key} className="bg-ink-900/40 px-5 py-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-200">
              <r.icon size={13} /> {r.label}
              <span className="font-normal normal-case tracking-normal text-ink-300">· {r.ko}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-white/90">{insight[r.key]}</p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-3 bg-champagne-100 px-5 py-4 text-ink-900">
        <ArrowRight size={18} className="mt-0.5 shrink-0 text-champagne-700" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-champagne-700">Recommendation · 추천</div>
          <p className="mt-1 text-sm font-medium leading-relaxed">{insight.recommendation}</p>
        </div>
      </div>
    </section>
  );
}
