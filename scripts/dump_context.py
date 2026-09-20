#!/usr/bin/env python3
"""
Context & Codebase Dumper for VHectorLab 3D.
Generates vhectorlab-context.txt containing full context, architecture specifications,
developer protocol lessons, configuration, and source code for AI assistant analysis.

Optimized to produce a compact context payload (~100k-180k tokens) suitable for LLM context windows.
"""

import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

# Included file extensions for general source code scanning
SOURCE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".css", ".html", ".glsl",
    ".json", ".toml", ".yml", ".yaml", ".md", ".sh", ".mjs"
}

# Binary file extensions to strictly exclude
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz",
    ".npz", ".pt", ".mp4", ".webm", ".mov", ".ttf", ".woff", ".woff2", ".eot"
}

# Directories to strictly exclude from code scan
EXCLUDE_DIRS = {
    ".git", "node_modules", ".venv", "venv", "dist", ".pnpm-store",
    ".pytest_cache", "__pycache__", ".vite", "htmlcov", ".DS_Store", "demo", "archivo"
}

# Files to explicitly exclude from code scan
EXCLUDE_FILES = {
    "vhectorlab-context.txt", "vhectorlab_dev.log", "vectorlab_dev.log",
    "public/vocab.txt", "vocab.txt", "vocab_embeddings.npz", "pnpm-lock.yaml", "package-lock.json",
    "CONTEXT_HAB.MD", "scripts/capture-galaxy-demo.mjs", "capture-galaxy-demo.mjs",
    "diagnose_group_separation.py"
}


# Explicitly ordered root context & specification files (placed at top of dump)
PRIORITY_DOCS = [
    "manifest.json",
    "README.md",
    "CONTEXT.md",
    "architecture_spec.md",
    "CHANGELOG.md",
    ".agents/skills/dev-protocol/SKILL.md",
    ".agents/skills/dev-protocol/lessons-learned.md",
    ".agents/skills/dev-protocol/documentation.md",
    ".agents/skills/dev-protocol/git-workflow.md",
    ".agents/skills/dev-protocol/code-design.md",
    ".agents/skills/dev-protocol/debugging.md",
    ".agents/skills/dev-protocol/qa-review.md",
    "roadmap/README.md",
    "roadmap/gui-art.md",
    "roadmap/sae-denoise.md",
]

def is_binary_file(filepath: Path) -> bool:
    """Check if file is binary by checking extensions or initial bytes."""
    if filepath.suffix.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with open(filepath, "rb") as f:
            chunk = f.read(1024)
            if b"\x00" in chunk:
                return True
    except Exception:
        return True
    return False

def collect_project_files(root_dir: Path, include_tests: bool = False):
    """Collect relevant project files grouped by relative path."""
    collected = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Filter directories in-place
        dirnames[:] = [
            d for d in dirnames 
            if d not in EXCLUDE_DIRS and not d.startswith(".venv") and (include_tests or d != "tests")
        ]
        
        rel_dir = Path(dirpath).relative_to(root_dir)
        
        # Skip tests directory unless explicitly included
        if not include_tests:
            if "tests" in rel_dir.parts or "backend/tests" in str(rel_dir):
                continue

        for filename in sorted(filenames):
            rel_file = rel_dir / filename if str(rel_dir) != "." else Path(filename)
            rel_path_str = str(rel_file)
            
            # Check exclusions
            if filename in EXCLUDE_FILES or rel_path_str in EXCLUDE_FILES:
                continue
            if filename.startswith(".") and filename != ".gitignore" and filename != ".env.example":
                continue
            if filename.startswith("PROMPT-"):
                continue
            if filename.endswith(".log") or filename.endswith(".npz") or filename.endswith(".pt"):
                continue
            if not include_tests and (filename.endswith(".test.js") or filename.startswith("test_")):
                continue
                
            filepath = root_dir / rel_file
            
            if filepath.suffix.lower() not in SOURCE_EXTENSIONS and filename not in {"Dockerfile", "LICENSE", "NOTICE", "setup.sh"}:
                continue
                
            if is_binary_file(filepath):
                continue
                
            collected.append(rel_file)
            
    # Sort files logically: priority docs first, then alphabetical by relative path
    def file_sort_key(p: Path):
        p_str = str(p)
        if p_str in PRIORITY_DOCS:
            return (0, PRIORITY_DOCS.index(p_str))
        return (1, p_str)
        
    collected.sort(key=file_sort_key)
    return collected

