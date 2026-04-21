# RLHF for Dating App Bio Generation

[![Duke AIPI 590](https://img.shields.io/badge/Duke-AIPI%20590-012169)](https://masters.pratt.duke.edu/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![TRL](https://img.shields.io/badge/TRL-0.8%2B-orange.svg)](https://github.com/huggingface/trl)
[![HuggingFace](https://img.shields.io/badge/%F0%9F%A4%97-distilgpt2-yellow)](https://huggingface.co/distilgpt2)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

**AIPI 590 · Challenge 2 — Taming the Language Model**

We apply a full RLHF pipeline to the task of generating Hinge dating app bios. Human preferences are collected via a custom web app, then used to align a language model through Supervised Fine-Tuning followed by Direct Preference Optimization (DPO).

---

## Pipeline

```
distilgpt2
    │
    ├── [01] SFT ──────────────── fine-tune on chosen bios
    │         │
    │         └── sft_model/
    │
    ├── [02] DPO ──────────────── align with (prompt, chosen, rejected) triples
    │         │
    │         └── dpo_model/
    │
    └── [03] Evaluation ───────── compare base / SFT / DPO outputs
```

Human preference data (243 triples) was collected via [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app) and exported as `preferences.json`.

---

## Notebooks

| # | Notebook | Open in Colab |
|---|----------|---------------|
| 01 | Supervised Fine-Tuning | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/01_sft.ipynb) |
| 02 | DPO Alignment | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/02_dpo.ipynb) |
| 03 | Evaluation & Results | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/03_evaluation.ipynb) |

Results (charts and metrics JSON) are published back to this repo automatically from each notebook via `src/colab_utils.publish_artifacts`.

---

## Data

243 human preference triples collected via [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app), included at `data/preferences.json`.

Format:
```json
{"prompt": "Write a dating bio for: ...", "chosen": "...", "rejected": "..."}
```

## Human Preference Data App (`data_app`)

This repository also includes a standalone data-collection app under `data_app/`, used to generate and annotate bio pairs before training.

### What it includes

- `generate_bios.py`: generate paired candidate bios from profile prompts and save to `bio_pairs.json`
- `swiperight/`: React + Vite + Tailwind web app ("MyRight") for A/B preference collection
- `preferences.json`: exported `(prompt, chosen, rejected)` records for DPO
- `report.md`: short implementation report for the annotation workflow

### MyRight web app

Live demo: [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app)

- Firebase Firestore-backed annotation collection
- 20 comparisons per user session
- Left/right randomization to reduce position bias
- Admin export page at `?admin=true`

### Run locally

```bash
cd data_app/swiperight
npm install
npm run dev
```

### Generate bio pairs

```bash
cd data_app
python generate_bios.py
```

---

## Structure

```
aipi590-challenge-2/
├── notebooks/
│   ├── 01_sft.ipynb
│   ├── 02_dpo.ipynb
│   └── 03_evaluation.ipynb
├── src/
│   ├── colab_utils.py      # publish_artifacts pattern
│   ├── dataset.py          # SFT and DPO dataset loaders
│   └── eval.py             # bio generation and quality metrics
├── data_app/
│   ├── generate_bios.py    # generates candidate bio pairs
│   ├── bio_pairs.json      # generated pairs used in annotation app
│   ├── preferences.json    # exported preferences from annotation app
│   ├── report.md           # app and data pipeline report
│   └── swiperight/         # React app for human preference collection
├── data/
│   └── preferences.json    # 243 human preference triples
├── results/                # metrics + charts (auto-published by notebooks)
└── requirements.txt
```

---

## Setup

Each notebook is self-contained and installs its own dependencies. To run locally:

```bash
pip install -r requirements.txt
```

### GitHub token (one-time, for publishing results)

Notebooks push charts and metrics back to this repo from their final cell. This requires a `GITHUB_TOKEN` Colab secret with write access.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Set repository access to **Only select repositories → aipi590-challenge-2**
3. Under Permissions → Repository permissions, set **Contents** to **Read and Write**
4. Generate and copy the token
5. In Colab, click the **key icon** in the left sidebar → **Secrets** → **Add new secret**, name it `GITHUB_TOKEN`, paste the token, and enable notebook access

![Colab Secrets panel showing GITHUB_TOKEN](docs/assets/colab-secrets.png)

---

## Team

Lindsay Gross · Yifei Guo · Jonas Neves

Duke University · AIPI 590 · Spring 2026
