/**
 * Image generation for the Packaging Studio (AI Concept Mockup).
 *
 * Connected provider: Cloudflare Workers AI · FLUX.1 [schnell] (@cf/black-forest-labs/flux-1-schnell)
 *   Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (Workers AI permission). CLOUDFLARE_BASE_URL is for tests only.
 *   Cost: the Workers Free plan includes 10,000 Neurons per day. One 1024px image with 4 steps is about
 *   58 Neurons, so roughly 170 images per day. On the Free plan, requests over the daily allocation fail
 *   with an error (no charge). Use a Free plan account so nothing can be billed.
 *
 * Paid providers (OpenAI, Google) are listed as planned slots only. They are not implemented and are
 * never reported as connected.
 */
import { AdapterError, type AdapterInfo } from './types.js';

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

export const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const accountId = () => process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const token = () => process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const cfBase = () => (process.env.CLOUDFLARE_BASE_URL?.trim() || 'https://api.cloudflare.com').replace(/\/+$/, '');
export const cloudflareConfigured = () => accountId().length > 0 && token().length > 0;

/** Soft cap per server instance so a loop in the browser cannot burn the whole daily allocation. */
const DAILY_CAP = () => Math.max(1, Number(process.env.IMAGE_DAILY_LIMIT) || 60);
let day = '';
let used = 0;
export function takeQuota(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  if (used >= DAILY_CAP()) return false;
  used++;
  return true;
}

export function imageGenAdapters(): AdapterInfo[] {
  return [
    {
      id: 'cloudflare-flux',
      name: 'Cloudflare Workers AI · FLUX.1 schnell',
      homepage: 'https://developers.cloudflare.com/workers-ai/',
      status: cloudflareConfigured() ? 'connected' : 'not_configured',
      description: '텍스트 지시문으로 용기·단상자 컨셉 이미지를 생성 (AI Concept Mockup)',
      env: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
      costNote: 'Workers Free 플랜 하루 10,000 Neurons 무료 (이미지 1장 약 58 Neurons). 초과 시 오류로 멈추고 과금 없음. 반드시 Free 플랜 계정 사용',
    },
    {
      id: 'openai-image',
      name: 'OpenAI 이미지 모델 (유료)',
      homepage: 'https://platform.openai.com',
      status: 'planned',
      description: '연결 자리만 있음. 유료라서 기본으로 꺼져 있고 구현되지 않음',
      env: ['OPENAI_API_KEY'],
      costNote: '사용량 과금 (유료). 무료 범위 원칙에 따라 사용하지 않음',
    },
    {
      id: 'google-image',
      name: 'Google 이미지 모델 (유료)',
      homepage: 'https://ai.google.dev',
      status: 'planned',
      description: '연결 자리만 있음. 유료라서 기본으로 꺼져 있고 구현되지 않음',
      env: ['GEMINI_API_KEY'],
      costNote: '사용량 과금 (유료). 무료 범위 원칙에 따라 사용하지 않음',
    },
  ];
}

export interface GeneratedImage {
  /** base64 JPEG */
  base64: string;
  mime: string;
  provider: string;
  model: string;
}

export async function generateImage(prompt: string, opts: { seed?: number } = {}): Promise<GeneratedImage> {
  if (!cloudflareConfigured()) throw new AdapterError('NOT_CONFIGURED', '이미지 생성 API(Cloudflare Workers AI)가 연결되지 않았습니다.');
  let r: Response;
  try {
    r = await http.fetch(`${cfBase()}/client/v4/accounts/${encodeURIComponent(accountId())}/ai/run/${CF_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 4, ...(opts.seed ? { seed: opts.seed } : {}) }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AdapterError('NETWORK', 'Cloudflare Workers AI에 연결하지 못했습니다.');
  }
  const body = (await r.json().catch(() => null)) as { success?: boolean; result?: { image?: string }; errors?: { message?: string; code?: number }[] } | null;
  const msg = body?.errors?.map((e) => e.message).filter(Boolean).join(' / ') ?? '';
  if (r.status === 401 || r.status === 403) throw new AdapterError('AUTH', 'Cloudflare 인증에 실패했습니다. CLOUDFLARE_API_TOKEN 권한(Workers AI)을 확인하세요.', r.status);
  if (r.status === 429 || /neuron|allocation|limit/i.test(msg)) throw new AdapterError('QUOTA', '오늘의 무료 이미지 생성 한도를 모두 사용했습니다. 내일(UTC 0시) 초기화 후 다시 생성하세요 (추가 과금 없음).', r.status);
  if (!r.ok || !body?.success || !body.result?.image) throw new AdapterError('UPSTREAM', `이미지를 생성하지 못했습니다${msg ? `: ${msg.slice(0, 160)}` : ` (Cloudflare ${r.status})`}`, r.status);
  return { base64: body.result.image, mime: 'image/jpeg', provider: 'Cloudflare Workers AI', model: 'FLUX.1 [schnell]' };
}
