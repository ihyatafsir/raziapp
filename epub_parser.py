#!/usr/bin/env python3
"""
epub_parser.py

Zero-dependency, high-performance EPUB parser for RaziApp.
Extracts metadata, hierarchical table of contents, and semantic
bilingual text blocks (Arabic source, English translation, apparatus,
and 'In Qila / Qulna' dialectical arguments) with zero emojis.
"""

import re
import html
import zipfile
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Regex to strip all emoji characters
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended
    "\U00002600-\U000026FF"  # misc symbols
    "\U00002B50-\U00002B55"
    "\U00002300-\U000023FF"
    "]+",
    flags=re.UNICODE
)

def clean_no_emoji(text: str) -> str:
    """Removes emojis and standardizes whitespace."""
    if not text:
        return ""
    cleaned = EMOJI_PATTERN.sub("", text)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return cleaned.strip()

DIALECTIC_OBJECTION_PATTERNS = [
    re.compile(r'\b(if\s+(?:it\s+is\s+said|you\s+say|one\s+objects|an\s+objector\s+argues|it\s+be\s+objected))\b', re.I),
    re.compile(r'\b(objection\s*[\d:]*|the\s+first\s+objection|the\s+second\s+objection|first\s+doubt|second\s+doubt)\b', re.I),
    re.compile(r'\b(فإن\s+قيل|إن\s+قيل|والشبهة|السؤال|الإشكال|المعارضة)\b'),
    re.compile(r'\b(it\s+might\s+be\s+contended|they\s+argue\s+that|an\s+adversary\s+may\s+claim)\b', re.I)
]

DIALECTIC_REFUTATION_PATTERNS = [
    re.compile(r'\b(we\s+(?:say|reply|respond|answer|counter))\b', re.I),
    re.compile(r'\b(the\s+answer\s+is|in\s+response|the\s+refutation|the\s+resolution\s+is)\b', re.I),
    re.compile(r'\b(قلنا|والجواب|فنقول|برهان\s+ذلك|الجواب\s+عنه|رد\s+ذلك)\b'),
    re.compile(r'\b(the\s+decisive\s+proof\s+is|this\s+is\s+refuted\s+by|apodictic\s+demonstration)\b', re.I)
]

DIALECTIC_PROOF_PATTERNS = [
    re.compile(r'\b(proof|dalil|burhan|syllogism|demonstration|qiyas|premise|deduction)\b', re.I),
    re.compile(r'\b(الدليل|البرهان|الحجة|القياس|المقدمة)\b')
]

DIALECTIC_TAXONOMY_PATTERNS = [
    re.compile(r'\b(taqsim|exhaustive\s+division|classification|categories|taxonomy|either\s+.*?\s+or)\b', re.I),
    re.compile(r'\b(التقسيم|الحصر|القسمة\s+الحاصرة|أنواع|أقسام)\b')
]

DIALECTIC_LEXICAL_PATTERNS = [
    re.compile(r'\b(root:|lisan\s*/\s*ayn|al-raghib|mufradat|asas\s+al-balaghah|sibawayh|quad-lexical|morphological)\b', re.I),
    re.compile(r'\b(الجذر|الاشتقاق|لسان\s+العرب|كتاب\s+العين|المفردات)\b')
]

class HtmlBlockExtractor(HTMLParser):
    """Accurately extracts hierarchical headings, paragraphs, and blocks from XHTML."""

    def __init__(self):
        super().__init__()
        self.blocks: List[Dict[str, Any]] = []
        self.current_tag: Optional[str] = None
        self.current_class: str = ""
        self.current_text: List[str] = []
        self.in_title: bool = False
        self.title: str = ""

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        attrs_dict = dict(attrs)
        class_name = attrs_dict.get("class", "") or ""

        if tag == "title":
            self.in_title = True
        elif tag in ["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li", "pre"]:
            self._flush()
            self.current_tag = tag
            self.current_class = class_name
        elif tag == "div" and any(k in class_name for k in ["arabic", "apparatus", "lexical", "translation", "verse", "hadith", "note"]):
            self._flush()
            self.current_tag = tag
            self.current_class = class_name
        elif tag == "br":
            self.current_text.append("\n")

    def handle_endtag(self, tag: str):
        if tag == "title":
            self.in_title = False
        elif tag == self.current_tag:
            self._flush()

    def handle_data(self, data: str):
        if self.in_title:
            self.title += data
        elif self.current_tag:
            self.current_text.append(data)
        elif data.strip():
            # Text outside explicit tags
            self.current_text.append(data)

    def _flush(self):
        raw = "".join(self.current_text)
        text = clean_no_emoji(raw)
        if text:
            self.blocks.append({
                "tag": self.current_tag or "p",
                "class": self.current_class,
                "text": text
            })
        self.current_tag = None
        self.current_class = ""
        self.current_text = []


