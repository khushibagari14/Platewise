'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Camera,
  History,
  Leaf,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

const SEEN_KEY = 'platewise:tour:v1';
const steps = [
  {
    icon: Camera,
    tag: '01 / A little clarity',
    title: 'A photo. A clearer picture.',
    description:
      'Add a photo of your meal. Platewise estimates the energy, protein and nutrients on your plate.',
    detail:
      'Use a clear photo of the whole plate. Add up to four angles for a better estimate.',
  },
  {
    icon: SlidersHorizontal,
    tag: '02 / Make it yours',
    title: 'Your portion, your call.',
    description:
      'Check the foods we found, adjust the portions, or remove an item. Your meal totals update as you go.',
    detail: 'Every scan is an estimate. You always have the final say.',
  },
  {
    icon: History,
    tag: '03 / Pick up anywhere',
    title: 'Your meals come with you.',
    description:
      'Sign in to keep your meal calendar together across devices. Meals already on this browser move into your account automatically.',
    detail:
      'No extra import step. Sign in with the same account wherever you use Platewise.',
  },
];
export function AppTour({
  signedIn,
  onSignIn,
  onSignUp,
}: {
  signedIn: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
      } catch {
        setOpen(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  function finish() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {}
    setOpen(false);
  }
  const current = steps[step];
  const Icon = current.icon;
  const last = step === steps.length - 1;
  return (
    <>
      <button
        className="tour-trigger"
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
      >
        Quick tour
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) finish();
        }}
      >
        <DialogContent className="tour-dialog" showCloseButton={false}>
          <div className="tour-topline">
            <span>
              <Leaf size={16} aria-hidden="true" /> platewise
            </span>
            <button type="button" onClick={finish}>
              Skip tour
            </button>
          </div>
          <div className="tour-art" key={step} aria-hidden="true">
            <div className="tour-orbit">
              <Icon size={38} strokeWidth={1.2} />
            </div>
            <span>
              {step === 0
                ? 'A moment for your meal'
                : step === 1
                  ? 'Small adjustments, clear insight'
                  : 'One account. Every device.'}
            </span>
          </div>
          <div className="tour-copy" key={step}>
            <p className="tour-kicker">{current.tag}</p>
            <DialogTitle className="tour-title">{current.title}</DialogTitle>
            <DialogDescription className="tour-description">
              {current.description}
            </DialogDescription>
            <p className="tour-detail">{current.detail}</p>
          </div>
          <div className="tour-bottom">
            <div
              className="tour-progress"
              aria-label={`Step ${step + 1} of ${steps.length}`}
            >
              {steps.map((item, index) => (
                <span
                  key={item.tag}
                  className={index === step ? 'active' : ''}
                />
              ))}
            </div>
            <div className="tour-navigation">
              {step > 0 && (
                <button
                  type="button"
                  className="tour-back"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              <button
                className="tour-primary"
                type="button"
                onClick={() => {
                  if (!last) setStep(step + 1);
                  else {
                    finish();
                    if (!signedIn) onSignUp();
                  }
                }}
              >
                {last
                  ? signedIn
                    ? 'Start exploring'
                    : 'Create an account'
                  : 'Continue'}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          {last && !signedIn && (
            <button
              className="tour-login"
              type="button"
              onClick={() => {
                finish();
                onSignIn();
              }}
            >
              Already have an account? Sign in
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
