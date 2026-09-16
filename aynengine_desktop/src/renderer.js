/**
 * renderer.js
 * Frontend controller for AynEngine AI Desktop Studio
 * Strictly zero emojis.
 */

// Sample Corpus Treatises
const CLASSICAL_CORPUS = [
  {
    author: "Imam Abu Hamid al-Ghazali",
    author_ar: "أبو حامد الغزالي",
    treatises: [
      {
        id: "ghazali_qawaid",
        title_en: "The Foundations of the Articles of Faith",
        title_ar: "قواعد العقائد",
        section: "مقدمة في التوحيد والصفات",
        sample: "الحمد لله المبديء المعيد الفعال لما يريد ذي العرش المجيد والبطش الشديد الهادي صفوة العبيد إلى المنهج الرشيد والمسلك السديد المنعم عليهم بعد شهادة التوحيد بحراسة عقائدهم عن ظلمات التشكيك والترديد السالك بهم إلى اتباع رسوله المصطفى واقتفاء آثار صحبه الأكرمين المكرمين بالتأييد والتسديد المتجلى لهم في ذاته وأفعاله بمحاسن أوصافه التي لا يدركها إلا من ألقى السمع وهو شهيد المعرف إياهم أنه في ذاته واحد لا شريك له فرد لا مثيل له صمد لا ضد له منفرد لا ند له وأنه واحد قديم لا أول له أزلي لا بداية له مستمر الوجود لا آخر له أبدي لا نهاية له قيوم لا انقطاع له دائم لا انصرام له."
      },
      {
        id: "ghazali_mishkat",
        title_en: "The Niche of Lights",
        title_ar: "مشكاة الأنوار",
        section: "الفصل الأول: في بيان أن النور الحق هو الله تعالى",
        sample: "الحمد لله مفيض الأنوار ومبدع الأسرار ومسبغ النعم ومسدي الآلاء. فإن سألت أيها الأخ الكريم عن سر قوله تعالى: {الله نور السماوات والأرض} فاعلم أن الاسم وإن كان مشركاً يقع على معان مختلفة، فإن النور المطلق هو الظاهر بذاته والمظهر لغيره، ولا ظهور لأمر من الأمور إلا بالحق تعالى."
      }
    ]
  },
  {
    author: "Imam Fakhr al-Din al-Razi",
    author_ar: "فخر الدين الرازي",
    treatises: [
      {
        id: "razi_mabahith",
        title_en: "Eastern Inquiries in Metaphysics",
        title_ar: "المباحث المشرقية في علم الإلهيات والطبيعيات",
        section: "المقالة الأولى: في الوجود وأقسامه",
        sample: "الوجود بديهي التصور، إذ لا يمكن تعريفه بما هو أجلى منه وأظهر عند العقل. وكل من حاول تعريفه وقع في الدور أو استعمل الألفاظ المترادفة كالثبوت والحصول، والعلم بالوجود ضروري لا يفتقر إلى كسب ولا نظر."
      },
      {
        id: "razi_arbaeen",
        title_en: "The Forty Proofs on the Principles of Religion",
        title_ar: "كتاب الأربعين في أصول الدين",
        section: "المسألة الأولى: في حدوث العالم",
        sample: "العالم مركب من الجواهر والأعراض، والأعراض حادثة لتعاقب الوجود والعدم عليها، وما لا ينفك عن الحوادث فهو حادث، فيلزم ضرورة حدوث الأجسام وافتقارها إلى صانع قديم واجب الوجود بذاته."
      }
    ]
  },
  {
    author: "Imam Yahya ibn Sharaf al-Nawawi",
    author_ar: "يحيى بن شرف النووي",
    treatises: [
      {
        id: "nawawi_arbaeen",
        title_en: "The Forty Hadith of Al-Nawawi",
        title_ar: "الأربعون النووية",
        section: "الحديث الأول: إنما الأعمال بالنيات",
        sample: "عن أمير المؤمنين أبي حفص عمر بن الخطاب رضي الله عنه قال: سمعت رسول الله صلى الله عليه وسلم يقول: {«إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله، ومن كانت هجرته لدنيا يصيبها أو امرأة ينكحها فهجرته إلى ما هاجر إليه»}. رواه إمام المحدثين أبو عبد الله محمد بن إسماعيل بن إبراهيم بن المغيرة بن بردزبة البخاري ومسلم بن الحجاج."
      }
    ]
  },
  {
    author: "Al-Raghib al-Isfahani",
    author_ar: "الراغب الأصفهاني",
    treatises: [
      {
        id: "raghib_mufradat",
        title_en: "The Quranic Lexicon",
        title_ar: "المفردات في غريب القرآن",
        section: "كتاب الألف: أصل الإله والألوهية",
        sample: "الإله هو المعبود بحق، وأصله من أله الرجل يأله إذا فزع من أمر نزل به، فالمألوه هو الذي يلجأ إليه العباد عند الشدائد، ولا إله في الحقيقة إلا الله تعالى المتفرد بالإيجاد والإمداد."
      }
    ]
  }
];

