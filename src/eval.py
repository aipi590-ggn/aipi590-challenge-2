"""
Evaluation utilities.

Computes reward scores and qualitative metrics across model checkpoints.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


def score_bios(
    bios: list[str],
    reward_model_path: str,
    batch_size: int = 16,
    device: str = "cuda",
) -> list[float]:
    """Return reward model scores for a list of bio strings."""
    tokenizer = AutoTokenizer.from_pretrained(reward_model_path)
    model = AutoModelForSequenceClassification.from_pretrained(
        reward_model_path, torch_dtype=torch.float16
    ).to(device).eval()

    scores = []
    for i in range(0, len(bios), batch_size):
        batch = bios[i : i + batch_size]
        inputs = tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=256).to(device)
        with torch.no_grad():
            logits = model(**inputs).logits
        scores.extend(logits[:, 0].cpu().float().tolist())

    return scores


def compare_checkpoints(
    prompts: list[str],
    checkpoints: dict[str, str],
    reward_model_path: str,
    generate_fn,
) -> dict[str, dict]:
    """
    Score generated bios from multiple checkpoints using the reward model.

    Args:
        prompts: list of formatted SFT prompts
        checkpoints: {label: model_path}
        reward_model_path: path to trained reward model
        generate_fn: callable(model_path, prompts) -> list[str]

    Returns:
        {label: {"mean": float, "std": float, "scores": list[float]}}
    """
    results = {}
    for label, model_path in checkpoints.items():
        bios = generate_fn(model_path, prompts)
        scores = score_bios(bios, reward_model_path)
        results[label] = {
            "mean": float(np.mean(scores)),
            "std":  float(np.std(scores)),
            "scores": scores,
            "bios": bios,
        }
    return results


def save_metrics(metrics: dict[str, Any], path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
