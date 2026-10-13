/**
 * Analysis Engine. Two layers, both tied to observation ids:
 *
 * 1. computeFindings — plain arithmetic over collected values (averages, first vs last, peaks).
 *    Deterministic, always available, labeled COMPUTED.
 * 2. aiNarrative — optional. The AI model only sees the collected values and the computed
 *    findings. Every sentence must cite observation ids, and any number in a sentence must
 *    already exist in the data; sentences that break either rule are dropped, not repaired.
 *
 * Neither layer produces sales, revenue, market share, growth rates of sales, review counts or
 * consumer percentages: the source does not contain them.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AiStatement, Observation } from './observation.js';

const AGE_KO: Record<string, string> = { '10': '10대', '20': '20대', '30': '30대', '40': '40대', '50': '50대', '60': '60대 이상' };
const GENDER_KO: Record<string, string> = { f: '여성', m: '남성' };
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ym = (d: string) => d.slice(0, 7);

export interface Findings {
  statements: AiStatement[];
  /** what the data cannot answer — shown as "데이터 부족" */
  gaps: string[];
}

function series(list: Observation[]) {
  return [...list].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

/** first-window vs last-window average (3 periods each when there are ≥6, else 1) */
function change(list: Observation[]) {
  const s = series(list);
  if (s.length < 2) return null;
  const w = s.length >= 6 ? 3 : 1;
  const head = s.slice(0, w);
  const tail = s.slice(-w);
  const peak = s.reduce((a, b) => (b.metricValue > a.metricValue ? b : a));
  return { head, tail, from: r1(avg(head.map((o) => o.metricValue))), to: r1(avg(tail.map((o) => o.metricValue))), peak, w };
}

function byDimension(list: Observation[], prefix: string) {
  const groups = new Map<string, Observation[]>();
  for (const o of list) if (o.dimension.startsWith(prefix)) groups.set(o.dimension.slice(prefix.length), [...(groups.get(o.dimension.slice(prefix.length)) ?? []), o]);
  return [...groups.entries()].map(([g, obs]) => ({ group: g, obs, mean: r1(avg(obs.map((o) => o.metricValue))) })).sort((a, b) => b.mean - a.mean);
}

export function computeFindings(obs: Observation[], keywords: string[], categoryLabel: string): Findings {
  const statements: AiStatement[] = [];
  const gaps: string[] = [];
  let n = 0;
  const add = (text: string, used: Observation[]) => used.length && statements.push({ id: `f${++n}`, text, observationIds: [...new Set(used.map((o) => o.id))], dataType: 'COMPUTED' });
  const pick = (metric: string, keyword: string | null) => obs.filter((o) => o.metricName === metric && o.keyword === keyword);

  // Category trend
  const cat = change(pick('category_click_index', null));
  if (cat) {
    const wl = cat.w > 1 ? `처음 ${cat.w}개 기간 평균` : '첫 기간';
    const wr = cat.w > 1 ? `최근 ${cat.w}개 기간 평균` : '마지막 기간';
    add(
      `${categoryLabel} 분야 클릭 상대지표는 ${wl} ${cat.from}에서 ${wr} ${cat.to}로 ${cat.to >= cat.from ? '+' : ''}${r1(cat.to - cat.from)}p 변했습니다. 조회 기간 중 가장 높은 시점은 ${ym(cat.peak.periodStart)}(${r1(cat.peak.metricValue)})입니다.`,
      [...cat.head, ...cat.tail, cat.peak],
    );
  } else gaps.push('분야 전체 클릭 추이 데이터 부족');

  // Category by age / gender
  const ages = byDimension(pick('category_click_index_by_age', null), 'age:');
  if (ages.length >= 2) add(`연령대별 평균 클릭 상대지표는 ${ages.slice(0, 3).map((a) => `${AGE_KO[a.group] ?? a.group} ${a.mean}`).join(', ')} 순으로 높습니다.`, ages.slice(0, 3).flatMap((a) => a.obs));
  else gaps.push('연령별 관심도 데이터 부족');
  const genders = byDimension(pick('category_click_index_by_gender', null), 'gender:');
  if (genders.length === 2) add(`성별 평균 클릭 상대지표는 ${genders.map((g) => `${GENDER_KO[g.group]} ${g.mean}`).join(', ')}입니다.`, genders.flatMap((g) => g.obs));
  else gaps.push('성별 관심도 데이터 부족');

  // Keywords compared in one query
  if (!keywords.length) gaps.push('조회할 키워드가 없습니다');
  const kw = keywords
    .map((k) => ({ k, obs: pick('keyword_click_index', k) }))
    .filter((x) => x.obs.length)
    .map((x) => ({ ...x, mean: r1(avg(x.obs.map((o) => o.metricValue))), ch: change(x.obs) }))
    .sort((a, b) => b.mean - a.mean);
  const empty = keywords.filter((k) => !kw.some((x) => x.k === k) || kw.find((x) => x.k === k)!.obs.every((o) => o.metricValue === 0));
  if (kw.length >= 2) add(`함께 조회한 키워드의 기간 평균 클릭 상대지표: ${kw.map((x) => `${x.k} ${x.mean}`).join(', ')}.`, kw.flatMap((x) => x.obs));
  for (const x of kw) {
    if (!x.ch || x.obs.every((o) => o.metricValue === 0)) continue;
    add(`"${x.k}" 클릭 상대지표는 ${x.ch.from}에서 ${x.ch.to}로 ${x.ch.to >= x.ch.from ? '+' : ''}${r1(x.ch.to - x.ch.from)}p 변했고, 가장 높은 시점은 ${ym(x.ch.peak.periodStart)}입니다.`, [...x.ch.head, ...x.ch.tail, x.ch.peak]);
  }
  for (const k of empty) gaps.push(`"${k}" 키워드 클릭 데이터 부족 (검색량이 적거나 해당 분야에서 클릭이 없음)`);

  // Keyword age / gender
  for (const x of kw) {
    const a = byDimension(pick('keyword_click_index_by_age', x.k), 'age:');
    const g = byDimension(pick('keyword_click_index_by_gender', x.k), 'gender:');
    if (a.length >= 2 && a[0].mean > 0) add(`"${x.k}" 클릭 상대지표가 가장 높은 연령대는 ${AGE_KO[a[0].group] ?? a[0].group}(평균 ${a[0].mean}), 다음은 ${AGE_KO[a[1].group] ?? a[1].group}(${a[1].mean})입니다.`, [...a[0].obs, ...a[1].obs]);
    if (g.length === 2 && g[0].mean > 0) add(`"${x.k}" 성별 평균 클릭 상대지표는 ${g.map((v) => `${GENDER_KO[v.group]} ${v.mean}`).join(', ')}입니다.`, g.flatMap((v) => v.obs));
  }
  return { statements, gaps };
}

// ── AI narrative ────────────────────────────────────────────────────────────

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
/** MARKET_AI_ANALYSIS=on turns on AI sentences (billed per call). Default off, so the data pipeline costs nothing. */
export const aiAnalysisEnabled = () => process.env.MARKET_AI_ANALYSIS === 'on' && !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = `당신은 화장품 상품기획 분석가입니다. 주어진 "수집 데이터"와 "계산된 사실"만 근거로 해석 문장을 씁니다.

규칙:
- 모든 값은 네이버 데이터랩 쇼핑인사이트의 클릭 상대지표입니다(조회 결과 안 최댓값 = 100). 판매량, 매출, 시장 규모, 점유율, 구매자 비율, 리뷰 수가 아닙니다. 이런 말로 바꾸어 쓰지 않습니다.
- 주어진 데이터에 없는 숫자(성장률, 매출액, 비율, 리뷰 수 등)를 만들지 않습니다. 숫자를 쓸 때는 주어진 값을 그대로 씁니다.
- 각 문장에는 근거가 된 데이터 ID(obs_...)를 observationIds에 1개 이상 넣습니다. 주어진 ID만 씁니다.
- 근거가 부족한 내용은 쓰지 않습니다. 쓸 수 있는 문장이 없으면 빈 배열을 반환합니다.
- kind: finding(데이터가 보여주는 것), implication(제품 기획에 주는 의미), risk(주의할 점), recommendation(다음 확인 행동).
- 한국어로 짧게, 3~6문장.`;

export function allowedNumbers(obs: Observation[], findings: AiStatement[]) {
  const set = new Set<number>();
  const addText = (t: string) => {
    for (const m of t.match(/\d+(?:[.,]\d+)*/g) ?? []) set.add(Number(m.replace(/,/g, '')));
  };
  for (const o of obs) {
    set.add(r1(o.metricValue));
    set.add(Math.round(o.metricValue));
    addText(o.periodStart);
    addText(o.periodEnd);
    addText(o.dimension);
  }
  for (const f of findings) addText(f.text);
  return set;
}

/** Drops statements without valid citations or with numbers the data does not contain. */
export function checkStatements(raw: { text: string; observationIds: string[]; kind?: string }[], obs: Observation[], findings: AiStatement[]) {
  const known = new Set(obs.map((o) => o.id));
  const nums = allowedNumbers(obs, findings);
  const kept: (AiStatement & { kind: string })[] = [];
  let dropped = 0;
  for (const s of raw) {
    const ids = [...new Set((s.observationIds ?? []).filter((id) => known.has(id)))];
    const text = String(s.text ?? '').trim().slice(0, 400);
    const badNumber = (text.match(/\d+(?:[.,]\d+)*/g) ?? []).some((m) => !nums.has(Number(m.replace(/,/g, ''))));
    const unknownId = (s.observationIds ?? []).some((id) => !known.has(id));
    if (!text || !ids.length || unknownId || badNumber) {
      dropped++;
      continue;
    }
    kept.push({ id: `ai${kept.length + 1}`, text, observationIds: ids, dataType: 'AI_GENERATED', kind: ['finding', 'implication', 'risk', 'recommendation'].includes(String(s.kind)) ? String(s.kind) : 'finding' });
  }
  return { kept, dropped };
}

export interface Narrative {
  status: 'OK' | 'NO_API_KEY' | 'NO_DATA' | 'ERROR';
  model: string | null;
  statements: (AiStatement & { kind: string })[];
  dropped: number;
  message?: string;
}

export async function aiNarrative(obs: Observation[], findings: Findings, context: { category: string; keywords: string[]; idea?: string }): Promise<Narrative> {
  // Paid per use: off unless explicitly enabled, even when ANTHROPIC_API_KEY is set for the blueprint.
  if (!aiAnalysisEnabled()) return { status: 'NO_API_KEY', model: null, statements: [], dropped: 0, message: 'AI 해석은 꺼져 있습니다 (사용량 과금 기능이라 기본값 꺼짐). 아래 계산 결과는 수집 데이터만으로 계산한 값입니다.' };
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'NO_API_KEY', model: null, statements: [], dropped: 0, message: 'ANTHROPIC_API_KEY가 없어 AI 해석 문장은 만들지 않았습니다. 아래 계산 결과는 수집 데이터만으로 계산한 값입니다.' };
  if (!findings.statements.length) return { status: 'NO_DATA', model: null, statements: [], dropped: 0, message: '데이터 부족으로 AI 해석을 만들지 않았습니다.' };

  // Compact table: monthly series are summarized by the findings; send ids so the model can cite.
  const cited = new Set(findings.statements.flatMap((s) => s.observationIds));
  const rows = obs
    .filter((o) => cited.has(o.id))
    .slice(0, 400)
    .map((o) => `${o.id}\t${o.metricName}\t${o.keyword ?? '-'}\t${o.dimension}\t${o.periodStart}\t${r1(o.metricValue)}`);
  const prompt = [
    `분야: ${context.category}\n키워드: ${context.keywords.join(', ') || '없음'}`,
    context.idea ? `제품 아이디어(참고용, 데이터 아님): """${context.idea.slice(0, 500)}"""` : '',
    `계산된 사실 (근거 ID 포함):\n${findings.statements.map((s) => `- ${s.text} [${s.observationIds.slice(0, 12).join(', ')}${s.observationIds.length > 12 ? ', …' : ''}]`).join('\n')}`,
    findings.gaps.length ? `데이터 부족 항목: ${findings.gaps.join('; ')}` : '',
    `수집 데이터 (id, 지표, 키워드, 구분, 기간 시작, 값):\n${rows.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['statements'],
    properties: {
      statements: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'observationIds', 'kind'],
          properties: { text: { type: 'string' }, observationIds: { type: 'array', items: { type: 'string' } }, kind: { type: 'string', enum: ['finding', 'implication', 'risk', 'recommendation'] } },
        },
      },
    },
  };

  try {
    const client = new Anthropic();
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      })
      .finalMessage();
    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') return { status: 'ERROR', model: message.model, statements: [], dropped: 0, message: 'AI 해석 응답을 완성하지 못했습니다.' };
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const parsed = JSON.parse(text) as { statements: { text: string; observationIds: string[]; kind: string }[] };
    const { kept, dropped } = checkStatements(parsed.statements ?? [], obs, findings.statements);
    return { status: 'OK', model: message.model, statements: kept, dropped };
  } catch (err) {
    const msg = err instanceof Anthropic.RateLimitError ? 'AI API 호출 한도 초과' : err instanceof Anthropic.AuthenticationError ? 'AI API Key 오류' : err instanceof Anthropic.APIError ? `AI API 오류 (${err.status ?? 'network'})` : 'AI 해석 생성 실패';
    return { status: 'ERROR', model: null, statements: [], dropped: 0, message: msg };
  }
}
