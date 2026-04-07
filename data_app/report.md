# RLHF Preference Data Collection for Dating Bio Generation

## 1. Introduction

This report describes the design and implementation of a human preference data collection pipeline for Reinforcement Learning from Human Feedback (RLHF). The goal is to collect pairwise preference annotations—where humans choose between two AI-generated dating bios—to produce a training dataset in the `(prompt, chosen, rejected)` format required by Direct Preference Optimization (DPO).

The core challenge is incentivizing non-expert annotators to provide high-quality labels at scale. Our solution disguises the annotation task as a fun dating personality quiz, making the data collection process engaging and shareable.

**Live application**: [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app)

---

## 2. Data Generation Pipeline

### 2.1 Profile Generation

We defined 300 unique dating profiles spanning diverse demographics:

| Attribute | Distribution |
|-----------|-------------|
| Gender | 120 Female, 120 Male, 60 Non-binary |
| Age | 21–40 (distributed across the full range) |
| Job | 117 unique occupations (e.g., Aerospace Engineer, Tattoo Artist, Museum Curator, Sous Chef, Veterinarian) |
| Hobbies | 1–3 per profile |

### 2.2 Bio Pair Generation

For each profile, we used an LLM (`generate_bios.py`) to generate **two** dating bios (bio_a and bio_b) with controlled variation:

- **240 "subtle" pairs**: Both bios are competent but differ in tone, style, or emphasis. These are the most valuable for RLHF because the preference signal captures nuanced quality differences.
- **60 "easy" pairs**: One bio is clearly better than the other. These serve as attention checks and help calibrate annotator consistency.

Each entry in `bio_pairs.json` follows this schema:

```json
{
  "id": "pair_001",
  "prompt": "Gender: Female | Age: 25 | Job: frontend developer | Hobbies: bouldering, sourdough baking",
  "bio_a": "I debug CSS by day and overproof dough by night...",
  "bio_b": "When I'm not scaling walls at the climbing gym...",
  "pair_type": "subtle",
  "profile": {
    "gender": "Female",
    "age": 25,
    "job": "frontend developer",
    "hobbies": "bouldering, sourdough baking"
  }
}
```

---

## 3. Annotation Interface Design

### 3.1 Design Philosophy

Traditional annotation tools (spreadsheets, Mechanical Turk) suffer from low engagement and annotator fatigue. We took a different approach: **gamification**. The annotation task is wrapped in a dating personality quiz called "MyRight," where users believe they are discovering their dating personality type while actually providing pairwise preference labels.

This design yields several advantages:
- **High completion rate**: Users are motivated to finish 20 questions to see their personality result.
- **Shareability**: The personality result page encourages social sharing, driving organic user acquisition.
- **Natural context**: Users evaluate dating bios in the mindset of someone actually reading a dating profile, producing more ecologically valid preferences.

### 3.2 Application Flow

The app has three screens:

**Screen 1 — Welcome Page**:
- Users select their gender and dating interest ("I'm interested in: Men / Women / Everyone").
- These selections filter which profiles are shown (e.g., a user interested in "Men" only sees male profiles), ensuring preferences are collected from the relevant audience.
- The framing emphasizes personality discovery, not data collection.

**Screen 2 — Quiz (20 Rounds)**:
- Each round displays a profile card (gender icon, randomized name, age, job, hobby tags) and two bio cards (Bio A and Bio B).
- Users tap the bio they prefer, or select "It's a tie."
- After a brief highlight animation (300ms), the next question loads automatically.

**Screen 3 — Personality Result**:
- A personality type is computed from the user's 20 choices (see Section 5).
- The result includes a character match, description, and share button.
- A confetti animation fires on load for a rewarding feeling.

### 3.3 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 3 |
| Database | Firebase Firestore (real-time writes) |
| Hosting | Vercel (edge CDN, auto-SSL) |
| Session | Anonymous UUID via `crypto.randomUUID()` |

---

## 4. Anti-Bias Measures

### 4.1 Position Randomization

For each bio pair in each session, we randomly swap which bio appears as "Bio A" (left/top) vs. "Bio B" (right/bottom). This prevents **position bias**, where users systematically prefer whichever option appears first. The actual bio identity (bio_a or bio_b from the dataset) is recorded in the annotation, not the display position.

