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

## 실제 시장 데이터 (네이버 데이터랩 쇼핑인사이트)
Market · Consumer · Trend 화면 상단의 "실제 데이터" 영역은 서버 API가 외부 데이터를 수집해 보여 줍니다. 그 아래 기존 영역은 데모 데이터입니다.

External Data Source (`api/_lib/adapters/*`) → Server API (`api/market-data.ts`) → Data Validation (`api/_lib/observation.ts`) → Supabase (`api/_lib/supabase.ts`) → Analysis Engine (`api/_lib/analysis.ts`) → 화면 (`src/components/market/RealMarketData.tsx`)

- 환경변수는 `.env.example` 참고. 로컬은 `.env.local`에 넣고 `npm run dev`를 실행하면 `/api/*`도 함께 동작합니다.
- Supabase 테이블: `supabase/migrations/20261013000000_market_data.sql`을 SQL Editor에서 한 번 실행합니다.
- 값은 모두 클릭 상대지표(조회 결과 안 최댓값 = 100)입니다. 판매량·매출·점유율로 해석하지 않습니다.
- API 실패 시 데모 값으로 대체하지 않고 오류 또는 "데이터 부족"을 표시합니다.

### 키 없이 쓰는 실제 데이터: UN Comtrade 수출 통계
`api/trade-data.ts`가 UN Comtrade 공개 미리보기 API(무료, 키 불필요)에서 한국 화장품(HS 3304/3305/3307)의 국가별 연간 수출액을 가져옵니다. AI 기획안 아래 "실제 데이터 근거"와 Market 화면에 표시됩니다.
