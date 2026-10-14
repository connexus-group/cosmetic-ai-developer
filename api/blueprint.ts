/**
 * POST /api/blueprint — generates the AI Product Blueprint with Claude (server side only).
 * GET  /api/blueprint — tells the client whether a real AI model is configured.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY  required. Never exposed to the browser.
 *   ANTHROPIC_MODEL    optional, defaults to claude-opus-5-5.
 *
 * Without ANTHROPIC_API_KEY the endpoint answers 503 and the site falls back to its labeled Demo Mode.
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const ORIGINS = ['USER_PROVIDED', 'AI_SUGGESTED', 'UNDETERMINED'] as const;

interface FieldDef {
  key: string;
  label: string;
  guide: string;
  options?: string[];
  multi?: boolean;
  verify?: boolean;
}
interface RequestBody {
  idea: string;
  fields: FieldDef[];
  /** only these keys (single-item "다시 추천" or refreshing items marked for review) */
  keys?: string[];
  /** current values of the other items, so a partial answer stays consistent */
  context?: Record<string, { value: string; origin: string }>;
  /** values already suggested for a key; give something different */
  avoid?: Record<string, string[]>;
  /** competitor products collected from real pages (Firecrawl → Supabase); the only products the model may name */
  competitors?: CompetitorRef[];
}

interface CompetitorRef {
  brand: string;
  product: string;
  price: string;
  size: string;
  per100Krw: number | null;
  keyIngredients: string[];
  usp: string[];
  url: string;
  collectedAt: string;
}

function parseCompetitors(raw: unknown): CompetitorRef[] {
  if (!Array.isArray(raw)) return [];
  const out: CompetitorRef[] = [];
  for (const c of raw.slice(0, 10) as Record<string, unknown>[]) {
    const url = str(c?.url, 400);
    if (!/^https:\/\/[^\s]+$/i.test(url)) continue;
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => str(x, 80)).filter(Boolean) : []);
    const per = Number(c.per100Krw);
    out.push({ brand: str(c.brand, 60), product: str(c.product, 120), price: str(c.price, 40), size: str(c.size, 30), per100Krw: Number.isFinite(per) && per > 0 ? Math.round(per) : null, keyIngredients: list(c.keyIngredients, 6), usp: list(c.usp, 5), url, collectedAt: str(c.collectedAt, 30) });
  }
  return out;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function parseBody(raw: unknown): RequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const idea = str(b.idea, 2000).trim();
  if (!idea || !Array.isArray(b.fields) || b.fields.length === 0 || b.fields.length > 80) return null;
  const fields: FieldDef[] = [];
  for (const f of b.fields as Record<string, unknown>[]) {
    const key = str(f?.key, 40);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return null;
    fields.push({
      key,
      label: str(f.label, 60),
      guide: str(f.guide, 240),
      options: Array.isArray(f.options) ? f.options.slice(0, 16).map((o) => str(o, 40)) : undefined,
      multi: f.multi === true,
      verify: f.verify === true,
    });
  }
  const known = new Set(fields.map((f) => f.key));
  const keys = Array.isArray(b.keys) ? (b.keys as unknown[]).map((k) => str(k, 40)).filter((k) => known.has(k)) : undefined;
  const context: RequestBody['context'] = {};
  if (b.context && typeof b.context === 'object')
    for (const [k, v] of Object.entries(b.context as Record<string, { value?: unknown; origin?: unknown }>))
      if (known.has(k) && v && typeof v === 'object') context[k] = { value: str(v.value, 400), origin: str(v.origin, 20) };
  const avoid: RequestBody['avoid'] = {};
  if (b.avoid && typeof b.avoid === 'object')
    for (const [k, v] of Object.entries(b.avoid as Record<string, unknown>)) if (known.has(k) && Array.isArray(v)) avoid[k] = v.slice(0, 8).map((x) => str(x, 200));
  return { idea, fields, keys: keys?.length ? keys : undefined, context, avoid, competitors: parseCompetitors(b.competitors) };
}

