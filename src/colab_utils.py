"""
Colab utilities — artifact publishing back to GitHub.

Mirrors the pattern from the spatialft project:
  prepare_notebook → run training → publish_artifacts

Usage in a notebook cell:
    from src.colab_utils import prepare_notebook, publish_artifacts
    repo_root, paths = prepare_notebook("aipi590-challenge-2")
    # ... training ...
    publish_artifacts([paths["results"] / "metrics.json"], "add sft metrics", repo_root)
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _run(cmd: str, cwd: Path | None = None) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{result.stderr}")
    return result.stdout.strip()


def prepare_notebook(
    repo_name: str = "aipi590-challenge-2",
    *,
    pull_latest: bool = True,
) -> tuple[Path, dict[str, Path]]:
    """
    Clone or update the repo and return (repo_root, named_paths).

    Requires a GITHUB_TOKEN secret in Colab:
        from google.colab import userdata
        os.environ["GITHUB_TOKEN"] = userdata.get("GITHUB_TOKEN")
    """
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise EnvironmentError(
            "GITHUB_TOKEN not set. Add it as a Colab secret and run:\n"
            "  from google.colab import userdata\n"
            "  import os; os.environ['GITHUB_TOKEN'] = userdata.get('GITHUB_TOKEN')"
        )

    repo_url = f"https://{token}@github.com/jonasneves/{repo_name}.git"
    repo_root = Path(f"/content/{repo_name}")

    if repo_root.exists():
        if pull_latest:
            _run("git stash", cwd=repo_root)
            _run("git pull --rebase origin main", cwd=repo_root)
            try:
                _run("git stash pop", cwd=repo_root)
            except RuntimeError:
                pass
    else:
        _run(f"git clone {repo_url} {repo_root}")

    _run(f'git config user.email "colab@aipi590"', cwd=repo_root)
    _run(f'git config user.name "Colab"', cwd=repo_root)

    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    paths = {
        "root":    repo_root,
        "data":    repo_root / "data",
        "results": repo_root / "results",
        "src":     repo_root / "src",
    }
    for p in paths.values():
        p.mkdir(parents=True, exist_ok=True)

    return repo_root, paths


def ensure_requirements(
    repo_root: Path,
    requirements_path: str = "requirements.txt",
) -> None:
    req = repo_root / requirements_path
    if req.exists():
        _run(f"pip install -q -r {req}")


def publish_artifacts(
    paths: list[Path],
    message: str,
    repo_dir: Path,
    *,
    dry_run: bool = False,
) -> bool:
    """
    Stage, commit, and push the given files back to origin/main.

    Uses stash + rebase to handle concurrent pushes from multiple notebooks.
    Returns True on success.
    """
    if not paths:
        return False

    for p in paths:
        _run(f"git add {p}", cwd=repo_dir)

    status = _run("git status --porcelain", cwd=repo_dir)
    if not status:
        print("Nothing to publish — no changes.")
        return False

    if dry_run:
        print(f"[dry_run] Would commit: {message}")
        return True

    _run(f'git commit -m "{message}"', cwd=repo_dir)
    _run("git stash", cwd=repo_dir)
    _run("git pull --rebase origin main", cwd=repo_dir)
    _run("git stash pop || true", cwd=repo_dir)
    _run("git push origin main", cwd=repo_dir)
    print(f"Published: {message}")
    return True
