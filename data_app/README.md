# RLHF — Human Preference Data Collection for Dating Bio Generation

This project collects **human A/B preference annotations** on AI-generated dating bios, producing training data for RLHF (Reinforcement Learning from Human Feedback).

## Overview

1. **`generate_bios.py`** — Uses an LLM to generate pairs of dating bios from profile prompts (gender, age, job, hobbies). Outputs `bio_pairs.json`.
2. **`swiperight/`** — A mobile-first web app ("MyRight") disguised as a dating personality quiz. Users compare two bios per question and pick their favorite, unknowingly generating preference labels.
3. **`bio_pairs.json`** — ~300 bio pair entries used by the web app.
4. **Exported `preferences.json`** — The final training dataset with `(prompt, chosen, rejected)` triples for DPO/RLHF.

## Web App (MyRight)

**Live**: [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app)

- Built with React + Vite + Tailwind CSS
- Firebase Firestore for real-time annotation storage
- Users see 20 bio pairs per session, prioritizing least-annotated pairs
- Bios are randomly swapped left/right each round to prevent position bias
- Personality quiz result at the end (incentive to complete)
- Admin export at `?admin=true`

### Local Development

```bash
cd swiperight
npm install
npm run dev
```

### Deploy

```bash
cd swiperight
vercel --prod
```

## Data Pipeline

### 1. Generate bio pairs

```bash
python generate_bios.py
```

Outputs `bio_pairs.json` with entries like:
```json
{
  "id": "pair_001",
  "prompt": "Gender: Female | Age: 25 | Job: frontend developer | Hobbies: bouldering, sourdough baking",
  "bio_a": "...",
  "bio_b": "...",
  "pair_type": "subtle",
  "profile": { "gender": "Female", "age": 25, "job": "frontend developer", "hobbies": "..." }
}
```

### 2. Collect annotations

Share the quiz link. Each user choice writes to Firestore:
```json
{
  "pair_id": "pair_001",
  "session_id": "uuid",
  "user_gender": "female",
  "user_interested_in": "men",
  "displayed_left": "bio_a",
  "choice": "bio_a",
  "timestamp": "2026-03-23T..."
}
```

### 3. Export preferences for training

Visit `?admin=true` or use the exported `preferences.json`. The output groups annotations by `pair_id`, applies majority vote, and formats for DPO:

```json
[
  {
    "prompt": "Write a dating bio for: Female, 25, frontend developer, bouldering and sourdough baking",
    "chosen": "the winning bio text",
    "rejected": "the losing bio text"
  }
]
```

## Tech Stack

| Component | Tech |
|-----------|------|
| Frontend | React 19, Vite 6, Tailwind CSS 3 |
| Database | Firebase Firestore |
| Hosting | Vercel |
| Bio Generation | Python + LLM API |

## Project Structure

```
RLHF/
├── README.md
├── generate_bios.py          # Bio pair generation script
├── bio_pairs.json             # Generated bio pairs (~300)
├── preferences.json           # Exported training data
└── swiperight/                # Web app
    ├── src/
    │   ├── App.jsx
    │   ├── firebase.js
    │   ├── components/
    │   │   ├── Welcome.jsx
    │   │   ├── Quiz.jsx
    │   │   ├── Result.jsx
    │   │   └── AdminExport.jsx
    │   └── data/
    │       └── bio_pairs.json
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## Team

Duke University — Spring 2026 Reinforcement Learning Course, Challenge 2
