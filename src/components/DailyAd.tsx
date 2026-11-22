import { useEffect, useState } from 'react';
import { dayKey, setState } from '../lib/store';
import { Btn, Card, Overlay } from './ui';

/*
 * The one ad per day. This is a placeholder "house ad" slot.
 * To monetise later, render an AdSense (web) or AdMob (Capacitor) unit inside
 * <div id="lockedin-ad-slot">. Keep it to ONE per day and never show it during
 * panic mode or a relapse flow — that is the promise to users.
 */
export default function DailyAd() {
  const [secs, setSecs] = useState(5);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs(secs - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const close = () => setState({ lastAdDay: dayKey() });

  return (
    <Overlay>
      <Card className="col">
        <div className="spread">
          <span className="badge shu">Today's one and only ad</span>
          <Btn variant="ghost sm" disabled={secs > 0} onClick={close}>
            {secs > 0 ? `Skip in ${secs}` : '✕ Close'}
          </Btn>
        </div>
        <div
          id="lockedin-ad-slot"
          className="center col"
          style={{
            minHeight: 220,
            border: '1.5px dashed var(--ink)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            gap: 10,
          }}
        >
          <span className="badge">Ad</span>
          <h3>LockedIn is free & open source</h3>
          <p className="small muted">
            No subscriptions, no paywalls, no data selling. This single daily ad keeps it that way. Share it with a friend
            who needs it.
          </p>
        </div>
        <p className="small dim center">That's it. No more ads until tomorrow. Back to locking in.</p>
      </Card>
    </Overlay>
  );
}
