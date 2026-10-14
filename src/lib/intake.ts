import type { Intake, IntakeField } from '@/data/types';

/**
 * Demo-mode "AI requirement analysis": a rule-based parser that turns the free-text idea
 * into structured fields. Anything it cannot find is filled with an AI recommendation
 * and marked AI_ESTIMATE so the user can see it was not stated.
 *
 * TODO(Phase 6): replace with an LLM call (structured output) behind DevDataSource.
 */

const ai = (value: string): IntakeField => ({ value, kind: 'AI_ANALYSIS' });
const guess = (value: string): IntakeField => ({ value, kind: 'AI_ESTIMATE' });

const CATEGORY_RULES: [RegExp, string, string][] = [
  [/앰플|세럼|에센스|serum|ampoule/i, '스킨케어 > 앰플/세럼', 'Ampoule'],
  [/크림|cream/i, '스킨케어 > 크림', 'Cream'],
  [/토너|스킨|toner/i, '스킨케어 > 토너', 'Toner'],
  [/선크림|선스틱|자외선|sun/i, '선케어 > 선크림', 'Sun Cream'],
  [/클렌징|클렌저|폼|cleanser/i, '클렌징 > 클렌저', 'Cleanser'],
  [/패드|pad/i, '스킨케어 > 패드', 'Pad'],
  [/마스크|팩/i, '스킨케어 > 마스크팩', 'Mask'],
];

const BENEFIT_RULES: [RegExp, string, string][] = [
  [/탄력|리프팅|firm/i, '탄력', 'Firming'],
  [/주름|안티에이징|노화|anti/i, '주름', 'Anti-aging'],
  [/미백|브라이트|톤업|잡티/i, '미백', 'Brightening'],
  [/진정|민감|시카/i, '진정', 'Calming'],
  [/보습|수분|촉촉/i, '보습', 'Hydrating'],
  [/장벽/i, '피부 장벽', 'Barrier'],
  [/모공|피지/i, '모공', 'Pore'],
  [/광채|윤기/i, '광채', 'Glow'],
];

const CHANNEL_RULES: [RegExp, string][] = [
  [/올리브영/, '올리브영'],
  [/자사몰|공식몰/, '자사몰'],
  [/쿠팡/, '쿠팡'],
  [/아마존|amazon/i, '아마존'],
  [/백화점/, '백화점'],
  [/면세/, '면세점'],
  [/무신사/, '무신사'],
  [/큐텐|qoo10/i, 'Qoo10'],
];

function parsePrice(text: string): { lo: number; hi: number } | null {
  const range = text.match(/(\d+)\s*만\s*원?\s*대/);
  if (range) {
    const n = Number(range[1]);
    return { lo: n * 10000 - 1000, hi: n * 10000 + 9000 };
  }
  const exact = text.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*원/);
  if (exact) {
    const n = Number(exact[1].replace(/,/g, ''));
    return { lo: Math.round(n * 0.9), hi: Math.round(n * 1.1) };
  }
  const man = text.match(/(\d+(?:\.\d)?)\s*만\s*원/);
  if (man) {
    const n = Number(man[1]) * 10000;
    return { lo: Math.round(n * 0.9), hi: Math.round(n * 1.1) };
  }
  return null;
}

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export function analyzeIdea(text: string): { intake: Intake; productName: string; missing: string[] } {
  const missing: string[] = [];

  const cat = CATEGORY_RULES.find(([re]) => re.test(text));
  const category = cat ? ai(cat[1]) : guess('스킨케어 > 앰플/세럼');
  if (!cat) missing.push('category');

  const benefits = BENEFIT_RULES.filter(([re]) => re.test(text));
  const benefitLabels = [...new Set(benefits.map((b) => b[1]))];
  if (benefitLabels.includes('탄력') || benefitLabels.includes('주름')) {
    for (const extra of ['주름', '안티에이징']) if (!benefitLabels.includes(extra)) benefitLabels.push(extra);
  }
  const benefit = benefitLabels.length ? ai(benefitLabels.slice(0, 3).join(' / ')) : guess('보습 / 진정');
  if (!benefitLabels.length) missing.push('benefit');

  const age = text.match(/(\d)0\s*대/);
  const gender = /남성|남자/.test(text) ? '남성' : /여성|여자/.test(text) ? '여성' : null;
  let target: IntakeField;
  if (age) {
    const a = Number(age[1]) * 10;
    target = ai(`${a}~${a + 9}세 ${gender ?? '여성·남성'}`);
  } else if (gender) {
    target = ai(`25~44세 ${gender}`);
  } else {
    target = guess('25~39세 여성');
    missing.push('target');
  }

  const p = parsePrice(text);
  const price = p ? ai(`${won(p.lo)} ~ ${won(p.hi)}`) : guess('25,000원 ~ 35,000원');
  if (!p) missing.push('price');

  const channels = CHANNEL_RULES.filter(([re]) => re.test(text)).map(([, c]) => c);
  const channel = channels.length ? ai(channels.join(' / ')) : guess('올리브영 / 자사몰');
  if (!channels.length) missing.push('channel');

  const mid = p ? (p.lo + p.hi) / 2 : 30000;
  const functional = benefitLabels.some((b) => ['탄력', '주름', '미백'].includes(b));
  const tier = mid >= 45000 ? '프리미엄' : mid >= 22000 ? '중가' : '가성비';
  const position = { value: `${tier} ${functional ? '기능성 ' : ''}${category.value.split(' > ')[0]}`, kind: 'AI_ANALYSIS' as const };

  const catEn = cat?.[2] ?? 'Ampoule';
  const benefitEn = benefits[0]?.[2] ?? 'Hydrating';
  const firming = benefitEn === 'Firming' || benefitEn === 'Anti-aging';
  const productName = `${firming ? 'PDRN ' : ''}${benefitEn} ${catEn}`;
  const concept = { value: `${functional ? '고기능성 ' : ''}${benefitLabels[0] ?? '데일리'} ${category.value.split(' > ')[1] ?? ''}`.trim(), kind: 'AI_ANALYSIS' as const };

  return { intake: { category, target, benefit, price, channel, position, concept }, productName, missing };
}

export const INTAKE_LABELS: Record<keyof Intake, { en: string; ko: string }> = {
  category: { en: 'Category', ko: '카테고리' },
  target: { en: 'Target', ko: '타깃' },
  benefit: { en: 'Core Benefit', ko: '핵심 효능' },
  price: { en: 'Price', ko: '예상 판매가' },
  channel: { en: 'Channel', ko: '판매채널' },
  position: { en: 'Position', ko: '제품 포지션' },
  concept: { en: 'Concept', ko: '제품 컨셉' },
};

export const EXAMPLE_IDEA = '30대 여성을 위한 탄력 앰플을 만들고 싶어요. 판매가는 3만원대이고 올리브영과 자사몰 판매를 생각하고 있어요.';
