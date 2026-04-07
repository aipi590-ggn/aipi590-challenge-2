import { useState, useRef } from 'react';
import { writeAnnotation } from '../firebase';

// ── Gender icons ──
function GenderIcon({ gender }) {
  const g = (gender || '').toLowerCase();
  if (g === 'female') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-rose-400">
        <circle cx="12" cy="9" r="5" /><line x1="12" y1="14" x2="12" y2="22" /><line x1="9" y1="19" x2="15" y2="19" />
      </svg>
    );
  }
  if (g === 'male') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-sky-400">
        <circle cx="10" cy="14" r="5" /><line x1="19" y1="5" x2="13.6" y2="10.4" /><polyline points="19 5 19 10" /><polyline points="19 5 14 5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-violet-400">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="3" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="21" /><line x1="4.22" y1="19.78" x2="7.05" y2="16.95" />
    </svg>
  );
}

// ── Quiz component ──
// Rounds are immutable props. No useEffect. No Firebase reads. Minimal state.
export default function Quiz({ rounds, sessionId, userGender, userInterest, initialProgress, onProgress, onComplete }) {
  const startCurrent = (initialProgress?.current >= 0 && initialProgress?.current < rounds.length)
    ? initialProgress.current
    : 0;
  const startChoices = Array.isArray(initialProgress?.choices) ? initialProgress.choices : [];

  const [current, setCurrent] = useState(startCurrent);
  const [choices, setChoices] = useState(startChoices);
  const [picked, setPicked] = useState(null); // 'left' | 'right' | 'tie' | null
  const advancingRef = useRef(false); // prevents any double-advance

  // Defensive: if current is out of bounds, show fallback
  if (!rounds || current < 0 || current >= rounds.length) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-warm-gray mb-4">Preparing your results...</p>
        </div>
      </div>
    );
  }

  const round = rounds[current];
  if (!round || !round.pair) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-warm-gray">Loading...</p>
      </div>
    );
  }

  const { pair, displayedLeft, displayedRight } = round;
  const profile = pair.profile || {};
  const rawHobbies = profile.hobbies;
  const hobbies = Array.isArray(rawHobbies)
    ? rawHobbies
    : typeof rawHobbies === 'string'
      ? rawHobbies.split(',').map(h => h.trim()).filter(Boolean)
      : [];
  const progress = (current / rounds.length) * 100;
  const isLast = current + 1 >= rounds.length;

  function advance(choiceRecord) {
    // CRITICAL: prevent double advance
    if (advancingRef.current) return;
    advancingRef.current = true;

    const newChoices = [...choices, choiceRecord];

    if (isLast) {
      // Don't update local state — just call parent callbacks
      onProgress({ current: current + 1, choices: newChoices });
      onComplete(newChoices);
    } else {
      const nextCurrent = current + 1;
      setCurrent(nextCurrent);
      setChoices(newChoices);
      setPicked(null);
      onProgress({ current: nextCurrent, choices: newChoices });
      // Reset the lock after state update
      advancingRef.current = false;
    }
  }

  function handleChoice(choice) {
    // Only allow if nothing is picked yet
    if (picked !== null) return;

    let chosenBio;
    if (choice === 'left') chosenBio = displayedLeft;
    else if (choice === 'right') chosenBio = displayedRight;
    else chosenBio = 'tie';

    // Show highlight
    setPicked(choice);

    // Fire-and-forget annotation (fully try-caught in firebase.js)
    writeAnnotation({
      pair_id: pair.id,
      session_id: sessionId,
      user_gender: userGender,
      user_interested_in: userInterest,
      displayed_left: displayedLeft,
      choice: chosenBio,
      timestamp: new Date().toISOString(),
    });

    const choiceRecord = {
      pair_id: pair.id,
      session_id: sessionId,
      user_gender: userGender,
      user_interested_in: userInterest,
      displayed_left: displayedLeft,
      choice: chosenBio,
      chosen_text: choice === 'left' ? round.leftBio : choice === 'right' ? round.rightBio : null,
      pair_type: pair.pair_type,
      timestamp: new Date().toISOString(),
    };

    // Advance after brief highlight
    setTimeout(() => advance(choiceRecord), 300);
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-4 sm:py-6 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-warm-gray">
            Question {current + 1} of {rounds.length}
          </span>
          <span className="text-xs text-gray-300">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-sand rounded-full overflow-hidden">
          <div className="h-full bg-coral rounded-full progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Profile card */}
      <div key={`p-${current}`} className="bg-white rounded-2xl shadow-sm border border-sand p-4 mb-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
            <GenderIcon gender={profile.gender} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">{round.fakeName || 'Anonymous'}</h2>
            <p className="text-warm-gray text-sm">{profile.age || '?'} · {profile.job || 'Unknown'}</p>
          </div>
        </div>
        {hobbies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {hobbies.map(h => (
              <span key={h} className="px-2.5 py-0.5 bg-cream text-warm-gray text-xs font-medium rounded-full">{h}</span>
            ))}
          </div>
        )}
      </div>

      {/* Bio cards */}
      <div key={`b-${current}`} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 animate-fade-in">
        <button
          onClick={() => handleChoice('left')}
          disabled={picked !== null}
          className={`bio-card rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
            picked === 'left'
              ? 'border-coral bg-coral/5'
              : picked !== null
                ? 'border-transparent bg-white shadow-sm opacity-50'
                : 'border-transparent bg-white shadow-sm hover:border-coral/30 hover:shadow-md active:scale-[0.98] cursor-pointer'
          }`}
        >
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-coral/70 mb-1.5">Bio A</span>
          <p className="text-gray-800 text-sm leading-relaxed">{round.leftBio || ''}</p>
        </button>

        <button
          onClick={() => handleChoice('right')}
          disabled={picked !== null}
          className={`bio-card rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
            picked === 'right'
              ? 'border-coral bg-coral/5'
              : picked !== null
                ? 'border-transparent bg-[#F9F5F0] shadow-sm opacity-50'
                : 'border-transparent bg-[#F9F5F0] shadow-sm hover:border-amber-300/50 hover:shadow-md active:scale-[0.98] cursor-pointer'
          }`}
        >
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-600/70 mb-1.5">Bio B</span>
          <p className="text-gray-800 text-sm leading-relaxed">{round.rightBio || ''}</p>
        </button>
      </div>

      {/* Tie button */}
      <div className="flex justify-center pb-4">
        <button
          onClick={() => handleChoice('tie')}
          disabled={picked !== null}
          className={`py-2.5 px-8 rounded-xl font-semibold text-sm transition-all duration-150 ${
            picked === 'tie'
              ? 'bg-warm-gray text-white scale-[0.97]'
              : 'bg-white border border-gray-200 text-gray-400 hover:border-warm-gray hover:text-warm-gray active:scale-[0.97]'
          }`}
        >
          It's a tie
        </button>
      </div>
    </div>
  );
}