def generate_context_dump(root_dir: Path, output_path: Path, include_tests: bool = False, max_changelog_lines: int = 150):
    """Generate the complete context and codebase dump txt file."""
    if output_path.exists():
        print(f"Removing existing dump file: {output_path}")
        output_path.unlink()

    project_files = collect_project_files(root_dir, include_tests=include_tests)
    timestamp = datetime.now().isoformat()
    
    print(f"Gathering {len(project_files)} project files into {output_path.name} (include_tests={include_tests})...")
    
    total_lines = 0
    file_count = 0

    with open(output_path, "w", encoding="utf-8") as out:
        # Header block
        out.write("================================================================================\n")
        out.write("VHECTORLAB 3D - COMPLETE CODEBASE & CONTEXT DUMP FOR AI AGENT ANALYSIS\n")
        out.write(f"Generated: {timestamp}\n")
        out.write(f"Repository Root: {root_dir.resolve()}\n")
        out.write(f"Total Source Files Included: {len(project_files)}\n")
        out.write(f"Include Tests: {include_tests}\n")
        out.write("================================================================================\n\n")

        # Project Summary / Description
        out.write("--- 1. PROJECT OVERVIEW & ARCHITECTURE SUMMARY ---\n")
        out.write("VHectorLab 3D is a WebGL vector space visualizer & LLM embedding analytics workspace.\n")
        out.write("- Backend: FastAPI (Python 3.11+, `uv`), SentenceTransformers, PyTorch, SAE (Sparse Autoencoders).\n")
        out.write("- Frontend: Vanilla JS + Three.js WebGL (Vite, npm).\n")
        out.write("- Modes: ARITHMETIC (vector algebra) & COMPARE (cosine similarity & multi-token comparison).\n")
        out.write("- Views: ANALYSIS (vertical stack), NAVIGATION (3D corridor), GALAXY (2D/3D UMAP manifold).\n")
        out.write("- Render Modes: POINTS & RIBBONS (wide quad strips).\n")
        out.write("- Quality & Protocol: Managed via `.agents/skills/dev-protocol/` (TDD, deep modules, lessons-learned).\n\n")

        # Directory Tree Section
        out.write("--- 2. REPOSITORY FILE TREE ---\n")
        for pf in project_files:
            out.write(f"- {pf}\n")
        out.write("\n")

        # Detailed Files Content Section
        out.write("--- 3. DETAILED SOURCE CODE & CONTEXT FILES ---\n\n")

        for pf in project_files:
            full_path = root_dir / pf
            try:
                content = full_path.read_text(encoding="utf-8", errors="replace")
                lines = content.splitlines()

                # Compact long CHANGELOG.md if needed
                if pf.name == "CHANGELOG.md" and len(lines) > max_changelog_lines:
                    lines = lines[:max_changelog_lines] + [f"\n[... Truncated older changelog history ({len(lines) - max_changelog_lines} lines omitted) ...]"]
                    content = "\n".join(lines)

                num_lines = len(lines)
                total_lines += num_lines
                file_count += 1

                out.write("================================================================================\n")
                out.write(f"FILE: {pf} ({num_lines} lines)\n")
                out.write("================================================================================\n")
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")
                out.write("\n")
            except Exception as e:
                out.write(f"ERROR: Could not read file {pf}: {e}\n\n")

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    estimated_tokens = total_lines * 8  # approximate ~8-9 tokens per line of code/markdown
    print(f"✓ Context dump successfully created at {output_path}")
    print(f"  - Files: {file_count}")
    print(f"  - Total Lines: {total_lines}")
    print(f"  - File Size: {file_size_mb:.2f} MB (~{estimated_tokens // 1000}k tokens)")
    return output_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dump codebase context to txt for AI analysis")
    parser.add_argument("--output", type=str, default="vhectorlab-context.txt", help="Output file path")
    parser.add_argument("--include-tests", action="store_true", help="Include test files in the context dump")
    args = parser.parse_args()

    root_path = Path(__file__).resolve().parent.parent
    out_file = Path(args.output)
    if not out_file.is_absolute():
        out_file = root_path / out_file

    generate_context_dump(root_path, out_file, include_tests=args.include_tests)
