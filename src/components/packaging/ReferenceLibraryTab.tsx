import { useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, ImageOff, Link2, Loader2, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, KindBadge, Segmented } from '@/components/ui';
import { collectPage, KIND_LABEL, searchReferences, selectedDirection, type ReferenceSearchResult } from '@/data/packaging';
import type { PackagingReference } from '@/data/types';
import type { TabProps } from './PackagingStudio';

type Filter = 'all' | 'container' | 'carton' | 'text';

const merge = (prev: PackagingReference[] | undefined, next: PackagingReference[]) => {
  const map = new Map((prev ?? []).map((r) => [r.id, r]));
  for (const r of next) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()].slice(-60);
};

export function ReferenceLibraryTab({ studio, setStudio, status, inputs }: TabProps) {
  const connected = !!status?.firecrawl.configured;
  const direction = selectedDirection(studio);
  const [query, setQuery] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [busy, setBusy] = useState<'search' | 'page' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ReferenceSearchResult | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const refs = studio.references ?? [];
  const perSearch = status?.firecrawl.costs.perImageSearch10 ?? 2;
  const perPage = status?.firecrawl.costs.perPage ?? 5;

  const search = async () => {
    setBusy('search');
    setError(null);
    try {
      const r = await searchReferences(inputs, direction, query.trim() ? [query.trim()] : undefined);
      setLast(r);
      setStudio((s) => ({ ...s, references: merge(s.references, r.references) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const fromPage = async () => {
    setBusy('page');
    setError(null);
    try {
      const r = await collectPage(pageUrl.trim());
      setStudio((s) => ({ ...s, references: merge(s.references, r.references) }));
      setPageUrl('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const patch = (id: string, fn: (r: PackagingReference) => PackagingReference) => setStudio((s) => ({ ...s, references: (s.references ?? []).map((r) => (r.id === id ? fn(r) : r)) }));
  const remove = (id: string) => setStudio((s) => ({ ...s, references: (s.references ?? []).filter((r) => r.id !== id) }));

  const withImage = refs.filter((r) => r.imageStatus === 'ok');
  const textOnly = refs.filter((r) => r.imageStatus !== 'ok');
  const shown = filter === 'text' ? [] : withImage.filter((r) => filter === 'all' || r.kind === filter || r.kind === 'set');

  return (
    <div className="space-y-3">
      {!connected && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-[12px] text-slate-600">
          <b>Firecrawl 미연결</b> · 실제 레퍼런스 검색이 작동하지 않습니다. 서버에 <code>FIRECRAWL_API_KEY</code>가 설정되면 사용할 수 있어요. 아래 목록에는 이전에 실제로 수집한 레퍼런스만 표시됩니다.
        </p>
      )}
      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-100 p-2.5">
          <div className="mb-1.5 text-[12px] font-semibold text-ink-800">이미지 검색 (Firecrawl)</div>
          <div className="flex gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`비우면 기획 조건${direction ? `·${direction.name}` : ''}으로 검색어 자동 생성`}
              className="min-w-0 flex-1 rounded-lg border border-ink-100 px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-400"
            />
            <Button variant="primary" className="!px-2.5 !py-1.5 text-xs" disabled={!connected || !!busy} onClick={search}>
              {busy === 'search' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} 검색
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            검색어 {query.trim() ? 1 : 2}개 × 약 {perSearch} 크레딧 (Firecrawl 무료 크레딧에서 차감, 24시간 내 같은 검색은 저장된 결과 재사용 시 0)
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 p-2.5">
          <div className="mb-1.5 text-[12px] font-semibold text-ink-800">공식 제품 페이지에서 가져오기</div>
          <div className="flex gap-1.5">
            <input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://브랜드 공식몰 제품 페이지" className="min-w-0 flex-1 rounded-lg border border-ink-100 px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-400" />
            <Button className="!px-2.5 !py-1.5 text-xs" disabled={!connected || !!busy || !/^https?:\/\/\S+\.\S+/.test(pageUrl.trim())} onClick={fromPage}>
              {busy === 'page' ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} 가져오기
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">페이지 1개 약 {perPage} 크레딧 · 브랜드·제품명·패키지 문구는 페이지에 적힌 글자만 저장</p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{error}</p>}
      {last && (
        <p className="text-[11px] text-slate-500">
          검색어: {last.queries.map((q) => `"${q}"`).join(', ')} · 사용 크레딧 {last.creditsUsed}
          {last.runs.some((r) => r.fromCache) ? ' (일부 저장된 결과 재사용)' : ''} · 이미지 확인 {last.references.filter((r) => r.imageStatus === 'ok').length}개 · 제외 {last.excluded.length}개
          {last.warnings.length > 0 && ` · ${last.warnings.join(' / ')}`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: `이미지 ${withImage.length}` },
            { id: 'container', label: '용기' },
            { id: 'carton', label: '단상자' },
            { id: 'text', label: `텍스트만 ${textOnly.length}` },
          ]}
        />
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <ShieldCheck size={12} /> 이미지는 복사·저장하지 않고 원본 주소로만 미리보기 · 저작권은 원저작자에게 있음 · 참고용
        </span>
      </div>

      {filter !== 'text' &&
        (shown.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((r) => (
              <RefCard key={r.id} r={r} patch={patch} remove={remove} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-ink-100 px-3 py-6 text-center text-[12px] text-slate-500">
            {refs.length ? '이 분류에 해당하는 이미지 레퍼런스가 없어요.' : connected ? '검색하거나 공식 페이지 주소를 넣으면 실제 패키지 레퍼런스가 여기에 쌓여요.' : '수집한 레퍼런스가 없어요.'}
          </p>
        ))}

      {(filter === 'text' || filter === 'all') && textOnly.length > 0 && (
        <div className="rounded-xl border border-ink-100">
          <div className="border-b border-ink-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500">이미지 미확보 · 텍스트만 확보 ({textOnly.length})</div>
          <ul className="divide-y divide-ink-50">
            {textOnly.map((r) => (
              <li key={r.id} className="flex items-start gap-2 px-3 py-2 text-[12px]">
                <ImageOff size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink-900">{[r.brand, r.productName].filter(Boolean).join(' ') || r.title || r.site}</div>
                  <div className="text-[11px] text-slate-500">
                    {r.imageNote ?? '이미지 없음'} · {r.source} · {r.collectedAt.slice(0, 10)} 수집 ·{' '}
                    <a href={r.pageUrl} target="_blank" rel="noreferrer noopener" className="underline">
                      원본
                    </a>
                  </div>
                  {r.features.length > 0 && <div className="mt-0.5 text-[11px] text-slate-600">페이지 원문: {r.features.map((f) => `"${f}"`).join(', ')}</div>}
                </div>
                <button type="button" onClick={() => remove(r.id)} className="text-slate-300 hover:text-rose-600" title="삭제">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {last && last.excluded.length > 0 && (
        <details className="text-[11px] text-slate-500">
          <summary className="cursor-pointer">제외된 결과 {last.excluded.length}개 (약관·robots.txt·스톡 이미지 등)</summary>
          <ul className="mt-1 space-y-0.5">
            {last.excluded.map((x, i) => (
              <li key={i} className="truncate">
                {x.reason} · {x.pageUrl}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RefCard({ r, patch, remove }: { r: PackagingReference; patch: (id: string, fn: (r: PackagingReference) => PackagingReference) => void; remove: (id: string) => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-ink-100 bg-white">
      <div className="relative aspect-square bg-white">
        {broken || !r.imageUrl ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-[11px] text-slate-400">
            <ImageOff size={18} /> 이미지를 불러오지 못함
          </div>
        ) : (
          <img src={r.imageUrl} alt={r.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-contain" />
        )}
        <span className="absolute left-1.5 top-1.5">
          <KindBadge kind="EXTERNAL" />
        </span>
        <button type="button" onClick={() => remove(r.id)} title="삭제" className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="space-y-1 p-2 text-[11.5px] leading-snug">
        <div className="flex items-center gap-1">
          <select
            value={r.kind}
            onChange={(e) => patch(r.id, (x) => ({ ...x, kind: e.target.value as PackagingReference['kind'], kindByUser: true }))}
            className={clsx('rounded border border-ink-100 bg-white px-1 py-0.5 text-[11px]', r.kind === 'unknown' ? 'text-slate-500' : 'text-ink-800')}
            title={r.kindByUser ? '사용자가 지정' : '제목 단어로 추정 · 확인 필요'}
          >
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v} {k === r.kind && !r.kindByUser && k !== 'unknown' ? '(추정)' : ''}
              </option>
            ))}
          </select>
        </div>
        <input
          value={r.brand ?? ''}
          onChange={(e) => patch(r.id, (x) => ({ ...x, brand: e.target.value || null }))}
          placeholder="브랜드 · 확인 필요"
          className="w-full rounded border border-transparent px-1 py-0.5 font-semibold text-ink-900 placeholder:font-normal placeholder:text-slate-400 hover:border-ink-100 focus:border-ink-300 focus:outline-none"
        />
        <input
          value={r.productName ?? ''}
          onChange={(e) => patch(r.id, (x) => ({ ...x, productName: e.target.value || null }))}
          placeholder="제품명 · 확인 필요"
          className="w-full rounded border border-transparent px-1 py-0.5 text-ink-800 placeholder:text-slate-400 hover:border-ink-100 focus:border-ink-300 focus:outline-none"
        />
        {r.features.length > 0 ? (
          <div className="px-1 text-[11px] text-slate-600" title="페이지에 적힌 문구 그대로">
            페이지 원문: {r.features.map((f) => `"${f}"`).join(', ')}
          </div>
        ) : (
          <input
            value={r.note ?? ''}
            onChange={(e) => patch(r.id, (x) => ({ ...x, note: e.target.value }))}
            placeholder="디자인 특징 메모 (직접 입력)"
            className="w-full rounded border border-transparent px-1 py-0.5 text-[11px] text-slate-700 placeholder:text-slate-400 hover:border-ink-100 focus:border-ink-300 focus:outline-none"
          />
        )}
        <div className="px-1 text-[10.5px] text-slate-400" title={r.title}>
          {r.title ? `제목: ${r.title.slice(0, 60)}` : ''}
        </div>
        <div className="flex items-center justify-between gap-1 px-1 text-[10.5px] text-slate-500">
          <span className="truncate">
            {r.source} · {r.collectedAt.slice(0, 10)}
          </span>
          <a href={r.pageUrl} target="_blank" rel="noreferrer noopener" className="inline-flex shrink-0 items-center gap-0.5 font-medium text-ink-600 hover:text-ink-900" title={r.pageUrl}>
            {r.site} <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
