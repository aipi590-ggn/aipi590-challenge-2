# RLHF for Dating App Bio Generation

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

Human preference data (214 triples) was collected via [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app) and exported as `preferences.json`.

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

240 preference triples collected by Yifei Guo via [swiperight-alpha.vercel.app](https://swiperight-alpha.vercel.app), included at `data/preferences.json`.

Format:
```json
{"prompt": "Write a dating bio for: ...", "chosen": "...", "rejected": "..."}
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
├── data/
│   └── preferences.json    # 240 human preference triples
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
