"""
Bio dataset utilities.

Handles loading, formatting, and splitting bio preference data for
each stage of the RLHF pipeline.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Optional

from datasets import Dataset, DatasetDict


# ── Prompt template ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are writing a witty, specific, and genuine Hinge dating app bio. "
    "The bio should reflect the person's personality concretely — avoid generic "
    "phrases like 'looking for someone genuine' or 'love to travel'."
)

def format_sft_prompt(person_description: str) -> str:
    """Format a person description into an SFT training prompt."""
    return f"<|system|>{SYSTEM_PROMPT}\n<|user|>Write a Hinge bio for: {person_description}\n<|assistant|>"


def format_sft_example(person_description: str, bio: str) -> str:
    """Full prompt + completion for SFT."""
    return format_sft_prompt(person_description) + bio + "<|endoftext|>"


# ── SFT dataset ──────────────────────────────────────────────────────────────

def load_sft_dataset(path: str | Path, split_ratio: float = 0.9) -> DatasetDict:
    """
    Load a JSONL file of {person, bio} pairs and return train/val splits.

    Expected format:
        {"person": "Software engineer, 26, NYC...", "bio": "I write code..."}
    """
    path = Path(path)
    records = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    random.shuffle(records)

    split = int(len(records) * split_ratio)
    train_records = records[:split]
    val_records = records[split:]

    def to_dataset(recs):
        return Dataset.from_dict({
            "text": [format_sft_example(r["person"], r["bio"]) for r in recs],
            "person": [r["person"] for r in recs],
            "bio": [r["bio"] for r in recs],
        })

    return DatasetDict({"train": to_dataset(train_records), "val": to_dataset(val_records)})


# ── Preference dataset ────────────────────────────────────────────────────────

def load_preference_dataset(path: str | Path, split_ratio: float = 0.9) -> DatasetDict:
    """
    Load a JSONL file of human preference pairs and return train/val splits.

    Expected format (exported from the preference collector app):
        {"person": "...", "chosen": "A", "a": "...", "b": "..."}
    """
    path = Path(path)
    records = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    # Drop ties from reward model training
    records = [r for r in records if r.get("chosen") in ("A", "B")]

    formatted = []
    for r in records:
        prompt = format_sft_prompt(r["person"])
        if r["chosen"] == "A":
            chosen_text, rejected_text = r["a"], r["b"]
        else:
            chosen_text, rejected_text = r["b"], r["a"]
        formatted.append({
            "prompt": prompt,
            "chosen": chosen_text,
            "rejected": rejected_text,
        })

    random.shuffle(formatted)
    split = int(len(formatted) * split_ratio)

    def to_dataset(recs):
        return Dataset.from_dict({
            "prompt":   [r["prompt"]   for r in recs],
            "chosen":   [r["chosen"]   for r in recs],
            "rejected": [r["rejected"] for r in recs],
        })

    return DatasetDict({
        "train": to_dataset(formatted[:split]),
        "val":   to_dataset(formatted[split:]),
    })


# ── Eval dataset ─────────────────────────────────────────────────────────────

def load_eval_prompts(path: str | Path) -> list[str]:
    """Load a list of person descriptions for generation/eval."""
    path = Path(path)
    records = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    return [format_sft_prompt(r["person"]) for r in records]
