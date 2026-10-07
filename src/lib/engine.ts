import { CHECKLIST, COST_BASE, CONCEPTS, FORMULAS, MOQ_FACTOR, PACKAGES, TESTS, TIMELINE_BASE } from '@/data/mock';
import type { ClaimRiskHit, ConceptOption, CostKey, FormulaOption, PackageOption, Project, RegulationItem, StepId, TimelineTask } from '@/data/types';

/**
 * Rule-based demo engines that derive results from the project's choices.
 * They run on the client so every edit is reflected immediately.
 * TODO(Phase 6): move regulation / cost rules to a server-side engine with reviewed rule data.
 */

export const conceptOf = (p: Project): ConceptOption | undefined => CONCEPTS.find((c) => c.id === p.conceptId);
/** The chosen concept, or the AI-recommended one when the user has not chosen yet (preview). */
export const effectiveConcept = (p: Project): ConceptOption => conceptOf(p) ?? CONCEPTS.find((c) => c.recommended) ?? CONCEPTS[0];
export const formulaOf = (p: Project): FormulaOption | undefined => FORMULAS.find((f) => f.id === p.formulaId);
export const packageOf = (p: Project): PackageOption | undefined => PACKAGES.find((x) => x.id === p.packageId);

// ── Steps & progress ────────────────────────────────────────────────────────

export const STEPS: { id: StepId; no: string; label: string; ko: string; group: 'Start' | 'Research' | 'Design' | 'Plan' }[] = [
  { id: 'overview', no: '01', label: 'Overview', ko: '개요', group: 'Start' },
  { id: 'market', no: '02', label: 'Market', ko: '시장', group: 'Research' },
  { id: 'competitors', no: '03', label: 'Competitors', ko: '경쟁제품', group: 'Research' },
  { id: 'consumer', no: '04', label: 'Consumer', ko: '소비자', group: 'Research' },
  { id: 'trend', no: '05', label: 'Trend', ko: '트렌드', group: 'Research' },
  { id: 'opportunity', no: '06', label: 'Opportunity', ko: '시장 기회', group: 'Research' },
  { id: 'concept', no: '07', label: 'Concept', ko: '제품 컨셉', group: 'Design' },
  { id: 'formula', no: '08', label: 'Formula', ko: '제형', group: 'Design' },
  { id: 'ingredients', no: '09', label: 'Ingredients', ko: '원료', group: 'Design' },
  { id: 'packaging', no: '10', label: 'Packaging', ko: '패키지', group: 'Design' },
  { id: 'cost', no: '11', label: 'Cost', ko: '원가', group: 'Plan' },
  { id: 'regulation', no: '12', label: 'Regulation', ko: '규제', group: 'Plan' },
  { id: 'testing', no: '13', label: 'Testing', ko: '시험', group: 'Plan' },
  { id: 'timeline', no: '14', label: 'Timeline', ko: '일정·체크리스트', group: 'Plan' },
  { id: 'brief', no: '15', label: 'Development Brief', ko: '개발의뢰서', group: 'Plan' },
];

/** What the user is asked to do next when a step is the next one, and the button that takes them there. */
export const NEXT_ACTION: Record<StepId, { question: string; cta: string }> = {
  overview: { question: '프로젝트 개요를 확인해 볼까요?', cta: '개요 보기' },
  market: { question: '시장과 경쟁환경을 먼저 분석해볼까요?', cta: '시장 분석 시작' },
  competitors: { question: '이미 팔리고 있는 경쟁제품을 살펴볼까요?', cta: '경쟁제품 분석하기' },
  consumer: { question: '소비자가 무엇을 원하고 무엇이 불만인지 볼까요?', cta: '소비자 니즈 분석' },
  trend: { question: '지금 뜨는 성분 트렌드를 확인해 볼까요?', cta: '트렌드 분석' },
  opportunity: { question: '분석 결과를 모아 시장 기회를 찾아볼까요?', cta: '시장 기회 찾기' },
  concept: { question: '기회를 바탕으로 제품 컨셉을 골라볼까요?', cta: '제품 컨셉 만들기' },
  formula: { question: '컨셉에 맞는 제형을 정해볼까요?', cta: '제형 정하기' },
  ingredients: { question: '어떤 원료가 들어가는지 확인해 볼까요?', cta: '원료 구성 보기' },
  packaging: { question: '제품을 담을 용기를 골라볼까요?', cta: '패키지 고르기' },
  cost: { question: '얼마에 만들어 얼마가 남는지 계산해 볼까요?', cta: '원가 계산하기' },
  regulation: { question: '출시 전에 확인할 규제 사항을 볼까요?', cta: '규제 검토하기' },
  testing: { question: '어떤 시험이 필요한지 정해볼까요?', cta: '시험 계획 세우기' },
  timeline: { question: '출시까지 일정을 짜볼까요?', cta: '개발 일정 보기' },
  brief: { question: '제조사에 보낼 개발의뢰서를 만들어 볼까요?', cta: '개발의뢰서 만들기' },
};

