import { useEffect, useRef } from 'react';
import { countBus, emptyNums, hm } from '../utils.js';

export default function AdminDock({ curBus, seats, t, d, saving, onDepart, onEarlyDepart, onUndepart, onReset, onLogout }) {
  const dockRef = useRef(null);
  const c = countBus(t, curBus, seats);
  const departed = !!d[curBus];

  let departBtnClass = 'depart';
  let departDisabled = true;
  let departText;
  let hint;
  let secButton = null;

  if (saving) {
    departText = '저장 중...';
    hint = '저장하는 중입니다. 잠시만 기다려 주세요.';
  } else if (departed) {
    departBtnClass += ' done';
    departText = `${curBus}호차 출발 완료 (${hm(d[curBus])}, ${c}명)`;
    hint = '최종확인된 차량은 수정할 수 없습니다.';
    secButton = (
      <button type="button" onClick={() => onUndepart(curBus)}>
        최종확인 해제
      </button>
    );
  } else if (c === seats) {
    departDisabled = false;
    departText = `${curBus}호차 최종확인 후 출발 (${c}/${seats})`;
    hint = `${curBus}호차 ${seats}명 배정 완료. 최종확인 전에는 명단에서 취소할 수 있습니다.`;
  } else {
    departText = `${seats}번까지 모두 차면 최종확인 (${c}/${seats})`;
    const em = emptyNums(t, curBus, seats);
    const list = em.slice(0, 8).join(', ') + (em.length > 8 ? ` 외 ${em.length - 8}개` : '');
    hint = `${curBus}호차 빈 번호: ${list}`;
    if (c > 0) {
      secButton = (
        <button type="button" onClick={() => onEarlyDepart(curBus)}>
          인원 미달로 지금 최종확인
        </button>
      );
    }
  }

  useEffect(() => {
    if (dockRef.current) {
      document.documentElement.style.setProperty('--dock', `${dockRef.current.offsetHeight}px`);
    }
    return () => document.documentElement.style.setProperty('--dock', '0px');
  });

  return (
    <div className="dock" aria-label="관리자 도구" ref={dockRef}>
      <div className="in">
        <div className="lbl">
          <span>{hint}</span>
          <span className="tools">
            <button type="button" onClick={onReset}>
              전체 초기화
            </button>
            <button type="button" onClick={onLogout}>
              나가기
            </button>
          </span>
        </div>
        <button type="button" className={departBtnClass} disabled={departDisabled || saving} onClick={() => onDepart(curBus)}>
          {departText}
        </button>
        <div className="sec">{secButton}</div>
      </div>
    </div>
  );
}
