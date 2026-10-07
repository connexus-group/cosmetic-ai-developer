import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

/** Shown when a step is opened before the decision it depends on, so it previews the AI-recommended option. */
export function PreviewBanner({ projectId, step, what }: { projectId: string; step: 'concept' | 'formula' | 'packaging'; what: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Info size={15} />
      아직 {what}을(를) 선택하지 않아 AI 추천안 기준으로 미리 보여드려요.
      <Link to={`/projects/${projectId}/${step}`} className="ml-auto font-semibold underline underline-offset-2">
        {what} 선택하기
      </Link>
    </div>
  );
}
