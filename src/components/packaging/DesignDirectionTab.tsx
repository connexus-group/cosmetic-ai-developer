import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button, KindBadge } from '@/components/ui';
import { basisKeyOf, defaultMockupOptions, generateDirections } from '@/data/packaging';
import type { DesignDirection } from '@/data/types';
import { now } from '@/state/ProjectStore';
import { PackIllustration, Row, Swatches } from './bits';
import type { TabProps } from './PackagingStudio';

export function DesignDirectionTab({ studio, setStudio, status, inputs, go }: TabProps) {
  const [busy, setBusy] = useState(false);
  const set = studio.directions;
  const stale = !!set && set.basisKey !== basisKeyOf(inputs);
  const auto = useRef(false);

  const run = async () => {
    setBusy(true);
    try {
      const next = await generateDirections(inputs, !!status?.ai.configured);
      setStudio((s) => ({ ...s, directions: next, selectedDirectionId: next.items.some((d) => d.id === s.selectedDirectionId) && s.directions?.basisKey === next.basisKey ? s.selectedDirectionId : undefined }));
    } finally {
      setBusy(false);
    }
  };

  // First visit: propose automatically once the connection check has finished.
  useEffect(() => {
    if (auto.current || set || status === undefined) return;
    auto.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, set]);

  const choose = (d: DesignDirection) =>
    setStudio((s) => ({
      ...s,
      selectedDirectionId: d.id,
      selectedAt: now(),
      // the mockup options follow the newly chosen direction; identity and quotes are kept
      mockupOptions: s.selectedDirectionId === d.id && s.mockupOptions ? s.mockupOptions : defaultMockupOptions(d),
      material: s.selectedDirectionId === d.id ? s.material : undefined,
    }));

  const kind = set?.mode === 'ai' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        {set ? (
          <>
            <KindBadge kind={kind} />
            <span>
              {set.mode === 'ai' ? `AI 제안 (${set.model ?? 'Claude'})` : '데모 제안 · 규칙 기반, AI 분석 아님'} · {new Date(set.generatedAt).toLocaleString('ko-KR')}
            </span>
          </>
        ) : (
          <span>기획 조건으로 디자인 방향 3개를 제안합니다.</span>
        )}
        <Button className="ml-auto !px-2.5 !py-1.5 text-xs" onClick={run} disabled={busy}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {set ? '다시 제안' : '제안 받기'}
        </Button>
      </div>
      {set?.notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{set.notice}</p>}
      {stale && (
        <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <TriangleAlert size={13} /> 제안 이후 Product Blueprint 값이 바뀌었어요. "다시 제안"으로 새 조건을 반영하세요 (기존 선택은 유지됨).
        </p>
      )}

      {busy && !set && (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-ink-50" />
          ))}
        </div>
      )}

      {set && (
        <div className="grid gap-3 md:grid-cols-3">
          {set.items.map((d, i) => {
            const selected = studio.selectedDirectionId === d.id;
            const main = d.mainColors[0]?.hex ?? '#eeeeee';
            return (
              <div key={d.id} className={clsx('flex flex-col overflow-hidden rounded-xl border bg-white', selected ? 'border-ink-500 ring-2 ring-ink-200' : 'border-ink-100')}>
                <div className="relative">
                  <PackIllustration container={d.container} main={main} sub={d.subColors[0]?.hex ?? '#ffffff'} accent={d.mainColors[1]?.hex ?? d.subColors[1]?.hex ?? '#999999'} className="block h-36 w-full" />
                  <span className="absolute left-2 top-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">색·형태 일러스트</span>
                  <span className="absolute right-2 top-2 text-[11px] font-bold tracking-[0.15em] text-ink-500">0{i + 1}</span>
                </div>
                <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-ink-900">{d.name}</div>
                      <div className="text-[12px] text-slate-500">{d.summary}</div>
                    </div>
                    <KindBadge kind={kind} />
                  </div>
                  <dl className="mt-1.5 divide-y divide-ink-50">
                    <Row label="추천 이유">
                      {d.reason}
                      {d.basis.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {d.basis.map((b) => (
                            <span key={b} className="rounded bg-ink-50 px-1.5 py-0.5 text-[10px] text-ink-700">
                              {b}
                            </span>
                          ))}
                        </span>
                      )}
                    </Row>
                    <Row label="메인 컬러">
                      <Swatches colors={d.mainColors} />
                    </Row>
                    <Row label="서브 컬러">
                      <Swatches colors={d.subColors} />
                    </Row>
                    <Row label="용기 형태">
                      {d.container}
                      <span className="block text-[11px] text-slate-500">{d.material}</span>
                    </Row>
                    <Row label="단상자">{d.carton}</Row>
                    <Row label="타이포">{d.typography}</Row>
                    <Row label="인쇄·후가공">{d.finishing}</Row>
                    <Row label="타깃 적합성">{d.targetFit}</Row>
                  </dl>
                  <div className="mt-auto flex gap-2 pt-2">
                    <Button variant={selected ? 'primary' : 'secondary'} className="flex-1 !py-1.5 text-xs" onClick={() => choose(d)}>
                      {selected ? (
                        <>
                          <Check size={13} /> 선택됨
                        </>
                      ) : (
                        '이 방향 선택'
                      )}
                    </Button>
                    {selected && (
                      <Button className="!py-1.5 text-xs" onClick={() => go('brief')}>
                        Packaging Brief
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400">일러스트는 색 조합과 용기 형태를 보여주는 단순 그림입니다. 실제 이미지 시안은 AI Design Mockup 탭, 실제 제품 레퍼런스는 Reference Library 탭에서 확인하세요.</p>
    </div>
  );
}