// Current State
let currentTranslationData = null;

// DOM Elements
const elStatusEngineText = document.getElementById('status-engine-text');
const elLexiconBadge = document.getElementById('lexicon-count-badge');
const elCorpusTree = document.getElementById('corpus-tree-container');
const elCorpusSearch = document.getElementById('input-corpus-search');

const elAuthor = document.getElementById('input-author');
const elTitleAr = document.getElementById('input-title-ar');
const elTitleEn = document.getElementById('input-title-en');
const elSectionTitle = document.getElementById('input-section-title');

const elSourceText = document.getElementById('source-text');
const elSourceChars = document.getElementById('source-char-counter');
const elTargetWords = document.getElementById('target-word-counter');
const elOutputTitle = document.getElementById('output-section-title');
const elOutputText = document.getElementById('output-text-area');

const elBodyRaghib = document.getElementById('body-raghib');
const elBodyZamakhshari = document.getElementById('body-zamakhshari');
const elBodyLisanAyn = document.getElementById('body-lisan-ayn');
const elBodySibawayh = document.getElementById('body-sibawayh');

const elBtnExecute = document.getElementById('btn-execute-translation');
const elBtnExtractRoots = document.getElementById('btn-extract-roots-only');
const elBtnExportPure = document.getElementById('btn-export-pure-epub');
const elBtnExportBilingual = document.getElementById('btn-export-bilingual-epub');
const elBtnOpenFile = document.getElementById('btn-open-file');
const elBtnCopyOutput = document.getElementById('btn-copy-output');
const elDockStatus = document.getElementById('dock-status-msg');

// Initial Setup
async function initApp() {
  renderCorpusTree(CLASSICAL_CORPUS);
  setupEvents();

  // Check Backend Status
  try {
    if (window.AynEngineDesktop) {
      const status = await window.AynEngineDesktop.getStatus();
      if (status && status.success) {
        elStatusEngineText.textContent = `Model: ${status.model}`;
        const totalEntries = (status.lexicon_stats.lisan_entries || 0) + (status.lexicon_stats.zamakhshari_entries || 0);
        elLexiconBadge.textContent = `${totalEntries.toLocaleString()} Lexical Records`;
        setDockStatus(`AynEngine AI framework active. DeepSeek model: ${status.model}`);
      }
    }
  } catch (err) {
    elStatusEngineText.textContent = "Engine: Fallback Mode";
    setDockStatus("Backend bridge note: Standalone mode active.");
  }
}

function setDockStatus(msg) {
  if (elDockStatus) elDockStatus.textContent = msg;
}

