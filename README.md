# Cosmetic AI Developer

화장품 개발 전문지식이 없어도 제품 아이디어만 입력하면 시장조사부터 제조사 전달용 제품개발의뢰서까지 만들어 주는 AI 화장품 상품기획 서비스입니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
```

## 배포 (Vercel)
`vercel.json`이 SPA fallback을 설정합니다. `/assets/*`를 제외한 모든 경로는 `index.html`로 rewrite됩니다.

## Stack
React 19 · TypeScript · Vite · Tailwind CSS v4 · Recharts · Lucide Icons · React Router

## 구조 (Frontend MVP)
- `src/data/types.ts` 데이터 타입 · `src/data/mock.ts` 데모 데이터(모두 가상) · `src/data/source.ts` 데이터 소스 인터페이스
- 화면은 `dataSource.*`만 호출합니다. 실제 API 연결 시 `source.ts`의 `dataSource`만 교체하면 됩니다.
- `src/lib/engine.ts` 진행률·원가·규제·일정 계산 규칙 · `src/lib/brief.ts` 개발의뢰서 생성
- `src/state/ProjectStore.tsx` 프로젝트 저장 (현재 브라우저 localStorage, 백엔드 연결 시 교체)
- `src/pages/project/steps/*` 15단계 화면

## 데이터 표시 원칙
모든 수치에는 DEMO / AI ANALYSIS / AI 추정 / USER INPUT 배지가 붙습니다. 원료사·원료 단가·MOQ·특허·임상 데이터는 만들지 않고 "데이터 없음 / 원료사 확인 필요"로 표시하며, 규제는 항상 "규제 검토 필요"로 안내합니다.
