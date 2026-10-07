import { useState } from 'react';
import clsx from 'clsx';
import { FileDown, FileSpreadsheet, Link2, Pencil, Printer, RotateCcw } from 'lucide-react';
import { Button, Card, KindBadge, PageIntro } from '@/components/ui';
import { briefMissing, buildBrief, downloadCsv, isEdited, type BriefField } from '@/lib/brief';
import { progressOf } from '@/lib/engine';
import { useProject } from '../ProjectLayout';
import { PreviewBanner } from './PreviewBanner';

const SECTIONS: { id: BriefField['section']; title: string }[] = [
  { id: 'Overview', title: '01 · Product Overview' },
  { id: 'Product', title: '02 · Product Specification' },
  { id: 'Commercial', title: '03 · Commercial Conditions' },
  { id: 'Compliance', title: '04 · Testing · Regulation · Schedule' },
];

export default function Brief() {
  const { project: p, update } = useProject();
  const fields = buildBrief(p);
  const missing = briefMissing(p);
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  };
  const title = fields.find((f) => f.key === 'name')?.value ?? p.name;

  const save = (key: string, value: string) => {
    setEditing(null);
    update((x) => ({ ...x, brief: { ...x.brief, [key]: value } }));
  };
  const reset = (key: string) =>
    update((x) => {
      const b = { ...x.brief };
      delete b[key];
      return { ...x, brief: b };
    });

  // TODO(PDF): generate a real PDF (e.g. server-side rendering or a PDF library) with brand layout.
  // For now the browser print dialog is used; choose "PDF로 저장" there.
  const exportPdf = () => {
    flash('인쇄 창에서 "PDF로 저장"을 선택하세요. (전용 PDF 생성은 준비 중)');
    window.setTimeout(() => window.print(), 300);
  };
  // TODO(Share): needs a backend (accounts + share links). Until then this copies the local URL.
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash('링크를 복사했어요. 공유 링크는 로그인 기능 연결 후 다른 사람도 열 수 있어요.');
    } catch {
      flash('링크 복사를 지원하지 않는 환경이에요.');
    }
  };

  return (
    <div className="space-y-10">
      <div className="no-print">
        <PageIntro
          no="15"
          title="Product Development Brief"
          ko="제품개발의뢰서"
          question="지금까지의 결정을 제조사에 바로 전달할 수 있는 문서로 정리했어요."
          right={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={exportPdf}>
                <FileDown size={15} /> PDF Export
              </Button>
              <Button onClick={() => downloadCsv(p)}>
                <FileSpreadsheet size={15} /> Excel (CSV)
              </Button>
              <Button onClick={() => window.print()}>
                <Printer size={15} /> Print
              </Button>
              <Button onClick={share}>
                <Link2 size={15} /> Share
              </Button>
            </div>
          }
        />
        {missing.length > 0 && <PreviewBanner projectId={p.id} step={!p.conceptId ? 'concept' : !p.formulaId ? 'formula' : 'packaging'} what={missing.join('·')} />}
        <p className="mt-3 text-xs text-ink-500">각 항목을 누르면 직접 수정할 수 있어요. 수정한 항목은 USER INPUT으로 표시되고, 이후 단계 선택이 바뀌어도 유지됩니다.</p>
      </div>

      <Card className="print-sheet overflow-hidden">
        <div className="border-b border-ink-100 px-6 pb-8 pt-10 sm:px-12">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-wine-700">Product Development Brief</div>
              <div className="font-display mt-3 text-[44px] leading-[1.05] text-ink-900 sm:text-[56px]">{title}</div>
              <div className="mt-3 text-[15px] text-ink-500">제품개발의뢰서 · 제조사 전달용</div>
            </div>
            <div className="space-y-1 text-right text-[13px] text-ink-500">
              <div>작성일 {new Date().toLocaleDateString('ko-KR')}</div>
              <div>Development progress {progressOf(p).pct}%</div>
              <div className="pt-2">
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-800 ring-1 ring-amber-200">DEMO DATA 포함</span>
              </div>
            </div>
          </div>
        </div>
        <div className="divide-y divide-ink-100">
          {SECTIONS.map((s) => (
            <section key={s.id} className="px-6 py-8 sm:px-12">
              <h2 className="mb-4 text-[13px] font-semibold text-wine-700">{s.title}</h2>
              <dl className="grid gap-x-8 md:grid-cols-2">
                {fields
                  .filter((f) => f.section === s.id)
                  .map((f) => {
                    const edited = isEdited(p, f.key);
                    const wide = f.value.length > 48;
                    return (
                      <div key={f.key} className={clsx('group border-b border-ink-100/70 py-4', wide && 'md:col-span-2')}>
                        <dt className="flex items-center gap-2 text-[12px] font-medium text-ink-500">
                          {f.label} <span className="normal-case tracking-normal text-ink-400">· {f.ko}</span>
                          <span className="no-print ml-auto flex items-center gap-1.5">
                            <KindBadge kind={edited ? 'USER_INPUT' : f.basis === 'ai' ? 'AI_ANALYSIS' : f.basis === 'calc' ? 'AI_ESTIMATE' : 'USER_INPUT'} />
                            {edited && (
                              <button type="button" onClick={() => reset(f.key)} title="자동 생성값으로 되돌리기" className="text-ink-400 hover:text-ink-700">
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </span>
                        </dt>
                        <dd className="mt-1">
                          {editing === f.key ? (
                            <textarea
                              autoFocus
                              defaultValue={f.value}
                              rows={Math.max(2, Math.ceil(f.value.length / 60))}
                              onBlur={(e) => save(f.key, e.target.value)}
                              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink-500"
                            />
                          ) : (
                            <button type="button" onClick={() => setEditing(f.key)} className="flex w-full items-start gap-2 text-left text-base leading-relaxed text-ink-900">
                              <span className="flex-1">{f.value}</span>
                              <Pencil size={12} className="no-print mt-1.5 text-ink-300 opacity-0 transition group-hover:opacity-100" />
                            </button>
                          )}
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </section>
          ))}
        </div>
        <div className="bg-ink-50/60 px-6 py-5 text-[12px] leading-relaxed text-ink-500 sm:px-12">
          본 의뢰서의 시장·원가·시험 기간 수치는 데모 데이터 또는 AI 추정값을 포함합니다. 원료 함량·원료사·단가·MOQ는 제조사 및 원료사 확인이 필요하며, 기능성·표시광고 관련 사항은 규제 검토가 필요합니다.
        </div>
      </Card>

      {toast && <div className="no-print fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}
