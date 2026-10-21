import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ColorSwatch } from '@/data/types';

/** Connection state of one service, colour + text (never colour alone). */
export function StatusPill({ on, label, offText = '미연결', onText = '연결됨', tone }: { on: boolean; label: string; offText?: string; onText?: string; tone?: 'demo' }) {
  const cls = on ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : tone === 'demo' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-100 text-slate-600 ring-slate-200';
  const dot = on ? 'bg-emerald-500' : tone === 'demo' ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', cls)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} />
      {label} · {on ? onText : offText}
    </span>
  );
}

export function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('grid grid-cols-[76px_1fr] gap-2 py-1.5 text-[13px] leading-snug', className)}>
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-ink-900">{children}</dd>
    </div>
  );
}

export function Swatches({ colors, size = 'md' }: { colors: ColorSwatch[]; size?: 'sm' | 'md' }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <span key={c.hex + c.name} className="inline-flex items-center gap-1 text-[11px] text-slate-600" title={`${c.name} ${c.hex}`}>
          <span className={clsx('rounded-full ring-1 ring-black/10', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} style={{ background: c.hex }} />
          {size === 'md' && (
            <>
              {c.name} <span className="font-mono text-[10px] text-slate-400">{c.hex}</span>
            </>
          )}
        </span>
      ))}
    </span>
  );
}

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/**
 * Flat illustration of the container and carton in the direction's colours. It is a colour/shape
 * preview drawn by the site, not a generated image and not a real product.
 */
export function PackIllustration({ container, main, sub, accent, className }: { container: string; main: string; sub: string; accent: string; className?: string }) {
  const c = container;
  const body =
    /단지/.test(c) ? (
      <g>
        <rect x="58" y="92" width="64" height="40" rx="8" fill={main} />
        <rect x="54" y="80" width="72" height="16" rx="5" fill={accent} />
        <rect x="70" y="104" width="40" height="14" rx="2" fill={sub} opacity="0.9" />
      </g>
    ) : /튜브/.test(c) ? (
      <g>
        <path d="M64 40 L116 40 L110 118 L70 118 Z" fill={main} />
        <rect x="76" y="118" width="28" height="16" rx="3" fill={accent} />
        <rect x="72" y="36" width="36" height="6" rx="2" fill={shade(main, -0.08)} />
        <rect x="74" y="64" width="32" height="26" rx="2" fill={sub} opacity="0.9" />
      </g>
    ) : /스포이드/.test(c) ? (
      <g>
        <rect x="64" y="64" width="52" height="70" rx="10" fill={main} />
        <rect x="80" y="50" width="20" height="16" rx="3" fill={accent} />
        <ellipse cx="90" cy="40" rx="10" ry="13" fill={shade(accent, -0.15)} />
        <rect x="72" y="88" width="36" height="26" rx="2" fill={sub} opacity="0.9" />
      </g>
    ) : /스프레이/.test(c) ? (
      <g>
        <rect x="66" y="62" width="48" height="72" rx="8" fill={main} />
        <rect x="80" y="44" width="20" height="20" rx="3" fill={accent} />
        <rect x="70" y="36" width="34" height="10" rx="3" fill={shade(accent, -0.1)} />
        <rect x="74" y="86" width="32" height="28" rx="2" fill={sub} opacity="0.9" />
      </g>
    ) : (
      <g>
        <rect x="66" y="58" width="48" height="76" rx="9" fill={main} />
        <rect x="76" y="44" width="28" height="16" rx="3" fill={accent} />
        <path d="M84 30 h22 v8 h-6 v8 h-16 z" fill={shade(accent, -0.12)} />
        <rect x="74" y="84" width="32" height="30" rx="2" fill={sub} opacity="0.9" />
      </g>
    );
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="색·형태 일러스트">
      <rect width="200" height="150" fill="#faf9fb" />
      <rect x="126" y="46" width="52" height="88" rx="2" fill={shade(main, -0.04)} />
      <rect x="126" y="46" width="52" height="12" fill={accent} />
      <rect x="134" y="80" width="36" height="22" fill={sub} opacity="0.9" />
      {body}
      <rect x="20" y="134" width="160" height="2" fill="#e8e4ee" />
    </svg>
  );
}