const SYSTEM = `당신은 화장품 브랜드의 시니어 상품기획자(Product Planner)입니다. 비전문가 브랜드가 입력한 제품 아이디어를 바탕으로, 제조사에 전달하기 전 단계의 상세 제품 기획 초안을 작성합니다.

작성 원칙:
- 모든 값은 한국어로 씁니다. 목록형 항목은 쉼표로 구분합니다.
- value 작성 방식:
  - 선택지가 있는 항목과 목록형 항목은 value에 값만 짧게 씁니다(예: "밀키", "30ml", "탄력, 주름"). 다른 화면이 이 값을 그대로 읽습니다.
  - 서술형 항목(컨셉, 차별화, USP, 구매 동기, 니즈, 사용감, 원료 선택 이유, 포지셔닝, 저자극 방향, 적합성, 규제 검토 등)은 이 제품에만 해당하는 구체적인 내용으로 2~3문장을 씁니다. "효과적인", "프리미엄" 같은 일반적인 표현만 나열하지 않습니다.
- detail에는 모든 항목마다 2~4문장의 상세 설명을 씁니다. 이 값을 이 제품에 어떻게 적용하는지, 타깃·효능·제형·판매 국가와 어떻게 연결되는지, 제조사와 이야기할 때 무엇을 정해야 하는지를 구체적으로 적습니다. 사용자 입력 항목도 그 조건을 기획에 어떻게 반영할지 씁니다. 수치·원가·규제는 detail에서도 확정처럼 쓰지 않고 "확인 필요"로 표현합니다.
- reason은 왜 이 값을 제안했는지 한 문장으로 씁니다.
- origin 규칙:
  - USER_PROVIDED: 사용자 아이디어 문장에 명시된 조건만. 사용자가 쓴 조건은 바꾸지 말고 그대로 옮깁니다.
  - AI_SUGGESTED: 아이디어에서 합리적으로 보완한 제안. 왜 그렇게 제안했는지 reason에 한 문장으로 씁니다.
  - UNDETERMINED: 근거가 부족해 지금 정하면 오해를 부를 항목. value는 "미정" 또는 "확인 필요"로 둡니다.
- 시장 규모, 원가, 원료 규제, 인증, 시험 적합성은 실제 검증 없이 확정값으로 쓰지 않습니다. 원가는 "추정 범위"로만 쓰고 needsVerification을 true로 둡니다.
- 국가별 규제는 일반 지식만으로 수출 가능·적합을 판정하지 않습니다. "규제 확인 필요"라고 쓰고, 무엇을 확인해야 하는지만 적습니다.
- sourceReferences에는 실제로 근거가 된 것만 씁니다: "사용자 입력" 또는 확인해야 할 공식 자료의 이름(예: "중국 NMPA 화장품 원료 목록 확인 필요"). URL이나 존재하지 않는 자료를 만들지 않습니다. 근거가 일반 지식뿐이면 빈 배열로 둡니다. 단, 요청에 "실제 수집한 경쟁제품" 목록이 있으면 그 목록의 제품과 출처 URL만 근거로 인용할 수 있습니다.
- 실제 브랜드 제품명이나 특허·임상 결과를 사실처럼 만들어내지 않습니다. 벤치마킹은 제품 유형으로 쓰고 확인 필요로 둡니다.
- confidence는 0~1 사이 숫자로, 아이디어에 근거가 많을수록 높게 씁니다.
- 선택지가 주어진 항목은 가능하면 선택지 안에서 고르되, 더 맞는 값이 있으면 직접 씁니다.
- 판매 국가가 여러 곳이면 모든 국가의 조건을 기획 전체(원료, 기능성, 표시·광고, 시험)에 함께 반영합니다.`;

