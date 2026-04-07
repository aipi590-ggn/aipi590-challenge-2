import { useState } from 'react';
import { fetchAllAnnotations, firebaseReady } from '../firebase';
import bioPairs from '../data/bio_pairs.json';

// Build a lookup from pair id to pair data
const pairMap = Object.fromEntries(bioPairs.map(p => [p.id, p]));

function formatPrompt(profile) {
  return `Write a dating bio for: ${profile.gender}, ${profile.age}, ${profile.job}, ${profile.hobbies}`;
}

function buildPreferenceData(annotations) {
  // Group by pair_id
  const groups = {};
  for (const a of annotations) {
    if (!groups[a.pair_id]) groups[a.pair_id] = [];
    groups[a.pair_id].push(a);
  }

  const results = [];
  for (const [pairId, votes] of Object.entries(groups)) {
    const pair = pairMap[pairId];
    if (!pair) continue;

    // Count votes for bio_a, bio_b, tie
    let countA = 0, countB = 0;
    for (const v of votes) {
      if (v.choice === 'bio_a') countA++;
      else if (v.choice === 'bio_b') countB++;
      // ties don't count toward either
    }

    let chosen, rejected;
    if (countA > countB) {
      chosen = pair.bio_a;
      rejected = pair.bio_b;
    } else if (countB > countA) {
      chosen = pair.bio_b;
      rejected = pair.bio_a;
    } else {
      // Tie: pick randomly
      if (Math.random() < 0.5) {
        chosen = pair.bio_a;
        rejected = pair.bio_b;
      } else {
        chosen = pair.bio_b;
        rejected = pair.bio_a;
      }
    }

    results.push({
      prompt: formatPrompt(pair.profile),
      chosen,
      rejected,
    });
  }

  return results;
}

export default function AdminExport() {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(null);
  const [error, setError] = useState('');

  async function handleDownload() {
    setLoading(true);
    setError('');
    try {
      const annotations = await fetchAllAnnotations();
      if (annotations.length === 0) {
        setError('No annotations found. Firebase may not be configured.');
        setLoading(false);
        return;
      }
      setCount(annotations.length);
      const data = buildPreferenceData(annotations);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'preferences.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Export</h1>
        <p className="text-warm-gray text-sm mb-6">
          Download aggregated preference data from Firestore annotations.
        </p>

        {!firebaseReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
            Firebase is not configured. Edit <code>src/firebase.js</code> with your credentials to enable data export.
          </div>
        )}

        {count !== null && (
          <div className="bg-white rounded-xl border border-sand p-4 mb-4">
            <p className="text-sm text-gray-700">
              Total annotations: <span className="font-bold">{count}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-coral text-white font-bold text-base shadow-lg shadow-coral/25 hover:bg-coral-dark active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Fetching...' : 'Download preferences.json'}
        </button>
      </div>
    </div>
  );
}
