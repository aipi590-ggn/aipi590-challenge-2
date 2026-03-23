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
    repo: str = "jonasneves/aipi590-challenge-2",
    branch: str = "main",
) -> bool:
    """
    Upload files to GitHub via the Contents API (no git push required).

    Each file is upserted (created or updated) individually. Returns True
    if all uploads succeed. Falls back gracefully if a file is unchanged.

    Requires GITHUB_TOKEN in environment with repo write access.
    """
    import base64
    import urllib.request
    import urllib.error
    import json as _json

    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        print("GITHUB_TOKEN not set — skipping publish.")
        return False

    if dry_run:
        print(f"[dry_run] Would publish: {[str(p) for p in paths]}")
        return True

    if not paths:
        return False

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    }

    # Resolve each path relative to the repo root on disk
    repo_root = repo_dir

    success = True
    for p in paths:
        p = Path(p)
        if not p.exists():
            print(f"  skip (not found): {p}")
            continue

        # Path inside the repo
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            rel = Path(p.name)

        api_url = f"https://api.github.com/repos/{repo}/contents/{rel}"
        content_b64 = base64.b64encode(p.read_bytes()).decode()

        # Fetch existing SHA (needed for updates)
        sha = None
        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req) as resp:
                sha = _json.loads(resp.read())["sha"]
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"  warning: GET {rel} returned {e.code}")

        payload = {"message": message, "content": content_b64, "branch": branch}
        if sha:
            payload["sha"] = sha

        data = _json.dumps(payload).encode()
        req = urllib.request.Request(api_url, data=data, headers=headers, method="PUT")
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.getcode()
            verb = "updated" if sha else "created"
            print(f"  {verb}: {rel} ({status})")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  error uploading {rel}: {e.code} {body}")
            success = False

    if success:
        print(f"Published: {message}")
    return success
