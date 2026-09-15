export default function ViewTabs({ view, onChange }) {
  return (
    <div className="views" role="tablist" aria-label="보기 방식">
      <button type="button" role="tab" aria-selected={view === 'roster'} onClick={() => onChange('roster')}>
        명단
      </button>
      <button type="button" role="tab" aria-selected={view === 'seats'} onClick={() => onChange('seats')}>
        차량 현황
      </button>
    </div>
  );
}
