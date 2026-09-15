import Modal from './Modal.jsx';
import { hms } from '../utils.js';

export default function SeatSheetModal({ state, onClose, onCancelSeat }) {
  if (!state) return null;
  const { seatKey: k, person, at, canEdit, departedBus } = state;

  const desc = [
    person ? person.n : '-',
    `배정 시각 ${hms(at)}`,
    departedBus ? `${departedBus}호차는 최종확인되어 수정할 수 없습니다.` : null
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Modal open onClose={onClose}>
      <h3>{k}번</h3>
      <p>{desc}</p>
      <div className="acts">
        {canEdit && (
          <button
            type="button"
            className="danger"
            onClick={() => {
              onClose();
              onCancelSeat(k);
            }}
          >
            {k}번 배정 취소
          </button>
        )}
        <button type="button" className="quiet" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
