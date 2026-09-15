import Modal from './Modal.jsx';

// state: null (closed) or { title, desc, ok, kind, resolve }
export default function ConfirmModal({ state, onClose }) {
  if (!state) return null;
  const { title, desc, ok, kind = 'primary', resolve } = state;

  const finish = (value) => {
    resolve(value);
    onClose();
  };

  return (
    <Modal open onClose={() => finish(false)}>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="acts">
        <button type="button" className={kind} onClick={() => finish(true)}>
          {ok}
        </button>
        <button type="button" className="quiet" onClick={() => finish(false)}>
          취소
        </button>
      </div>
    </Modal>
  );
}
