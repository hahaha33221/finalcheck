import { useMemo, useRef, useState } from 'react';
import { fold, ownedMap } from '../utils.js';

export default function RosterView({
  people,
  groups,
  t,
  d,
  curBus,
  isAdmin,
  flashId,
  query,
  setQuery,
  fGroup,
  setFGroup,
  fState,
  setFState,
  onAssign,
  onCancel
}) {
  const owned = useMemo(() => ownedMap(t), [t]);
  const assignedCount = Object.keys(owned).length;
  const open = !d[curBus];

  const grpCt = useMemo(() => {
    const map = {};
    groups.forEach((g) => (map[g.id] = { done: 0, total: 0 }));
    for (const p of people) {
      map[p.g].total++;
      if (owned[p.i]) map[p.g].done++;
    }
    return map;
  }, [groups, people, owned]);

  const qf = fold(query.trim());
  const rows = useMemo(
    () =>
      people.filter(
        (p) =>
          (!fGroup || p.g === fGroup) &&
          (fState === 'all' || (fState === 'todo' ? !owned[p.i] : !!owned[p.i])) &&
          (!qf || fold(p.n + ' ' + p.r).includes(qf))
      ),
    [people, fGroup, fState, owned, qf]
  );

  const filterParts = [];
  if (fState !== 'all') filterParts.push(fState === 'todo' ? '미배정' : '배정됨');
  if (fGroup) filterParts.push(`${fGroup}. ${groups[fGroup - 1].name}`);
  if (qf) filterParts.push(`"${query.trim()}"`);

  const hint = !isAdmin
    ? '이름 옆 번호가 배정된 차량과 번호입니다. 1-7은 1호차 7번입니다.'
    : open
      ? `미배정 이름 옆 칸에 번호를 넣고 배정을 누르세요. 7을 넣으면 ${curBus}-7로 배정됩니다.`
      : `${curBus}호차는 출발했습니다. 위에서 배정할 호차를 고르세요.`;

  return (
    <section>
      <div className="controls">
        <input
          className="search"
          type="search"
          placeholder="이름 검색"
          autoComplete="off"
          aria-label="이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="statusrow" aria-label="배정 상태">
          {[
            ['all', '전체', people.length],
            ['todo', '미배정', people.length - assignedCount],
            ['done', '배정됨', assignedCount]
          ].map(([v, l, n]) => (
            <button
              key={v}
              type="button"
              className="chip"
              aria-pressed={fState === v}
              onClick={() => setFState(v)}
            >
              {l} <small className="num">{n}</small>
            </button>
          ))}
        </div>
        <div className="chips" aria-label="조 선택">
          <button type="button" className="chip" aria-pressed={fGroup === 0} onClick={() => setFGroup(0)}>
            모든 조
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="chip"
              aria-pressed={fGroup === g.id}
              onClick={() => setFGroup(fGroup === g.id ? 0 : g.id)}
            >
              <span className="sw" style={{ background: g.color }} />
              {g.id}. {g.name} <small className="num">{grpCt[g.id].done}/{grpCt[g.id].total}</small>
            </button>
          ))}
        </div>
        <div className="filterinfo">
          <span>
            {filterParts.length ? `${filterParts.join(', ')} 결과 ${rows.length}명` : `${rows.length}명`}
          </span>
          {filterParts.length > 0 && (
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                setFGroup(0);
                setFState('all');
                setQuery('');
              }}
            >
              필터 해제
            </button>
          )}
        </div>
      </div>
      <p className="hint">{hint}</p>
      {rows.length === 0 ? (
        <div className="empty-note">
          {fState === 'todo' && !qf && !fGroup
            ? '모든 사람이 배정되었습니다.'
            : (
              <>
                조건에 맞는 사람이 없습니다.
                <br />
                필터를 해제하거나 검색어를 바꿔 보세요.
              </>
            )}
        </div>
      ) : (
        <RosterGroups
          rows={rows}
          groups={groups}
          grpCt={grpCt}
          owned={owned}
          d={d}
          isAdmin={isAdmin}
          open={open}
          curBus={curBus}
          flashId={flashId}
          onAssign={onAssign}
          onCancel={onCancel}
        />
      )}
    </section>
  );
}

function RosterGroups({ rows, groups, grpCt, owned, d, isAdmin, open, curBus, flashId, onAssign, onCancel }) {
  const blocks = [];
  let currentGroup = null;
  let bucket = [];

  const flush = () => {
    if (currentGroup === null) return;
    const g = groups[currentGroup - 1];
    blocks.push(
      <div key={`b-${currentGroup}`}>
        <div className="grp">
          <span className="sw" style={{ background: g.color }} />
          {g.id}. {g.name} <small className="num">
            {grpCt[g.id].done}/{grpCt[g.id].total}
          </small>
        </div>
        <ul>{bucket}</ul>
      </div>
    );
    bucket = [];
  };

  for (const p of rows) {
    if (p.g !== currentGroup) {
      flush();
      currentGroup = p.g;
    }
    bucket.push(
      <RosterRow
        key={p.i}
        p={p}
        groupColor={groups[p.g - 1].color}
        seatKeyOf={owned[p.i]}
        departed={owned[p.i] ? !!d[owned[p.i].split('-')[0]] : false}
        isAdmin={isAdmin}
        open={open}
        curBus={curBus}
        flash={flashId === p.i}
        onAssign={onAssign}
        onCancel={onCancel}
      />
    );
  }
  flush();

  return <>{blocks}</>;
}

function RosterRow({ p, groupColor, seatKeyOf, departed, isAdmin, open, curBus, flash, onAssign, onCancel }) {
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const submit = async () => {
    const result = await onAssign(p.i, value);
    if (result && result.err) {
      setErr(result.err);
    } else {
      setValue('');
      setErr('');
    }
  };

  const meta = [p.r ? <span className="role" key="r">{p.r}</span> : null, p.s]
    .filter(Boolean)
    .reduce((acc, cur, i) => (i === 0 ? [cur] : [...acc, ' / ', cur]), []);

  return (
    <li>
      <div className={`row${flash ? ' flash' : ''}`}>
        <span className="edge" style={{ background: groupColor }} />
        <span className="who">
          <span className="nm">{p.n}</span>
          {meta.length > 0 && <span className="meta">{meta}</span>}
          <span className="err">{err}</span>
        </span>
        {seatKeyOf ? (
          <span className="done">
            <span className={`tag num ${departed ? 'gone' : 'on'}`}>{seatKeyOf}</span>
            {isAdmin && !departed && (
              <button type="button" className="cxl" onClick={() => onCancel(seatKeyOf)}>
                취소
              </button>
            )}
          </span>
        ) : isAdmin && open ? (
          <span className="asgform">
            <label className="tnum">
              <span>{curBus}-</span>
              <input
                ref={inputRef}
                className="tno"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                maxLength={5}
                placeholder="번호"
                aria-label={`${p.n} 번호 입력`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setErr('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </label>
            <button type="button" className="asgbtn" onClick={submit}>
              배정
            </button>
          </span>
        ) : (
          <span className="tag off">미배정</span>
        )}
      </div>
    </li>
  );
}
