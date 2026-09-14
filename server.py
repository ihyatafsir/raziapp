#!/usr/bin/env python3
"""
server.py

RaziApp Backend Server (Port 5200)
Provides REST & Streaming APIs for:
- Classical EPUB library indexing (246 Masterworks)
- Dialectical chapter & TOC extraction
- In-book full-text cross-chapter search
- Shaykh Hamza Yusuf neural TTS synthesis
- 'Al-Muhaqqiq' AI companion (DeepSeek Flash 4.1 + local Ollama)
Strictly zero emojis.
"""

import os
import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from epub_parser import EpubParser
from tts_engine import TtsEngine
from ai_assistant import RaziAiAssistant
import re
import time
import base64
from translation_studio import translation_studio

BASE_DIR = Path(__file__).parent.resolve()
PUBLIC_DIR = BASE_DIR / "public"
CACHE_AUDIO_DIR = BASE_DIR / "cache_audio"
CATALOG_PATH = BASE_DIR / "catalog.json"

app = FastAPI(
    title="RaziApp: Dialectical EPUB Reader & Scholarly Audio Ecosystem",
    description="Interactive reading platform grounded in Imam Fakhr al-Din al-Razi's epistemic inquiry.",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Assistant
ai_assistant = RaziAiAssistant()

# Cache books catalog in memory
def load_catalog() -> List[Dict[str, Any]]:
    if not CATALOG_PATH.exists():
        from setup_corpus import setup_corpus
        return setup_corpus()
    try:
        return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

catalog = load_catalog()

# --- API Models ---
class TtsRequest(BaseModel):
    text: str
    voice: str = "hamza_yusuf"
    rate: Optional[str] = None

class TranslationStartRequest(BaseModel):
    source_type: str = "openiti"  # "openiti", "local", "upload", "direct"
    source_identifier: str
    author: str = "Classical Author"
    book_title_ar: str = "كتاب"
    book_title_en: str = "Treatise"
    target_lang: str = "en"  # "en", "sq", "de", "tr", "fr"
    edition_mode: str = "bilingual"  # "bilingual" or "pure"
    include_rag_glossary: bool = True
    max_chunks: Optional[int] = None
    api_key: Optional[str] = None

class ChunkTranslationRequest(BaseModel):
    text: str
    author: Optional[str] = "Imam Fakhr al-Din al-Razi"
    book_title_ar: Optional[str] = "كتاب كلاسيكي"
    book_title_en: Optional[str] = "Classical Treatise"
    target_lang: Optional[str] = "en"
    api_key: Optional[str] = None

class UploadFileRequest(BaseModel):
    filename: str
    content_base64: Optional[str] = None
    content_text: Optional[str] = None

class AiAskRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    mode: str = "deep_dialectic"

# --- REST Endpoints ---
@app.get("/api/health")
def get_health():
    """Health check and corpus stats."""
    current_catalog = load_catalog()
    return {
        "status": "online",
        "version": "2.3.0",
        "total_books": len(current_catalog),
        "v4_v5_total": len([b for b in current_catalog if b.get("is_v4_v5")]),
        "v5_total": len([b for b in current_catalog if b.get("version") == "v5"]),
        "v4_total": len([b for b in current_catalog if b.get("version") == "v4"]),
        "pure_en_total": len([b for b in current_catalog if b.get("is_pure_en")]),
        "bilingual_total": len([b for b in current_catalog if b.get("is_bilingual")]),
        "sq_total": len([b for b in current_catalog if b.get("is_sq")]),
        "ai_engine": "DeepSeek Flash 4.1 + Ollama Fallback",
        "tts_engine": "Classical Arabic Recitation"
    }

@app.get("/api/taxonomy")
def get_taxonomy():
    """Returns the hierarchical Imams and Topics taxonomy metadata."""
    from setup_corpus import IMAMS_MAP, TOPICS_MAP
    current_catalog = load_catalog()
    return {
        "imams": IMAMS_MAP,
        "topics": TOPICS_MAP,
        "total_books": len(current_catalog),
        "v4_v5_total": len([b for b in current_catalog if b.get("is_v4_v5")]),
        "v5_total": len([b for b in current_catalog if b.get("version") == "v5"]),
        "v4_total": len([b for b in current_catalog if b.get("version") == "v4"]),
        "pure_en_total": len([b for b in current_catalog if b.get("is_pure_en")]),
        "v5_pure_total": len([b for b in current_catalog if b.get("version") == "v5" and b.get("is_pure_en")]),
        "v4_pure_total": len([b for b in current_catalog if b.get("version") == "v4" and b.get("is_pure_en")]),
        "bilingual_total": len([b for b in current_catalog if b.get("is_bilingual")]),
        "v5_bilingual_total": len([b for b in current_catalog if b.get("version") == "v5" and b.get("is_bilingual")]),
        "v4_bilingual_total": len([b for b in current_catalog if b.get("version") == "v4" and b.get("is_bilingual")]),
        "sq_total": len([b for b in current_catalog if b.get("is_sq")])
    }

@app.get("/api/books")
def get_books(
    author: Optional[str] = None,
    imam: Optional[str] = None,
    topic: Optional[str] = None,
    version: Optional[str] = None,
    format: Optional[str] = None,
    v4_v5_only: Optional[bool] = None,
    query: Optional[str] = None,
    limit: int = 500
):
    """Returns catalog of translated classical works sorted by Imam and Topic."""
    # Always read fresh catalog
    current_catalog = load_catalog()
    results = current_catalog

    # Filter by Imam / Author
    selected_imam = imam or author
    if selected_imam and selected_imam != "all":
        results = [b for b in results if b.get("imam_key") == selected_imam or b.get("author_key") == selected_imam]

    # Filter by Epistemic Topic
    if topic and topic != "all":
        results = [b for b in results if b.get("topic_key") == topic or b.get("pillar_key") == topic]

    # Filter by Format (pure_en, bilingual, sq, v5_pure, v4_pure)
    if format and format != "all":
        if format == "pure_en":
            results = [b for b in results if b.get("is_pure_en")]
        elif format == "bilingual":
            results = [b for b in results if b.get("is_bilingual")]
        elif format == "sq":
            results = [b for b in results if b.get("is_sq")]
        elif format == "v5_pure":
            results = [b for b in results if b.get("version") == "v5" and b.get("is_pure_en")]
        elif format == "v4_pure":
            results = [b for b in results if b.get("version") == "v4" and b.get("is_pure_en")]
        elif format == "v5":
            results = [b for b in results if b.get("version") == "v5"]
        elif format == "v4":
            results = [b for b in results if b.get("version") == "v4"]

    # Filter by Version or v4/v5 Only
    if v4_v5_only:
        results = [b for b in results if b.get("is_v4_v5")]
    elif version and version != "all":
        results = [b for b in results if b.get("version") == version]

    # Search Query
    if query:
        q = query.lower().strip()
        results = [
            b for b in results
            if q in b.get("title", "").lower()
            or q in b.get("arabic_title", "").lower()
            or q in b.get("filename", "").lower()
            or q in b.get("author", "").lower()
            or q in b.get("topic_name", "").lower()
            or q in b.get("topic_arabic", "").lower()
        ]

    return results[:limit]

@app.get("/api/book/{book_id}")
def get_book_info(book_id: str):
    """Returns single book metadata."""
    book = next((b for b in catalog if b["id"] == book_id), None)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@app.get("/api/book/{book_id}/toc")
def get_book_toc(book_id: str):
    """Extracts and returns the hierarchical Table of Contents."""
    book = next((b for b in catalog if b["id"] == book_id), None)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    epub_path = book["path"]
    toc = EpubParser.get_table_of_contents(epub_path)
    return {
        "book_id": book_id,
        "title": book["title"],
        "arabic_title": book.get("arabic_title", ""),
        "total_sections": len(toc),
        "toc": toc
    }

@app.get("/api/book/{book_id}/chapter")
def get_book_chapter(
    book_id: str,
    href: Optional[str] = Query(None),
    index: Optional[int] = Query(0)
):
    """Extracts a specific chapter and decomposes it into dialectical blocks."""
    book = next((b for b in catalog if b["id"] == book_id), None)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    epub_path = book["path"]
    toc = EpubParser.get_table_of_contents(epub_path)
    if not toc:
        raise HTTPException(status_code=400, detail="Empty book or invalid EPUB")

    target_href = href
    target_title = None
    if not target_href:
        idx = max(0, min(index, len(toc) - 1))
        target_href = toc[idx]["href"]
        target_title = toc[idx]["title"]
    else:
        match = next((item for item in toc if item["href"] == target_href), None)
        if match:
            target_title = match["title"]

    chapter_data = EpubParser.get_chapter(epub_path, target_href)
    if target_title and chapter_data.get("title") in ["Section Not Found", "Chapter Not Found"]:
        chapter_data["title"] = target_title

    chapter_data["book_id"] = book_id
    chapter_data["book_title"] = book["title"]
    chapter_data["current_href"] = target_href

    return chapter_data

@app.get("/api/book/{book_id}/search")
def search_book_content(
    book_id: str,
    q: str = Query(..., min_length=2),
    limit: int = 25
):
    """Performs full-text search across all chapters in the codex."""
    book = next((b for b in catalog if b["id"] == book_id), None)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    epub_path = book["path"]
    toc = EpubParser.get_table_of_contents(epub_path)
    q_lower = q.lower()
    matches = []

    for item in toc:
        chap = EpubParser.get_chapter(epub_path, item["href"])
        for p in chap.get("paragraphs", []):
            text = p.get("text", "")
            if q_lower in text.lower():
                # Extract snippet around match
                idx = text.lower().find(q_lower)
                start = max(0, idx - 60)
                end = min(len(text), idx + len(q) + 60)
                snippet = ("..." if start > 0 else "") + text[start:end] + ("..." if end < len(text) else "")

                matches.append({
                    "chapter_title": item["title"],
                    "chapter_href": item["href"],
                    "paragraph_id": p.get("id"),
                    "dialectic_type": p.get("dialectic_type", "exposition"),
                    "snippet": snippet,
                    "text": text
                })
                if len(matches) >= limit:
                    break
        if len(matches) >= limit:
            break

    return {
        "book_id": book_id,
        "query": q,
        "total_matches": len(matches),
        "results": matches
    }

@app.post("/api/tts/synthesize")
async def synthesize_audio(req: TtsRequest):
    """Synthesizes text using the Shaykh Hamza Yusuf vocal profile."""
    result = await TtsEngine.synthesize(
        text=req.text,
        profile_key=req.voice,
        custom_rate=req.rate
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "TTS synthesis failed"))
    return result

