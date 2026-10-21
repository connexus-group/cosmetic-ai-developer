import { useState } from 'react';
import clsx from 'clsx';
import { ImagePlus, Loader2, Paperclip, PlugZap, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { CONTAINER_OPTIONS, defaultMockupOptions, LAYOUT_OPTIONS, MOCKUP_KINDS, inputMap, requestMockup, selectedDirection, STYLE_OPTIONS } from '@/data/packaging';
import type { MockupMeta, MockupOptions, PackageIdentity } from '@/data/types';
import { deleteImage, fileToDataUrl, putImage, useStoredImage } from '@/lib/imageStore';
import type { TabProps } from './PackagingStudio';

export function MockupTab({ p, studio, setStudio, status, inputs, go }: TabProps) {
  const d = selectedDirection(studio);
  const m = inputMap(inputs);
  const connected = !!status?.imageGen.configured;
  const opts: MockupOptions = studio.mockupOptions ?? defaultMockupOptions(d);
  const id: PackageIdentity = studio.identity ?? { brandName: '', productName: m.productName || p.name, volume: m.size, copy: '' };
  const [busy, setBusy] = useState<MockupMeta['kind'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<string>(d?.subColors[1]?.hex ?? d?.mainColors[1]?.hex ?? '#C8A97E');
  const [overlay, setOverlay] = useState(true);

  const setOpts = (patch: Partial<MockupOptions>) => setStudio((s) => ({ ...s, mockupOptions: { ...(s.mockupOptions ?? defaultMockupOptions(selectedDirection(s))), ...patch } }));
  const setId = (patch: Partial<PackageIdentity>) => setStudio((s) => ({ ...s, identity: { ...(s.identity ?? id), ...patch } }));
  const palette = d ? [...d.mainColors, ...d.subColors] : [];

  const generate = async (kind: MockupMeta['kind']) => {
    setBusy(kind);
    setError(null);
    try {
      const o = kind === 'colorway' ? { ...opts, variantColor: variant } : opts;
      const r = await requestMockup(p.id, kind, o, d, id.volume || m.size, m.texture);
      const where = await putImage(`mockup:${r.id}`, `data:${r.mime};base64,${r.image}`);
      const meta: MockupMeta = { id: r.id, kind, createdAt: r.createdAt, provider: r.provider, model: r.model, prompt: r.prompt, directionId: d?.id, options: o, stored: r.stored === 'supabase' ? 'browser+supabase' : 'browser' };
      setStudio((s) => ({ ...s, mockups: [meta, ...(s.mockups ?? [])].slice(0, 40) }));
      if (where === 'memory') setError('이 브라우저에서 이미지 저장소(IndexedDB)를 쓸 수 없어 새로고침하면 이미지가 사라집니다.');
      else if (r.storageError) setError(`Supabase 저장 실패 (이 브라우저에는 저장됨): ${r.storageError}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const remove = (x: MockupMeta) => {
    void deleteImage(`mockup:${x.id}`);
    setStudio((s) => ({ ...s, mockups: (s.mockups ?? []).filter((y) => y.id !== x.id) }));
  };
  const pin = (x: MockupMeta) => setStudio((s) => ({ ...s, mockups: (s.mockups ?? []).map((y) => (y.id === x.id ? { ...y, pinned: !y.pinned } : y)) }));
  const uploadLogo = async (f: File | undefined) => {
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      const key = `logo:${p.id}`;
      await putImage(key, url);
      setId({ logoKey: key });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const mockups = studio.mockups ?? [];
  const field = 'w-full rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-ink-400';

  return (
    <div className="space-y-3">
      {!connected && (
        <div className="flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[12px] text-slate-700">
          <PlugZap size={15} className="mt-0.5 shrink-0" />
          <div>
            <b>이미지 생성 API 미연결 · 시안 생성 기능이 작동하지 않습니다.</b> 아래 입력값과 옵션은 저장되며, 연결 후 바로 생성할 수 있어요.
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
              {(status?.imageGen.adapters ?? []).map((a) => (
                <li key={a.id}>
                  {a.name}: {a.status === 'connected' ? '연결됨' : a.status === 'planned' ? '연결 자리만 있음 (유료, 꺼짐)' : `미연결 · 필요: ${a.env.join(', ')}`} · {a.costNote}
                </li>
              ))}
              {!status && <li>서버 API를 확인할 수 없어 연결 상태를 알 수 없습니다 (로컬 미리보기).</li>}
            </ul>
          </div>
        </div>
      )}
      {!d && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          디자인 방향을 아직 선택하지 않았어요.{' '}
          <button type="button" className="font-semibold underline" onClick={() => go('direction')}>
            Design Direction에서 선택
          </button>
          하면 색·스타일이 시안에 반영됩니다.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <fieldset className="rounded-xl border border-ink-100 p-2.5">
            <legend className="px-1 text-[12px] font-semibold text-ink-800">표시 데이터 (이미지와 별도 관리)</legend>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="text-[11px] text-slate-500">
                브랜드명
                <input className={field} value={id.brandName} onChange={(e) => setId({ brandName: e.target.value })} placeholder="브랜드" />
              </label>
              <label className="text-[11px] text-slate-500">
                용량
                <input className={field} value={id.volume} onChange={(e) => setId({ volume: e.target.value })} placeholder="30ml" />
              </label>
              <label className="col-span-2 text-[11px] text-slate-500">
                제품명
                <input className={field} value={id.productName} onChange={(e) => setId({ productName: e.target.value })} />
              </label>
              <label className="col-span-2 text-[11px] text-slate-500">
                표시 문구
                <input className={field} value={id.copy} onChange={(e) => setId({ copy: e.target.value })} placeholder="예: Firming Ampoule · 표시광고 검토 필요" />
              </label>
              <div className="col-span-2 flex items-center gap-2 text-[11px] text-slate-500">
                <LogoThumb k={id.logoKey} />
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-medium text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50">
                  <ImagePlus size={12} /> 로고 업로드
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
                </label>
                <span>이 브라우저에만 저장</span>
              </div>
            </div>
            <p className="mt-1.5 text-[10.5px] text-slate-400">AI 이미지에는 글자를 넣지 않고, 위 값을 시안 위에 별도 레이어로 얹어 보여줍니다.</p>
          </fieldset>

          <fieldset className="rounded-xl border border-ink-100 p-2.5">
            <legend className="px-1 text-[12px] font-semibold text-ink-800">시안 옵션</legend>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="text-[11px] text-slate-500">
                용기 형태
                <select className={field} value={opts.container} onChange={(e) => setOpts({ container: e.target.value })}>
                  {CONTAINER_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-500">
                라벨·로고 배치
                <select className={field} value={opts.labelLayout} onChange={(e) => setOpts({ labelLayout: e.target.value })}>
                  {LAYOUT_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-[11px] text-slate-500">
                디자인 스타일
                <select className={field} value={opts.style} onChange={(e) => setOpts({ style: e.target.value })}>
                  {STYLE_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <ColorField label="메인 컬러" value={opts.mainColor} palette={palette.map((c) => c.hex)} onChange={(v) => setOpts({ mainColor: v })} />
              <ColorField label="서브 컬러" value={opts.subColor} palette={palette.map((c) => c.hex)} onChange={(v) => setOpts({ subColor: v })} />
              <label className="col-span-2 text-[11px] text-slate-500">
                단상자 디자인
                <textarea rows={2} className={field} value={opts.carton} onChange={(e) => setOpts({ carton: e.target.value })} placeholder="예: 화이트 단상자, 정면 골드 박 로고" />
              </label>
              <ColorField label="컬러 변형안 색" value={variant} palette={palette.map((c) => c.hex)} onChange={setVariant} />
              <label className="flex items-end gap-1.5 pb-1.5 text-[11px] text-slate-600">
                <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> 표시 데이터 레이어 보기
              </label>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-1.5">
            {MOCKUP_KINDS.map((k) => (
              <Button key={k.id} variant={k.id === 'container' ? 'primary' : 'secondary'} className="!py-1.5 text-xs" disabled={!connected || !!busy} onClick={() => generate(k.id)} title={connected ? '' : '이미지 생성 API 미연결'}>
                {busy === k.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {k.label}
              </Button>
            ))}
          </div>
          {connected && <p className="text-[10.5px] text-slate-400">Cloudflare Workers AI 무료 한도 안에서만 생성 (이미지 1장 약 58 Neurons, 하루 10,000 Neurons). 한도를 넘으면 생성이 멈추고 과금되지 않습니다.</p>}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{error}</p>}
        </div>

        <div>
          {mockups.length ? (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {mockups.map((x) => (
                <MockupCard key={x.id} x={x} id={id} overlay={overlay} onPin={() => pin(x)} onRemove={() => remove(x)} />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-ink-100 px-4 text-center text-[12px] text-slate-500">
              <Wand2 size={20} className="mb-1 text-slate-300" />
              {connected ? '옵션을 고르고 시안 종류를 누르면 AI Concept Mockup이 여기에 생성돼요.' : '이미지 생성 API가 연결되지 않아 생성된 시안이 없습니다.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, palette, onChange }: { label: string; value: string; palette: string[]; onChange: (v: string) => void }) {
  return (
    <div className="text-[11px] text-slate-500">
      {label}
      <div className="mt-0.5 flex items-center gap-1">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-8 cursor-pointer rounded border border-ink-100 bg-white p-0.5" />
        <span className="font-mono text-[10px]">{value}</span>
        <span className="ml-auto flex gap-0.5">
          {[...new Set(palette)].slice(0, 5).map((c) => (
            <button key={c} type="button" title={c} onClick={() => onChange(c)} className={clsx('h-4 w-4 rounded-full ring-1 ring-black/10', c.toLowerCase() === value.toLowerCase() && 'ring-2 ring-ink-500')} style={{ background: c }} />
          ))}
        </span>
      </div>
    </div>
  );
}

function LogoThumb({ k }: { k?: string }) {
  const src = useStoredImage(k);
  return src ? <img src={src} alt="로고" className="h-7 w-7 rounded border border-ink-100 object-contain" /> : <span className="grid h-7 w-7 place-items-center rounded border border-dashed border-ink-200 text-[9px]">LOGO</span>;
}

const LAYOUT_CLS: Record<string, string> = {
  중앙: 'inset-x-0 top-1/2 -translate-y-1/2 items-center text-center',
  상단: 'inset-x-0 top-[14%] items-center text-center',
  하단: 'inset-x-0 bottom-[12%] items-center text-center',
  세로: 'left-[8%] top-1/2 -translate-y-1/2 items-start [writing-mode:vertical-rl]',
};

/** Generated image + the identity layer laid over it. Always labeled "AI Concept Mockup". */
export function MockupImage({ x, id, overlay, className }: { x: MockupMeta; id?: PackageIdentity; overlay: boolean; className?: string }) {
  const src = useStoredImage(`mockup:${x.id}`);
  const logo = useStoredImage(id?.logoKey);
  return (
    <div className={clsx('relative aspect-square overflow-hidden bg-ink-50', className)}>
      {src ? <img src={src} alt="AI Concept Mockup" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-2 text-center text-[11px] text-slate-400">{src === undefined ? '불러오는 중…' : '이 브라우저에 이미지가 없습니다 (다른 기기에서 생성)'}</div>}
      {src && overlay && id && (
        <div className={clsx('pointer-events-none absolute flex flex-col gap-0.5 px-2', LAYOUT_CLS[x.options.labelLayout] ?? LAYOUT_CLS['중앙'])}>
          {logo && <img src={logo} alt="" className="h-6 w-auto object-contain" />}
          {id.brandName && <span className="text-[10px] font-bold tracking-[0.2em] text-ink-900/80 [text-shadow:0_0_6px_rgba(255,255,255,.9)]">{id.brandName.toUpperCase()}</span>}
          {id.productName && <span className="text-[12px] font-semibold text-ink-900 [text-shadow:0_0_6px_rgba(255,255,255,.9)]">{id.productName}</span>}
          {id.copy && <span className="text-[9px] text-ink-800 [text-shadow:0_0_6px_rgba(255,255,255,.9)]">{id.copy}</span>}
          {id.volume && <span className="text-[9px] text-ink-800 [text-shadow:0_0_6px_rgba(255,255,255,.9)]">{id.volume}</span>}
        </div>
      )}
      <span className="absolute left-1.5 top-1.5 rounded bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">AI Concept Mockup</span>
    </div>
  );
}

function MockupCard({ x, id, overlay, onPin, onRemove }: { x: MockupMeta; id: PackageIdentity; overlay: boolean; onPin: () => void; onRemove: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
      <MockupImage x={x} id={id} overlay={overlay} />
      <div className="space-y-0.5 p-2 text-[11px]">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-ink-900">{MOCKUP_KINDS.find((k) => k.id === x.kind)?.label}</span>
          <span className="flex gap-1">
            <button type="button" onClick={onPin} title="Packaging Brief에 첨부" className={clsx('rounded p-1', x.pinned ? 'bg-champagne-100 text-champagne-700' : 'text-slate-400 hover:text-ink-700')}>
              <Paperclip size={12} />
            </button>
            <button type="button" onClick={onRemove} title="삭제" className="rounded p-1 text-slate-400 hover:text-rose-600">
              <Trash2 size={12} />
            </button>
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: x.options.variantColor ?? x.options.mainColor }} />
          {x.options.container} · {STYLE_OPTIONS.find((s) => s.id === x.options.style)?.label ?? x.options.style}
        </div>
        <div className="text-slate-400">
          {x.provider} {x.model} · {new Date(x.createdAt).toLocaleString('ko-KR')} · {x.stored === 'browser+supabase' ? 'Supabase+브라우저 저장' : '이 브라우저 저장'}
        </div>
      </div>
    </div>
  );
}
