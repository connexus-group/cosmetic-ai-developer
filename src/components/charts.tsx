import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { IngredientTrend, TimelineTask, TrendStage } from '@/data/types';
import { ACCENT } from '@/lib/colors';

// ── Progress ring ───────────────────────────────────────────────────────────

export function ProgressRing({ value, size = 88, stroke = 8, label, dark }: { value: number; size?: number; stroke?: number; label?: ReactNode; dark?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`진행률 ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? 'rgba(255,255,255,0.15)' : '#ede8e2'} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={dark ? '#e3cfae' : ACCENT}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className={clsx('text-lg font-semibold tabular-nums', dark ? 'text-white' : 'text-ink-900')}>{value}%</div>
        {label && <div className={clsx('text-[9px] uppercase tracking-wider', dark ? 'text-ink-200' : 'text-ink-500')}>{label}</div>}
      </div>
    </div>
  );
}

// ── Tooltip used by Recharts charts ─────────────────────────────────────────

export function TipBox({ title, rows }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {title && <div className="mb-1 font-semibold text-ink-900">{title}</div>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-ink-600">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-ink-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Heatmap (sequential: one hue, light → dark) ─────────────────────────────

export function Heatmap({ rows, cols, values, unit = '%' }: { rows: string[]; cols: string[]; values: number[][]; unit?: string }) {
  const max = Math.max(...values.flat());
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="px-1 pb-1 text-[11px] font-medium text-ink-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th className="whitespace-nowrap pr-2 text-left text-xs font-medium text-ink-600">{r}</th>
              {values[i].map((v, j) => {
                const t = v / max;
                return (
                  <td
                    key={j}
                    title={`${r} × ${cols[j]}: ${v}${unit}`}
                    className="h-11 min-w-[56px] rounded-md text-center text-xs font-semibold tabular-nums"
                    style={{ background: `rgba(125, 53, 75, ${0.08 + t * 0.85})`, color: t > 0.5 ? '#fff' : '#3b1824' }}
                  >
                    {v}
                    {unit}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Gantt ───────────────────────────────────────────────────────────────────

const PHASE_CLS: Record<TimelineTask['phase'], string> = {
  plan: 'bg-ink-300',
  develop: 'bg-wine-400',
  verify: 'bg-champagne-500',
  launch: 'bg-wine-700',
};
export const PHASE_LABEL: Record<TimelineTask['phase'], string> = { plan: '기획', develop: '개발', verify: '검증', launch: '생산·출시' };

export function Gantt({ tasks, weeks }: { tasks: TimelineTask[]; weeks: number }) {
  const cols = Array.from({ length: weeks }, (_, i) => i + 1);
  const pctLeft = (w: number) => ((w - 1) / weeks) * 100;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="flex">
          <div className="w-44 shrink-0" />
          <div className="relative flex flex-1">
            {cols.map((w) => (
              <div key={w} className="flex-1 pb-2 text-center text-[10px] font-medium tabular-nums text-ink-400">
                W{w}
              </div>
            ))}
          </div>
        </div>
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center border-t border-ink-50">
            <div className="w-44 shrink-0 py-1.5 pr-3">
              <div className="text-sm font-medium text-ink-900">{t.name}</div>
              <div className="text-[11px] text-ink-500">{t.nameKo}</div>
            </div>
            <div className="relative h-11 flex-1">
              <div className="absolute inset-0 flex">
                {cols.map((w) => (
                  <div key={w} className={clsx('flex-1 border-l border-ink-50', w % 2 === 0 && 'bg-ink-50/40')} />
                ))}
              </div>
              <div
                title={`${t.nameKo}: ${t.start}주차 ~ ${t.end}주차`}
                className={clsx('absolute inset-y-2.5 flex items-center rounded-md px-2 text-[10px] font-semibold text-white', PHASE_CLS[t.phase])}
                style={{ left: `calc(${pctLeft(t.start)}% + 2px)`, width: `calc(${((t.end - t.start + 1) / weeks) * 100}% - 4px)` }}
              >
                <span className="truncate">{t.start === t.end ? `W${t.start}` : `W${t.start}–${t.end}`}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trend radar (concentric stage rings) ────────────────────────────────────

const RING_ORDER: TrendStage[] = ['EMERGING', 'GROWING', 'MAINSTREAM', 'SATURATED'];
const GROUPS: IngredientTrend['group'][] = ['Regeneration', 'Retinoid', 'Barrier', 'Longevity'];
const GROUP_KO: Record<IngredientTrend['group'], string> = { Regeneration: '재생·탄력 컨셉', Retinoid: '레티노이드', Barrier: '장벽·진정', Longevity: '롱제비티' };

export function TrendRadar({ items, selected, onSelect }: { items: IngredientTrend[]; selected?: string; onSelect: (id: string) => void }) {
  const size = 440;
  const cx = size / 2;
  const ringW = (size / 2 - 24) / 4;
  const pos = items.map((it) => {
    const ring = RING_ORDER.indexOf(it.stage);
    const g = GROUPS.indexOf(it.group);
    const sameCell = items.filter((x) => x.stage === it.stage && x.group === it.group);
    const k = sameCell.indexOf(it);
    const angle = ((g + (k + 1) / (sameCell.length + 1)) / 4) * Math.PI * 2 - Math.PI / 2;
    const radius = ring * ringW + ringW / 2 + 8;
    return { it, x: cx + Math.cos(angle) * radius, y: cx + Math.sin(angle) * radius };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[460px]" role="img" aria-label="원료 트렌드 레이더">
      {RING_ORDER.map((s, i) => (
        <circle key={s} cx={cx} cy={cx} r={(i + 1) * ringW + 8} fill={i === 0 ? '#faf1f3' : i === 1 ? '#f8f5f0' : i === 2 ? '#fbf9f6' : '#ffffff'} stroke="#e6dfd6" />
      ))}
      {[0, 1, 2, 3].map((g) => {
        const a = (g / 4) * Math.PI * 2 - Math.PI / 2;
        return <line key={g} x1={cx} y1={cx} x2={cx + Math.cos(a) * (cx - 16)} y2={cx + Math.sin(a) * (cx - 16)} stroke="#e6dfd6" strokeDasharray="3 4" />;
      })}
      {RING_ORDER.map((s, i) => (
        <text key={s} x={cx + 4} y={cx - (i * ringW + 8) - 4} fontSize="9" fontWeight="700" fill="#8f7148" letterSpacing="1.5">
          {s}
        </text>
      ))}
      {GROUPS.map((g, i) => {
        const a = ((i + 0.5) / 4) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={g} x={cx + Math.cos(a) * (cx - 6)} y={cx + Math.sin(a) * (cx - 6)} fontSize="10" fill="#6f685f" textAnchor="middle" dominantBaseline="middle">
            {GROUP_KO[g]}
          </text>
        );
      })}
      {pos.map(({ it, x, y }) => {
        const active = it.id === selected;
        return (
          <g key={it.id} onClick={() => onSelect(it.id)} className="cursor-pointer" role="button" aria-label={`${it.name} ${it.stage}`}>
            <circle cx={x} cy={y} r={22} fill="transparent" />
            <circle cx={x} cy={y} r={active ? 9 : 7} fill={active ? '#8a2f4c' : '#2f6fa8'} stroke="#fff" strokeWidth={2} />
            <text x={x} y={y + 19} fontSize="11" fontWeight={active ? 700 : 600} fill="#292524" textAnchor="middle">
              {it.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