# Mount Audio Cache
CACHE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/audio", StaticFiles(directory=str(CACHE_AUDIO_DIR)), name="audio")

@app.post("/api/ai/ask")
def query_razi_ai(req: AiAskRequest):
    """Al-Muhaqqiq Al-Razi dialectical inquiry engine."""
    res = ai_assistant.query(
        prompt=req.prompt,
        context_passage=req.context,
        mode=req.mode
    )
    return res

@app.get("/api/voices")
def get_available_voices():
    """Returns available scholarly voice profiles."""
    return TtsEngine.get_voice_profiles()

@app.get("/download/apk")
@app.head("/download/apk")
@app.get("/api/download/apk")
@app.head("/api/download/apk")
def download_android_apk():
    """Serves the compiled RaziApp Android APK package."""
    candidates = [
        BASE_DIR / "raziapp-v2.3.7.apk",
        BASE_DIR / "public" / "raziapp-v2.3.7.apk",
        BASE_DIR / "public" / "raziapp.apk",
        BASE_DIR / "raziapp.apk",
        BASE_DIR / "android" / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk",
        BASE_DIR / "public" / "raziapp.apk",
        BASE_DIR / "raziapp-v2.3.0.apk",
        BASE_DIR / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
    ]
    apk_path = next((p for p in candidates if p.exists()), None)
    if not apk_path:
        raise HTTPException(status_code=404, detail="APK binary not found.")
    return FileResponse(
        path=str(apk_path),
        filename="raziapp-v2.3.7.apk",
        media_type="application/vnd.android.package-archive"
    )


