#!/usr/bin/env python3
"""
tts_engine.py

Classical Arabic Scholarly Vocalization Engine for RaziApp.
Provides high-fidelity, measured, classical Arabic pronunciation (قَارِئ الفَصَاحَة)
for classical Arabic texts, citations, and treatises.
Strictly zero emojis.
"""

import os
import re
import hashlib
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional

CACHE_DIR = Path(__file__).parent / "cache_audio"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Pure Classical Arabic Vocal Profiles
ARABIC_VOICE_PROFILES = {
    "classical_arabic": {
        "voice": "ar-SA-HamedNeural",
        "rate": "-4%",
        "pitch": "-2Hz",
        "name": "Classical Arabic Reciter (قَارِئ الفَصَاحَة)",
        "desc": "Measured classical vocalization with tajweed precision"
    },
    "classical_arabic_clear": {
        "voice": "ar-SA-ZariyahNeural",
        "rate": "-3%",
        "pitch": "-1Hz",
        "name": "Classical Diction (قِرَاءَة بَيَانِيَّة)",
        "desc": "High-clarity vocalization for classical linguistic treatises"
    }
}

class TtsEngine:
    @staticmethod
    def get_voice_profiles() -> Dict[str, Any]:
        return ARABIC_VOICE_PROFILES

    @classmethod
    async def synthesize(
        cls,
        text: str,
        profile_key: str = "classical_arabic",
        custom_rate: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes classical Arabic text into an MP3 file, caching on disk for instant re-use.
        """
        import edge_tts

        profile = ARABIC_VOICE_PROFILES.get(profile_key, ARABIC_VOICE_PROFILES["classical_arabic"])
        voice = profile["voice"]
        rate = custom_rate or profile["rate"]
        pitch = profile["pitch"]

        # Clean text
        text = text.strip()
        if not text:
            return {"success": False, "error": "Empty text"}

        # Unique cache key
        cache_str = f"{voice}_{rate}_{pitch}_{text}"
        cache_hash = hashlib.sha256(cache_str.encode("utf-8")).hexdigest()
        cache_file = CACHE_DIR / f"{cache_hash}.mp3"

        if cache_file.exists():
            return {
                "success": True,
                "cached": True,
                "audio_url": f"/api/audio/{cache_hash}.mp3",
                "file_path": str(cache_file),
                "voice_used": voice
            }

        try:
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await comm.save(str(cache_file))
            return {
                "success": True,
                "cached": False,
                "audio_url": f"/api/audio/{cache_hash}.mp3",
                "file_path": str(cache_file),
                "voice_used": voice
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "fallback_browser": True
            }

if __name__ == "__main__":
    async def run():
        res = await TtsEngine.synthesize("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ. الحَمْدُ لِلَّهِ رَبِّ العَالَمِينَ.")
        print("Synthesized Arabic:", res)
    asyncio.run(run())
