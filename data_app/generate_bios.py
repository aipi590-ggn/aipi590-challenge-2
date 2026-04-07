"""
SwipeRight — Data Generation Script
Generates 300 random dating profiles + 2 bio variants each via OpenRouter.
Output: bio_pairs.json ready to load into the app.

Usage:
  export OPENROUTER_API_KEY="your-key-here"
  python generate_bios.py
"""

import json
import os
import random
import time
from openai import OpenAI

# ── Config ──────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "YOUR_KEY_HERE")
# PROFILE_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"  # for profile generation
# BIO_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"       # for bio generation
PROFILE_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025"  # for profile generation
BIO_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025"       # for bio generation

NUM_PROFILES = 300
OUTPUT_FILE = "bio_pairs.json"
BATCH_SIZE = 10  # generate profiles in batches to reduce API calls

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

# ── Step 1: Generate 300 profiles ───────────────────────────────────

PROFILE_SYSTEM = """You generate realistic dating app profiles. Return ONLY a valid JSON array, no markdown, no backticks, no explanation.

Each profile has exactly 4 fields:
- "gender": "Male" or "Female" or "Non-binary"  
- "age": integer between 21 and 40
- "job": a specific job title (not just "engineer" — say "frontend developer" or "pediatric nurse")
- "hobbies": 2-3 specific hobbies (not generic — say "bouldering, sourdough baking" not "sports, cooking")

Make them diverse in gender, age, profession, and interests. Be creative and realistic."""


def generate_profiles_batch(n: int) -> list[dict]:
    """Generate n profiles in one API call."""
    resp = client.chat.completions.create(
        model=PROFILE_MODEL,
        messages=[
            {"role": "system", "content": PROFILE_SYSTEM},
            {"role": "user", "content": f"Generate exactly {n} dating profiles as a JSON array."},
        ],
        temperature=1.0,
        max_tokens=3000,
    )
    text = resp.choices[0].message.content.strip()
    # Clean potential markdown fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
    return json.loads(text)


def generate_all_profiles() -> list[dict]:
    """Generate NUM_PROFILES profiles in batches."""
    profiles = []
    remaining = NUM_PROFILES
    attempt = 0

    while remaining > 0 and attempt < 60:
        batch = min(BATCH_SIZE, remaining)
        print(f"  Generating profiles batch: requesting {batch}, total so far: {len(profiles)}")
        try:
            batch_profiles = generate_profiles_batch(batch)
            # Validate each profile
            for p in batch_profiles:
                if all(k in p for k in ("gender", "age", "job", "hobbies")):
                    profiles.append(p)
                    remaining -= 1
                    if remaining <= 0:
                        break
            time.sleep(1)  # rate limit courtesy
        except Exception as e:
            print(f"  Batch failed: {e}, retrying...")
            time.sleep(3)
        attempt += 1

    return profiles[:NUM_PROFILES]


# ── Step 2: Generate 2 bios per profile ─────────────────────────────

BIO_SYSTEM_SUBTLE = """You write dating app bios. Return ONLY valid JSON with two fields: "bio_a" and "bio_b". No markdown, no backticks.

Rules:
- Each bio is 2-4 sentences, MAX 150 words
- Both bios are for the SAME person described in the prompt
- Make them DIFFERENT STYLES, not just different quality levels:
  * One might be witty/humorous, the other sincere/heartfelt
  * One might be confident/bold, the other warm/approachable  
  * One might use self-deprecating humor, the other be straightforward
- BOTH should be decent — no obviously terrible bios
- The quality difference should be SUBTLE — reasonable people could disagree on which is better
- Do NOT just restate the profile facts — show personality
- Do NOT use clichés like "partner in crime", "love to laugh", "work hard play hard"
"""

BIO_SYSTEM_EASY = """You write dating app bios. Return ONLY valid JSON with two fields: "bio_a" and "bio_b". No markdown, no backticks.

Rules:
- Each bio is 2-4 sentences, MAX 150 words
- Both bios are for the SAME person described in the prompt
- "bio_a" should be GOOD: witty, specific, shows personality, makes the reader curious
- "bio_b" should be clearly BAD in one of these ways (pick one randomly):
  * Extremely generic and boring ("I like fun and food. Looking for my person.")
  * Cringy and try-hard ("I'm basically a CEO of vibes. Alpha mindset only.")
  * Lazy copy-paste feel ("Hi I'm [age] and I work in [job]. Message me if interested.")
  * Red-flag energy ("My ex was crazy. Looking for someone normal for once.")
  * Just a list of demands ("Must be 5'10+, fit, no kids, college educated, dog lover")
- The good bio should feel like someone you'd swipe right on
- The bad bio should make you cringe or feel nothing
- Randomly assign which style of bad bio to use — vary it across calls
"""

