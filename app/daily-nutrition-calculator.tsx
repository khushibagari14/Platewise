'use client';

import { useAuth } from '@clerk/nextjs';
import { CheckCircle2, ChevronDown, Target, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { Nutrients } from '@/lib/nutrition';

type Profile = {
  gender: '' | 'female' | 'male' | 'other';
  age: number;
  height: number;
  weight: number;
  activity: '' | 'sedentary' | 'light' | 'moderate' | 'very';
  goal: '' | 'lose' | 'maintain' | 'gain';
};

type Targets = Nutrients;
type HeightUnit = 'cm' | 'ft' | 'm';

const PROFILE_KEY = 'platewise:nutrition-profile';
const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};
const proteinFactors = { sedentary: 1.2, light: 1.4, moderate: 1.6, very: 1.8 };
const defaultProfile: Profile = {
  gender: '',
  age: 0,
  height: 0,
  weight: 0,
  activity: '',
  goal: '',
};

function calculateTargets(profile: Profile): Targets {
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age;
  const genderAdjustment =
    profile.gender === 'male' ? 5 : profile.gender === 'female' ? -161 : -78;
  const goalAdjustment =
    profile.goal === 'lose' ? -300 : profile.goal === 'gain' ? 250 : 0;
  const calories = Math.max(
    1200,
    Math.round(
      (base + genderAdjustment) *
        activityFactors[profile.activity || 'moderate'] +
        goalAdjustment,
    ),
  );
  const proteinGoalAdjustment =
    profile.goal === 'gain' ? 0.2 : profile.goal === 'lose' ? 0.15 : 0;
  const protein = Math.round(
    profile.weight *
      (proteinFactors[profile.activity || 'moderate'] + proteinGoalAdjustment),
  );
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * 14);
  return { calories, protein, carbs, fat, fiber };
}

