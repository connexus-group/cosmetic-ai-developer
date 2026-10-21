import { COMPETITORS, TESTS } from '@/data/mock';
import { fieldsOf, marketLabel, SPEC_GROUPS } from '@/data/intakeSpec';
import { BLUEPRINT_FIELDS } from '@/data/blueprintFields';
import type { DataKind, Project } from '@/data/types';
import { displayValue, first, isSet, signals, vals } from './spec';
import { packagingBriefRows } from '@/data/packaging';
import { conceptOf, costSummary, effectiveConcept, formulaOf, krw, packageOf, regulationItems, testsOf, timelineOf } from './engine';

export interface BriefField {
  key: string;
  label: string;
  ko: string;
  value: string;
  /** where the auto value came from */
  basis: 'intake' | 'selection' | 'ai' | 'calc';
  section: 'Overview' | 'Product' | 'Commercial' | 'Compliance' | 'Blueprint' | 'AIBlueprint' | 'Packaging';
  /** source badge when it differs from what `basis` implies */
  kind?: DataKind;
}

/** Assemble the Product Development Brief from every decision in the project. User edits override auto values. */
export function buildBrief(p: Project): BriefField[] {
  const c = effectiveConcept(p);
  const f = formulaOf(p);
  const pk = packageOf(p);
  const cost = costSummary(p);
  const tl = timelineOf(p);
  const reg = regulationItems(p).filter((r) => r.risk !== 'LOW');
  const bench = COMPETITORS.filter((x) => x.hero === c.hero || c.actives.includes(x.hero)).slice(0, 3);
  const required = testsOf(p).filter((t) => t.group !== 'MARKETING');
  const marketing = testsOf(p).filter((t) => t.group === 'MARKETING');
  const g = signals(p);
  const spec = p.spec ?? {};
  const extras = [
    first(spec, 'scent'),
    vals(spec, 'finish').length ? `${vals(spec, 'finish').join('·')} 마무리감` : null,
    first(spec, 'stickiness') ? `끈적임: ${first(spec, 'stickiness')}` : null,
    first(spec, 'appearance') ? `외관: ${first(spec, 'appearance')}` : null,
    g.exclude.length ? `제외 원료: ${g.exclude.join(', ')}` : null,
    g.mustInclude.length ? `필수 원료: ${g.mustInclude.join(', ')} (원료사 확인 필요)` : null,
    g.vegan ? '비건 지향 (원료 유래 확인 필요)' : null,
    g.lowIrritation || g.sensitive ? '저자극 설계·피부 자극 시험 희망' : null,
    g.natural ? '천연 유래 원료 선호' : null,
    first(spec, 'supplier') ? `원료사 지정: ${first(spec, 'supplier')}` : null,
  ].filter(Boolean) as string[];
  const blueprint: BriefField[] = SPEC_GROUPS.map((grp) => {
    const answered = fieldsOf(grp.id).filter((f) => isSet(spec[f.id]));
    const modes = answered.map((f) => spec[f.id]!.mode);
    return {
      key: `blueprint-${grp.id}`,
      label: grp.en,
      ko: grp.label,
      value: answered.length ? answered.map((f) => `${f.label}: ${displayValue(f, spec[f.id])}`).join(' / ') : '미정',
      basis: 'intake' as const,
      section: 'Blueprint' as const,
      kind: (modes.includes('ai') ? 'DEMO_RECOMMEND' : modes.includes('idea') ? 'AI_ANALYSIS' : 'USER_INPUT') as DataKind,
    };
  });
  const undecided = SPEC_GROUPS.flatMap((grp) => fieldsOf(grp.id)).filter((f) => !isSet(spec[f.id]));
  if (undecided.length) blueprint.push({ key: 'blueprint-open', label: 'Undecided', ko: '미정 항목', value: undecided.map((f) => f.label).join(', '), basis: 'intake', section: 'Blueprint' });
  // The confirmed AI Product Blueprint, item by item, with where each value came from.
  const bp = p.blueprint;
  const aiBlueprint: BriefField[] = bp
    ? [
        ...BLUEPRINT_FIELDS.map((f) => {
          const e = bp.entries[f.key];
          const undecided = !e || e.origin === 'UNDETERMINED';
          return {
            key: `bp-${f.key}`,
            label: f.key,
            ko: f.label,
            value: `${undecided ? '미정' : e.value}${e?.needsVerification && !undecided ? ' (확인 필요)' : ''}`,
            basis: 'ai' as const,
            section: 'AIBlueprint' as const,
            kind: (e?.origin === 'USER_PROVIDED' ? 'USER_INPUT' : undecided ? 'AI_ESTIMATE' : bp.mode === 'ai' ? 'AI_ANALYSIS' : 'DEMO_RECOMMEND') as DataKind,
          };
        }),
        {
          key: 'bp-regulatory',
          label: 'Country Regulatory Check',
          ko: '국가별 규제 확인',
          value: bp.regulatory.length ? bp.regulatory.map((r) => `${r.country}: ${r.status === 'VERIFIED' && r.source ? `확인됨 (${r.source.title}, ${r.checkedAt})` : '규제 확인 필요'}`).join(' / ') : '판매 국가 미정',
          basis: 'ai' as const,
          section: 'AIBlueprint' as const,
          kind: 'AI_ESTIMATE' as DataKind,
        },
      ]
    : [];
  const auto: BriefField[] = [
    { key: 'name', label: 'Project Name', ko: '프로젝트명', value: p.name, basis: 'selection', section: 'Overview' },
    { key: 'category', label: 'Product Category', ko: '카테고리', value: p.intake.category.value, basis: 'intake', section: 'Overview' },
    { key: 'target', label: 'Target Consumer', ko: '타깃', value: `${p.intake.target.value} · ${c.target}`, basis: 'intake', section: 'Overview' },
    { key: 'concept', label: 'Product Concept', ko: '제품 컨셉', value: c.oneLiner, basis: 'selection', section: 'Overview' },
    { key: 'claims', label: 'Key Claims', ko: '핵심 효능', value: c.claims.join(' / '), basis: 'selection', section: 'Overview' },
    { key: 'hero', label: 'Hero Ingredient', ko: '히어로 원료', value: c.hero, basis: 'selection', section: 'Product' },
    { key: 'actives', label: 'Active Ingredients', ko: '액티브 원료', value: c.actives.join(' / '), basis: 'selection', section: 'Product' },
    { key: 'texture', label: 'Texture / Formula', ko: '제형', value: f ? `${f.name} (${f.nameKo}) · ${f.viscosity}` : `${c.texture} (제형 미선택)`, basis: 'selection', section: 'Product' },
    { key: 'usage', label: 'Usage', ko: '사용법', value: c.actives.includes('Retinal') ? '저녁 세안 후 토너 다음 단계, 2~3방울. 사용 초기 격일 사용 권장 (제조사 확인)' : '아침·저녁 세안 후 토너 다음 단계, 2~3방울', basis: 'ai', section: 'Product' },
    { key: 'functionality', label: 'Functionality', ko: '기능성', value: c.claims.some((x) => /주름/.test(x)) || c.actives.includes('Adenosine') ? '주름개선 기능성 (보고/심사 방식 규제 검토 필요)' : '일반화장품', basis: 'ai', section: 'Product' },
    { key: 'size', label: 'Size', ko: '용량', value: `${c.sizeMl}ml`, basis: 'selection', section: 'Product' },
    { key: 'packaging', label: 'Packaging', ko: '용기', value: pk ? `${pk.name} (${pk.material})` : '패키지 미선택', basis: 'selection', section: 'Product' },
    { key: 'price', label: 'Target Retail Price', ko: '목표 판매가', value: `${krw(p.retailPrice)} (VAT 포함)`, basis: 'calc', section: 'Commercial' },
    { key: 'cost', label: 'Target Cost', ko: '목표 원가', value: `${krw(cost.total)} 이하 (원가율 ${(cost.costRatio * 100).toFixed(1)}%)`, basis: 'calc', section: 'Commercial' },
    ...(g.targetCost ? [{ key: 'targetCost', label: 'Target Manufacturing Cost', ko: '입력한 목표 제조원가', value: `${krw(g.targetCost)} · 현재 예상 ${krw(cost.total)} (데모 추정)`, basis: 'intake' as const, section: 'Commercial' as const }] : []),
    { key: 'moq', label: 'MOQ', ko: '초도 수량', value: `${p.moq.toLocaleString()}개`, basis: 'calc', section: 'Commercial' },
    { key: 'channel', label: 'Sales Channel', ko: '판매채널', value: p.intake.channel.value, basis: 'intake', section: 'Commercial' },
    { key: 'markets', label: 'Target Markets', ko: '판매 국가', value: g.markets.length ? `${g.markets.map(marketLabel).join(', ')}${first(spec, 'priorityMarket') ? ` (우선 출시: ${marketLabel(first(spec, 'priorityMarket')!)})` : ''}${g.overseas.length ? ' · 국가별 규제 검토 필요' : ''}` : '미정', basis: 'intake', section: 'Commercial' },
    { key: 'launch', label: 'Target Launch', ko: '목표 출시 시기', value: first(spec, 'launchTiming') ?? '미정', basis: 'intake', section: 'Commercial' },
    { key: 'benchmark', label: 'Benchmark Products', ko: '벤치마크 제품', value: bench.map((b) => `${b.brand} ${b.product} (DEMO)`).join(' / ') || '경쟁제품 분석 참고', basis: 'ai', section: 'Commercial' },
    { key: 'tests', label: 'Required Tests', ko: '필요 시험', value: [...required.map((t) => t.nameKo), ...(marketing.length ? [`효능: ${marketing.map((t) => t.nameKo).join(', ')}`] : [])].join(' / ') || '선택된 시험 없음', basis: 'selection', section: 'Compliance' },
    { key: 'regulatory', label: 'Regulatory Requirements', ko: '규제 요건', value: reg.map((r) => r.title).join(' / ') + ' (모두 규제 검토 필요)', basis: 'ai', section: 'Compliance' },
    { key: 'timeline', label: 'Development Timeline', ko: '개발 일정', value: `${tl.weeks}주 (기획 → 입고)`, basis: 'calc', section: 'Compliance' },
    { key: 'additional', label: 'Additional Requirements', ko: '추가 요청사항', value: '무향 또는 저향 · 끈적임 없는 마무리감 · 저자극 테스트 진행 희망', basis: 'ai', section: 'Compliance' },
    ...(extras.length ? [{ key: 'specRequests', label: 'Blueprint Requests', ko: '상세 기획 요청사항', value: extras.join(' · '), basis: 'intake' as const, section: 'Compliance' as const }] : []),
    ...blueprint,
    ...aiBlueprint,
    // Packaging Brief from the AI Packaging & Design Studio (only after a design direction is selected)
    ...packagingBriefRows(p).map((r) => ({ key: r.key, label: r.label, ko: r.label, value: r.value, basis: 'selection' as const, section: 'Packaging' as const, kind: r.kind })),
  ];
  return auto.map((x) => (p.brief[x.key] !== undefined ? { ...x, value: p.brief[x.key] } : x));
}

export const isEdited = (p: Project, key: string) => p.brief[key] !== undefined;

export function briefMissing(p: Project): string[] {
  const m: string[] = [];
  if (!conceptOf(p)) m.push('제품 컨셉');
  if (!formulaOf(p)) m.push('제형');
  if (!packageOf(p)) m.push('패키지');
  return m;
}

/** CSV export (opens in Excel). TODO(Phase 6): real .xlsx with formatting via a spreadsheet library or server. */
export function downloadCsv(p: Project) {
  const rows = [['항목', 'Field', '내용'], ...buildBrief(p).map((f) => [f.ko, f.label, f.value])];
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.name.replace(/\s+/g, '_')}_Development_Brief.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const ALL_TESTS = TESTS;
