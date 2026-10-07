import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { ProgressRing } from '@/components/charts';
import { Card, LinkButton } from '@/components/ui';
import { currentStep, progressOf } from '@/lib/engine';
import { useProjects } from '@/state/ProjectStore';

export default function Projects() {
  const { projects, remove } = useProjects();
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-wine-700">My projects</div>
          <h1 className="font-display mt-2 text-[40px] leading-tight text-ink-900 sm:text-[48px]">내 제품 개발 프로젝트</h1>
          <p className="mt-1 text-sm text-ink-500">프로젝트는 이 브라우저에 저장됩니다 (데모).</p>
        </div>
        <LinkButton to="/" variant="primary">
          <Plus size={15} /> 새 제품 개발
        </LinkButton>
      </div>
      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-base font-semibold text-ink-900">아직 프로젝트가 없어요</div>
          <p className="mt-1 text-sm text-ink-500">만들고 싶은 화장품 아이디어를 입력해 첫 프로젝트를 시작하세요.</p>
          <LinkButton to="/" variant="primary" className="mt-5">
            아이디어 입력하기 <ArrowRight size={15} />
          </LinkButton>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const prog = progressOf(p);
            const cur = currentStep(p);
            return (
              <Card key={p.id} className="flex items-center gap-4 p-5">
                <ProgressRing value={prog.pct} size={64} stroke={6} />
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${p.id}/overview`} className="block truncate font-semibold text-ink-900 hover:underline">
                    {p.name}
                  </Link>
                  <div className="mt-0.5 truncate text-xs text-ink-500">{p.idea}</div>
                  <div className="mt-1 text-xs text-ink-600">
                    현재 단계 {cur.no} {cur.label} · {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="프로젝트 삭제"
                  onClick={() => window.confirm(`"${p.name}" 프로젝트를 삭제할까요?`) && remove(p.id)}
                  className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
