/**
 * Access rules checked BEFORE any page is sent to Firecrawl.
 *
 * 1. Blocked domains: shopping malls / review services whose terms forbid automated collection.
 *    These are refused outright, whatever their robots.txt says.
 * 2. robots.txt: the page path must be allowed for `*` (and for Firecrawl's agent if listed).
 *    If robots.txt cannot be read (network error, 401/403, 5xx) the page is NOT collected,
 *    because permission could not be confirmed. A 404 robots.txt means no rules (allowed).
 */

export const http = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

/** Terms of service forbid automated collection (or robots.txt blocks it). Matched on the host and its subdomains. */
export const BLOCKED_DOMAINS: Record<string, string> = {
  'oliveyoung.co.kr': '올리브영',
  'coupang.com': '쿠팡',
  '11st.co.kr': '11번가',
  'kurly.com': '컬리',
  'hwahae.co.kr': '화해',
  'musinsa.com': '무신사',
  'ssg.com': 'SSG닷컴',
  'gmarket.co.kr': 'G마켓',
  'auction.co.kr': '옥션',
  'smartstore.naver.com': '네이버 스마트스토어',
  'shopping.naver.com': '네이버쇼핑',
  'amazon.com': 'Amazon',
  'sephora.com': 'Sephora',
  'unpa.me': '언니의파우치',
};

const AGENTS = ['firecrawlagent', 'firecrawl', '*'];

export type RobotsVerdict = { allowed: true; robotsUrl: string; note: string } | { allowed: false; robotsUrl: string | null; reason: string };

export function blockedDomain(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const [d, name] of Object.entries(BLOCKED_DOMAINS)) if (h === d || h.endsWith(`.${d}`)) return name;
  return null;
}

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow')) {
        // an empty Disallow means "allow everything" and adds no rule
        if (val) cur.rules.push({ allow: key === 'allow', path: val });
      }
    }
  }
  return groups;
}

const toRegex = (p: string) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));

/** Longest matching rule wins; on a tie Allow wins (Google / RFC 9309 behaviour). */
export function isAllowed(groups: Group[], pathWithQuery: string): boolean {
  let group: Group | undefined;
  for (const a of AGENTS) {
    group = groups.find((g) => g.agents.some((x) => (a === '*' ? x === '*' : x.includes(a))));
    if (group) break;
  }
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    if (!toRegex(r.path).test(pathWithQuery)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
  }
  return best ? best.allow : true;
}

const cache = new Map<string, { at: number; groups: Group[] | null; status: number | 'error' }>();

export async function checkAccess(pageUrl: string): Promise<RobotsVerdict> {
  const u = new URL(pageUrl);
  const blocked = blockedDomain(u.hostname);
  if (blocked) return { allowed: false, robotsUrl: null, reason: `${blocked}은(는) 이용약관상 자동 수집이 허용되지 않아 수집하지 않습니다.` };

  const robotsUrl = `${u.origin}/robots.txt`;
  let hit = cache.get(u.origin);
  if (!hit || Date.now() - hit.at > 3600_000) {
    try {
      const r = await http.fetch(robotsUrl, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; AIProductDeveloper/1.0; +robots-check)' }, redirect: 'follow', signal: AbortSignal.timeout(8_000) });
      hit = { at: Date.now(), status: r.status, groups: r.ok ? parseRobots(await r.text()) : r.status === 404 || r.status === 410 ? [] : null };
    } catch {
      hit = { at: Date.now(), status: 'error', groups: null };
    }
    cache.set(u.origin, hit);
  }
  if (!hit.groups) {
    return { allowed: false, robotsUrl, reason: hit.status === 'error' ? 'robots.txt를 읽지 못해 수집 허용 여부를 확인할 수 없어 수집하지 않았습니다.' : `robots.txt 응답 ${hit.status}: 수집 허용 여부를 확인할 수 없어 수집하지 않았습니다.` };
  }
  if (!isAllowed(hit.groups, u.pathname + u.search)) return { allowed: false, robotsUrl, reason: 'robots.txt가 이 페이지의 자동 수집을 허용하지 않습니다.' };
  return { allowed: true, robotsUrl, note: hit.groups.length ? 'robots.txt 허용 확인' : 'robots.txt 없음 (404): 제한 규칙 없음' };
}
