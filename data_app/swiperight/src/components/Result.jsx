import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { writePersonalityResult, fetchPersonalityStats } from '../firebase';

const VIBE_KEYWORDS = {
  witty: ['joke', 'jokes', 'lol', 'pun', 'puns', 'probably', 'honestly', 'sarcas', 'funny', 'humor', 'warning', 'spoiler', 'judge', 'blame', 'apparently', 'bonus', 'points', 'slightly', 'questionable', 'convince', 'weird', 'terrible', 'secretly', 'confess'],
  romantic: ['heart', 'connection', 'soul', 'love', 'beautiful', 'emotion', 'romantic', 'genuine', 'feel', 'honest'],
  adventurous: ['adventure', 'travel', 'dare', 'spontaneous', 'bold', 'wild', 'explore', 'wander', 'lost', 'trip', 'road', 'thrill', 'world', 'challenge', 'adrenaline', 'conquer', 'night', 'seeking'],
  intellectual: ['read', 'book', 'debate', 'think', 'curious', 'museum', 'podcast', 'learn', 'teach', 'theory', 'philosophy', 'nerd', 'conversation', 'complex', 'mind', 'discuss', 'analyze', 'nuance', 'perspective', 'ideas'],
};

const PERSONALITIES = {
  witty: {
    title: 'The Quick Wit',
    emoji: '\u{1F60F}',
    character: 'Chandler Bing (Friends)',
    description: "You're drawn to people who can make you laugh \u2014 the sharper the humor, the better. Your ideal date involves witty banter, playful teasing, and someone who doesn't take themselves too seriously.",
  },
  romantic: {
    title: 'The Hopeless Romantic',
    emoji: '\u{1F495}',
    character: 'Elizabeth Bennet (Pride & Prejudice)',
    description: "You believe in real connection and you're not afraid to go deep. You want someone authentic who wears their heart on their sleeve and isn't afraid of vulnerability.",
  },
  adventurous: {
    title: 'The Thrill Seeker',
    emoji: '\u2693',
    character: 'Jack Sparrow (Pirates of the Caribbean)',
    description: "You're attracted to bold energy and spontaneous spirits. Forget Netflix \u2014 you want someone who'll say yes to a last-minute road trip and figure out the details later.",
  },
  intellectual: {
    title: 'The Deep Thinker',
    emoji: '\u{1F50D}',
    character: 'Sherlock Holmes',
    description: "You fall for minds first. Your perfect match is someone who lights up talking about ideas, stays curious about the world, and can turn a simple dinner into a fascinating conversation.",
  },
  free_spirit: {
    title: 'The Free Spirit',
    emoji: '\u{1F319}',
    character: 'Luna Lovegood (Harry Potter)',
    description: "You don't fit neatly into a box \u2014 and you wouldn't want to. You're drawn to people who are unapologetically themselves, mixing humor, depth, and a touch of whimsy.",
  },
};

// Fallback percentages when Firebase is not available
const FALLBACK_PERCENTS = { witty: 28, romantic: 24, adventurous: 18, intellectual: 14, free_spirit: 16 };

function classifyVibe(text) {
  if (!text) return 'free_spirit';
  const lower = text.toLowerCase();
  const scores = {};
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    scores[vibe] = keywords.filter(k => lower.includes(k)).length;
  }
  const max = Math.max(...Object.values(scores));
  if (max === 0) return 'free_spirit';
  const top = Object.entries(scores).filter(([, v]) => v === max);
  return top[0][0];
}

function computePersonality(choices) {
  const vibeCounts = { witty: 0, romantic: 0, adventurous: 0, intellectual: 0, free_spirit: 0 };
  for (const c of choices) {
    if (c.chosen_text) {
      const vibe = classifyVibe(c.chosen_text);
      vibeCounts[vibe]++;
    }
  }
  let dominant = 'free_spirit';
  let maxCount = 0;
  for (const [vibe, count] of Object.entries(vibeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = vibe;
    }
  }
  return dominant;
}

export default function Result({ choices, onRetake }) {
  const [copied, setCopied] = useState(false);
  const [percent, setPercent] = useState(null);

  const dominant = computePersonality(choices || []);
  const p = PERSONALITIES[dominant] || PERSONALITIES.free_spirit;

  useEffect(() => {
    // Fire confetti — wrapped in try-catch because canvas can fail on low-memory mobile
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E07A5F', '#F4E8D1', '#FFD6C0', '#FDF6EC', '#C4663F'],
      });
    } catch {}

    // Save result & fetch stats — all fully try-caught in firebase.js
    writePersonalityResult(dominant);
    fetchPersonalityStats().then(stats => {
      if (stats) {
        setPercent(stats[dominant] || 0);
      } else {
        setPercent(FALLBACK_PERCENTS[dominant]);
      }
    }).catch(() => {
      setPercent(FALLBACK_PERCENTS[dominant]);
    });
  }, [dominant]);

  function handleShare() {
    const text = `I got "${p.title} ${p.emoji}" on MyRight! Find your dating vibe: ${window.location.origin}${window.location.pathname}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      prompt('Copy this text:', text);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="text-7xl mb-4">{p.emoji}</div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
          You're {p.title}
        </h1>

        <p className="text-coral font-semibold text-lg mb-6">
          Your dating energy matches: {p.character}
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-sand p-6 mb-6 text-left">
          <p className="text-gray-700 leading-relaxed text-sm">
            {p.description}
          </p>
        </div>

        {percent !== null && (
          <p className="text-warm-gray text-sm mb-6">
            {percent}% of quiz takers share your vibe
          </p>
        )}

        <div className="space-y-3">
          <button
            onClick={handleShare}
            className="w-full py-3.5 rounded-2xl bg-coral text-white font-bold text-base shadow-lg shadow-coral/25 hover:bg-coral-dark active:scale-[0.98] transition-all"
          >
            {copied ? 'Copied to clipboard!' : 'Share My Result'}
          </button>

          <button
            onClick={onRetake}
            className="w-full py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold text-base hover:border-coral hover:text-coral active:scale-[0.98] transition-all"
          >
            Take Quiz Again
          </button>
        </div>

        <p className="mt-8 text-[11px] text-gray-300 leading-relaxed">
          This quiz is part of a Duke University research project on AI alignment.
        </p>
      </div>
    </div>
  );
}
