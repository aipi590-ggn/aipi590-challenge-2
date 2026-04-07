import { useState, useEffect, Component } from 'react';
import Welcome from './components/Welcome';
import Quiz from './components/Quiz';
import Result from './components/Result';
import AdminExport from './components/AdminExport';
import bioPairs from './data/bio_pairs.json';
import { fetchAnnotationCounts } from './firebase';

const TOTAL_QUESTIONS = 20;
const SESSION_KEY = 'myright_session';

// ── Error boundary: catch any render crash → reset to welcome ──
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, errorMsg: String(err?.message || err || 'Unknown error') };
  }
  componentDidCatch(err, info) {
    console.error('[MyRight] Render crash:', err, info?.componentStack);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</p>
            <p className="text-xs text-gray-400 mb-4 break-all">{this.state.errorMsg}</p>
            <button
              onClick={() => {
                try { sessionStorage.removeItem(SESSION_KEY); } catch {}
                window.location.reload();
              }}
              className="px-6 py-2 bg-coral text-white rounded-xl font-semibold"
            >
              Start Over
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function selectPairs(pool, count, annotationCounts) {
  if (!annotationCounts) return shuffle(pool).slice(0, count);
  const withCounts = pool.map(p => ({
    pair: p,
    count: annotationCounts[p.id] || 0,
  }));
  withCounts.sort((a, b) => a.count - b.count || Math.random() - 0.5);
  return withCounts.slice(0, count).map(x => x.pair);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const NAMES = [
  'Jordan', 'Alex', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Dakota', 'Reese', 'Skyler', 'Jamie', 'Drew', 'Sage', 'Rowan', 'Finley',
  'Parker', 'Hayden', 'Emery', 'Blair', 'Cameron', 'Peyton', 'Kendall', 'Harley',
];
const LAST_INITIALS = 'ABCDEFGHIJKLMNOPRSTW';

function buildRounds(pairs) {
  return pairs.map(pair => {
    const swapped = Math.random() < 0.5;
    return {
      pair,
      swapped,
      leftBio: swapped ? pair.bio_b : pair.bio_a,
      rightBio: swapped ? pair.bio_a : pair.bio_b,
      displayedLeft: swapped ? 'bio_b' : 'bio_a',
      displayedRight: swapped ? 'bio_a' : 'bio_b',
      fakeName: `${pickRandom(NAMES)} ${pickRandom(LAST_INITIALS)}.`,
    };
  });
}

function getFilteredPool(userInterest) {
  const interestToGender = { men: 'male', women: 'female' };
  const genderFilter = interestToGender[userInterest];
  return genderFilter
    ? bioPairs.filter(p => p.profile.gender.toLowerCase() === genderFilter)
    : bioPairs;
}

// ── Session persistence ──
function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Validate: if quiz screen, rounds must be a non-empty array with valid structure
    if (data.screen === 'quiz') {
      if (!Array.isArray(data.rounds) || data.rounds.length === 0) return null;
      if (!data.rounds[0]?.pair?.id || !data.rounds[0]?.pair?.profile) return null;
    }
    if (data.screen === 'result') {
      if (!data.quizProgress?.choices?.length) return null;
    }
    return data;
  } catch {
    // Corrupted data — clear it
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    return null;
  }
}

function saveSession(data) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

// ── Main App ──
function AppInner() {
  const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
  if (isAdmin) return <AdminExport />;

  const saved = loadSession();

  const [screen, setScreen] = useState(saved?.screen || 'welcome');
  const [userGender, setUserGender] = useState(saved?.userGender || '');
  const [userInterest, setUserInterest] = useState(saved?.userInterest || '');
  const [sessionId] = useState(() => saved?.sessionId || crypto.randomUUID());
  const [rounds, setRounds] = useState(saved?.rounds || null);
  const [quizProgress, setQuizProgress] = useState(saved?.quizProgress || { current: 0, choices: [] });

  // Safety: if we're supposed to show quiz but rounds is invalid, go back to welcome
  useEffect(() => {
    if (screen === 'quiz' && (!rounds || rounds.length === 0)) {
      console.warn('[MyRight] Quiz screen with no rounds — resetting to welcome');
      clearSession();
      setScreen('welcome');
      setRounds(null);
    }
  }, [screen, rounds]);

  // Persist session (only for quiz/result screens)
  useEffect(() => {
    if (screen === 'quiz' && rounds && rounds.length > 0) {
      saveSession({ screen, userGender, userInterest, sessionId, rounds, quizProgress });
    } else if (screen === 'result' && quizProgress.choices.length > 0) {
      saveSession({ screen, userGender, userInterest, sessionId, rounds, quizProgress });
    }
  }, [screen, rounds, quizProgress]);

  // Pre-fetch annotation counts while on Welcome page
  const [annotationCounts, setAnnotationCounts] = useState(null);
  useEffect(() => {
    if (screen === 'welcome') {
      fetchAnnotationCounts().then(counts => {
        if (counts) setAnnotationCounts(counts);
      });
    }
  }, [screen]);

  function handleStart() {
    const pool = getFilteredPool(userInterest);
    const count = Math.min(TOTAL_QUESTIONS, pool.length);
    if (count === 0) {
      alert('No profiles available for your selection. Try choosing "Everyone".');
      return;
    }
    const selected = selectPairs(pool, count, annotationCounts);
    const newRounds = buildRounds(selected);
    const newProgress = { current: 0, choices: [] };
    // Set all state synchronously before render
    setRounds(newRounds);
    setQuizProgress(newProgress);
    setScreen('quiz');
  }

  function handleQuizProgress(progress) {
    setQuizProgress(progress);
  }

  function handleQuizComplete(allChoices) {
    setQuizProgress({ current: -1, choices: allChoices });
    setScreen('result');
  }

  function handleRetake() {
    clearSession();
    const pool = getFilteredPool(userInterest);
    const count = Math.min(TOTAL_QUESTIONS, pool.length);
    const selected = selectPairs(pool, count, annotationCounts);
    setRounds(buildRounds(selected));
    setQuizProgress({ current: 0, choices: [] });
    setScreen('quiz');
  }

  return (
    <div className="min-h-screen font-sans">
      {screen === 'welcome' && (
        <Welcome
          userGender={userGender}
          setUserGender={setUserGender}
          userInterest={userInterest}
          setUserInterest={setUserInterest}
          onStart={handleStart}
        />
      )}
      {screen === 'quiz' && rounds && rounds.length > 0 && (
        <Quiz
          rounds={rounds}
          sessionId={sessionId}
          userGender={userGender}
          userInterest={userInterest}
          initialProgress={quizProgress}
          onProgress={handleQuizProgress}
          onComplete={handleQuizComplete}
        />
      )}
      {screen === 'result' && (
        <Result choices={quizProgress.choices} onRetake={handleRetake} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