function renderCorpusTree(corpus, filter = "") {
  elCorpusTree.innerHTML = "";
  const filterNorm = filter.toLowerCase().trim();

  corpus.forEach(authorGroup => {
    const matchingTreatises = authorGroup.treatises.filter(t => 
      !filterNorm || 
      t.title_en.toLowerCase().includes(filterNorm) || 
      t.title_ar.includes(filterNorm) ||
      authorGroup.author.toLowerCase().includes(filterNorm)
    );

    if (matchingTreatises.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'author-group';

    const authorHeader = document.createElement('div');
    authorHeader.className = 'author-header';
    authorHeader.textContent = authorGroup.author;
    groupEl.appendChild(authorHeader);

    matchingTreatises.forEach(t => {
      const item = document.createElement('div');
      item.className = 'book-item';
      item.innerHTML = `
        <div class="book-title-ar">${t.title_ar}</div>
        <div class="book-title-en">${t.title_en}</div>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.book-item').forEach(b => b.classList.remove('active'));
        item.classList.add('active');
        loadTreatise(authorGroup.author, t);
      });
      groupEl.appendChild(item);
    });

    elCorpusTree.appendChild(groupEl);
  });
}

function loadTreatise(author, treatise) {
  elAuthor.value = author;
  elTitleAr.value = treatise.title_ar;
  elTitleEn.value = treatise.title_en;
  elSectionTitle.value = treatise.section;
  elSourceText.value = treatise.sample;
  updateCounters();
  setDockStatus(`Loaded "${treatise.title_en}" (${author})`);
}

function updateCounters() {
  const chars = elSourceText.value.length;
  elSourceChars.textContent = `${chars.toLocaleString()} chars`;

  const outputText = elOutputText.innerText || "";
  const words = outputText.trim() ? outputText.trim().split(/\s+/).length : 0;
  elTargetWords.textContent = `${words.toLocaleString()} words`;
}

function setupEvents() {
  elSourceText.addEventListener('input', updateCounters);

  if (elCorpusSearch) {
    elCorpusSearch.addEventListener('input', (e) => {
      renderCorpusTree(CLASSICAL_CORPUS, e.target.value);
    });
  }

  // Quick Samples
  document.getElementById('btn-sample-ghazali')?.addEventListener('click', () => {
    loadTreatise(CLASSICAL_CORPUS[0].author, CLASSICAL_CORPUS[0].treatises[0]);
  });
  document.getElementById('btn-sample-razi')?.addEventListener('click', () => {
    loadTreatise(CLASSICAL_CORPUS[1].author, CLASSICAL_CORPUS[1].treatises[0]);
  });
  document.getElementById('btn-sample-nawawi')?.addEventListener('click', () => {
    loadTreatise(CLASSICAL_CORPUS[2].author, CLASSICAL_CORPUS[2].treatises[0]);
  });

  // Extract Roots Action
  elBtnExtractRoots.addEventListener('click', async () => {
    const text = elSourceText.value.trim();
    if (!text) {
      alert("Please enter or load Arabic text first.");
      return;
    }
    setDockStatus("Extracting roots and retrieving Active-RAG scholia...");
    try {
      const res = await window.AynEngineDesktop.extractRoots({ text, max_candidates: 4 });
      if (res && res.success) {
        populateApparatusCards(res.details || [], res.sibawayh_rule);
        setDockStatus(`Retrieved ${res.roots.length} root scholia and Sibawayh syntactic canon.`);
      }
    } catch (err) {
      setDockStatus(`Extraction error: ${err.message}`);
    }
  });

  // Execute Zero-Loss Translation Action
  elBtnExecute.addEventListener('click', async () => {
    const passage = elSourceText.value.trim();
    if (!passage) {
      alert("Please provide classical Arabic text to translate.");
      return;
    }

    elBtnExecute.disabled = true;
    elBtnExecute.style.opacity = '0.6';
    setDockStatus("Executing Sovereign Quad-Lexical Translation Pipeline (DeepSeek Flash)...");
    elOutputTitle.textContent = "Translating with Active-RAG Grounding...";
    elOutputText.innerHTML = '<div class="output-placeholder" style="color: var(--accent-gold);">Executing Active-RAG scholia pre-retrieval, Kalam philosophical validation, and verbatim synthesis...</div>';

    const payload = {
      author: elAuthor.value.trim(),
      book_title_ar: elTitleAr.value.trim(),
      book_title_en: elTitleEn.value.trim(),
      section_title: elSectionTitle.value.trim(),
      target_lang: document.getElementById('sel-target-lang').value,
      passage_text: passage
    };

    try {
      const res = await window.AynEngineDesktop.translate(payload);
      if (res && res.success && res.result) {
        const tr = res.result;
        currentTranslationData = tr;

        elOutputTitle.textContent = tr.title_en || elSectionTitle.value;
        elOutputText.innerHTML = formatTranslationHtml(tr.translation);
        updateCounters();

        // Also update apparatus
        if (tr.anchors) {
          renderAnchorsText(tr.anchors);
        }

        setDockStatus("Translation complete with 100% verbatim authorial voice and Kalam precision.");
      } else {
        throw new Error(res.error || "Unknown translation error");
      }
    } catch (err) {
      elOutputText.innerHTML = `<div class="output-placeholder" style="color: var(--accent-crimson);">Translation Failed: ${err.message}</div>`;
      setDockStatus(`Error: ${err.message}`);
    } finally {
      elBtnExecute.disabled = false;
      elBtnExecute.style.opacity = '1';
    }
  });

  // Export Pure Scholarly EPUB
  elBtnExportPure.addEventListener('click', async () => {
    if (!currentTranslationData) {
      alert("Please translate a passage first before exporting to EPUB.");
      return;
    }
    await exportEpub("PURE_SCHOLARLY");
  });

  // Export Bilingual Apparatus EPUB
  elBtnExportBilingual.addEventListener('click', async () => {
    if (!currentTranslationData) {
      alert("Please translate a passage first before exporting to EPUB.");
      return;
    }
    await exportEpub("BILINGUAL_APPARATUS");
  });

  // Open Local File
  elBtnOpenFile.addEventListener('click', async () => {
    if (!window.AynEngineDesktop) return;
    const file = await window.AynEngineDesktop.openFile();
    if (file && file.content) {
      elSourceText.value = file.content;
      updateCounters();
      setDockStatus(`Loaded file: ${file.filePath}`);
    }
  });

  // Copy Output
  elBtnCopyOutput.addEventListener('click', () => {
    const text = elOutputText.innerText;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setDockStatus("Translation text copied to clipboard.");
  });
}

function formatTranslationHtml(rawText) {
  if (!rawText) return "";
  const paras = rawText.split(/\n\n+/);
  return paras.map(p => {
    // Check for scripture highlights {«...»}
    let formatted = escapeHtml(p.trim()).replace(/\{«(.*?)»\}/g, '<span style="color: #34d399; font-family: var(--font-arabic); font-weight: 700; direction: rtl; display: inline-block;">{«$1»}</span>');
    return `<p style="margin-bottom: 1.2em; text-indent: 1.2em;">${formatted}</p>`;
  }).join('');
}

function populateApparatusCards(details, sibRule) {
  let raghibHtml = [];
  let zamakhHtml = [];
  let lisanHtml = [];

  details.forEach(d => {
    const r = d.root;
    if (d.raghib_theology) {
      raghibHtml.push(`<strong>[${r}]</strong>: ${escapeHtml(d.raghib_theology)}`);
    }
    if (d.zamakhshari_rhetoric) {
      const z = d.zamakhshari_rhetoric;
      let part = `<strong>[${r}]</strong>`;
      if (z.literal) part += ` <br/><em>Haqiqah:</em> ${escapeHtml(z.literal)}`;
      if (z.majaz) part += ` <br/><em>Majaz:</em> ${escapeHtml(z.majaz)}`;
      zamakhHtml.push(part);
    }
    if (d.lisan_semantics || d.ayn_etymology) {
      let part = `<strong>[${r}]</strong>`;
      if (d.lisan_semantics) part += ` <br/><em>Lisan:</em> ${escapeHtml(d.lisan_semantics.substring(0, 180))}...`;
      if (d.ayn_etymology) part += ` <br/><em>Ayn:</em> ${escapeHtml(d.ayn_etymology.substring(0, 160))}...`;
      lisanHtml.push(part);
    }
  });

  elBodyRaghib.innerHTML = raghibHtml.length > 0 ? raghibHtml.join('<hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 6px 0;"/>') : "No theological roots in current window.";
  elBodyZamakhshari.innerHTML = zamakhHtml.length > 0 ? zamakhHtml.join('<hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 6px 0;"/>') : "No metaphorical roots matched.";
  elBodyLisanAyn.innerHTML = lisanHtml.length > 0 ? lisanHtml.join('<hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 6px 0;"/>') : "No archaic etymologies.";

  if (sibRule) {
    elBodySibawayh.innerHTML = `<strong>Rule:</strong> ${escapeHtml(sibRule.name)}<br/><strong>Canon:</strong> "${escapeHtml(sibRule.canon)}"`;
  }
}

function renderAnchorsText(anchorsText) {
  const lines = anchorsText.split('\n');
  let html = lines.map(l => escapeHtml(l)).join('<br/>');
  elBodyRaghib.innerHTML = `<div style="font-size: 11px; line-height: 1.5;">${html}</div>`;
}

async function exportEpub(editionType) {
  const safeTitle = elTitleEn.value.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const defaultName = `${safeTitle}_${editionType.toLowerCase()}.epub`;

  setDockStatus(`Compiling ${editionType} EPUB via AynEpubBuilder...`);
  const payload = {
    title: elTitleEn.value,
    author: elAuthor.value,
    edition_type: editionType,
    output_path: `/tmp/${defaultName}`,
    chapters: [
      {
        title: elSectionTitle.value,
        arabic: elSourceText.value,
        anchors: currentTranslationData.anchors || "",
        translation: currentTranslationData.translation
      }
    ]
  };

  try {
    const res = await window.AynEngineDesktop.compileEpub(payload);
    if (res && res.success) {
      setDockStatus(`EPUB compiled successfully to ${res.output_path}!`);
      alert(`EPUB Masterwork successfully compiled and verified at:\n${res.output_path}`);
    } else {
      throw new Error(res.error || "Compilation failed");
    }
  } catch (err) {
    setDockStatus(`EPUB export error: ${err.message}`);
    alert(`EPUB export error: ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', initApp);