# --- Translation Studio Endpoints ---
@app.get("/api/translation/openiti/search")
def search_openiti_catalog(q: str = Query("", min_length=0), limit: int = 50):
    """Searches 7,123 classical Islamic manuscripts from OpenITI GitHub catalog."""
    results = translation_studio.search_openiti(q, limit=limit)
    return {
        "query": q,
        "total_results": len(results),
        "results": results
    }

@app.get("/api/translation/openiti/preview")
def preview_openiti_manuscript(url: str = Query(...)):
    """Fetches and previews first 1,500 characters of clean manuscript text."""
    try:
        clean_text = translation_studio.fetch_openiti_text(url)
        return {
            "url": url,
            "char_count": len(clean_text),
            "preview": clean_text[:1500]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch OpenITI text: {e}")

@app.get("/api/translation/local_sources")
def get_local_translation_sources():
    """Lists pre-indexed classical texts in local library."""
    sources = translation_studio.get_local_sources()
    return {"sources": sources}

@app.post("/api/translation/upload")
def upload_manuscript_file(req: UploadFileRequest):
    """Uploads a PDF, TXT, or MD manuscript."""
    uploads_dir = BASE_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    
    file_id = f"{int(time.time())}_{re.sub(r'[^a-zA-Z0-9._-]', '_', req.filename)}"
    out_file = uploads_dir / file_id
    
    if req.content_base64:
        b64_data = req.content_base64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(b64_data)
        out_file.write_bytes(raw_bytes)
    elif req.content_text:
        out_file.write_text(req.content_text, encoding="utf-8")
    else:
        raise HTTPException(status_code=400, detail="Missing file content")
        
    try:
        extracted = translation_studio.extract_uploaded_file(out_file)
        return {
            "success": True,
            "file_id": file_id,
            "filename": req.filename,
            "char_count": len(extracted),
            "preview": extracted[:1500]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {e}")

@app.post("/api/translation/translate_chunk")
def translate_single_chunk(req: ChunkTranslationRequest):
    """Translates a single passage using authentic local AynEngine Active-RAG + DeepSeek."""
    try:
        session_lexicon = {}
        res = translation_studio.translate_passage(
            passage_text=req.text,
            author=req.author,
            book_title_ar=req.book_title_ar,
            book_title_en=req.book_title_en,
            section_idx=1,
            target_lang=req.target_lang,
            session_lexicon=session_lexicon,
            api_key=req.api_key
        )
        return {
            "success": True,
            "translation": res.get("translation", ""),
            "title_target": res.get("title_target", "Section 1"),
            "anchors": res.get("anchors", ""),
            "session_lexicon": session_lexicon
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translation/start")
def start_translation(req: TranslationStartRequest):
    """Starts background AynEngine AI translation job."""
    try:
        job_id = translation_studio.start_translation_job(
            source_type=req.source_type,
            source_identifier=req.source_identifier,
            author=req.author,
            book_title_ar=req.book_title_ar,
            book_title_en=req.book_title_en,
            target_lang=req.target_lang,
            edition_mode=req.edition_mode,
            include_rag_glossary=req.include_rag_glossary,
            max_chunks=req.max_chunks
        )
        return {"success": True, "job_id": job_id, "status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translation/status/{job_id}")
def get_translation_status(job_id: str):
    """Polls translation job progress and generated book ID."""
    status = translation_studio.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


# Mount Frontend

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="public")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5200))
    print(f"Starting RaziApp server on port {port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