### 4.2 Smart Pair Selection

Rather than randomly sampling 20 pairs per session, we implemented a **least-annotated-first** selection strategy:

1. When the user is on the Welcome page, the app pre-fetches annotation counts per pair from Firestore (with a 3-second timeout).
2. Pairs are sorted by annotation count (ascending), so unannotated pairs are shown first.
3. If the fetch fails or times out, the app falls back to random selection.

This ensures maximum coverage across all 300 pairs before any pair receives redundant annotations.

### 4.3 Interest-Based Filtering

Users who select "interested in Men" only see male profiles, and vice versa. Users who select "Everyone" see all profiles. This ensures that preference labels come from the target audience for each profile's gender, producing more meaningful training signal.

---

## 5. Personality Classification Logic

The personality quiz result is computed entirely client-side using keyword matching on the user's chosen bios. This serves as the user-facing incentive and has no effect on the collected preference data.

### 5.1 Keyword Categories

Each bio the user selects is classified into one of four vibes based on keyword occurrence:

| Vibe | Keywords |
|------|----------|
| **Witty** | joke, jokes, lol, pun, puns, probably, honestly, sarcas, funny, humor, warning, spoiler, judge, blame, apparently, bonus, points, slightly, questionable, convince, weird, terrible, secretly, confess |
| **Romantic** | heart, connection, soul, love, beautiful, emotion, romantic, genuine, feel, honest |
| **Adventurous** | adventure, travel, dare, spontaneous, bold, wild, explore, wander, lost, trip, road, thrill, world, challenge, adrenaline, conquer, night, seeking |
| **Intellectual** | read, book, debate, think, curious, museum, podcast, learn, teach, theory, philosophy, nerd, conversation, complex, mind, discuss, analyze, nuance, perspective, ideas |
| **Free Spirit** | *(default — assigned when no keywords match)* |

### 5.2 Classification Process

For each of the 20 chosen bios:
1. Convert the bio text to lowercase.
2. Count how many keywords from each category appear in the text.
3. The category with the highest keyword count wins that round. If all counts are zero, it is classified as "free_spirit."

After all 20 rounds, the category that was selected most frequently becomes the user's dominant personality.

### 5.3 Keyword Balancing

Our initial keyword set was heavily skewed toward "romantic" — words like `genuine` (appeared in 111 out of 600 bios), `deep` (77 bios), and `real` (37 bios) caused 87% of all quiz results to be "The Hopeless Romantic" based on 15 early quiz completions. We performed a frequency analysis across all 600 bios in the dataset and rebalanced:

**Before rebalancing** (keyword hit counts across all bios):
- Romantic: 382 hits → 87% of results
- Adventurous: 126 hits
- Intellectual: 118 hits
- Witty: 59 hits

**Changes made**:
- Removed overly generic words from romantic (`deep`, `real`) that appeared in bios of all styles.
- Added high-frequency bio-specific words to witty (`bonus`, `points`, `slightly`, `questionable`, `confess`, etc.).
- Added domain-relevant words to intellectual (`conversation`, `complex`, `mind`, `perspective`, `ideas`, etc.).
- Added action words to adventurous (`world`, `challenge`, `seeking`, `night`, `conquer`, etc.).

**After rebalancing** (bio classification distribution):
- Intellectual: 24%
- Romantic: 24%
- Witty: 23%
- Adventurous: 20%
- Free Spirit: 9%

### 5.4 Personality Mapping

| Dominant Vibe | Personality Title | Character Match |
|---------------|------------------|-----------------|
| Witty | The Quick Wit | Chandler Bing (Friends) |
| Romantic | The Hopeless Romantic | Elizabeth Bennet (Pride & Prejudice) |
| Adventurous | The Thrill Seeker | Jack Sparrow (Pirates of the Caribbean) |
| Intellectual | The Deep Thinker | Sherlock Holmes |
| Free Spirit | The Free Spirit | Luna Lovegood (Harry Potter) |

### 5.5 Percentage Display

The result page shows "X% of quiz takers share your vibe." This percentage is computed in real-time from Firestore's `personality_results` collection, which stores each user's final personality type. If Firestore is unavailable, hardcoded fallback percentages are displayed.

---

