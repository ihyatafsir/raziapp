#!/usr/bin/env python3
"""
AynEngine AI Desktop Bridge
Bridges the desktop GUI directly to the VM's sovereign LexicographicalTranslationEngine
and AynEpubBuilder. Supports both JSON-RPC via stdio and a lightweight HTTP REST server.
Strictly zero emojis.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

# Locate translation framework
POSSIBLE_PATHS = [
    Path("/home/absolut7/.gemini/antigravity/scratch/translation_engine_framework"),
    Path(__file__).parent.parent.parent.resolve() / "translation_engine_framework"
]

FRAMEWORK_PATH = None
for p in POSSIBLE_PATHS:
    if (p / "core" / "lexicographical_engine.py").exists():
        FRAMEWORK_PATH = p
        break

if not FRAMEWORK_PATH:
    sys.stderr.write("ERROR: Could not locate translation_engine_framework\n")
    sys.exit(1)

sys.path.insert(0, str(FRAMEWORK_PATH))
from core.lexicographical_engine import LexicographicalTranslationEngine
from core.epub_builder import AynEpubBuilder

def handle_translate(payload):
    author = payload.get("author", "Imam Abu Hamid al-Ghazali")
    book_title_ar = payload.get("book_title_ar", "كتاب كلاسيكي")
    book_title_en = payload.get("book_title_en", "Classical Treatise")
    target_lang = payload.get("target_lang", "en")
    api_key = payload.get("api_key")
    model = payload.get("model")
    base_url = payload.get("base_url")
    passage_text = payload.get("passage_text", "")
    section_title = payload.get("section_title", "Section")

    engine = LexicographicalTranslationEngine(
        author=author,
        book_title_ar=book_title_ar,
        book_title_en=book_title_en,
        api_key=api_key,
        model=model,
        base_url=base_url,
        target_lang=target_lang
    )

    result = engine.translate_passage(passage_text, title_ar=section_title)
    return {
        "success": True,
        "result": result
    }

def handle_extract_roots(payload):
    text = payload.get("text", "")
    max_cands = payload.get("max_candidates", 5)

    engine = LexicographicalTranslationEngine("Scholar", "Arabic", "English")
    roots = engine.extract_candidate_roots(text, max_candidates=max_cands)
    details = []
    for r in roots:
        summary = engine.get_quad_anchor_summary(r)
        details.append(summary)

    sib_rule = engine.match_sibawayh_rule(text)
    return {
        "success": True,
        "roots": roots,
        "details": details,
        "sibawayh_rule": sib_rule
    }

def handle_compile_epub(payload):
    title = payload.get("title", "AynEngine AI Edition")
    author = payload.get("author", "Classical Scholar")
    edition_type = payload.get("edition_type", "PURE_SCHOLARLY") # or BILINGUAL_APPARATUS
    output_path = payload.get("output_path", "/tmp/export.epub")
    chapters = payload.get("chapters", [])

    builder = AynEpubBuilder(
        title=title,
        author=author,
        language=payload.get("language", "en"),
        edition_type=edition_type
    )

    for ch in chapters:
        ch_title = ch.get("title", "Chapter")
        if edition_type == "BILINGUAL_APPARATUS":
            builder.add_bilingual_apparatus_chapter(
                title=ch_title,
                arabic_text=ch.get("arabic", ""),
                quad_anchors=ch.get("anchors", ""),
                translation_text=ch.get("translation", "")
            )
        else:
            builder.add_pure_scholarly_chapter(
                title=ch_title,
                translation_text=ch.get("translation", "")
            )

    out_file = builder.build(output_path)
    return {
        "success": True,
        "output_path": out_file
    }

def handle_get_status():
    engine = LexicographicalTranslationEngine("Status", "Status", "Status")
    return {
        "success": True,
        "framework_path": str(FRAMEWORK_PATH),
        "model": engine.model,
        "base_url": engine.base_url,
        "api_key_configured": bool(engine.api_key),
        "lexicon_stats": {
            "lisan_entries": len(engine.lisan_dict),
            "ayn_entries": len(engine.ayn_dict),
            "raghib_entries": len(engine.raghib_dict),
            "zamakhshari_entries": len(engine.zamakhshari_dict),
            "sibawayh_rules": len(engine.sibawayh_rules)
        }
    }

class BridgeHttpHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/status":
            res = handle_get_status()
            body = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(raw_body) if raw_body else {}
        except Exception as e:
            payload = {}

        response_data = {"success": False, "error": "Unknown route"}

        try:
            if self.path == "/api/translate":
                response_data = handle_translate(payload)
            elif self.path == "/api/extract_roots":
                response_data = handle_extract_roots(payload)
            elif self.path == "/api/compile_epub":
                response_data = handle_compile_epub(payload)
            elif self.path == "/api/status":
                response_data = handle_get_status()
        except Exception as e:
            response_data = {"success": False, "error": str(e)}

        body = json.dumps(response_data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

def run_stdio_mode():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            action = req.get("action")
            payload = req.get("payload", {})
            if action == "translate":
                res = handle_translate(payload)
            elif action == "extract_roots":
                res = handle_extract_roots(payload)
            elif action == "compile_epub":
                res = handle_compile_epub(payload)
            elif action == "status":
                res = handle_get_status()
            else:
                res = {"success": False, "error": f"Unknown action: {action}"}
        except Exception as e:
            res = {"success": False, "error": str(e)}
        sys.stdout.write(json.dumps(res, ensure_ascii=False) + "\n")
        sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser(description="AynEngine AI Desktop Bridge")
    parser.add_argument("--port", type=int, default=5800, help="HTTP server port")
    parser.add_argument("--stdio", action="store_true", help="Run in JSON-RPC stdio mode")
    args = parser.parse_args()

    if args.stdio:
        run_stdio_mode()
    else:
        server = HTTPServer(("127.0.0.1", args.port), BridgeHttpHandler)
        sys.stdout.write(f"AynEngine AI Bridge running on http://127.0.0.1:{args.port}\n")
        sys.stdout.flush()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
