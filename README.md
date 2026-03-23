# RLHF for Dating App Bio Generation

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![TRL](https://img.shields.io/badge/TRL-0.8%2B-orange.svg)](https://github.com/huggingface/trl)
[![HuggingFace](https://img.shields.io/badge/%F0%9F%A4%97-distilgpt2-yellow)](https://huggingface.co/distilgpt2)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

**AIPI 590 · Challenge 2 — Taming the Language Model**

We apply a full RLHF pipeline to the task of generating Hinge dating app bios. Human preferences are collected via a custom web app, used to train a reward model, and fed back into PPO alignment — turning a generic language model into one that writes bios people actually prefer.

---

## Pipeline

```
distilgpt2
    │
    ├── [01] SFT ──────────────── fine-tune on bio corpus
    │         │
    │         └── sft_model/
    │
    ├── [02] Preference Data ──── human A/B judgments via web app
    │         │
    │         └── data/preferences.jsonl
    │
    ├── [03] Reward Model ─────── RewardTrainer on preference pairs
    │         │
    │         └── reward_model/
    │
    └── [04] PPO ──────────────── align SFT model with reward signal
              │
              └── ppo_model/

[05] Analysis — compare base / SFT / PPO reward scores and qualitative outputs
```

---

## Notebooks

| # | Notebook | Open in Colab |
|---|----------|---------------|
| 01 | Supervised Fine-Tuning | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/01_sft.ipynb) |
| 02 | Preference Data Processing | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/02_preference_data.ipynb) |
| 03 | Reward Model | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/03_reward_model.ipynb) |
| 04 | PPO Alignment | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/04_ppo.ipynb) |
| 05 | Analysis & Results | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/jonasneves/aipi590-challenge-2/blob/main/notebooks/05_analysis.ipynb) |

Results are published back to this repo automatically from each notebook via `src/colab_utils.publish_artifacts`.

---

## Preference Collector

Human preference data is collected through a custom web app — three design directions, all fully interactive:

**[jonasneves.github.io/aipi590-challenge-2](https://jonasneves.github.io/aipi590-challenge-2/)**

| | Design | Best for |
|---|---|---|
| A | Swipe Cards | Mobile |
| B | Split Compare | Desktop |
| C | Minimal Judge | Keyboard-driven |

Export collected preferences as JSONL directly from the app, then upload to Colab for notebook 02.

---

## Structure

```
aipi590-challenge-2/
├── notebooks/
│   ├── 01_sft.ipynb
│   ├── 02_preference_data.ipynb
│   ├── 03_reward_model.ipynb
│   ├── 04_ppo.ipynb
│   └── 05_analysis.ipynb
├── src/
│   ├── colab_utils.py      # publish_artifacts pattern
│   ├── dataset.py          # bio + preference data loading
│   └── eval.py             # reward scoring utilities
├── data/                   # preference JSONL (not committed)
├── results/                # metrics + charts (auto-published by notebooks)
└── requirements.txt
```

---

## Setup

Each notebook is self-contained and installs its own dependencies. To run locally:

```bash
pip install -r requirements.txt
```

Notebooks that publish results back to GitHub require a `GITHUB_TOKEN` Colab secret with write access to this repo.

---

## Team

Lindsay Gross · Yifei Guo · Jonas Neves

Duke University · AIPI 590 · Spring 2026
