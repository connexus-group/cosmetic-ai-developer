import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="font-display text-[72px] leading-none text-wine-700">404</div>
      <h1 className="mt-2 text-2xl font-semibold text-ink-900">페이지를 찾을 수 없어요</h1>
      <LinkButton to="/" variant="primary" className="mt-6">
        처음으로
      </LinkButton>
    </main>
  );
}
