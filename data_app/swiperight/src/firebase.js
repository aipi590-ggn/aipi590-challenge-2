import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAJPkgEGY-_XC2Sx1i7aqxS-8t4pcE_xk",
  authDomain: "myright-84d33.firebaseapp.com",
  projectId: "myright-84d33",
  storageBucket: "myright-84d33.firebasestorage.app",
  messagingSenderId: "284087274999",
  appId: "1:284087274999:web:f4dd110f70160f712232f2",
  measurementId: "G-S36J5XMEEW"
};

let db = null;
let firebaseReady = false;

try {
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_")) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    firebaseReady = true;
  } else {
    console.warn('[MyRight] Firebase not configured — offline mode.');
  }
} catch (err) {
  console.warn('[MyRight] Firebase init failed:', err.message);
}

function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// ALL Firebase calls are wrapped in try-catch at EVERY level.
// Nothing here can ever throw synchronously or propagate errors to callers.

export function writeAnnotation(data) {
  try {
    if (!firebaseReady) return;
    withTimeout(addDoc(collection(db, 'annotations'), data), 5000).catch(() => {});
  } catch (err) {
    console.warn('[MyRight] writeAnnotation error:', err);
  }
}

export function writePersonalityResult(personality) {
  try {
    if (!firebaseReady) return;
    withTimeout(
      addDoc(collection(db, 'personality_results'), { personality, timestamp: new Date().toISOString() }),
      5000
    ).catch(() => {});
  } catch (err) {
    console.warn('[MyRight] writePersonalityResult error:', err);
  }
}

export async function fetchAnnotationCounts() {
  try {
    if (!firebaseReady) return null;
    const snapshot = await withTimeout(getDocs(collection(db, 'annotations')), 3000);
    const counts = {};
    snapshot.docs.forEach(doc => {
      const pid = doc.data().pair_id;
      counts[pid] = (counts[pid] || 0) + 1;
    });
    return counts;
  } catch {
    return null;
  }
}

export async function fetchPersonalityStats() {
  try {
    if (!firebaseReady) return null;
    const snapshot = await withTimeout(getDocs(collection(db, 'personality_results')), 5000);
    const counts = { witty: 0, romantic: 0, adventurous: 0, intellectual: 0, free_spirit: 0 };
    let total = 0;
    snapshot.docs.forEach(doc => {
      const p = doc.data().personality;
      if (p in counts) { counts[p]++; total++; }
    });
    if (total === 0) return null;
    const percents = {};
    for (const [k, v] of Object.entries(counts)) {
      percents[k] = Math.round((v / total) * 100);
    }
    return percents;
  } catch {
    return null;
  }
}

export async function fetchAllAnnotations() {
  try {
    if (!firebaseReady) return [];
    const snapshot = await withTimeout(getDocs(collection(db, 'annotations')), 10000);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch {
    return [];
  }
}

export { firebaseReady };
