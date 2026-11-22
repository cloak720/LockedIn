import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { AssessmentResult } from './lib/assessment';
import { buzz, dayKey, getState, lockNow, setState, useAppState, useLock } from './lib/store';
import Assessment from './components/Assessment';
import Coach from './components/Coach';
import DailyAd from './components/DailyAd';
import Home from './components/Home';
import Insights from './components/Insights';
import Onboarding from './components/Onboarding';
import PanicMode from './components/PanicMode';
import PinLock from './components/PinLock';
import RelapseFlow from './components/RelapseFlow';
import Results from './components/Results';
import Settings from './components/Settings';
import { Icon, Overlay } from './components/ui';

type Tab = 'home' | 'insights' | 'coach' | 'settings';
type Modal = null | 'panic' | 'relapse' | 'assess';

const TABS: { id: Tab; ico: 'home' | 'radar' | 'coach' | 'settings'; label: string }[] = [
  { id: 'home', ico: 'home', label: 'Home' },
  { id: 'insights', ico: 'radar', label: 'Radar' },
  { id: 'coach', ico: 'coach', label: 'Coach' },
  { id: 'settings', ico: 'settings', label: 'Settings' },
];

function Retake({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const [res, setRes] = useState<AssessmentResult | null>(null);
  const prev = s.assessments[s.assessments.length - 1];
  return res ? (
    <Results
      result={res}
      previous={prev}
      cta="Save & close"
      onContinue={() => {
        setState((st) => ({ assessments: [...st.assessments, res] }));
        onClose();
      }}
    />
  ) : (
    <Assessment onDone={setRes} onCancel={onClose} />
  );
}

export default function App() {
  const s = useAppState();
  const [tab, setTab] = useState<Tab>('home');
  const [modal, setModal] = useState<Modal>(null);
  const lock = useLock();
  const [adReady, setAdReady] = useState(false);

  // Privacy: blur the UI whenever the app is backgrounded (hides it in the app
  // switcher), and auto-lock after the chosen time if a passcode is set.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        document.body.classList.add('privacy-blur');
        if (getState().settings.autoLockSec === 0) void lockNow();
      } else {
        document.body.classList.remove('privacy-blur');
        const sec = getState().settings.autoLockSec;
        if (sec >= 0 && Date.now() - hiddenAt >= sec * 1000) void lockNow();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Close any open flow when the app locks, so nothing re-opens on unlock.
  useEffect(() => {
    if (lock.locked) setModal(null);
  }, [lock.locked]);

  // The daily ad: never on day one, never during panic/relapse, and only after
  // the user has had 20 seconds to reach the panic button undisturbed.
  useEffect(() => {
    const t = setTimeout(() => setAdReady(true), 20_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (lock.locked) return <PinLock />;

  const onboarded = !!s.profile && !!s.streakStart;
  const today = dayKey();
  const showAd =
    onboarded &&
    adReady &&
    modal === null &&
    s.lastAdDay !== today &&
    s.profile !== null &&
    dayKey(s.profile.createdAt) !== today;

  return (
    <MotionConfig reducedMotion={s.settings.reduceMotion ? 'always' : 'user'}>
      {!onboarded ? (
        <Onboarding />
      ) : (
        <>
          <main className="app">
            <AnimatePresence mode="wait">
              <motion.div key={tab}>
                {tab === 'home' && <Home onPanic={() => setModal('panic')} onRelapse={() => setModal('relapse')} />}
                {tab === 'insights' && <Insights />}
                {tab === 'coach' && <Coach goSettings={() => setTab('settings')} />}
                {tab === 'settings' && <Settings onRetake={() => setModal('assess')} />}
              </motion.div>
            </AnimatePresence>
          </main>

          <LayoutGroup>
            <nav className="tabbar">
              {TABS.map((t) => (
                <motion.button
                  key={t.id}
                  className={`tab ${tab === t.id ? 'on' : ''}`}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => {
                    buzz(8);
                    setTab(t.id);
                  }}
                >
                  {tab === t.id && <motion.span layoutId="pill" className="pill" />}
                  <motion.span className="ico" animate={tab === t.id ? { y: [0, -3, 0] } : {}}>
                    <Icon name={t.ico} />
                  </motion.span>
                  {t.label}
                </motion.button>
              ))}
            </nav>
          </LayoutGroup>

          <AnimatePresence>
            {modal === 'panic' && (
              <Overlay full key="panic">
                <PanicMode
                  onClose={() => setModal(null)}
                  onRelapse={() => setModal('relapse')}
                  onCoach={() => {
                    setModal(null);
                    setTab('coach');
                  }}
                />
              </Overlay>
            )}
            {modal === 'relapse' && (
              <Overlay full key="relapse">
                <RelapseFlow
                  onClose={() => setModal(null)}
                  onCoach={() => {
                    setModal(null);
                    setTab('coach');
                  }}
                />
              </Overlay>
            )}
            {modal === 'assess' && (
              <Overlay full key="assess">
                <Retake onClose={() => setModal(null)} />
              </Overlay>
            )}
            {showAd && <DailyAd key="ad" />}
          </AnimatePresence>
        </>
      )}
    </MotionConfig>
  );
}
