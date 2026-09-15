import { countBus, hm } from '../utils.js';

export default function BusTabs({ buses, seats, t, d, curBus, onSelect }) {
  return (
    <div className="buses" role="tablist" aria-label="호차 선택">
      {buses.map((b) => {
        const c = countBus(t, b, seats);
        const departed = !!d[b];
        let cls = '';
        let txt;
        if (departed) {
          cls = 'left';
          txt = `출발 ${hm(d[b])}`;
        } else if (c) {
          cls = 'go';
          txt = `${c}/${seats}`;
        } else {
          txt = '대기';
        }
        return (
          <button
            key={b}
            type="button"
            role="tab"
            className={`btab ${cls}`}
            aria-selected={b === curBus}
            onClick={() => onSelect(b)}
          >
            <b>{b}호차</b>
            <small className="num">{txt}</small>
          </button>
        );
      })}
    </div>
  );
}
