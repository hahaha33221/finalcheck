export default function Toast({ text }) {
  return (
    <div className={`toast${text ? ' show' : ''}`} role="status">
      <span>{text}</span>
    </div>
  );
}
