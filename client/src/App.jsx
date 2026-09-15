import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, subscribeState } from './api.js';
import { parseTicket, hms, readLS, writeLS } from './utils.js';
import Header from './components/Header.jsx';
import BusTabs from './components/BusTabs.jsx';
import ViewTabs from './components/ViewTabs.jsx';
import RosterView from './components/RosterView.jsx';
import SeatView from './components/SeatView.jsx';
import AdminDock from './components/AdminDock.jsx';
import Toast from './components/Toast.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import LoginModal from './components/LoginModal.jsx';
import SeatSheetModal from './components/SeatSheetModal.jsx';
import { useConfirm } from './hooks/useConfirm.js';

export default function App() {
  const [roster, setRoster] = useState(null); // { groups, people, busCount, seats }
  const [t, setT] = useState({});
  const [d, setD] = useState({});
  const [updatedAt, setUpdatedAt] = useState(0);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState('connecting'); // connecting | live | polling | offline

  // Restored from this browser's last visit so a refresh (or the login-modal
  // page reload) lands back on the same bus/view/filter instead of resetting.
  const [curBus, setCurBus] = useState(() => readLS('curBus', 1));
  const [view, setView] = useState(() => readLS('view', 'roster'));
  const [fGroup, setFGroup] = useState(() => readLS('fGroup', 0));
  const [fState, setFState] = useState(() => readLS('fState', 'all'));
  const [query, setQuery] = useState(() => readLS('query', ''));

  useEffect(() => writeLS('curBus', curBus), [curBus]);
  useEffect(() => writeLS('view', view), [view]);
  useEffect(() => writeLS('fGroup', fGroup), [fGroup]);
  useEffect(() => writeLS('fState', fState), [fState]);
  useEffect(() => writeLS('query', query), [query]);

  const [flashId, setFlashId] = useState(null);
  const [toastText, setToastText] = useState('');
  const [seatSheet, setSeatSheet] = useState(null);

  const { confirmState, confirm, closeConfirm } = useConfirm();
  const toastTimer = useRef(null);
  const flashTimer = useRef(null);

  const toast = useCallback((text) => {
    setToastText(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(''), 3500);
  }, []);

  const flash = useCallback((personId) => {
    setFlashId(personId);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 900);
  }, []);

  // ---- initial load: roster + current shared state + admin session ----
  useEffect(() => {
    (async () => {
      try {
        const [rosterRes, stateRes, meRes] = await Promise.all([api.getRoster(), api.getState(), api.me()]);
        setRoster(rosterRes);
        setT(stateRes.t);
        setD(stateRes.d);
        setUpdatedAt(stateRes.u);
        setIsAdmin(meRes.isAdmin);
      } catch (e) {
        toast('초기 데이터를 불러오지 못했습니다. 새로고침 해주세요.');
      }
    })();
  }, [toast]);

  // ---- live updates ----
  useEffect(() => {
    const unsubscribe = subscribeState(
      (state) => {
        setT(state.t);
        setD(state.d);
        setUpdatedAt(state.u);
      },
      (status) => setLiveStatus(status)
    );
    return unsubscribe;
  }, []);

  // pick an open bus once the roster/state have loaded, if the current one has departed
  useEffect(() => {
    if (!roster) return;
    if (d[curBus]) {
      const next = Array.from({ length: roster.busCount }, (_, i) => i + 1).find((b) => !d[b]);
      if (next) setCurBus(next);
    }
  }, [roster, d, curBus]);

  const byId = useMemo(() => {
    if (!roster) return {};
    return Object.fromEntries(roster.people.map((p) => [p.i, p]));
  }, [roster]);

  const owned = useMemo(() => {
    const m = {};
    for (const k in t) if (t[k] && t[k].p) m[t[k].p] = k;
    return m;
  }, [t]);
  const assignedCount = Object.keys(owned).length;
  const sumGone = roster ? Object.keys(d).length : 0;

  // ---- write helpers ----
  const guardedWrite = useCallback(
    async (fn) => {
      setSaving(true);
      try {
        await fn();
        return { ok: true };
      } catch (err) {
        if (err.status === 401) {
          setIsAdmin(false);
          toast('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        } else if (err.code === 'seat_taken') {
          toast(`${err.body?.personId ? byId[err.body.personId]?.n + ', ' : ''}이미 배정된 번호입니다.`);
        } else if (err.code === 'bus_departed') {
          toast('이미 출발한 차량입니다.');
        } else if (err.code === 'already_assigned') {
          toast('이미 다른 번호로 배정되어 있습니다.');
        } else {
          toast('저장에 실패했습니다. 다시 시도해 주세요.');
        }
        return { ok: false, err };
      } finally {
        setSaving(false);
      }
    },
    [toast, byId]
  );

  const handleAssign = useCallback(
    async (personId, raw) => {
      if (!roster) return { err: '아직 불러오는 중입니다.' };
      const parsed = parseTicket(raw, curBus, roster.busCount, roster.seats);
      if (parsed.err) return { err: parsed.err };
      const seatKey = `${parsed.bus}-${parsed.seat}`;
      if (owned[personId]) return { err: `이미 ${owned[personId]}번으로 배정되어 있습니다.` };

      const result = await guardedWrite(() => api.assign(seatKey, personId));
      if (result.ok) {
        flash(personId);
        toast(`${byId[personId]?.n}, ${seatKey}번 배정했습니다.`);
        return { ok: true };
      }
      if (result.err?.code === 'seat_taken') {
        return { err: `${seatKey}번은 이미 ${byId[result.err.body?.personId]?.n || '다른 사람'}에게 배정되어 있습니다.` };
      }
      if (result.err?.code === 'bus_departed') {
        return { err: `${parsed.bus}호차는 이미 출발했습니다.` };
      }
      return { err: '배정에 실패했습니다. 다시 시도해 주세요.' };
    },
    [roster, curBus, owned, guardedWrite, flash, toast, byId]
  );

  const handleCancel = useCallback(
    async (seatKey) => {
      const personId = t[seatKey]?.p;
      const result = await guardedWrite(() => api.cancel(seatKey));
      if (result.ok) {
        if (personId) flash(personId);
        toast(`${personId ? byId[personId]?.n + ', ' : ''}${seatKey}번 배정을 취소했습니다.`);
      }
    },
    [t, guardedWrite, flash, toast, byId]
  );

  const handleDepart = useCallback(
    async (bus, early = false) => {
      const c = Object.keys(t).filter((k) => Number(k.split('-')[0]) === bus).length;
      let desc = `${bus}호차 ${c}명을 최종확인하고 출발 처리합니다.\n최종확인 후에는 이 차량의 배정을 취소하거나 바꿀 수 없습니다.`;
      if (early) {
        const em = [];
        for (let n = 1; n <= roster.seats; n++) if (!t[`${bus}-${n}`]) em.push(n);
        desc += `\n\n아직 ${em.length}개 번호가 비어 있습니다: ${em.slice(0, 12).join(', ')}${em.length > 12 ? ' 등' : ''}`;
      }
      const ok = await confirm({
        title: early ? `${bus}호차 인원 미달 최종확인` : `${bus}호차 최종확인`,
        desc,
        ok: early ? `${c}명으로 출발` : '최종확인, 출발',
        kind: 'primary'
      });
      if (!ok) return;
      const result = await guardedWrite(() => api.depart(bus));
      if (result.ok) {
        toast(`${bus}호차 출발했습니다.`);
        const next = Array.from({ length: roster.busCount }, (_, i) => i + 1).find((b) => b > bus && !d[b]);
        if (next) setCurBus(next);
      }
    },
    [t, d, roster, confirm, guardedWrite, toast]
  );

  const handleUndepart = useCallback(
    async (bus) => {
      const ok = await confirm({
        title: `${bus}호차 최종확인 해제`,
        desc: '실수로 최종확인을 눌렀을 때만 사용하세요.\n해제하면 이 차량의 배정을 다시 수정할 수 있습니다.',
        ok: '최종확인 해제',
        kind: 'dark'
      });
      if (!ok) return;
      const result = await guardedWrite(() => api.undepart(bus));
      if (result.ok) toast(`${bus}호차 최종확인을 해제했습니다.`);
    },
    [confirm, guardedWrite, toast]
  );

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: '전체 초기화',
      desc: '모든 번호 배정과 최종확인 기록을 지웁니다.\n링크로 보는 모든 사람의 화면에도 반영되며 되돌릴 수 없습니다.',
      ok: '모두 지우기',
      kind: 'dark'
    });
    if (!ok) return;
    const result = await guardedWrite(() => api.reset());
    if (result.ok) {
      setCurBus(1);
      toast('모든 기록을 지웠습니다.');
    }
  }, [confirm, guardedWrite, toast]);

  const handleSeatClick = useCallback(
    (key, entry) => {
      if (entry) {
        const bus = Number(key.split('-')[0]);
        setSeatSheet({
          seatKey: key,
          person: byId[entry.p],
          at: entry.at,
          canEdit: isAdmin && !d[bus],
          departedBus: d[bus] ? bus : null
        });
      } else if (isAdmin && !d[curBus]) {
        toast('명단에서 이름 옆에 번호를 입력해 배정하세요.');
      }
    },
    [byId, isAdmin, d, curBus, toast]
  );

  const handleAdminLogin = useCallback(async (password) => {
    try {
      await api.login(password);
      setIsAdmin(true);
      toast('관리자 모드로 전환했습니다.');
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [toast]);

  const handleLogout = useCallback(async () => {
    await api.logout().catch(() => {});
    setIsAdmin(false);
    toast('보기 전용으로 전환했습니다.');
  }, [toast]);

  const statusKind = liveStatus === 'offline' ? 'err' : liveStatus === 'polling' ? 'warn' : 'ok';
  const statusText =
    liveStatus === 'offline'
      ? '연결이 끊겼습니다. 새로고침 해보세요.'
      : liveStatus === 'polling'
        ? `실시간 연결 대기 중 (자동 갱신)${updatedAt ? ', 마지막 변경 ' + hms(updatedAt) : ''}`
        : `실시간 연결됨${updatedAt ? ', 마지막 변경 ' + hms(updatedAt) : ''}`;

  if (!roster) {
    return (
      <div className="wrap">
        <p className="hint" style={{ padding: 16 }}>
          불러오는 중...
        </p>
      </div>
    );
  }

  const buses = Array.from({ length: roster.busCount }, (_, i) => i + 1);

  return (
    <div className={`app${isAdmin ? ' admin' : ''}${saving ? ' saving' : ''}`}>
      <div className="stripe" />
      <div className="wrap">
        <Header
          isAdmin={isAdmin}
          sumBoard={assignedCount}
          sumLeft={roster.people.length - assignedCount}
          sumGone={sumGone}
          statusKind={statusKind}
          statusText={statusText}
          onAdminClick={() => (isAdmin ? null : setLoginOpen(true))}
          onRefresh={() => window.location.reload()}
        />

        <BusTabs buses={buses} seats={roster.seats} t={t} d={d} curBus={curBus} onSelect={setCurBus} />
        <ViewTabs view={view} onChange={setView} />

        {view === 'roster' ? (
          <RosterView
            people={roster.people}
            groups={roster.groups}
            t={t}
            d={d}
            curBus={curBus}
            isAdmin={isAdmin}
            flashId={flashId}
            query={query}
            setQuery={setQuery}
            fGroup={fGroup}
            setFGroup={setFGroup}
            fState={fState}
            setFState={setFState}
            onAssign={handleAssign}
            onCancel={handleCancel}
          />
        ) : (
          <SeatView
            curBus={curBus}
            seats={roster.seats}
            t={t}
            d={d}
            byId={byId}
            isAdmin={isAdmin}
            onSeatClick={handleSeatClick}
          />
        )}
      </div>

      {isAdmin && (
        <AdminDock
          curBus={curBus}
          seats={roster.seats}
          t={t}
          d={d}
          saving={saving}
          onDepart={(bus) => handleDepart(bus, false)}
          onEarlyDepart={(bus) => handleDepart(bus, true)}
          onUndepart={handleUndepart}
          onReset={handleReset}
          onLogout={handleLogout}
        />
      )}

      <Toast text={toastText} />
      <ConfirmModal state={confirmState} onClose={closeConfirm} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSubmit={handleAdminLogin} />
      <SeatSheetModal state={seatSheet} onClose={() => setSeatSheet(null)} onCancelSeat={handleCancel} />
    </div>
  );
}