function userPrompt(body: RequestBody) {
  const want = body.keys ? body.fields.filter((f) => body.keys!.includes(f.key)) : body.fields;
  const lines = want.map((f) => {
    const opts = f.options?.length ? ` · 선택지: ${f.options.join(' / ')}` : '';
    const avoid = body.avoid?.[f.key]?.length ? ` · 이미 제안한 값(다른 후보를 제시): ${body.avoid[f.key].join(' | ')}` : '';
    return `- ${f.key} (${f.label}): ${f.guide}${f.multi ? ' · 쉼표로 여러 개' : ''}${f.verify ? ' · 반드시 확인 필요 항목' : ''}${opts}${avoid}`;
  });
  const ctx = Object.entries(body.context ?? {})
    .filter(([k]) => !body.keys?.includes(k))
    .map(([k, v]) => `- ${k}: ${v.value} (${v.origin})`);
  return [
    `제품 아이디어:\n"""${body.idea}"""`,
    ctx.length ? `현재 기획 초안의 다른 항목 (이 값들과 일관되게 작성):\n${ctx.join('\n')}` : '',
    body.competitors?.length
      ? `실제 수집한 경쟁제품 (공개 제품 페이지에서 Firecrawl로 수집, 페이지에 적힌 값만):\n${body.competitors
          .map((c, i) => `${i + 1}. ${c.brand} ${c.product} · 가격 ${c.price || '없음'} · 용량 ${c.size || '없음'}${c.per100Krw ? ` · 100ml당 약 ${c.per100Krw.toLocaleString('ko-KR')}원` : ''} · 핵심 원료 ${c.keyIngredients.join(', ') || '없음'} · USP ${c.usp.map((u) => `"${u}"`).join(', ') || '없음'} · 출처 ${c.url} (${c.collectedAt.slice(0, 10)} 수집)`)
          .join('\n')}\n경쟁·차별화·가격·포지셔닝·벤치마킹 항목은 이 목록을 근거로 쓰고, 근거로 쓴 제품의 출처 URL을 sourceReferences에 그대로 넣습니다. 이 목록에 없는 실제 제품명이나 URL은 쓰지 않습니다. 목록에 없는 값(점유율, 판매량, 리뷰 수 등)은 만들지 않습니다.`
      : '',
    `작성할 항목 (모든 항목을 fields 배열에 한 번씩 포함):\n${lines.join('\n')}`,
    body.keys
      ? 'regulatory는 판매 국가 관련 항목을 작성한 경우에만 채우고, 아니면 빈 배열로 둡니다. productName은 현재 제품명을 유지할 수 있도록 짧게 씁니다.'
      : 'regulatory에는 판매 국가마다 하나씩, 그 국가에서 확인해야 할 원료·기능성·표시·절차 항목(items)과 알려진 제한 조건 후보(conditions, 확인 필요)를 씁니다. productName은 제품의 가칭(영문 또는 한글, 30자 이내)입니다.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function schema(keys: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['productName', 'fields', 'regulatory'],
    properties: {
      productName: { type: 'string' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fieldKey', 'value', 'detail', 'origin', 'reason', 'confidence', 'needsVerification', 'sourceReferences'],
          properties: {
            fieldKey: { type: 'string', enum: keys },
            value: { type: 'string' },
            detail: { type: 'string' },
            origin: { type: 'string', enum: [...ORIGINS] },
            reason: { type: 'string' },
            confidence: { type: 'number' },
            needsVerification: { type: 'boolean' },
            sourceReferences: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      regulatory: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['country', 'items', 'conditions'],
          properties: {
            country: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
            conditions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

interface ModelOutput {
  productName: string;
  fields: { fieldKey: string; value: string; detail?: string; origin: string; reason: string; confidence: number; needsVerification: boolean; sourceReferences: string[] }[];
  regulatory: { country: string; items: string[]; conditions: string[] }[];
}

/** Never trust the model output blindly: keep only requested keys and enforce the verification rules. */
function sanitize(out: ModelOutput, body: RequestBody) {
  const wanted = new Set(body.keys ?? body.fields.map((f) => f.key));
  const verify = new Set(body.fields.filter((f) => f.verify).map((f) => f.key));
  const seen = new Set<string>();
  const allowedUrls = new Set((body.competitors ?? []).map((c) => c.url));
  const entries = [];
  for (const f of out.fields ?? []) {
    if (!wanted.has(f.fieldKey) || seen.has(f.fieldKey)) continue;
    seen.add(f.fieldKey);
    const origin = (ORIGINS as readonly string[]).includes(f.origin) ? f.origin : 'AI_SUGGESTED';
    entries.push({
      fieldKey: f.fieldKey,
      value: String(f.value ?? '').slice(0, 600),
      detail: String(f.detail ?? '').slice(0, 1200),
      origin,
      reason: String(f.reason ?? '').slice(0, 600),
      confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)),
      needsVerification: verify.has(f.fieldKey) || origin === 'UNDETERMINED' || f.needsVerification === true,
      // URLs are kept only when they are one of the collected competitor pages sent with the request
      sourceReferences: (f.sourceReferences ?? []).map((s) => String(s).slice(0, 400).trim()).filter((s) => !/https?:\/\//i.test(s) || allowedUrls.has(s)).slice(0, 5),
    });
  }
  const regulatory = (out.regulatory ?? []).slice(0, 12).map((r) => ({
    country: String(r.country ?? '').slice(0, 40),
    // General model knowledge is not an official source: nothing is marked verified here.
    status: 'REVIEW_REQUIRED' as const,
    items: (r.items ?? []).map((s) => String(s).slice(0, 300)).slice(0, 10),
    source: null,
    checkedAt: null,
    conditions: (r.conditions ?? []).map((s) => String(s).slice(0, 300)).slice(0, 10),
  }));
  return { productName: String(out.productName ?? '').slice(0, 60), entries, regulatory };
}

export async function GET() {
  return json(200, { configured: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_API_KEY ? MODEL : null });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'NO_API_KEY', message: 'ANTHROPIC_API_KEY가 서버 환경변수에 설정되지 않았습니다.' });
  let body: RequestBody | null = null;
  try {
    body = parseBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) return json(400, { error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' });

  const keys = body.keys ?? body.fields.map((f) => f.key);
  const client = new Anthropic();
  try {
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: body.keys ? 'low' : 'medium', format: { type: 'json_schema', schema: schema(keys) } },
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt(body) }],
      })
      .finalMessage();

    if (message.stop_reason === 'refusal') return json(502, { error: 'REFUSAL', message: 'AI가 이 요청에 답하지 않았습니다.' });
    if (message.stop_reason === 'max_tokens') return json(502, { error: 'TRUNCATED', message: 'AI 응답이 길어 중간에 끊겼습니다.' });
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const parsed = JSON.parse(text) as ModelOutput;
    return json(200, { mode: 'ai', model: message.model, ...sanitize(parsed, body) });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json(502, { error: 'AUTH', message: 'API Key가 올바르지 않습니다.' });
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'RATE_LIMIT', message: '요청이 많아 잠시 후 다시 시도해야 합니다.' });
    if (err instanceof Anthropic.APIError) return json(502, { error: 'API_ERROR', message: `AI API 오류 (${err.status ?? 'network'})` });
    if (err instanceof SyntaxError) return json(502, { error: 'BAD_OUTPUT', message: 'AI 응답을 구조화 데이터로 읽지 못했습니다.' });
    return json(500, { error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' });
  }
}
