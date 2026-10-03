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
    tag: '01 / Add your meal',
    title: 'Photo or text. Your choice.',
    description:
      'Take a photo, choose one from your gallery, or type what you ate.',
    detail:
      'Use Add details to clarify ingredients, like a banana shake without sugar.',
  },
  {
    icon: SlidersHorizontal,
    tag: '02 / Make it yours',
    title: 'Fine-tune your portions.',
    description:
      'Change an amount, such as 100 g to 105 g. Calories and every nutrient adjust together.',
    detail:
      'Tap outside the amount field to save. Remove any food that does not belong.',
  },
  {
    icon: History,
    tag: '03 / Pick up anywhere',
    title: 'Your meals come with you.',
    description:
      'Sign in to save your meals and find them in your meal calendar on any device.',
    detail:
      'Forgot a photo? Add a meal manually and choose Today, Yesterday or an earlier date.',
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
          <div className="tour-body" key={step}>
            <div className="tour-art" aria-hidden="true">
              <div className="tour-orbit">
                <Icon size={38} strokeWidth={1.2} />
              </div>
              <span>
                {step === 0
                  ? 'Photo or text'
                  : step === 1
                    ? '100 g → 105 g'
                    : 'Your personal meal calendar'}
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
          </div>
          <div className="tour-footer">
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
              <small className="tour-step-count">
                {step + 1} of {steps.length}
              </small>
            </div>
            <div className="tour-navigation">
              <button
                type="button"
                className="tour-back"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
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
            {(!last || signedIn) && (
              <div className="tour-login-placeholder" aria-hidden="true" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
