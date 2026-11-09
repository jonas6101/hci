import { ArrowRight, Trees } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../lib/store';
import { ArborLogo, Glyph } from './Glyph';

const STEPS = [
  {
    title: 'See who’s doing the thinking',
    body: 'Arbor quietly labels each prompt — your own thinking, thinking together, or delegated to the AI. It never blocks you; it just makes delegation visible.',
    art: (
      <div className="ob-art ob-modes">
        <span>
          <Glyph mode="own" size={18} /> Your thinking
        </span>
        <span>
          <Glyph mode="together" size={18} /> Thinking together
        </span>
        <span>
          <Glyph mode="ai" size={18} /> Delegated to AI
        </span>
      </div>
    ),
  },
  {
    title: 'Watch your knowledge grow',
    body: 'Every concept you touch becomes a leaf on this conversation’s tree. Filled leaves are ideas you reasoned through yourself; hollow ones are still the AI’s.',
    art: (
      <div className="ob-art">
        <svg width="150" height="96" viewBox="-75 -90 150 96" aria-hidden="true">
          <polygon points="-3,0 -1,-78 1,-78 3,0" fill="var(--bark)" />
          <path d="M0,-20 C14,-22 28,-34 36,-40" className="limb" />
          <path d="M0,-50 C-14,-52 -28,-62 -36,-68" className="limb" />
          <circle cx="36" cy="-40" r="7" fill="var(--you)" />
          <circle cx="44" cy="-62" r="6" fill="var(--surface)" stroke="var(--ai)" strokeWidth="1.6" />
          <circle cx="-36" cy="-68" r="7" fill="var(--surface)" stroke="var(--you)" strokeWidth="1.6" />
          <path d="M-36,-75 A7,7 0 0 1 -36,-61 Z" fill="var(--you)" />
          <line x1="-50" x2="50" y1="0" y2="0" className="ground" />
        </svg>
      </div>
    ),
  },
  {
    title: 'Zoom out to your forest',
    body: 'All your conversations form a forest, grouped into groves. Spot what you truly own, what you mostly delegated, and which ideas connect across topics.',
    art: (
      <div className="ob-art ob-forest">
        <Trees size={44} strokeWidth={1.4} />
      </div>
    ),
  },
];

export function Onboarding() {
  const { state, finishOnboarding } = useStore();
  const [step, setStep] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.onboarding) {
      setStep(0);
      requestAnimationFrame(() => primary.current?.focus());
    }
  }, [state.onboarding]);

  useEffect(() => {
    if (!state.onboarding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishOnboarding();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.onboarding, finishOnboarding]);

  if (!state.onboarding) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ob-title">
        <div className="ob-brand">
          <ArborLogo size={18} /> Arbor
          <span className="muted small">· {step + 1} of {STEPS.length}</span>
        </div>
        {s.art}
        <h2 id="ob-title">{s.title}</h2>
        <p>{s.body}</p>
        <div className="ob-foot">
          <div className="dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <i key={i} className={i === step ? 'on' : ''} />
            ))}
          </div>
          <div className="ob-actions">
            {step > 0 ? (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={finishOnboarding}>
                Skip
              </button>
            )}
            <button ref={primary} className="btn btn-primary" onClick={() => (last ? finishOnboarding() : setStep(step + 1))}>
              {last ? 'Start' : 'Next'} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const { state } = useStore();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!state.toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3400);
    return () => clearTimeout(t);
  }, [state.toast]);
  return (
    <div className={`toast ${visible ? 'show' : ''}`} role="status" aria-live="polite">
      {state.toast?.text}
    </div>
  );
}