## 6. Data Storage and Annotation Schema

Every user choice is written to Firestore in real-time as a **fire-and-forget** operation (non-blocking, with 5-second timeout):

```json
{
  "pair_id": "pair_042",
  "session_id": "a1b2c3d4-...",
  "user_gender": "female",
  "user_interested_in": "men",
  "displayed_left": "bio_b",
  "choice": "bio_a",
  "timestamp": "2026-03-23T15:30:00.000Z"
}
```

Key fields:
- `displayed_left`: Records which bio was shown on the left/top position (for position bias analysis).
- `choice`: The actual bio chosen (`bio_a`, `bio_b`, or `tie`), independent of display position.
- `session_id`: Groups all 20 annotations from the same user session.

---

## 7. Export Pipeline

### 7.1 Aggregation Logic

The admin export page (`?admin=true`) or the command-line export script performs:

1. **Fetch** all annotations from Firestore.
2. **Group** annotations by `pair_id`.
3. **Majority vote**: For each pair, count votes for `bio_a` vs `bio_b` (ties are excluded from the count). The bio with more votes becomes `chosen`; the other becomes `rejected`. If the vote is tied, `bio_a` is selected as chosen by default.
4. **Format** the prompt from the raw profile format into natural language: `"Write a dating bio for: Female, 25, frontend developer, bouldering and sourdough baking"`.

### 7.2 Output Format

The exported `preferences.json` is directly compatible with DPO training:

```json
[
  {
    "prompt": "Write a dating bio for: Female, 25, frontend developer, bouldering and sourdough baking",
    "chosen": "the bio text that received more votes",
    "rejected": "the bio text that received fewer votes"
  }
]
```

### 7.3 Current Statistics

As of the time of writing:
- **235 total annotations** collected across multiple sessions
- **214 unique preference pairs** exported (214 of 300 pairs have at least one annotation)
- **86 pairs** still awaiting annotation

---

## 8. Reliability Engineering

During development and testing, we encountered and resolved several reliability issues:

### 8.1 Firebase Blocking UI

**Problem**: Firebase Firestore's first write requires establishing a WebSocket connection, which could hang for several seconds on slow mobile networks, freezing the entire quiz.

**Solution**: All Firebase write operations are fire-and-forget (non-blocking) with synchronous try-catch wrappers and 5-second timeouts. The quiz never waits for Firebase.

### 8.2 Render Crashes on Mobile

**Problem**: Mobile browsers are aggressive about memory management. A crash during rendering produced a blank white screen with no recovery path.

**Solution**: We added a React Error Boundary that catches any render crash, displays the actual error message (for debugging), clears corrupted session data, and offers a "Start Over" button.

### 8.3 Session Persistence

**Problem**: If a user refreshed the page mid-quiz, they lost all progress and had to restart from question 1.

**Solution**: Quiz state (current question, choices, rounds) is persisted to `sessionStorage` after each answer. On page load, the session is validated and restored if intact.

### 8.4 Data Type Mismatch

**Problem**: Some entries in `bio_pairs.json` stored `hobbies` as a comma-separated string (`"hiking, reading"`) while others used an array (`["hiking", "reading"]`). Calling `.split()` on an array crashed the app.

**Solution**: The code now handles both formats: arrays are used directly, strings are split on commas, and missing/invalid values default to an empty array.

---

## 9. Future Work

- **Increase annotation coverage**: 86 of 300 pairs still need annotations. Continued sharing of the quiz link will fill these gaps.
- **Multi-annotation consensus**: Currently each pair uses majority vote from all annotations. Adding a minimum vote threshold (e.g., 3+ votes per pair) would improve label quality.
- **Inter-annotator agreement**: The `session_id` field enables analysis of how consistently different users agree on the same pairs.
- **Position bias analysis**: The `displayed_left` field enables post-hoc analysis of whether display position influenced choices.

---

## 10. Conclusion

We built an end-to-end pipeline for collecting RLHF preference data through a gamified web application. By disguising the annotation task as a dating personality quiz, we achieved high engagement and natural preference signals. The system collected 235 annotations across 214 unique bio pairs, producing a DPO-compatible training dataset. The pipeline is fully automated: new annotations flow into Firestore in real-time, and the export can be re-run at any time to produce an updated training file.
