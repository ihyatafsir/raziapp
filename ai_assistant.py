#!/usr/bin/env python3
"""
ai_assistant.py

'Al-Muhaqqiq al-Razi' (The Dialectical Companion) for RaziApp.
Provides dual-mode AI inquiry:
1. Fast Local Mode: Instant definitions, paragraph summaries, and Arabic root unpacking (1.5B/2B local).
2. Deep Dialectical Mode: Formal syllogism decomposition, objection analysis, and philosophical critique (DeepSeek Flash 4.1).
Strictly zero emojis.
"""

import os
import sys
import json
import urllib.request
from pathlib import Path
from typing import Dict, Any, Optional

REPO_ROOT = Path(__file__).parent.parent / "aynengineaicoding"
if REPO_ROOT.exists():
    sys.path.append(str(REPO_ROOT))

RAZI_SYSTEM_PROMPT = """You are 'Al-Muhaqqiq al-Razi' (المُحَقِّق الرَّازِي), an AI dialectical scholar embodying the rigorous philosophical, theological, and exegetical methodology of Imam Fakhr al-Din al-Razi (544–606 AH / 1149–1209 CE).

Your principles:
1. Exhaustive Division (Al-Taqsim al-Hasir): Deconstruct any question into all logically possible premises.
2. Dialectical Fairness (Tahqiq al-Shubuhat): State counter-arguments and objections (In Qila) with utmost strength and clarity.
3. Apodictic Demonstration (Al-Burhan al-Qat'i): Dissect arguments using sound syllogisms (Qiyas), distinguishing between conclusive proof (Burhan), rhetorical persuasion (Khitaba), and dialectical debate (Jadal).
4. Classical Linguistic Precision: Anchor explanations in classical Arabic roots (Ishtiqaq) and grammatical precision.
5. Absolute Zero Emoji Policy: Never use emojis under any circumstances. Use clean typography, bold headings, and bullet points.

Tone: Profoundly lucid, measured, intellectually fearless, and deeply rooted in classical Islamic scholasticism."""

class RaziAiAssistant:
    def __init__(self):
        self.deepseek_engine = None
        self._init_deepseek()

    def _init_deepseek(self):
        try:
            from core.coding_engine import AynCodingEngine
            self.deepseek_engine = AynCodingEngine(provider="deepseek", model="deepseek-flash")
        except Exception as e:
            print(f"[RaziAI] Notice: AynCodingEngine deepseek init: {e}")

    def query(
        self,
        prompt: str,
        context_passage: Optional[str] = None,
        mode: str = "deep_dialectic"  # "fast_summary" or "deep_dialectic"
    ) -> Dict[str, Any]:
        """Queries the AI companion with context from the active EPUB section."""
        augmented_prompt = ""
        if context_passage:
            augmented_prompt += f"--- CONTEXT PASSAGE FROM WORK ---\n{context_passage[:3000]}\n--- END CONTEXT ---\n\n"
        augmented_prompt += f"INQUIRY:\n{prompt}"

        # 1. Deep Dialectical Mode (DeepSeek Flash 4.1)
        if mode == "deep_dialectic" and self.deepseek_engine:
            try:
                response_text = self.deepseek_engine.call_api(RAZI_SYSTEM_PROMPT, augmented_prompt)
                if response_text and len(response_text.strip()) > 5:
                    return {
                        "success": True,
                        "model": "DeepSeek Flash 4.1 (AynEngine Cloud)",
                        "mode": "deep_dialectic",
                        "response": response_text
                    }
            except Exception as e:
                print(f"[RaziAI] DeepSeek query error, falling back to local: {e}")

        # 2. Local Fast Mode (Ollama fallback)
        local_models = ["ayncoding-gemma2:latest", "ayncoding-model:latest", "qwen2.5-coder:1.5b", "gemma2:2b"]
        for m in local_models:
            try:
                payload = json.dumps({
                    "model": m,
                    "prompt": f"{RAZI_SYSTEM_PROMPT}\n\nUser: {augmented_prompt}\n\nAl-Muhaqqiq:",
                    "stream": False
                }).encode("utf-8")
                req = urllib.request.Request("http://127.0.0.1:11434/api/generate", data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return {
                        "success": True,
                        "model": f"{m} (Local CPU Engine)",
                        "mode": "fast_local",
                        "response": data.get("response", "")
                    }
            except Exception:
                continue

        # 3. Deterministic Fallback if offline
        return {
            "success": True,
            "model": "Razi Epistemic Rule Engine (Offline)",
            "mode": "offline_rule",
            "response": "### Dialectical Decomposition (التحقيق النظري)\n\n"
                        "Regarding your inquiry into this passage: Imam Razi approaches this through **Taqsim** (exhaustive logical division):\n\n"
                        "1. **The Thesis (Al-Mas'alah)**: The reality of the matter must either be self-evident (*Daruri*) or acquired through reflection (*Muktasab*).\n"
                        "2. **The Dialectical Division (In Qila)**: If an objector argues that the premise is contingent, we investigate whether it is bounded by time, place, or substance.\n"
                        "3. **The Conclusion (Qulna)**: The conclusive demonstration relies on the impossibility of an infinite regress (*Tasalsul*) and vicious circularity (*Dawr*)."
        }

if __name__ == "__main__":
    assistant = RaziAiAssistant()
    res = assistant.query("What is the core distinction between Daruri and Muktasab knowledge?", mode="deep_dialectic")
    print("AI Response:\n", res["response"][:200])
