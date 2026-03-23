"""
Dataset utilities for the Hinge bio RLHF pipeline.

Loads preferences.json (exported from the MyRight annotation app) and
formats it for each training stage.

Expected preferences.json format (JSON array or one object per line):
  {"prompt": "Write a dating bio for: ...", "chosen": "...", "rejected": "..."}
"""

from __future__ import annotations

import json
from pathlib import Path

from datasets import Dataset, DatasetDict


def _load_records(path: str | Path) -> list[dict]:
    text = Path(path).read_text().strip()
    if text.startswith("["):
        return json.loads(text)
    return [json.loads(line) for line in text.splitlines() if line.strip()]


# ── SFT ──────────────────────────────────────────────────────────────────────

def load_sft_dataset(path: str | Path, val_ratio: float = 0.1) -> DatasetDict:
    """
    Build an SFT dataset from the chosen bios.

    Each example is formatted as a prompt+completion so the model learns
    to generate dating bios before the DPO alignment step.
    """
    records = _load_records(path)
    examples = [
        {"text": f"{r['prompt']}\n\n{r['chosen']}<|endoftext|>"}
        for r in records
    ]

    split = max(1, int(len(examples) * val_ratio))
    return DatasetDict({
        "train": Dataset.from_list(examples[split:]),
        "val":   Dataset.from_list(examples[:split]),
    })


# ── DPO ──────────────────────────────────────────────────────────────────────

def load_dpo_dataset(path: str | Path, val_ratio: float = 0.1) -> DatasetDict:
    """
    Build a DPO dataset of (prompt, chosen, rejected) triples.

    DPOTrainer expects exactly these three keys.
    """
    records = _load_records(path)
    examples = [
        {
            "prompt":   r["prompt"],
            "chosen":   r["chosen"],
            "rejected": r["rejected"],
        }
        for r in records
    ]

    split = max(1, int(len(examples) * val_ratio))
    return DatasetDict({
        "train": Dataset.from_list(examples[split:]),
        "val":   Dataset.from_list(examples[:split]),
    })