# 20% of pairs will have an obvious quality gap, 80% subtle
EASY_RATIO = 0.20


def generate_bio_pair(profile: dict, pair_type: str) -> dict | None:
    """Generate two bio variants for a profile.
    pair_type: 'subtle' (both decent) or 'easy' (one good, one bad)
    """
    prompt_str = f"Gender: {profile['gender']} | Age: {profile['age']} | Job: {profile['job']} | Hobbies: {profile['hobbies']}"
    system = BIO_SYSTEM_EASY if pair_type == "easy" else BIO_SYSTEM_SUBTLE

    try:
        resp = client.chat.completions.create(
            model=BIO_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Write two dating bio variants for this person:\n{prompt_str}"},
            ],
            temperature=0.9,
            max_tokens=500,
        )
        text = resp.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[: text.rfind("```")]
        bios = json.loads(text)

        if "bio_a" in bios and "bio_b" in bios:
            a, b = bios["bio_a"].strip(), bios["bio_b"].strip()
            # For easy pairs, randomly swap so the bad bio isn't always in the same position
            if pair_type == "easy" and random.random() < 0.5:
                a, b = b, a
            return {
                "id": None,
                "prompt": prompt_str,
                "bio_a": a,
                "bio_b": b,
                "pair_type": pair_type,  # track this for analysis later
                "profile": profile,
            }
    except Exception as e:
        print(f"  Bio generation failed: {e}")
    return None


def generate_all_bios(profiles: list[dict]) -> list[dict]:
    """Generate bio pairs for all profiles. ~20% easy, ~80% subtle."""
    pairs = []
    # Pre-assign types: shuffle so easy pairs are randomly distributed
    types = (["easy"] * int(len(profiles) * EASY_RATIO) +
             ["subtle"] * (len(profiles) - int(len(profiles) * EASY_RATIO)))
    random.shuffle(types)

    for i, (profile, pair_type) in enumerate(zip(profiles, types)):
        print(f"  Generating bios: {i + 1}/{len(profiles)} ({pair_type})")
        result = generate_bio_pair(profile, pair_type)
        if result:
            result["id"] = f"pair_{i + 1:03d}"
            pairs.append(result)
        else:
            # Retry once
            time.sleep(2)
            result = generate_bio_pair(profile, pair_type)
            if result:
                result["id"] = f"pair_{i + 1:03d}"
                pairs.append(result)
            else:
                print(f"  Skipping profile {i + 1} after retry failure")

        # Rate limiting: pause every 5 calls
        if (i + 1) % 5 == 0:
            time.sleep(1)

    return pairs


# ── Main ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("SwipeRight Data Generator")
    print("=" * 60)

    # Step 1
    print(f"\n[Step 1] Generating {NUM_PROFILES} profiles...")
    profiles = generate_all_profiles()
    print(f"  Done: {len(profiles)} profiles generated")

    # Step 2
    print(f"\n[Step 2] Generating bio pairs...")
    pairs = generate_all_bios(profiles)
    print(f"  Done: {len(pairs)} bio pairs generated")

    # Save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(pairs, f, indent=2, ensure_ascii=False)

    print(f"\n[Done] Saved {len(pairs)} pairs to {OUTPUT_FILE}")
    easy_count = sum(1 for p in pairs if p["pair_type"] == "easy")
    subtle_count = len(pairs) - easy_count
    print(f"  Breakdown: {easy_count} easy ({easy_count*100//len(pairs)}%) | {subtle_count} subtle ({subtle_count*100//len(pairs)}%)")
    print(f"  Sample pair:")
    if pairs:
        sample = pairs[0]
        print(f"  Type:   {sample['pair_type']}")
        print(f"  Prompt: {sample['prompt']}")
        print(f"  Bio A:  {sample['bio_a'][:80]}...")
        print(f"  Bio B:  {sample['bio_b'][:80]}...")