export function DailyNutritionCalculator({
  consumed,
  selectedDate,
}: {
  consumed: Nutrients;
  selectedDate: string;
}) {
  const { isLoaded, userId } = useAuth();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [expanded, setExpanded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const notifiedDate = useRef<string | null>(null);
  const targets = useMemo(
    () => (savedProfile ? calculateTargets(savedProfile) : null),
    [savedProfile],
  );
  const remainingProtein = targets
    ? Math.max(0, Math.round(targets.protein - consumed.protein))
    : 0;
  const proteinGoalReached = Boolean(
    targets && consumed.protein >= targets.protein,
  );
  const proteinProgress = targets
    ? Math.min(100, Math.round((consumed.protein / targets.protein) * 100))
    : 0;
  const heightFeet = profile.height ? Math.floor(profile.height / 30.48) : 0;
  const heightInches = profile.height
    ? Math.round(profile.height / 2.54 - heightFeet * 12)
    : 0;
  const heightMetres = profile.height
    ? Number((profile.height / 100).toFixed(2))
    : 0;

  function updateFeetHeight(feet: number, inches: number) {
    setProfile({
      ...profile,
      height: Number((feet * 30.48 + inches * 2.54).toFixed(1)),
    });
  }

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    queueMicrotask(async () => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`${PROFILE_KEY}:${userId || 'guest'}`) || 'null',
        ) as Profile | null;
        if (active && saved?.age && saved?.height && saved?.weight) {
          setProfile(saved);
          setSavedProfile(saved);
        }
      } catch {}
      if (!userId) return;
      try {
        const response = await fetch('/api/nutrition-profile', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (active && response.status !== 503) setSyncError(true);
          return;
        }
        const body = (await response.json()) as { profile?: Profile | null };
        if (!active) return;
        setSyncError(false);
        setProfile(body.profile || defaultProfile);
        setSavedProfile(body.profile || null);
        if (body.profile)
          localStorage.setItem(
            `${PROFILE_KEY}:${userId}`,
            JSON.stringify(body.profile),
          );
      } catch {
        if (active) setSyncError(true);
      }
    });
    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!proteinGoalReached) {
      if (notifiedDate.current === selectedDate) notifiedDate.current = null;
      return;
    }
    if (notifiedDate.current === selectedDate) return;
    notifiedDate.current = selectedDate;
    queueMicrotask(() => setShowComplete(true));
    const timer = window.setTimeout(() => setShowComplete(false), 5200);
    return () => window.clearTimeout(timer);
  }, [proteinGoalReached, selectedDate]);

  function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.gender || !profile.activity || !profile.goal) return;
    const safeProfile = {
      ...profile,
      age: Math.min(100, Math.max(14, profile.age)),
      height: Math.min(230, Math.max(120, profile.height)),
      weight: Math.min(300, Math.max(30, profile.weight)),
    };
    setProfile(safeProfile);
    setSavedProfile(safeProfile);
    setExpanded(false);
    localStorage.setItem(
      `${PROFILE_KEY}:${userId || 'guest'}`,
      JSON.stringify(safeProfile),
    );
    if (userId) {
      void fetch('/api/nutrition-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safeProfile),
      })
        .then((response) => setSyncError(!response.ok))
        .catch(() => setSyncError(true));
    }
  }

  return (
    <section
      className="nutrition-goal-card"
      aria-labelledby="nutrition-goal-title"
    >
      {showComplete ? (
        <output className="protein-complete-toast">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Daily protein completed</strong>
            <small>You reached your protein goal for this day.</small>
          </span>
          <button
            type="button"
            onClick={() => setShowComplete(false)}
            aria-label="Dismiss notification"
          >
            <X size={17} />
          </button>
        </output>
      ) : null}

      {syncError ? (
        <output className="nutrition-sync-note">
          Your goal is saved on this device, but cloud sync is unavailable. It
          will be retried when you edit your details.
        </output>
      ) : null}

      <div className="nutrition-goal-heading">
        <span className="nutrition-goal-icon">
          <Target size={20} aria-hidden="true" />
        </span>
        <div>
          <span className="step-label">Your daily nutrition</span>
          <h3 id="nutrition-goal-title">Personal nutrition goal</h3>
        </div>
        {savedProfile ? (
          <button
            type="button"
            className="nutrition-edit"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            Edit details
            <ChevronDown className={expanded ? 'open' : ''} size={17} />
          </button>
        ) : null}
      </div>

      {expanded || !savedProfile ? (
        <form className="nutrition-profile-form" onSubmit={save}>
          {!savedProfile ? (
            <div className="nutrition-form-intro">
              <strong>Let’s set your daily targets</strong>
              <span>
                Add your details once. You can update them whenever they change.
              </span>
            </div>
          ) : null}
          <label>
            <span>Gender</span>
            <select
              required
              value={profile.gender}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  gender: event.target.value as Profile['gender'],
                })
              }
            >
              <option value="" disabled>
                Select gender
              </option>
              <option value="female">Woman</option>
              <option value="male">Man</option>
              <option value="other">Another identity</option>
            </select>
          </label>
          <label>
            <span>Age</span>
            <div className="field-with-unit">
              <input
                required
                type="number"
                min="14"
                max="100"
                placeholder="e.g. 28"
                value={profile.age || ''}
                onChange={(event) =>
                  setProfile({ ...profile, age: Number(event.target.value) })
                }
              />
              <small>years</small>
            </div>
          </label>
          <fieldset className="height-field">
            <div className="height-field-heading">
              <legend>Height</legend>
              <div className="height-unit-switch" aria-label="Height unit">
                {(['cm', 'ft', 'm'] as HeightUnit[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={heightUnit === unit ? 'active' : ''}
                    onClick={() => setHeightUnit(unit)}
                    aria-pressed={heightUnit === unit}
                  >
                    {unit === 'ft' ? 'ft / in' : unit}
                  </button>
                ))}
              </div>
            </div>
            {heightUnit === 'ft' ? (
              <div className="height-feet-fields">
                <div className="field-with-unit">
                  <input
                    required
                    aria-label="Height in feet"
                    type="number"
                    min="3"
                    max="7"
                    placeholder="5"
                    value={heightFeet || ''}
                    onChange={(event) =>
                      updateFeetHeight(Number(event.target.value), heightInches)
                    }
                  />
                  <small>ft</small>
                </div>
                <div className="field-with-unit">
                  <input
                    required
                    aria-label="Additional height in inches"
                    type="number"
                    min="0"
                    max="11"
                    placeholder="6"
                    value={profile.height ? heightInches : ''}
                    onChange={(event) =>
                      updateFeetHeight(heightFeet, Number(event.target.value))
                    }
                  />
                  <small>in</small>
                </div>
              </div>
            ) : (
              <div className="field-with-unit">
                <input
                  required
                  aria-label={`Height in ${heightUnit === 'cm' ? 'centimetres' : 'metres'}`}
                  type="number"
                  min={heightUnit === 'cm' ? 120 : 1.2}
                  max={heightUnit === 'cm' ? 230 : 2.3}
                  step={heightUnit === 'cm' ? 1 : 0.01}
                  placeholder={heightUnit === 'cm' ? 'e.g. 165' : 'e.g. 1.65'}
                  value={
                    heightUnit === 'cm'
                      ? profile.height || ''
                      : heightMetres || ''
                  }
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      height:
                        heightUnit === 'cm'
                          ? Number(event.target.value)
                          : Number(
                              (Number(event.target.value) * 100).toFixed(1),
                            ),
                    })
                  }
                />
                <small>{heightUnit}</small>
              </div>
            )}
          </fieldset>
          <label>
            <span>Weight</span>
            <div className="field-with-unit">
              <input
                required
                type="number"
                min="30"
                max="300"
                step="0.1"
                placeholder="e.g. 60"
                value={profile.weight || ''}
                onChange={(event) =>
                  setProfile({ ...profile, weight: Number(event.target.value) })
                }
              />
              <small>kg</small>
            </div>
          </label>
          <label className="wide">
            <span>Activity level</span>
            <select
              required
              value={profile.activity}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  activity: event.target.value as Profile['activity'],
                })
              }
            >
              <option value="" disabled>
                Select activity level
              </option>
              <option value="sedentary">Mostly seated</option>
              <option value="light">Lightly active</option>
              <option value="moderate">Moderately active</option>
              <option value="very">Very active</option>
            </select>
          </label>
          <label className="wide">
            <span>Goal</span>
            <select
              required
              value={profile.goal}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  goal: event.target.value as Profile['goal'],
                })
              }
            >
              <option value="" disabled>
                Select your goal
              </option>
              <option value="lose">Lose weight gradually</option>
              <option value="maintain">Maintain weight</option>
              <option value="gain">Gain weight or muscle</option>
            </select>
          </label>
          <p className="nutrition-estimate-note">
            These are general estimates for adults and are not medical advice.
          </p>
          <button className="save-nutrition-goal" type="submit">
            Calculate my daily goal
          </button>
        </form>
      ) : targets ? (
        <>
          <div
            className={`remaining-protein ${remainingProtein === 0 ? 'complete' : ''}`}
          >
            <div>
              <small>Remaining daily protein</small>
              <strong>
                {remainingProtein}
                <span>g</span>
              </strong>
            </div>
            <div className="protein-progress-copy">
              <span>{Math.round(consumed.protein)}g eaten</span>
              <span>{targets.protein}g goal</span>
            </div>
            <div
              className="protein-progress"
              aria-label={`${proteinProgress}% of daily protein goal`}
            >
              <i style={{ width: `${proteinProgress}%` }} />
            </div>
          </div>
          <dl className="daily-target-grid">
            <div>
              <dt>Calories</dt>
              <dd>
                {targets.calories}
                <small> kcal</small>
              </dd>
            </div>
            <div>
              <dt>Carbs</dt>
              <dd>
                {targets.carbs}
                <small>g</small>
              </dd>
            </div>
            <div>
              <dt>Fat</dt>
              <dd>
                {targets.fat}
                <small>g</small>
              </dd>
            </div>
            <div>
              <dt>Fiber</dt>
              <dd>
                {targets.fiber}
                <small>g</small>
              </dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  );
}
