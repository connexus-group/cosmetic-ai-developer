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