/** Which upstream decision each step depends on. A step opened before that decision changed needs review. */
const DEPENDS: Partial<Record<StepId, (keyof Project['changed'])[]>> = {
  market: ['intake'],
  competitors: ['intake'],
  consumer: ['intake'],
  trend: ['intake'],
  opportunity: ['intake'],
  concept: ['intake'],
  formula: ['concept'],
  ingredients: ['concept', 'formula'],
  packaging: ['concept', 'formula'],
  cost: ['concept', 'formula', 'package'],
  regulation: ['concept'],
  testing: ['concept'],
  timeline: ['concept', 'package'],
  brief: ['intake', 'concept', 'formula', 'package'],
};

export type StepStatus = 'done' | 'stale' | 'todo';

export function stepStatus(p: Project, id: StepId): StepStatus {
  const selection: Partial<Record<StepId, unknown>> = { concept: p.conceptId, formula: p.formulaId, packaging: p.packageId };
  const visited = p.visited[id];
  const done = id in selection ? !!selection[id] && !!visited : !!visited;
  if (!done) return 'todo';
  const deps = DEPENDS[id] ?? [];
  const stale = deps.some((d) => {
    const changed = p.changed[d];
    return changed && visited && changed > visited;
  });
  return stale ? 'stale' : 'done';
}

export function progressOf(p: Project) {
  const stepsDone = STEPS.filter((s) => stepStatus(p, s.id) === 'done').length;
  const checks = CHECKLIST.filter((c) => p.checklist[c.id]).length;
  // Weighted: completing the analysis/design steps is 60%, the real-world checklist is 40%.
  const pct = Math.round((stepsDone / STEPS.length) * 60 + (checks / CHECKLIST.length) * 40);
  return { pct, stepsDone, stepsTotal: STEPS.length, checks, checksTotal: CHECKLIST.length };
}

export function currentStep(p: Project): (typeof STEPS)[number] {
  return STEPS.find((s) => stepStatus(p, s.id) !== 'done') ?? STEPS[STEPS.length - 1];
}

// ── Cost ────────────────────────────────────────────────────────────────────

export const COST_KEYS: CostKey[] = ['content', 'container', 'pump', 'carton', 'label', 'filling', 'packing', 'testing', 'logistics'];
const PACKAGING_KEYS: CostKey[] = ['container', 'pump', 'carton', 'label'];
const PROCESS_KEYS: CostKey[] = ['filling', 'packing'];

/** Default unit cost at MOQ 5,000 for each line, derived from the chosen formula and package. */
export function costDefaults(p: Project): Record<CostKey, number> {
  const f = formulaOf(p) ?? FORMULAS[0];
  const pk = packageOf(p) ?? PACKAGES[0];
  const concept = conceptOf(p);
  const contentAdj = concept?.id === 'C' ? 1.6 : concept?.id === 'A' ? 0.9 : 1;
  return { content: Math.round(f.costPerUnit * contentAdj), container: pk.unitCost, pump: pk.pumpCost, ...COST_BASE };
}

export function costLines(p: Project, moq = p.moq) {
  const base = costDefaults(p);
  const factor = MOQ_FACTOR[moq];
  return COST_KEYS.map((key) => {
    const userValue = p.costOverrides[key];
    const at5000 = userValue ?? base[key];
    const mult = key === 'content' ? factor.content : PACKAGING_KEYS.includes(key) ? factor.packaging : PROCESS_KEYS.includes(key) ? factor.process : 1;
    return { key, at5000, value: Math.round(at5000 * mult), edited: userValue !== undefined };
  });
}

export function costSummary(p: Project, moq = p.moq) {
  const lines = costLines(p, moq);
  const total = lines.reduce((a, l) => a + l.value, 0);
  const retail = p.retailPrice;
  const supply = retail / 1.1; // VAT excluded
  const channelFee = supply * p.channelFeeRate;
  const net = supply - channelFee;
  return {
    lines,
    total,
    costRatio: total / retail,
    grossMargin: (supply - total) / supply,
    netMargin: (net - total) / supply,
    netPerUnit: net - total,
  };
}