class EpubParser:
    """Extracts and parses EPUB structure into dialectical reading nodes."""

    @staticmethod
    def _find_opf_path(zf: zipfile.ZipFile) -> str:
        try:
            container_xml = zf.read("META-INF/container.xml")
            root = ET.fromstring(container_xml)
            for rf in root.iter():
                if rf.tag.endswith("rootfile") and "full-path" in rf.attrib:
                    return rf.attrib["full-path"]
        except Exception:
            pass
        for name in zf.namelist():
            if name.endswith(".opf"):
                return name
        return "EPUB/content.opf"

    @classmethod
    def get_table_of_contents(cls, epub_path: str) -> List[Dict[str, Any]]:
        """Extracts table of contents from TOC.ncx, nav.xhtml, or spine."""
        toc = []
        try:
            with zipfile.ZipFile(epub_path, "r") as zf:
                opf_path = cls._find_opf_path(zf)
                opf_dir = str(Path(opf_path).parent)
                if opf_dir == ".":
                    opf_dir = ""

                opf_content = zf.read(opf_path)
                opf_root = ET.fromstring(opf_content)

                manifest = {}
                spine_order = []
                ncx_path = None

                for item in opf_root.iter():
                    if item.tag.endswith("item"):
                        item_id = item.attrib.get("id", "")
                        href = item.attrib.get("href", "")
                        media_type = item.attrib.get("media-type", "")
                        full_href = f"{opf_dir}/{href}".lstrip("/") if opf_dir else href
                        manifest[item_id] = {
                            "href": full_href,
                            "media_type": media_type,
                            "raw_href": href
                        }
                        if "ncx" in media_type or href.endswith(".ncx"):
                            ncx_path = full_href

                    elif item.tag.endswith("itemref"):
                        idref = item.attrib.get("idref", "")
                        if idref in manifest:
                            spine_order.append(manifest[idref]["href"])

                # 1. Try reading NCX TOC
                if ncx_path and ncx_path in zf.namelist():
                    try:
                        ncx_content = zf.read(ncx_path)
                        ncx_root = ET.fromstring(ncx_content)
                        for nav in ncx_root.iter():
                            if nav.tag.endswith("navPoint"):
                                text_el = nav.find(".//{*}text")
                                content_el = nav.find(".//{*}content")
                                label = text_el.text.strip() if text_el is not None and text_el.text else "Section"
                                label = clean_no_emoji(label)
                                src = content_el.attrib.get("src", "") if content_el is not None else ""
                                target_href = f"{opf_dir}/{src}".lstrip("/") if opf_dir else src
                                base_href = target_href.split("#")[0]
                                toc.append({
                                    "title": label,
                                    "href": base_href,
                                    "src": target_href,
                                    "index": len(toc)
                                })
                    except Exception:
                        pass

                # 2. Fallback: spine order if TOC is empty
                if not toc and spine_order:
                    for idx, href in enumerate(spine_order):
                        if "nav" in href.lower() or "style" in href.lower():
                            continue
                        name = Path(href).stem.replace("_", " ").replace("-", " ").title()
                        toc.append({
                            "title": f"Section {idx + 1}: {name}",
                            "href": href,
                            "src": href,
                            "index": idx
                        })
        except Exception as e:
            print(f"Error reading TOC for {epub_path}: {e}")

        return toc

    @classmethod
    def get_chapter(cls, epub_path: str, chapter_href: str) -> Dict[str, Any]:
        """Reads, sanitizes, and breaks chapter XHTML into structured dialectical blocks."""
        try:
            with zipfile.ZipFile(epub_path, "r") as zf:
                target_file = None
                for name in zf.namelist():
                    if name == chapter_href or name.endswith(chapter_href):
                        target_file = name
                        break

                if not target_file:
                    target_name = Path(chapter_href).name
                    for name in zf.namelist():
                        if name.endswith(target_name):
                            target_file = name
                            break

                if not target_file:
                    return {
                        "title": "Section Not Found",
                        "raw_html": "<p>Section content could not be located in EPUB archive.</p>",
                        "paragraphs": [],
                        "total_paragraphs": 0
                    }

                raw_bytes = zf.read(target_file)
                html_text = raw_bytes.decode("utf-8", errors="replace")

                parser = HtmlBlockExtractor()
                parser.feed(html_text)
                parser._flush()

                chapter_title = clean_no_emoji(parser.title) or Path(chapter_href).stem.replace("_", " ").title()

                # If first block is h1, use it as title
                if parser.blocks and parser.blocks[0]["tag"] in ["h1", "h2"] and not chapter_title:
                    chapter_title = parser.blocks[0]["text"]

                paragraphs = []
                p_idx = 0

                for b in parser.blocks:
                    text = b["text"]
                    if not text:
                        continue

                    # Don't duplicate the main h1 if it matches chapter title
                    if b["tag"] == "h1" and text.lower() == chapter_title.lower():
                        continue

                    # Classify Arabic vs English
                    arabic_chars = len(re.findall(r"[\u0600-\u06FF]", text))
                    is_arabic = (arabic_chars / max(1, len(text))) > 0.35

                    # Classify Dialectical Typology
                    dialectic_type = "exposition"

                    if is_arabic:
                        dialectic_type = "arabic_source"
                    elif any(p.search(text) for p in DIALECTIC_OBJECTION_PATTERNS):
                        dialectic_type = "irad"  # Objection (In Qila)
                    elif any(p.search(text) for p in DIALECTIC_REFUTATION_PATTERNS):
                        dialectic_type = "jawab"  # Refutation / Resolution (Qulna)
                    elif any(p.search(text) for p in DIALECTIC_PROOF_PATTERNS):
                        dialectic_type = "dalil"  # Proof
                    elif any(p.search(text) for p in DIALECTIC_TAXONOMY_PATTERNS):
                        dialectic_type = "taqsim"  # Taxonomy / Exhaustive Division
                    elif any(p.search(text) for p in DIALECTIC_LEXICAL_PATTERNS):
                        dialectic_type = "tahrir"  # Scholarly Apparatus & Lexical Anchor

                    p_idx += 1
                    paragraphs.append({
                        "id": f"p_{p_idx}",
                        "tag": b["tag"],
                        "class": b["class"],
                        "text": text,
                        "is_arabic": is_arabic,
                        "arabic": text if is_arabic else "",
                        "dialectic": dialectic_type,
                        "dialectic_type": dialectic_type
                    })

                # Fallback if no blocks extracted
                if not paragraphs:
                    clean_text = clean_no_emoji(re.sub(r"<[^>]+>", " ", html_text))
                    paragraphs.append({
                        "id": "p_1",
                        "tag": "p",
                        "class": "",
                        "text": clean_text[:4000],
                        "is_arabic": False,
                        "arabic": "",
                        "dialectic": "exposition",
                        "dialectic_type": "exposition"
                    })

                return {
                    "title": chapter_title,
                    "href": chapter_href,
                    "paragraphs": paragraphs,
                    "total_paragraphs": len(paragraphs)
                }
        except Exception as e:
            return {
                "title": "Error Loading Section",
                "paragraphs": [{
                    "id": "p_err",
                    "tag": "p",
                    "class": "",
                    "text": f"Error parsing section: {str(e)}",
                    "is_arabic": False,
                    "arabic": "",
                    "dialectic": "exposition",
                    "dialectic_type": "exposition"
                }],
                "total_paragraphs": 1
            }

if __name__ == "__main__":
    import sys
    test_epub = "/home/absolut7/Documents/news/wyresup-mesh-app/public/epubs/takhmis_al_ghanima_bilingual_lexical_en.epub"
    toc = EpubParser.get_table_of_contents(test_epub)
    print("TOC items:", len(toc))
    if toc:
        chap = EpubParser.get_chapter(test_epub, toc[1]["href"])
        print(f"Chapter: {chap['title']} ({chap['total_paragraphs']} paragraphs)")
        for p in chap["paragraphs"][:6]:
            print(f"  [{p['id']}] [{p['dialectic_type']}] {p['text'][:90]}...")
