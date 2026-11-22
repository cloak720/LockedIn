export default function CrisisCard() {
  return (
    <div className="banner red col" style={{ gap: 8 }}>
      <b>🫂 You matter more than any streak.</b>
      <p className="small">
        You mentioned thoughts of hurting yourself. Please reach out to a crisis line or emergency services now. They are
        free, confidential and available 24/7. You can find the right number for your country here:
      </p>
      <a className="btn sm" style={{ alignSelf: 'flex-start' }} href="https://findahelpline.com" target="_blank" rel="noreferrer">
        Find a helpline →
      </a>
      <p className="small muted">If you are in immediate danger, call your local emergency number.</p>
    </div>
  );
}
