/**
 * epub_engine.js
 * 
 * High-Performance Client-Side Pure JavaScript EPUB Engine for RaziApp
 * Powered by JSZip & DOMParser. Zero server dependencies.
 * Extracts TOC, Spine, semantic bilingual blocks (Arabic + English),
 * dialectic arguments (In Qila / Qulna / Dalil), and in-memory full-text search.
 * Strictly Zero Emojis.
 */

'use strict';

class ClientEpubEngine {
  constructor() {
    this.currentZip = null;
    this.opfDir = '';
    this.manifest = {}; // id -> { href, fullPath, mediaType }
    this.spine = []; // array of hrefs
    this.toc = []; // array of { title, href }
    this.metadata = {};
    this.activeBookId = null;
  }

  // Regex for dialectical classification
  static DIALECTIC_OBJECTION = /\b(if\s+(?:it\s+is\s+said|you\s+say|one\s+objects|an\s+objector\s+argues|it\s+be\s+objected)|objection|first\s+doubt|second\s+doubt|فإن\s+قيل|إن\s+قيل|والشبهة|السؤال|الإشكال|المعارضة)\b/i;
  static DIALECTIC_REFUTATION = /\b(we\s+(?:say|reply|respond|answer|counter)|the\s+answer\s+is|the\s+refutation|the\s+resolution\s+is|قلنا|والجواب|فنقول|برهان\s+ذلك|الجواب\s+عنه|رد\s+ذلك)\b/i;
  static DIALECTIC_PROOF = /\b(proof|dalil|burhan|syllogism|demonstration|qiyas|premise|deduction|الدليل|البرهان|الحجة|القياس|المقدمة)\b/i;
  static DIALECTIC_TAXONOMY = /\b(taqsim|exhaustive\s+division|classification|categories|taxonomy|either\s+.*?\s+or|التقسيم|الحصر|القسمة\s+الحاصرة|أنواع|أقسام)\b/i;
  static ARABIC_UNICODE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