// ── Regulation ──────────────────────────────────────────────────────────────

const RISK_PHRASES: { re: RegExp; phrase: string; risk: ClaimRiskHit['risk']; reason: string; alternative: string }[] = [
  { re: /재생/, phrase: '재생', risk: 'HIGH', reason: '피부 "재생"은 의약품 효능으로 오인될 수 있는 표현입니다.', alternative: '피부 컨디션 케어, 생기 있는 피부' },
  { re: /세포/, phrase: '세포 활성화', risk: 'HIGH', reason: '세포 단위 작용을 강조하면 의약품 오인 소지가 있습니다.', alternative: '피부 활력, 건강한 피부결' },
  { re: /염증|치료|치유/, phrase: '염증 치료', risk: 'HIGH', reason: '질병의 치료·예방 표현은 화장품에 사용할 수 없습니다.', alternative: '피부 진정에 도움' },
  { re: /여드름|아토피|흉터|상처/, phrase: '질환 관련 표현', risk: 'HIGH', reason: '피부 질환 개선 표현은 의약품 오인 표현에 해당할 수 있습니다.', alternative: '트러블 피부를 위한 순한 케어 (근거 필요)' },
  { re: /주름\s*(개선|완화|감소)/, phrase: '주름 개선', risk: 'MEDIUM', reason: '기능성화장품 심사·보고를 마친 경우에만 표시할 수 있습니다.', alternative: '기능성 심사 완료 후 사용, 이전에는 "탄력 케어"' },
  { re: /미백|화이트닝/, phrase: '미백', risk: 'MEDIUM', reason: '미백 기능성 심사·보고 후에만 표시할 수 있습니다.', alternative: '맑은 피부톤 케어 (기능성 완료 전)' },
  { re: /100%|완벽|영구|즉시|즉각/, phrase: '절대적 표현', risk: 'MEDIUM', reason: '절대적·과장 표현은 실증 자료가 필요하고 부당 광고로 판단될 수 있습니다.', alternative: '사용 후 ○주 탄력 개선 (시험 결과 기반)' },
  { re: /최고|최초|유일|1위/, phrase: '최상급 표현', risk: 'MEDIUM', reason: '비교·최상급 표현은 객관적 근거가 필요합니다.', alternative: '근거 자료와 기준을 함께 표기' },
  { re: /줄기세포|DNA\s*복구|유전자/, phrase: '유전자·줄기세포', risk: 'HIGH', reason: '생체 기능 변화를 암시하는 표현은 의약품 오인 소지가 큽니다.', alternative: '원료명만 표기 (예: PDRN 함유)' },
  { re: /저자극|민감/, phrase: '저자극', risk: 'MEDIUM', reason: '"저자극"은 피부 자극 시험 등 실증 자료가 있어야 합니다.', alternative: '피부 자극 시험 완료 후 사용' },
];

export function checkClaims(text: string): ClaimRiskHit[] {
  return RISK_PHRASES.filter((r) => r.re.test(text)).map(({ phrase, risk, reason, alternative }) => ({ phrase, risk, reason, alternative }));
}

export const DEFAULT_CLAIM_COPY = '피부 재생을 돕는 PDRN과 레티날이 세포 활성화로 주름 개선! 민감 피부도 쓸 수 있는 저자극 탄력 앰플';

