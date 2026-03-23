"""
Evaluation utilities for the Hinge bio RLHF pipeline.

Generates bios from a model checkpoint and computes simple quality metrics
for before/after comparison across base, SFT, and DPO checkpoints.
"""

from __future__ import annotations

import json
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def generate_bios(
    model_path: str,
    prompts: list[str],
    max_new_tokens: int = 150,
    temperature: float = 0.9,
    top_p: float = 0.95,
    device: str = "cuda",
) -> list[str]:
    """Generate one bio per prompt from a given checkpoint."""
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_path, torch_dtype=torch.float16
    ).to(device).eval()

    bios = []
    for prompt in prompts:
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                top_p=top_p,
                pad_token_id=tokenizer.eos_token_id,
            )
        new_tokens = out[0][inputs["input_ids"].shape[1]:]
        bios.append(tokenizer.decode(new_tokens, skip_special_tokens=True).strip())

    return bios


def avg_length(bios: list[str]) -> float:
    return sum(len(b.split()) for b in bios) / max(len(bios), 1)


def generic_phrase_rate(bios: list[str]) -> float:
    """
    Fraction of bios containing at least one known generic phrase.
    Lower is better — DPO should push the model away from these.
    """
    GENERIC = [
        "looking for someone", "love to laugh", "i love to travel",
        "i enjoy long walks", "i love adventures", "good vibes only",
        "i'm an open book", "love trying new things", "i enjoy life",
    ]
    hits = sum(any(p in bio.lower() for p in GENERIC) for bio in bios)
    return hits / max(len(bios), 1)


def summarize(label: str, bios: list[str]) -> dict:
    return {
        "label":        label,
        "n":            len(bios),
        "avg_words":    round(avg_length(bios), 1),
        "generic_rate": round(generic_phrase_rate(bios), 3),
    }


def save_results(results: list[dict], path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(results, f, indent=2)