  /**
   * Load and unpack an EPUB file from ArrayBuffer, Uint8Array, or URL.
   */
  async load(source, bookId = 'book') {
    this.activeBookId = bookId;
    let arrayBuffer = null;

    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status} loading EPUB: ${source}`);
      arrayBuffer = await response.arrayBuffer();
    } else if (source instanceof ArrayBuffer) {
      arrayBuffer = source;
    } else if (source instanceof Uint8Array) {
      arrayBuffer = source.buffer;
    } else {
      throw new Error('Unsupported EPUB data source');
    }

    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is required for standalone client EPUB engine');
    }

    this.currentZip = await JSZip.loadAsync(arrayBuffer);
    await this._parseContainerAndOpf();
    await this._parseToc();
    return {
      metadata: this.metadata,
      toc: this.toc,
      spineLength: this.spine.length
    };
  }

  async _parseContainerAndOpf() {
    const containerFile = this.currentZip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('Invalid EPUB: META-INF/container.xml not found');
    
    const containerText = await containerFile.async('text');
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerText, 'application/xml');
    const rootfileEl = containerDoc.querySelector('rootfile');
    const opfFullPath = rootfileEl?.getAttribute('full-path') || 'OEBPS/content.opf';

    const opfFile = this.currentZip.file(opfFullPath);
    if (!opfFile) throw new Error(`OPF package not found at ${opfFullPath}`);

    this.opfDir = opfFullPath.includes('/') ? opfFullPath.substring(0, opfFullPath.lastIndexOf('/') + 1) : '';
    const opfText = await opfFile.async('text');
    const opfDoc = parser.parseFromString(opfText, 'application/xml');

    // Parse Metadata
    this.metadata = {
      title: opfDoc.querySelector('metadata > title, metadata > dc\\:title')?.textContent?.trim() || 'Classical Treatise',
      creator: opfDoc.querySelector('metadata > creator, metadata > dc\\:creator')?.textContent?.trim() || 'Classical Master',
      language: opfDoc.querySelector('metadata > language, metadata > dc\\:language')?.textContent?.trim() || 'en'
    };

    // Parse Manifest
    this.manifest = {};
    const itemEls = opfDoc.querySelectorAll('manifest > item');
    itemEls.forEach(el => {
      const id = el.getAttribute('id');
      const href = el.getAttribute('href');
      const mediaType = el.getAttribute('media-type');
      const properties = el.getAttribute('properties') || '';
      if (id && href) {
        this.manifest[id] = {
          href: href,
          fullPath: this._resolvePath(this.opfDir, href),
          mediaType: mediaType,
          properties: properties
        };
      }
    });

    // Parse Spine
    this.spine = [];
    const itemrefEls = opfDoc.querySelectorAll('spine > itemref');
    itemrefEls.forEach(el => {
      const idref = el.getAttribute('idref');
      if (idref && this.manifest[idref]) {
        this.spine.push(this.manifest[idref].href);
      }
    });
  }

  async _parseToc() {
    this.toc = [];
    const parser = new DOMParser();

    // 1. Try EPUB3 Nav Document
    let navItem = Object.values(this.manifest).find(item => 
      item.properties.includes('nav') || item.href.includes('nav.xhtml') || item.href.includes('toc.xhtml')
    );

    if (navItem) {
      const navFile = this.currentZip.file(navItem.fullPath);
      if (navFile) {
        const navText = await navFile.async('text');
        const navDoc = parser.parseFromString(navText, 'application/xhtml+xml');
        const navToc = navDoc.querySelector('nav[*|type="toc"], nav#toc, nav');
        if (navToc) {
          const links = navToc.querySelectorAll('a[href]');
          links.forEach(a => {
            const href = a.getAttribute('href');
            const title = a.textContent.trim().replace(/\s+/g, ' ');
            if (href && title) {
              const cleanHref = href.split('#')[0];
              this.toc.push({ title: title, href: cleanHref, target: href });
            }
          });
        }
      }
    }

    // 2. Try EPUB2 NCX Table of Contents if nav was empty
    if (this.toc.length === 0) {
      const ncxItem = Object.values(this.manifest).find(item => 
        item.mediaType === 'application/x-dtbncx+xml' || item.href.endsWith('.ncx')
      );
      if (ncxItem) {
        const ncxFile = this.currentZip.file(ncxItem.fullPath);
        if (ncxFile) {
          const ncxText = await ncxFile.async('text');
          const ncxDoc = parser.parseFromString(ncxText, 'application/xml');
          const navPoints = ncxDoc.querySelectorAll('navPoint');
          navPoints.forEach(np => {
            const labelEl = np.querySelector('navLabel > text');
            const contentEl = np.querySelector('content');
            const title = labelEl?.textContent?.trim().replace(/\s+/g, ' ');
            const src = contentEl?.getAttribute('src');
            if (title && src) {
              const cleanHref = src.split('#')[0];
              this.toc.push({ title: title, href: cleanHref, target: src });
            }
          });
        }
      }
    }

    // 3. Fallback to Spine Chapter List
    if (this.toc.length === 0) {
      this.spine.forEach((href, idx) => {
        const cleanName = href.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const title = `Section ${idx + 1}: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
        this.toc.push({ title: title, href: href, target: href });
      });
    }

    // Deduplicate TOC by href preserving order
    const seen = new Set();
    this.toc = this.toc.filter(item => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }

  /**
   * Extract semantic dialectical chapter paragraphs from XHTML file.
   */
  async getChapter(targetHref) {
    if (!this.currentZip) throw new Error('No EPUB loaded');
    const cleanHref = (targetHref || this.spine[0] || '').split('#')[0];
    const fullPath = this._resolvePath(this.opfDir, cleanHref);

    let file = this.currentZip.file(fullPath);
    if (!file) {
      // Fuzzy lookup inside zip
      const match = Object.keys(this.currentZip.files).find(p => p.endsWith(cleanHref) || p.endsWith('/' + cleanHref));
      if (match) file = this.currentZip.file(match);
    }

    if (!file) {
      throw new Error(`Chapter file not found: ${cleanHref}`);
    }

    const htmlText = await file.async('text');
    return this._parseChapterHtml(htmlText, cleanHref);
  }

  _parseChapterHtml(htmlText, href) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const titleEl = doc.querySelector('h1, h2, h3, title');
    const chapterTitle = titleEl?.textContent?.trim().replace(/\s+/g, ' ') || 'Discourse Section';

    const paragraphs = [];
    let pCounter = 1;

    // Collect all semantic content containers
    const blockEls = doc.querySelectorAll('p, div.paragraph, div.section, blockquote, div.hadith-block, div.dialectic-block');

    if (blockEls.length > 0) {
      blockEls.forEach(el => {
        const rawText = el.textContent.trim().replace(/\s+/g, ' ');
        if (!rawText || rawText.length < 3) return;

        const isArabicBlock = el.getAttribute('dir') === 'rtl' || el.classList.contains('arabic') || el.classList.contains('arabic-text') || (ClientEpubEngine.ARABIC_UNICODE.test(rawText) && !/[a-zA-Z]{5,}/.test(rawText));

        // Check if block has nested Arabic text or is standalone
        let arabicText = null;
        let mainText = rawText;

        const nestedAr = el.querySelector('[dir="rtl"], .arabic, .arabic-text');
        if (nestedAr) {
          arabicText = nestedAr.textContent.trim().replace(/\s+/g, ' ');
          mainText = mainText.replace(arabicText, '').trim();
        } else if (isArabicBlock) {
          arabicText = rawText;
          mainText = '';
        }

        // Determine Dialectic Typology
        let pType = 'prose';
        const combinedText = rawText.toLowerCase();

        if (ClientEpubEngine.DIALECTIC_OBJECTION.test(combinedText)) {
          pType = 'objection';
        } else if (ClientEpubEngine.DIALECTIC_REFUTATION.test(combinedText)) {
          pType = 'refutation';
        } else if (ClientEpubEngine.DIALECTIC_PROOF.test(combinedText)) {
          pType = 'proof';
        } else if (ClientEpubEngine.DIALECTIC_TAXONOMY.test(combinedText)) {
          pType = 'taxonomy';
        }

        paragraphs.push({
          id: el.id || `p_${pCounter++}`,
          type: pType,
          arabic_text: arabicText,
          text: mainText || arabicText
        });
      });
    } else {
      // Fallback: extract plain body text split by newlines
      const bodyText = doc.body?.textContent?.trim() || '';
      const lines = bodyText.split(/\n\s*\n/).map(l => l.trim()).filter(l => l.length > 3);
      lines.forEach((line, idx) => {
        paragraphs.push({
          id: `p_${idx + 1}`,
          type: 'prose',
          arabic_text: ClientEpubEngine.ARABIC_UNICODE.test(line) ? line : null,
          text: line
        });
      });
    }

    return {
      href: href,
      title: chapterTitle,
      paragraphs: paragraphs
    };
  }

  /**
   * Search across all spine chapters in memory with snippet generation.
   */
  async search(query, limit = 30) {
    if (!this.currentZip || !query || query.trim().length === 0) return [];
    const qLower = query.trim().toLowerCase();
    const results = [];

    for (let i = 0; i < this.spine.length; i++) {
      const href = this.spine[i];
      try {
        const chapter = await this.getChapter(href);
        const title = chapter.title || `Section ${i + 1}`;

        for (const p of chapter.paragraphs) {
          const fullPText = ((p.arabic_text || '') + ' ' + (p.text || '')).toLowerCase();
          const matchIdx = fullPText.indexOf(qLower);
          if (matchIdx !== -1) {
            const start = Math.max(0, matchIdx - 60);
            const end = Math.min(fullPText.length, matchIdx + qLower.length + 60);
            const snippet = (start > 0 ? '...' : '') + (p.text || p.arabic_text).substring(start, end) + (end < fullPText.length ? '...' : '');

            results.push({
              chapter_href: href,
              chapter_title: title,
              paragraph_id: p.id,
              type: p.type,
              snippet: snippet
            });

            if (results.length >= limit) return results;
          }
        }
      } catch (_) {}
    }
    return results;
  }


  /**
   * Generates a 100% valid EPUB3 binary from offline_store data entirely client-side.
   * Returns { blob, base64, filename }
   */
  async exportEpubFromStore(book, offlineData) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip is required for EPUB compilation');
    }

    const zip = new JSZip();
    const title = book.title || 'Classical Masterwork';
    const author = book.author || 'Classical Author';
    const lang = book.is_sq ? 'sq' : (book.format && book.format.includes('sq') ? 'sq' : 'en');
    const filename = book.filename || (book.id ? book.id + '.epub' : 'codex.epub');
    const bookId = book.id || 'codex-' + Date.now();

    // 1. mimetype (MUST be first, uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. META-INF/container.xml
    zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>');

    // CSS
    const cssContent = 'body { font-family: Georgia, serif; line-height: 1.7; margin: 1.2em; color: #1a1a1a; }\n' +
      'h1 { font-family: sans-serif; color: #0b3c5d; border-bottom: 2px solid #0b3c5d; padding-bottom: 0.3em; }\n' +
      'h2 { font-family: sans-serif; color: #2c3e50; }\n' +
      '.arabic-block { font-family: "Amiri", serif; direction: rtl; text-align: right; font-size: 1.3em; line-height: 2.1; color: #1b365d; background: #f8fafc; border-right: 4px solid #1b365d; padding: 15px; margin: 15px 0; border-radius: 4px; }\n' +
      '.apparatus-box { background: #f4f6f8; border-left: 4px solid #0b3c5d; padding: 12px; margin: 15px 0; font-size: 0.9em; }\n' +
      '.translation-block { margin-top: 1.2em; line-height: 1.7; }\n' +
      'p { margin-bottom: 1em; }';
    zip.file('EPUB/style/nav.css', cssContent);

    // Prepare chapters
    const toc = offlineData && offlineData.toc ? offlineData.toc : [];
    const chaptersMap = offlineData && offlineData.chapters ? offlineData.chapters : {};

    const manifestItems = [
      '<item id="style_nav" href="style/nav.css" media-type="text/css"/>',
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
    ];
    const spineItems = [];
    const navLinks = [];
    const ncxPoints = [];

    const escapeXml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let chapIndex = 1;
    for (const t of toc) {
      const href = t.href;
      const chTitle = t.title || 'Section ' + chapIndex;
      const chData = chaptersMap[href] || {};
      const chFileName = 'chap_' + String(chapIndex).padStart(2, '0') + '.xhtml';

      let parasHtml = '';
      if (chData.paragraphs && chData.paragraphs.length > 0) {
        parasHtml = chData.paragraphs.map(p => {
          let inner = '';
          if (p.arabic_text) {
            inner += '<div class="arabic-block">' + escapeXml(p.arabic_text) + '</div>';
          }
          if (p.text && p.text !== p.arabic_text) {
            inner += '<p>' + escapeXml(p.text) + '</p>';
          }
          return inner;
        }).join('\n');
      } else {
        parasHtml = '<p>Section content indexed in RaziApp offline codex.</p>';
      }

      const xhtmlContent = '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<!DOCTYPE html>\n' +
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' + lang + '">\n' +
        '<head>\n' +
        '  <title>' + escapeXml(chTitle) + '</title>\n' +
        '  <link rel="stylesheet" type="text/css" href="style/nav.css"/>\n' +
        '</head>\n' +
        '<body>\n' +
        '  <h1>' + escapeXml(chTitle) + '</h1>\n' +
        '  <div class="translation-block">\n' +
        '    ' + parasHtml + '\n' +
        '  </div>\n' +
        '</body>\n' +
        '</html>';

      zip.file('EPUB/' + chFileName, xhtmlContent);

      const itemId = 'chap_' + chapIndex;
      manifestItems.push('<item id="' + itemId + '" href="' + chFileName + '" media-type="application/xhtml+xml"/>');
      spineItems.push('<itemref idref="' + itemId + '"/>');
      navLinks.push('<li><a href="' + chFileName + '">' + escapeXml(chTitle) + '</a></li>');
      ncxPoints.push('<navPoint id="np_' + chapIndex + '" playOrder="' + chapIndex + '">\n' +
        '  <navLabel><text>' + escapeXml(chTitle) + '</text></navLabel>\n' +
        '  <content src="' + chFileName + '"/>\n' +
        '</navPoint>');

      chapIndex++;
    }

    // nav.xhtml
    const navContent = '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<!DOCTYPE html>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' + lang + '">\n' +
      '<head><title>Table of Contents</title></head>\n' +
      '<body>\n' +
      '  <nav epub:type="toc" id="toc">\n' +
      '    <h1>Table of Contents</h1>\n' +
      '    <ol>\n' +
      '      ' + navLinks.join('\n      ') + '\n' +
      '    </ol>\n' +
      '  </nav>\n' +
      '</body>\n' +
      '</html>';
    zip.file('EPUB/nav.xhtml', navContent);

    // toc.ncx
    const ncxContent = '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n' +
      '  <head>\n' +
      '    <meta name="dtb:uid" content="' + bookId + '"/>\n' +
      '    <meta name="dtb:depth" content="1"/>\n' +
      '  </head>\n' +
      '  <docTitle><text>' + escapeXml(title) + '</text></docTitle>\n' +
      '  <navMap>\n' +
      '    ' + ncxPoints.join('\n    ') + '\n' +
      '  </navMap>\n' +
      '</ncx>';
    zip.file('EPUB/toc.ncx', ncxContent);

    // content.opf
    const opfContent = '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">\n' +
      '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '    <dc:identifier id="BookId">' + bookId + '</dc:identifier>\n' +
      '    <dc:title>' + escapeXml(title) + '</dc:title>\n' +
      '    <dc:creator>' + escapeXml(author) + '</dc:creator>\n' +
      '    <dc:language>' + lang + '</dc:language>\n' +
      '  </metadata>\n' +
      '  <manifest>\n' +
      '    ' + manifestItems.join('\n    ') + '\n' +
      '  </manifest>\n' +
      '  <spine toc="ncx">\n' +
      '    ' + spineItems.join('\n    ') + '\n' +
      '  </spine>\n' +
      '</package>';
    zip.file('EPUB/content.opf', opfContent);

    const base64 = await zip.generateAsync({ type: 'base64' });
    let blob = null;
    try {
      if (typeof Blob !== 'undefined') {
        const u8 = await zip.generateAsync({ type: 'uint8array' });
        blob = new Blob([u8], { type: 'application/epub+zip' });
      }
    } catch (_) {}

    return {
      blob,
      base64,
      filename
    };
  }

  _resolvePath(baseDir, relativePath) {
    if (!baseDir) return relativePath;
    if (relativePath.startsWith('/')) return relativePath.substring(1);
    const stack = baseDir.split('/').filter(Boolean);
    const parts = relativePath.split('/');
    for (const p of parts) {
      if (p === '..') {
        stack.pop();
      } else if (p !== '.') {
        stack.push(p);
      }
    }
    return stack.join('/');
  }
}

// Global Singleton Instance
window.clientEpubEngine = new ClientEpubEngine();
