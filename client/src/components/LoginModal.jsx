import { useState } from 'react';
import Modal from './Modal.jsx';

export default function LoginModal({ open, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword('');
    setErr('');
    setBusy(false);
    onClose();
  };

  const submit = async () => {
    if (!password) {
      setErr('비밀번호를 입력하세요.');
      return;
    }
    setBusy(true);
    setErr('');
    const result = await onSubmit(password);
    setBusy(false);
    if (result && result.ok) {
      close();
    } else {
      setErr('비밀번호가 맞지 않습니다.');
    }
  };

  return (
    <Modal open={open} onClose={close}>
      <h3>관리자 로그인</h3>
      <p>관리자 비밀번호를 입력하세요. 로그인하면 번호 배정과 출발 확인을 저장할 수 있습니다.</p>
      <input
        className="pin"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setErr('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="비밀번호"
        aria-label="관리자 비밀번호"
        autoFocus
      />
      <div className="err">{err}</div>
      <div className="acts">
        <button type="button" className="dark" onClick={submit} disabled={busy}>
          {busy ? '확인 중...' : '로그인'}
        </button>
        <button type="button" className="quiet" onClick={close}>
          취소
        </button>
      </div>
    </Modal>
  );
}
