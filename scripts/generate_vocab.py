#!/usr/bin/env python3
"""
Vocabulary Generator Script for VectorLab 3D.
Generates or updates public/vocab.txt with a specified number of common English words.
"""

import sys
import argparse
from pathlib import Path
import urllib.request

# Default top-frequency English word list URL (Google 10k most common words, clean)
DEFAULT_WORDLIST_URL = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt"

def generate_vocab(output_path: Path, count: int = 10000, source_url: str = DEFAULT_WORDLIST_URL):
    print(f"Generating vocabulary file at {output_path} (target words: {count})...")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    words = []
    try:
        req = urllib.request.Request(source_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8')
            for line in content.splitlines():
                word = line.strip().lower()
                if word and word.isalpha() and len(word) > 1 and word not in words:
                    words.append(word)
                    if len(words) >= count:
                        break
    except Exception as e:
        print(f"Warning: Could not fetch online word list ({e}). Using fallback basic vocabulary.")
        fallback_words = [
            "king", "queen", "man", "woman", "prince", "princess", "boy", "girl",
            "father", "mother", "son", "daughter", "brother", "sister", "uncle", "aunt",
            "apple", "banana", "fruit", "orange", "lemon", "cherry", "grape", "strawberry",
            "cat", "dog", "animal", "pet", "lion", "tiger", "bear", "wolf",
            "paris", "france", "city", "country", "capital", "rome", "italy", "berlin", "germany",
            "london", "england", "tokyo", "japan", "madrid", "spain", "beijing", "china",
            "happy", "sad", "good", "bad", "hot", "cold", "fast", "slow", "big", "small",
            "sun", "moon", "star", "sky", "earth", "ocean", "river", "mountain", "tree", "flower",
            "computer", "science", "technology", "code", "vector", "data", "model", "network"
        ]
        words = fallback_words[:count]

    with open(output_path, "w", encoding="utf-8") as f:
        for word in words:
            f.write(f"{word}\n")
            
    print(f"Vocabulary successfully saved to {output_path} ({len(words)} words).")
    return len(words)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate vocabulary file for VectorLab 3D")
    parser.add_argument("--output", type=str, default="public/vocab.txt", help="Output path for vocab.txt")
    parser.add_argument("--count", type=int, default=10000, help="Number of words to generate")
    args = parser.parse_args()
    
    generate_vocab(Path(args.output), args.count)
