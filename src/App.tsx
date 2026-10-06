import { Route, Routes } from 'react-router-dom';

function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">어떤 화장품을 만들고 싶으세요?</h1>
      <p className="mt-3 text-sm text-slate-500">AI Product Developer · 프로젝트 초기 설정</p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
