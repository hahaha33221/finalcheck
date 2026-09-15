import { countBus, emptyNums, hm, seatKey } from '../utils.js';

export default function SeatView({ curBus, seats, t, d, byId, isAdmin, onSeatClick }) {
  const c = countBus(t, curBus, seats);
  const departed = !!d[curBus];

  let meterClass = 'meter';
  if (departed) meterClass += ' gone';
  else if (c === seats) meterClass += ' full';

  let stateClass = 'state';
  let stateText;
  if (departed) {
    stateText = `${hm(d[curBus])} 최종확인, 출발했습니다. 더 이상 수정할 수 없습니다.`;
  } else if (c === seats) {
    stateClass = 'state ready';
    stateText = `${seats}번까지 모두 찼습니다. 확인 후 최종확인을 누르세요.`;
  } else if (c) {
    stateClass = 'state go';
    stateText = `배정 중, 빈 번호 ${seats - c}개`;
  } else {
    stateText = '아직 배정된 사람이 없습니다.';
  }

  const cells = [];
  for (let n = 1; n <= seats; n++) {
    const k = seatKey(curBus, n);
    const entry = t[k];
    if (n % 4 === 3) cells.push(<span aria-hidden="true" key={`gap-${n}`} />);
    const name = entry ? (byId[entry.p] ? byId[entry.p].n : '') : '';
    const classes = ['seat', entry ? (departed ? 'gone' : 'on') : departed ? 'gone empty' : 'empty'];
    if (!entry && !departed && c > 0) classes.push('miss');
    cells.push(
      <button
        type="button"
        key={k}
        className={classes.join(' ')}
        aria-label={entry ? `${k} ${name}` : `${k} 빈 번호`}
        onClick={() => onSeatClick(k, entry)}
      >
        <b className="num">{k}</b>
        <small>{entry ? name : departed ? '빈자리' : ' '}</small>
      </button>
    );
  }

  return (
    <section>
      <div className="busbox">
        <div className="bushead">
          <h2>{curBus}호차</h2>
          <div className="cnt num">
            <b>{c}</b> / {seats}석
          </div>
        </div>
        <p className={stateClass}>{stateText}</p>
        <div className={meterClass}>
          <i style={{ width: `${(c / seats) * 100}%` }} />
        </div>
        <div className="front">
          <span>앞쪽 (운전석)</span>
          <span>출입문</span>
        </div>
        <div className="seats">{cells}</div>
        <div className="legend">
          <span>
            <i /> 빈 번호
          </span>
          <span>
            <i style={{ background: 'var(--blue)', borderColor: 'var(--blue)' }} /> 배정됨
          </span>
          <span>
            <i style={{ background: 'var(--gone)', borderColor: 'var(--gone)' }} /> 출발 확정
          </span>
        </div>
      </div>
    </section>
  );
}