export function regulationItems(p: Project): RegulationItem[] {
  const c = conceptOf(p) ?? CONCEPTS[1];
  const claimHits = checkClaims(p.claimCopy);
  const highClaims = claimHits.filter((h) => h.risk === 'HIGH').length;
  const items: RegulationItem[] = [];
  const wrinkle = c.claims.some((x) => /주름/.test(x)) || c.actives.includes('Adenosine');
  items.push({
    id: 'functional',
    area: 'Functional Cosmetic',
    title: wrinkle ? '주름개선 기능성화장품 가능성' : '일반화장품 예상',
    risk: wrinkle ? 'MEDIUM' : 'LOW',
    detail: wrinkle
      ? '아데노신 등 고시 성분으로 "주름 개선"을 표시하려면 기능성화장품 심사 또는 보고가 필요합니다.'
      : '현재 컨셉은 기능성 표시가 없는 일반화장품으로 예상됩니다.',
    action: wrinkle ? '기능성 보고/심사 방식과 일정을 제조사와 규제 검토 필요' : '표시 문구에 기능성 효능이 들어가지 않도록 확인',
  });
  if (c.claims.some((x) => /미백/.test(x)) || c.actives.includes('Niacinamide')) {
    items.push({ id: 'functional-white', area: 'Functional Cosmetic', title: '미백 기능성 표시 여부', risk: 'MEDIUM', detail: '나이아신아마이드를 "미백" 효능으로 표시하려면 기능성 절차가 필요합니다.', action: '광채·톤 메시지로 갈지, 미백 기능성을 진행할지 결정 (규제 검토 필요)' });
  }
  items.push({
    id: 'claims',
    area: 'Claims Risk',
    title: '표시·광고 표현',
    risk: highClaims > 0 ? 'HIGH' : claimHits.length ? 'MEDIUM' : 'LOW',
    detail: claimHits.length ? `현재 문구에서 주의 표현 ${claimHits.length}개가 감지되었습니다 (아래 Risk Checker 참고).` : '현재 문구에서 감지된 주의 표현이 없습니다.',
    action: '최종 광고 문구는 규제 검토 필요',
  });
  if (c.actives.includes('Retinal')) {
    items.push({ id: 'retinal', area: 'Ingredient Review', title: 'Retinal 사용 기준·주의사항', risk: 'MEDIUM', detail: '레티날 계열은 함량, 사용상 주의사항 표시, 국가별 기준이 다를 수 있습니다.', action: '함량과 주의 문구를 원료사·제조사와 규제 검토 필요' });
  }
  if (c.hero === 'NAD+') {
    items.push({ id: 'nad', area: 'Ingredient Review', title: 'NAD+ 화장품 원료 사용 가능 여부', risk: 'HIGH', detail: '원료의 INCI 등재와 화장품 사용 가능 여부가 아직 확인되지 않았습니다.', action: '원료사 확인 및 규제 검토 필요' });
  }
  items.push({ id: 'pdrn', area: 'Ingredient Review', title: '원료 규격·유래 확인', risk: 'LOW', detail: 'PDRN 등 유래 원료는 원료 규격서와 유래(어류 등) 표시를 확인해야 합니다.', action: '원료사 규격서 수령' });
  items.push({ id: 'label', area: 'Label Review', title: '전성분·사용상 주의사항 표시', risk: 'MEDIUM', detail: '전성분 표시 순서, 사용상 주의사항, 기능성 문구 위치 등 표시사항을 확인해야 합니다.', action: '디자인 확정 전 표시사항 검토' });
  items.push({ id: 'export', area: 'Export', title: '해외 판매 시 국가별 규제', risk: 'LOW', detail: '국내 출시 기준입니다. 일본·미국 등 수출 시 성분·표시 기준을 별도로 확인해야 합니다.', action: '판매 국가 확정 후 규제 검토 필요' });
  return items;
}

// ── Testing & timeline ──────────────────────────────────────────────────────

export const testsOf = (p: Project) => TESTS.filter((t) => p.tests[t.id]);

export function timelineOf(p: Project): { tasks: TimelineTask[]; weeks: number; notes: string[] } {
  const c = conceptOf(p);
  const notes: string[] = [];
  let shift = 0;
  let testExtra = 0;
  if (c?.id === 'C') {
    shift = 2;
    notes.push('NAD+ 원료 확인과 캡슐 제형 개발로 샘플 단계 +2주');
  }
  if (c?.id === 'A') {
    shift = -2;
    notes.push('검증된 원료와 젤 제형으로 샘플 단계 −2주');
  }
  const marketingTests = TESTS.filter((t) => t.group === 'MARKETING' && p.tests[t.id]).length;
  if (marketingTests > 3) {
    testExtra = 1;
    notes.push(`마케팅 효능 시험 ${marketingTests}개 동시 진행으로 시험 단계 +1주`);
  }
  if (p.packageId === 'airless') notes.push('에어리스 용기는 MOQ와 리드타임을 제조사와 확인 필요');
  const AFTER_SAMPLE1 = ['sample2', 'packaging', 'testing', 'design', 'order', 'production', 'qc', 'launch'];
  const AFTER_TESTING = ['design', 'order', 'production', 'qc', 'launch'];
  const tasks = TIMELINE_BASE.map((t) => {
    let { start, end } = t;
    if (t.id === 'sample1') end += shift;
    if (AFTER_SAMPLE1.includes(t.id)) {
      start += shift;
      end += shift;
    }
    if (t.id === 'testing') end += testExtra;
    if (AFTER_TESTING.includes(t.id)) {
      start += testExtra;
      end += testExtra;
    }
    return { ...t, start: Math.max(1, start), end: Math.max(start, end) };
  });
  const weeks = Math.max(...tasks.map((t) => t.end));
  return { tasks, weeks, notes };
}

export const krw = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
