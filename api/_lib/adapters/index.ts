/**
 * Data source registry. Only adapters with an implementation can be `connected`;
 * the planned ones are listed so the UI can show what is NOT connected yet.
 *
 * To add a source: implement `DataAdapter` in its own file (see naverShopping.ts),
 * map its records to `Observation`, and replace its `planned` entry below.
 */
import { naverShoppingAdapter } from './naverShopping.js';
import { comtradeInfo } from './unComtrade.js';
import type { AdapterInfo, DataAdapter } from './types.js';

export const ADAPTERS: Record<string, DataAdapter> = {
  'naver-datalab-shopping': naverShoppingAdapter,
};

const planned = (id: string, name: string, homepage: string, description: string, env: string[], costNote: string): AdapterInfo => ({ id, name, homepage, status: 'planned', description, env, costNote });

export const PLANNED: AdapterInfo[] = [
  planned('kosis', 'KOSIS 국가통계포털', 'https://kosis.kr/openapi/', '화장품 생산·출하·소매판매 등 공식 통계', ['KOSIS_API_KEY'], '무료 (인증키 발급 필요)'),
  planned('google-trends', 'Google Trends', 'https://trends.google.com/', '국가별 검색 관심도 (공식 API 접근 권한 필요)', ['GOOGLE_TRENDS_*'], '공식 API는 별도 승인 필요'),
  planned('licensed-products', '허가된 쇼핑몰 제품 데이터', '', '제휴·라이선스 계약된 쇼핑몰의 제품·가격 데이터', [], '계약 조건에 따름'),
  planned('licensed-reviews', '허가된 소비자 리뷰 데이터', '', '이용 허락을 받은 리뷰 데이터 (키워드·감성 분석용)', [], '계약 조건에 따름'),
  planned('regulations', '국가별 화장품 규제 공식 자료', '', '식약처, EU CosIng, 중국 NMPA, 미국 FDA(MoCRA) 등 공식 원료·표시 규정', [], '대부분 무료 (자료별 이용 조건 확인 필요)'),
];

export function sourceStatus() {
  return [...Object.values(ADAPTERS).map((a) => a.info()), comtradeInfo(), ...PLANNED];
}
