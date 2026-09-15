const LS_PREFIX = 'mdboard.';

export function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeLS(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode / storage disabled: fine to no-op */
  }
}

export const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const seatKey = (bus, seat) => `${bus}-${seat}`;
export const busOfKey = (k) => Number(k.split('-')[0]);

export const hm = (t) =>
  t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
export const hms = (t) =>
  t
    ? new Date(t).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    : '-';

export function ownedMap(t) {
  const m = {};
  for (const k in t) {
    if (t[k] && t[k].p) m[t[k].p] = k;
  }
  return m;
}

export function countBus(t, bus, seats) {
  let c = 0;
  for (let n = 1; n <= seats; n++) if (t[seatKey(bus, n)]) c++;
  return c;
}

export function emptyNums(t, bus, seats) {
  const a = [];
  for (let n = 1; n <= seats; n++) if (!t[seatKey(bus, n)]) a.push(n);
  return a;
}

export function parseTicket(raw, curBus, busCount, seats) {
  const s = raw.trim().replace(/번$/, '');
  if (!s) return { err: '번호를 입력하세요.' };
  let bus;
  let seat;
  const m = s.match(/^(\d+)\s*[-.\s]\s*(\d+)$/);
  if (m) {
    bus = Number(m[1]);
    seat = Number(m[2]);
  } else if (/^\d+$/.test(s)) {
    bus = curBus;
    seat = Number(s);
  } else {
    return { err: '7 또는 1-7처럼 숫자로 입력하세요.' };
  }
  if (bus < 1 || bus > busCount) return { err: `호차는 1~${busCount} 사이여야 합니다.` };
  if (seat < 1 || seat > seats) return { err: `번호는 1~${seats} 사이여야 합니다.` };
  return { bus, seat };
}
