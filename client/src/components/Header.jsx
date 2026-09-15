export default function Header({ isAdmin, sumBoard, sumLeft, sumGone, statusKind, statusText, onAdminClick, onRefresh }) {
  return (
    <header>
      <div className="toprow">
        <div>
          <h1>명동 선착순 승차 확인</h1>
          <p className="sub">{isAdmin ? '관리자 편집 중' : '보기 전용'}</p>
        </div>
        <button
          type="button"
          className={`modebtn${isAdmin ? ' on' : ''}`}
          onClick={onAdminClick}
        >
          {isAdmin ? '관리자 모드' : '관리자'}
        </button>
      </div>
      <div className="summary">
        <div>
          <b className="num">{sumBoard}</b>배정 완료
        </div>
        <div>
          <b className="num">{sumLeft}</b>미배정
        </div>
        <div>
          <b className="num">{sumGone}</b>출발 차량
        </div>
      </div>
      <div className="status" role="status">
        <span className={`dot${statusKind === 'ok' ? '' : statusKind === 'warn' ? ' warn' : ' err'}`} />
        <span>{statusText}</span>
        <button type="button" className="linkbtn" onClick={onRefresh}>
          새로고침
        </button>
      </div>
    </header>
  );
}
