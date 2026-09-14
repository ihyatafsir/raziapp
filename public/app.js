/**
 * RaziApp Mobile: Sovereign Dialectical EPUB Reader & Scholarly Arabic Recitation
 * Grounded in Imam Fakhr al-Din al-Razi's 'Jami al-Ulum' & 'Al-Matalib al-Aliyah'
 * Mobile-Only Controller with Fullscreen EPUB Side Page Wipe (v2.3.0)
 * Strictly Zero Emojis
 */

'use strict';

// --- Application State ---
const state = {
  books: [],
  activeBook: null,
  activeBookId: null,
  toc: [],
  activeChapterIndex: 0,
  activeChapterHref: null,
  chapterData: null,
  activeParagraphIndex: 0,
  dialecticsEnabled: true,
  currentTheme: localStorage.getItem('raziapp_theme') || 'nocturne',
  fontSizeRem: parseFloat(localStorage.getItem('raziapp_fontsize') || '1.1'),
  fontFamily: localStorage.getItem('raziapp_font_family') || 'georgia',
  lineSpacing: localStorage.getItem('raziapp_line_spacing') || '1.85',
  isPlayingArabic: false,
  aiContextParagraph: null,
  // Hierarchical Imam, Topic & Version State
  activeImam: 'all',
  activeTopic: 'all',
  activeFormat: 'all',
  v4V5Only: true,
  searchQuery: '',
  taxonomy: null,
  // Fullscreen EPUB Page Mode State
  isEpubMode: false,
  epubPages: [],
  currentEpubPageIndex: 0,
  isHudVisible: true,
  isTypographyOpen: false
};

// --- Android & API Bridge Utilities ---
function getApiUrl(endpoint) {
  let base = '';
  if (window.AndroidBridge && typeof window.AndroidBridge.getApiBase === 'function') {
    try {
      base = window.AndroidBridge.getApiBase() || '';
    } catch (_) {}
  }
  if (!base) {
    base = localStorage.getItem('raziapp_api_base') || '';
  }
  base = base.replace(/\/+$/, '');
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }
  return base ? `${base}${endpoint}` : endpoint;
}

// Resilient fast fetch wrapper with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

let offlineStoreCache = null;
async function getOfflineStore() {
  if (offlineStoreCache) return offlineStoreCache;
  try {
    const res = await fetch('offline_store.json');
    if (res.ok) {
      offlineStoreCache = await res.json();
      return offlineStoreCache;
    }
  } catch (_) {}
  return null;
}

function updateServerStatus(online, label = '') {
  const dot = document.getElementById('server-status-dot');
  if (dot) {
    dot.className = `status-indicator-dot ${online ? 'online' : 'offline'}`;
  }
}

window.handleAndroidBack = function() {
  if (state.isEpubMode) {
    exitEpubMode();
    return true;
  }
  const modalServer = document.getElementById('modal-server');
  if (modalServer && modalServer.classList.contains('active')) {
    modalServer.classList.remove('active');
    return true;
  }
  const searchModal = document.getElementById('modal-search') || document.getElementById('search-modal');
  if (searchModal && (searchModal.classList.contains('active') || !searchModal.classList.contains('hidden'))) {
    searchModal.classList.remove('active');
    searchModal.classList.add('hidden');
    return true;
  }
  const libraryModal = document.getElementById('modal-library') || document.getElementById('library-modal');
  if (libraryModal && (libraryModal.classList.contains('active') || !libraryModal.classList.contains('hidden'))) {
    closeLibraryModal();
    return true;
  }
  const tocDrawer = document.getElementById('toc-drawer');
  if (tocDrawer && tocDrawer.classList.contains('open')) {
    closeTocSidebar();
    return true;
  }
  const aiDrawer = document.getElementById('ai-drawer');
  if (aiDrawer && aiDrawer.classList.contains('open')) {
    closeAiDrawer();
    return true;
  }
  return false;
};



// --- Theme Definitions & Minimalist Inline SVGs ---
const THEMES = ['nocturne', 'emerald', 'sepia', 'pristine'];
const THEME_ICONS = {
  nocturne: '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  emerald: '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  sepia: '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  pristine: '<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>'
};

// --- Lifecycle Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(state.currentTheme);
  initTypographyEngine();
  initFullscreenEngine();
  initEventListeners();
  initEpubPageTurnEngine();
  initAudioEngine();
  initScrollProgressTracker();
  initKeyboardNavigation();
  initReaderSwipeNavigation();
  initTranslationStudio();
  await loadLibrary();
});

// --- Theme Engine ---
function applyTheme(themeName) {
  if (!THEMES.includes(themeName)) themeName = 'nocturne';
  state.currentTheme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('raziapp_theme', themeName);
  
  const iconSpan = document.getElementById('theme-svg-icon');
  if (iconSpan && THEME_ICONS[themeName]) {
    iconSpan.innerHTML = THEME_ICONS[themeName];
  }
}

function cycleTheme() {
  const currentIndex = THEMES.indexOf(state.currentTheme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
  applyTheme(nextTheme);
  showToast(`Theme: ${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}`);
}

// --- Fullscreen Engine ---
function initFullscreenEngine() {
  const btnFs = document.getElementById('btn-epub-fullscreen');
  btnFs?.addEventListener('click', toggleFullscreen);

  document.addEventListener('fullscreenchange', updateFullscreenIcons);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcons);
}

function toggleFullscreen() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFs) {
    const el = document.getElementById('app-shell') || document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function updateFullscreenIcons() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const btnFs = document.getElementById('btn-epub-fullscreen');
  if (!btnFs) return;
  const enterIcon = btnFs.querySelector('.fs-enter');
  const exitIcon = btnFs.querySelector('.fs-exit');
  if (enterIcon && exitIcon) {
    enterIcon.classList.toggle('hidden', isFs);
    exitIcon.classList.toggle('hidden', !isFs);
  }
}

// --- Typography Engine ---
function initTypographyEngine() {
  updateTypographyStyles();

  // Typography Panel Open / Close
  document.getElementById('btn-epub-typography')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTypographyPanel();
  });
  document.getElementById('btn-close-typography')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTypographyPanel();
  });

  // Font Size Buttons
  document.getElementById('btn-font-smaller')?.addEventListener('click', (e) => {
    e.stopPropagation();
    adjustFontSize(-0.1);
  });
  document.getElementById('btn-font-larger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    adjustFontSize(0.1);
  });

  // Font Family Chips
  const fontChips = document.querySelectorAll('.typo-family-chips .typo-font-chip');
  fontChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      fontChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const font = chip.getAttribute('data-font') || 'georgia';
      state.fontFamily = font;
      localStorage.setItem('raziapp_font_family', font);
      updateTypographyStyles();
    });
  });

  // Spacing Chips
  const spacingChips = document.querySelectorAll('.typo-spacing-chips .spacing-chip');
  spacingChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      spacingChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const spacing = chip.getAttribute('data-spacing') || '1.85';
      state.lineSpacing = spacing;
      localStorage.setItem('raziapp_line_spacing', spacing);
      updateTypographyStyles();
    });
  });

  // Theme Choice Buttons inside panel
  const themeBtns = document.querySelectorAll('.typo-theme-grid .theme-choice-btn');
  themeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const theme = btn.getAttribute('data-theme-choice');
      if (theme) {
        applyTheme(theme);
        showToast(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
      }
    });
  });
}

function adjustFontSize(delta) {
  let newSize = Math.max(0.8, Math.min(1.8, state.fontSizeRem + delta));
  state.fontSizeRem = Math.round(newSize * 10) / 10;
  localStorage.setItem('raziapp_fontsize', state.fontSizeRem.toString());
  updateTypographyStyles();
}

function updateTypographyStyles() {
  document.documentElement.style.setProperty('--reader-size', `${state.fontSizeRem}rem`);
  document.documentElement.style.setProperty('--reader-line-height', `${state.lineSpacing}`);

  const display = document.getElementById('font-size-val');
  if (display) {
    const pct = Math.round((state.fontSizeRem / 1.1) * 100);
    display.textContent = `${pct}%`;
  }

  // Update font family chips active state
  const fontChips = document.querySelectorAll('.typo-family-chips .typo-font-chip');
  fontChips.forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-font') === state.fontFamily);
  });

  // Update spacing chips active state
  const spacingChips = document.querySelectorAll('.typo-spacing-chips .spacing-chip');
  spacingChips.forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-spacing') === state.lineSpacing);
  });

  // Update slide classes
  const slides = document.querySelectorAll('.epub-page-slide');
  slides.forEach(slide => {
    slide.className = `epub-page-slide font-${state.fontFamily}`;
  });
}

function toggleTypographyPanel() {
  state.isTypographyOpen = !state.isTypographyOpen;
  const panel = document.getElementById('epub-typography-panel');
  if (panel) {
    panel.classList.toggle('open', state.isTypographyOpen);
  }
}

function closeTypographyPanel() {
  state.isTypographyOpen = false;
  const panel = document.getElementById('epub-typography-panel');
  if (panel) {
    panel.classList.remove('open');
  }
}

// --- Scroll Progress Tracker ---
function initScrollProgressTracker() {
  const viewport = document.getElementById('reader-viewport');
  const progressBar = document.getElementById('reader-scroll-progress');
  if (!viewport || !progressBar) return;

  viewport.addEventListener('scroll', () => {
    const scrollHeight = viewport.scrollHeight - viewport.clientHeight;
    if (scrollHeight > 0) {
      const scrollPct = (viewport.scrollTop / scrollHeight) * 100;
      progressBar.style.width = `${Math.min(100, Math.max(0, scrollPct))}%`;
    }
  }, { passive: true });
}

// --- Keyboard Navigation Shortcuts ---
function initKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    if (['input', 'textarea', 'select'].includes(document.activeElement?.tagName?.toLowerCase())) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
        closeAllDrawers();
      }
      return;
    }

    if (state.isEpubMode) {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case 'j':
        case 'J':
        case ' ':
          e.preventDefault();
          nextEpubPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'k':
        case 'K':
        case 'Backspace':
          e.preventDefault();
          prevEpubPage();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'Escape':
          if (state.isTypographyOpen) {
            closeTypographyPanel();
          } else {
            exitEpubMode();
          }
          break;
        case 'm':
        case 'M':
          cycleTheme();
          break;
        case 't':
        case 'T':
          toggleTocSidebar();
          break;
      }
      return;
    }

    switch (e.key) {
      case 'e':
      case 'E':
        enterEpubMode();
        break;
      case 't':
      case 'T':
        toggleTocSidebar();
        break;
      case 'l':
      case 'L':
        openLibraryModal();
        break;
      case 's':
      case 'S':
      case '/':
        e.preventDefault();
        openSearchModal();
        break;
      case 'd':
      case 'D':
        toggleDialectics();
        break;
      case 'a':
      case 'A':
        toggleAiDrawer();
        break;
      case 'm':
      case 'M':
        cycleTheme();
        break;
      case 'Escape':
        closeAllDrawers();
        break;
    }
  });
}

// --- Event Listeners Setup ---
function initEventListeners() {
  // Backdrop closes sheets
  document.getElementById('drawer-backdrop')?.addEventListener('click', closeAllDrawers);

  // Taqsim (TOC) Toggles
  document.getElementById('btn-open-sidebar')?.addEventListener('click', toggleTocSidebar);
  document.getElementById('btn-close-toc')?.addEventListener('click', closeTocSidebar);
  document.getElementById('mb-btn-toc')?.addEventListener('click', toggleTocSidebar);
  document.getElementById('btn-epub-toc-quick')?.addEventListener('click', toggleTocSidebar);
  document.getElementById('btn-epub-header-title')?.addEventListener('click', toggleTocSidebar);

  // Library Modal Toggles
  document.getElementById('btn-open-library')?.addEventListener('click', openLibraryModal);
  document.getElementById('btn-close-library')?.addEventListener('click', closeLibraryModal);
  document.getElementById('mb-btn-library')?.addEventListener('click', openLibraryModal);
  document.getElementById('brand-home')?.addEventListener('click', openLibraryModal);

  // Fullscreen EPUB Mode Toggles
  document.getElementById('btn-enter-epub-mode')?.addEventListener('click', enterEpubMode);
  document.getElementById('mb-btn-reader-mode')?.addEventListener('click', () => {
    if (state.isEpubMode) exitEpubMode();
    else enterEpubMode();
  });
  document.getElementById('btn-exit-epub-mode')?.addEventListener('click', exitEpubMode);
  document.getElementById('btn-epub-theme-quick')?.addEventListener('click', cycleTheme);

  // AynEngine AI Translation Studio Openers
  document.getElementById('mb-btn-aynengine')?.addEventListener('click', openTranslationStudio);
  document.getElementById('banner-open-studio')?.addEventListener('click', openTranslationStudio);
  document.getElementById('btn-banner-launch-studio')?.addEventListener('click', (e) => { e.stopPropagation(); openTranslationStudio(); });
  document.getElementById('btn-open-translation-studio')?.addEventListener('click', openTranslationStudio);

  // Standalone Whole-Codex EPUB Share
  document.getElementById('btn-share-epub')?.addEventListener('click', shareCurrentBookEpub);

  // In-Book Search
  document.getElementById('btn-open-search')?.addEventListener('click', openSearchModal);
  document.getElementById('btn-close-search')?.addEventListener('click', closeSearchModal);
  document.getElementById('mb-btn-search')?.addEventListener('click', openSearchModal);
  
  // Server Settings Modal Listeners
  const modalServer = document.getElementById('modal-server');
  const serverInput = document.getElementById('server-url-input');
  const serverTestOut = document.getElementById('server-test-output');

  function openServerModal() {
    if (modalServer) {
      modalServer.classList.add('active');
      if (serverInput) {
        serverInput.value = localStorage.getItem('raziapp_api_base') || (window.AndroidBridge?.getApiBase ? window.AndroidBridge.getApiBase() : 'http://10.20.102.177:5200');
      }
    }
  }

  function closeServerModal() {
    if (modalServer) modalServer.classList.remove('active');
  }

  document.getElementById('btn-open-server-modal')?.addEventListener('click', openServerModal);
  document.getElementById('btn-close-server')?.addEventListener('click', closeServerModal);

  document.getElementById('btn-preset-lan')?.addEventListener('click', () => {
    if (serverInput) serverInput.value = 'http://10.20.102.177:5200';
  });
  document.getElementById('btn-preset-local')?.addEventListener('click', () => {
    if (serverInput) serverInput.value = 'http://127.0.0.1:5200';
  });
  document.getElementById('btn-preset-offline')?.addEventListener('click', () => {
    if (serverInput) serverInput.value = '';
    if (serverTestOut) serverTestOut.textContent = 'Standalone mode selected (using bundled 193-volume offline store)';
  });

  document.getElementById('btn-test-connection')?.addEventListener('click', async () => {
    const url = (serverInput?.value || '').trim().replace(/\/+$/, '');
    if (!url) {
      if (serverTestOut) serverTestOut.textContent = 'Offline standalone mode active (no server needed).';
      return;
    }
    if (serverTestOut) serverTestOut.textContent = 'Testing link to ' + url + '...';
    try {
      const t0 = performance.now();
      const res = await fetchWithTimeout(url + '/api/health', {}, 2500);
      const ms = Math.round(performance.now() - t0);
      if (res.ok) {
        const d = await res.json();
        if (serverTestOut) {
          serverTestOut.innerHTML = `<span style="color: var(--brand-emerald); font-weight: 700;">Online (${ms}ms)</span> - ${d.total_books} classical masterworks available.`;
        }
        updateServerStatus(true, 'Online');
      } else {
        if (serverTestOut) serverTestOut.innerHTML = `<span style="color: #ef4444;">Server error (HTTP ${res.status})</span>`;
        updateServerStatus(false, 'Error');
      }
    } catch (e) {
      if (serverTestOut) serverTestOut.innerHTML = `<span style="color: #ef4444;">Unreachable</span> (${e.message || 'connection failed'})`;
      updateServerStatus(false, 'Offline');
    }
  });

  document.getElementById('btn-save-connection')?.addEventListener('click', async () => {
    const url = (serverInput?.value || '').trim().replace(/\/+$/, '');
    localStorage.setItem('raziapp_api_base', url);
    if (window.AndroidBridge && typeof window.AndroidBridge.setApiBase === 'function') {
      try { window.AndroidBridge.setApiBase(url); } catch (_) {}
    }
    closeServerModal();
    showToast(url ? `Connected to ${url}` : 'Switched to Standalone Offline Mode');
    await loadLibrary();
  });

  
  let searchDebounce = null;
  document.getElementById('inbook-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    const query = e.target.value.trim();
    searchDebounce = setTimeout(() => handleInBookSearch(query), 300);
  });

  // Version Toggle Controls (v4 & v5 Master vs All)
  const btnV4V5 = document.getElementById('btn-toggle-v4-v5');
  const btnAllVer = document.getElementById('btn-toggle-all-versions');

  btnV4V5?.addEventListener('click', () => {
    btnV4V5.classList.add('active');
    btnAllVer?.classList.remove('active');
    state.v4V5Only = true;
    renderLibraryGrid();
  });

  btnAllVer?.addEventListener('click', () => {
    btnAllVer.classList.add('active');
    btnV4V5?.classList.remove('active');
    state.v4V5Only = false;
    renderLibraryGrid();
  });

  // Format Filter Chips (All, Pure English, v5 Pure, v4 Pure, Bilingual, v5 Master, v4 Pro)
  const formatChips = document.querySelectorAll('#format-filter-chips .format-chip');
  formatChips.forEach(chip => {
    chip.addEventListener('click', () => {
      formatChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFormat = chip.getAttribute('data-format') || 'all';
      renderLibraryGrid();
    });
  });

  // 1. Imam / Author Filter Chips
  const imamChips = document.querySelectorAll('#imam-filter-chips .filter-chip');
  imamChips.forEach(chip => {
    chip.addEventListener('click', () => {
      imamChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeImam = chip.getAttribute('data-imam') || 'all';
      renderLibraryGrid();
    });
  });

  // 2. Epistemic Topic Filter Chips
  const topicChips = document.querySelectorAll('#topic-filter-chips .topic-chip');
  topicChips.forEach(chip => {
    chip.addEventListener('click', () => {
      topicChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeTopic = chip.getAttribute('data-topic') || 'all';
      renderLibraryGrid();
    });
  });

  // Library Search Input
  document.getElementById('library-search')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderLibraryGrid();
  });

  // Dialectics Highlight Toggles
  document.getElementById('btn-toggle-dialectics')?.addEventListener('click', toggleDialectics);

  // Theme Toggle
  document.getElementById('btn-toggle-theme')?.addEventListener('click', cycleTheme);

  // AI Assistant Drawer Toggles
  document.getElementById('btn-toggle-ai')?.addEventListener('click', toggleAiDrawer);
  document.getElementById('btn-close-ai')?.addEventListener('click', closeAiDrawer);
  document.getElementById('mb-btn-ai')?.addEventListener('click', toggleAiDrawer);

  // AI Prompt Chips
  const aiChips = document.querySelectorAll('.ai-chips-scroll .chip-btn');
  aiChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        const input = document.getElementById('ai-input-text');
        if (input) input.value = prompt;
        handleAiSubmit();
      }
    });
  });

  // AI Send Button
  document.getElementById('btn-send-ai')?.addEventListener('click', handleAiSubmit);
  document.getElementById('ai-input-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAiSubmit();
    }
  });

  // Arabic Audio Dock Controls
  document.getElementById('btn-audio-play-pause')?.addEventListener('click', toggleArabicAudio);
  document.getElementById('btn-audio-stop')?.addEventListener('click', stopArabicAudio);

  // TOC Search Filter
  document.getElementById('toc-search')?.addEventListener('input', (e) => {
    filterTocList(e.target.value.toLowerCase().trim());
  });
}

// ==========================================================================
// FULLSCREEN EPUB PAGINATION & SIDE PAGE WIPE ENGINE
// ==========================================================================

function initEpubPageTurnEngine() {
  const tapPrev = document.getElementById('epub-tap-prev');
  const tapNext = document.getElementById('epub-tap-next');
  const tapCenter = document.getElementById('epub-tap-center');
  const btnPrev = document.getElementById('btn-epub-prev-page');
  const btnNext = document.getElementById('btn-epub-next-page');
  const viewport = document.getElementById('epub-stage-viewport');
  const wipeShadow = document.getElementById('epub-wipe-shadow');

  tapPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    pulseEdgeIndicator('left');
    prevEpubPage();
  });

  tapNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    pulseEdgeIndicator('right');
    nextEpubPage();
  });

  tapCenter?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.isTypographyOpen) {
      closeTypographyPanel();
    } else {
      toggleEpubHud();
    }
  });

  btnPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    pulseEdgeIndicator('left');
    prevEpubPage();
  });

  btnNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    pulseEdgeIndicator('right');
    nextEpubPage();
  });

  // Touch Swipe Gesture Handling with Resistance, Velocity & Wipe Animation
  if (viewport) {
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let startTime = 0;
    let isSwiping = false;

    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      deltaX = 0;
      isSwiping = true;

      const track = document.getElementById('epub-pages-track');
      if (track) track.style.transition = 'none';
      if (wipeShadow) wipeShadow.style.transition = 'none';
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (!isSwiping || e.touches.length !== 1) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY) + 4) {
        const track = document.getElementById('epub-pages-track');
        if (track) {
          const currentOffset = -state.currentEpubPageIndex * 100;
          const pxOffsetPct = (deltaX / viewport.clientWidth) * 100;
          track.style.transform = `translate3d(${currentOffset + pxOffsetPct}%, 0, 0)`;
        }

        if (wipeShadow) {
          const shadowOpacity = Math.min(0.85, Math.abs(deltaX) / (viewport.clientWidth * 0.4));
          wipeShadow.style.opacity = shadowOpacity.toString();
        }
      }
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;
      const timeElapsed = Math.max(1, Date.now() - startTime);
      const velocity = Math.abs(deltaX) / timeElapsed; // px per ms

      const track = document.getElementById('epub-pages-track');
      if (track) {
        track.style.transition = 'transform 0.32s cubic-bezier(0.18, 0.9, 0.25, 1)';
      }
      if (wipeShadow) {
        wipeShadow.style.transition = 'opacity 0.25s ease';
        wipeShadow.style.opacity = '0';
      }

      // Quick flick or drag past threshold
      const isFlick = velocity > 0.38 && Math.abs(deltaX) > 20;
      const isDrag = Math.abs(deltaX) > 42;

      if ((deltaX < 0 && (isFlick || isDrag))) {
        pulseEdgeIndicator('right');
        nextEpubPage();
      } else if ((deltaX > 0 && (isFlick || isDrag))) {
        pulseEdgeIndicator('left');
        prevEpubPage();
      } else {
        // Snap back to current page
        goToEpubPage(state.currentEpubPageIndex);
      }
    }, { passive: true });
  }
}

function pulseEdgeIndicator(side) {
  const el = document.querySelector(`.tap-edge-indicator.${side}-edge`);
  if (el) {
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 250);
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(10); } catch (_) {}
  }
}

function enterEpubMode() {
  state.isEpubMode = true;
  const canvas = document.getElementById('epub-reader-canvas');
  if (canvas) {
    canvas.classList.add('active');
  }

  // Notify Android native bridge for immersive fullscreen
  if (window.AndroidBridge && typeof window.AndroidBridge.toggleFullscreen === 'function') {
    try { window.AndroidBridge.toggleFullscreen(true); } catch (_) {}
  }

  // Update HUD titles
  const bookTitleEl = document.getElementById('epub-hud-book-title');
  const chapTitleEl = document.getElementById('epub-hud-chapter-title');
  if (bookTitleEl && state.activeBook) bookTitleEl.textContent = state.activeBook.title;
  if (chapTitleEl && state.chapterData) chapTitleEl.textContent = state.chapterData.title;

  // Restore saved page position for this chapter if exists
  const savedKey = `raziapp_page_${state.activeBookId}_${state.activeChapterIndex}`;
  const savedPage = parseInt(localStorage.getItem(savedKey) || '0', 10);

  buildEpubPages(savedPage);
  showToast('EPUB Reading Mode: Swipe left/right to wipe pages');
}

function exitEpubMode() {
  state.isEpubMode = false;
  closeTypographyPanel();
  const canvas = document.getElementById('epub-reader-canvas');
  if (canvas) {
    canvas.classList.remove('active');
  }

  // Restore Android native system bars
  if (window.AndroidBridge && typeof window.AndroidBridge.toggleFullscreen === 'function') {
    try { window.AndroidBridge.toggleFullscreen(false); } catch (_) {}
  }

  showToast('Returned to Dialectical Stream Mode');
}

function toggleEpubHud() {
  state.isHudVisible = !state.isHudVisible;
  const header = document.getElementById('epub-hud-header');
  const footer = document.getElementById('epub-hud-footer');
  if (header && footer) {
    header.classList.toggle('hud-hidden', !state.isHudVisible);
    footer.classList.toggle('hud-hidden', !state.isHudVisible);
  }
}

function buildEpubPages(targetPageIndex = 0) {
  const track = document.getElementById('epub-pages-track');
  if (!track || !state.chapterData) return;

  const paragraphs = state.chapterData.paragraphs || [];
  if (paragraphs.length === 0) {
    track.innerHTML = `<div class="epub-page-slide font-${state.fontFamily}"><div class="page-paragraph">Empty chapter section.</div></div>`;
    state.epubPages = [0];
    updateEpubPageIndicator(0, 1);
    return;
  }

  // Dynamic Pagination: Group paragraphs into pages (~500–750 chars per page slide)
  const pages = [];
  let currentPageItems = [];
  let currentChars = 0;

  const chapterHeading = state.chapterData.title || 'Section';

  paragraphs.forEach((p, idx) => {
    const textLen = (p.text || '').length;
    
    // Page break threshold
    if (currentPageItems.length > 0 && (currentChars + textLen > 650 || (p.is_arabic && currentChars > 250))) {
      pages.push(currentPageItems);
      currentPageItems = [];
      currentChars = 0;
    }

    currentPageItems.push({
      ...p,
      originalIndex: idx
    });
    currentChars += textLen;
  });

  if (currentPageItems.length > 0) {
    pages.push(currentPageItems);
  }

  state.epubPages = pages;
  const totalPages = Math.max(1, pages.length);

  // Render Page Slides
  track.innerHTML = pages.map((pageGroup, pageIdx) => {
    return `
      <div class="epub-page-slide font-${state.fontFamily}" id="epub-slide-${pageIdx}">
        ${pageIdx === 0 ? `<h2 class="page-heading">${escapeHtml(chapterHeading)}</h2>` : ''}
        ${pageGroup.map(item => {
          const isArabic = item.is_arabic || Boolean(item.arabic);
          const dialecticType = item.dialectic_type || item.dialectic || 'exposition';
          const tagLabel = getDialecticBadgeLabel(dialecticType);

          if (isArabic) {
            return `
              <div class="page-arabic">
                <div>${escapeHtml(item.arabic || item.text)}</div>
                <button class="page-arabic-btn" onclick="event.stopPropagation(); reciteArabicParagraph(${item.originalIndex});">
                  <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span>تلاوة</span>
                </button>
              </div>
            `;
          }

          return `
            <div class="page-item-block">
              ${dialecticType !== 'exposition' ? `
                <div class="page-badge ${dialecticType}">
                  <span>${tagLabel}</span>
                </div>
              ` : ''}
              <p class="page-paragraph">${escapeHtml(item.text)}</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');

  goToEpubPage(Math.min(targetPageIndex, totalPages - 1), false);
}

function goToEpubPage(pageIdx, animate = true) {
  const totalPages = state.epubPages.length || 1;
  const clampedIdx = Math.max(0, Math.min(pageIdx, totalPages - 1));
  state.currentEpubPageIndex = clampedIdx;

  // Persist page location in localStorage
  if (state.activeBookId) {
    localStorage.setItem(`raziapp_page_${state.activeBookId}_${state.activeChapterIndex}`, clampedIdx.toString());
  }

  const track = document.getElementById('epub-pages-track');
  if (track) {
    if (!animate) track.style.transition = 'none';
    track.style.transform = `translate3d(-${clampedIdx * 100}%, 0, 0)`;
    if (!animate) {
      setTimeout(() => {
        track.style.transition = 'transform 0.32s cubic-bezier(0.18, 0.9, 0.25, 1)';
      }, 50);
    }
  }

  updateEpubPageIndicator(clampedIdx, totalPages);
}

function nextEpubPage() {
  const totalPages = state.epubPages.length || 1;
  if (state.currentEpubPageIndex < totalPages - 1) {
    goToEpubPage(state.currentEpubPageIndex + 1);
  } else {
    // Reached end of current chapter -> wipe to next chapter
    if (state.activeChapterIndex < state.toc.length - 1) {
      showToast('Wiping to next chapter...');
      const nextToc = state.toc[state.activeChapterIndex + 1];
      loadChapter(nextToc.href, state.activeChapterIndex + 1).then(() => {
        if (state.isEpubMode) {
          buildEpubPages(0);
        }
      });
    } else {
      showToast('End of Treatise');
    }
  }
}

function prevEpubPage() {
  if (state.currentEpubPageIndex > 0) {
    goToEpubPage(state.currentEpubPageIndex - 1);
  } else {
    // At first page -> wipe to previous chapter
    if (state.activeChapterIndex > 0) {
      showToast('Wiping to previous chapter...');
      const prevToc = state.toc[state.activeChapterIndex - 1];
      loadChapter(prevToc.href, state.activeChapterIndex - 1).then(() => {
        if (state.isEpubMode) {
          buildEpubPages(999); // Go to last page of prev chapter
        }
      });
    }
  }
}

function updateEpubPageIndicator(currentIdx, totalPages) {
  const counterEl = document.getElementById('epub-page-counter');
  const fillEl = document.getElementById('epub-page-progress-fill');

  if (counterEl) {
    counterEl.textContent = `Page ${currentIdx + 1} / ${totalPages}`;
  }
  if (fillEl) {
    const pct = ((currentIdx + 1) / totalPages) * 100;
    fillEl.style.width = `${pct}%`;
  }
}

// ==========================================================================
// DRAWER & MODAL MANAGEMENT
// ==========================================================================

function updateBackdrop() {
  const bd = document.getElementById('drawer-backdrop');
  const isTocOpen = document.getElementById('sidebar-toc')?.classList.contains('open');
  const isAiOpen = document.getElementById('ai-drawer')?.classList.contains('open');
  const isLibraryOpen = document.getElementById('modal-library')?.classList.contains('active');
  const isSearchOpen = document.getElementById('modal-search')?.classList.contains('active');
  const isStudioOpen = document.getElementById('modal-translation-studio')?.classList.contains('active');

  const shouldBeActive = Boolean(isTocOpen || isAiOpen || isLibraryOpen || isSearchOpen || isStudioOpen);
  if (bd) {
    bd.classList.toggle('active', shouldBeActive);
  }
}

function closeAllDrawers() {
  document.getElementById('sidebar-toc')?.classList.remove('open');
  document.getElementById('ai-drawer')?.classList.remove('open');
  document.getElementById('modal-library')?.classList.remove('active');
  document.getElementById('modal-search')?.classList.remove('active');
  document.getElementById('modal-translation-studio')?.classList.remove('active');
  document.getElementById('modal-server')?.classList.remove('active');
  updateBackdrop();
}

function toggleTocSidebar() {
  const sidebar = document.getElementById('sidebar-toc');
  if (sidebar) {
    sidebar.classList.toggle('open');
    updateBackdrop();
  }
}

function closeTocSidebar() {
  document.getElementById('sidebar-toc')?.classList.remove('open');
  updateBackdrop();
}

function toggleAiDrawer() {
  const drawer = document.getElementById('ai-drawer');
  if (drawer) {
    drawer.classList.toggle('open');
    updateBackdrop();
    if (drawer.classList.contains('open')) {
      setTimeout(() => document.getElementById('ai-input-text')?.focus(), 250);
    }
  }
}

function closeAiDrawer() {
  document.getElementById('ai-drawer')?.classList.remove('open');
  updateBackdrop();
}

function openLibraryModal() {
  const modal = document.getElementById('modal-library');
  if (modal) {
    modal.classList.add('active');
    updateBackdrop();
    renderLibraryGrid();
  }
}

function closeLibraryModal() {
  document.getElementById('modal-library')?.classList.remove('active');
  updateBackdrop();
}

function openSearchModal() {
  const modal = document.getElementById('modal-search');
  const titleEl = document.getElementById('search-modal-book-title');
  if (modal) {
    if (titleEl && state.activeBook) {
      titleEl.textContent = `Searching: ${state.activeBook.title}`;
    }
    modal.classList.add('active');
    updateBackdrop();
    setTimeout(() => document.getElementById('inbook-search-input')?.focus(), 200);
  }
}

function closeSearchModal() {
  document.getElementById('modal-search')?.classList.remove('active');
  updateBackdrop();
}

function toggleDialectics() {
  state.dialecticsEnabled = !state.dialecticsEnabled;
  const container = document.getElementById('reader-container');
  if (container) {
    container.classList.toggle('dialectics-off', !state.dialecticsEnabled);
  }
  
  const subnavBtn = document.getElementById('btn-toggle-dialectics');
  if (subnavBtn) subnavBtn.classList.toggle('active', state.dialecticsEnabled);

  showToast(state.dialecticsEnabled ? 'Dialectics Highlighting Enabled' : 'Dialectics Highlighting Disabled');
}

// --- Hierarchical Library Corpus Engine (Imams -> Epistemic Topics) ---
async function loadLibrary() {
  try {
    // 1. Fetch Taxonomy Metadata with fast timeout
    try {
      const taxRes = await fetchWithTimeout(getApiUrl('/api/taxonomy'), {}, 1200);
      if (taxRes.ok) {
        state.taxonomy = await taxRes.json();
        const verCountBadge = document.getElementById('ver-count-badge');
        if (verCountBadge && state.taxonomy.v4_v5_total) {
          verCountBadge.textContent = state.taxonomy.v4_v5_total.toString();
        }
      }
    } catch (_) {}

    // 2. Fetch Full Catalog (Try API first with fast timeout, then local catalog.json)
    let booksData = null;
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/books?limit=500'), {}, 1500);
      if (res.ok) {
        booksData = await res.json();
        updateServerStatus(true, 'Online');
      }
    } catch (apiErr) {
      console.warn('API fetch timed out or failed, switching to local catalog.json:', apiErr);
      updateServerStatus(false, 'Offline Mode');
    }

    if (!booksData || !Array.isArray(booksData) || booksData.length === 0) {
      try {
        const localRes = await fetch('catalog.json');
        if (localRes.ok) {
          booksData = await localRes.json();
        }
      } catch (localErr) {
        console.warn('Local catalog.json fetch failed:', localErr);
      }
    }

    if (!booksData) throw new Error('Failed to load library catalog');
    state.books = booksData;
    renderLibraryGrid();

    // Select initial book (preferring v5/v4 masterworks like ismat_anbiya_v5 or al_futuhat or al_shifa)
    const savedBookId = localStorage.getItem('raziapp_active_book_id');
    const initialBook = state.books.find(b => b.id === savedBookId) ||
      state.books.find(b => b.filename?.includes('ismat_anbiya_v5_complete') || b.filename?.includes('al_shifa_qadi_iyad') || b.filename?.includes('al_futuhat')) ||
      state.books[0];

    if (initialBook) {
      await selectBook(initialBook.id);
    }
  } catch (err) {
    console.error('Library loading error:', err);
  }
}

function renderLibraryGrid() {
  const grid = document.getElementById('library-grid');
  const countSubtitle = document.getElementById('library-count-subtitle');
  if (!grid) return;

  let list = state.books;

  // 1. Filter by v4 / v5 Version Master Flag
  if (state.v4V5Only) {
    list = list.filter(b => b.is_v4_v5);
  }

  // 2. Filter by Edition Format (Pure English, v5 Pure, v4 Pure, Bilingual, v5 Master, v4 Pro)
  if (state.activeFormat && state.activeFormat !== 'all') {
    if (state.activeFormat === 'pure_en') {
      list = list.filter(b => b.is_pure_en || b.edition_format === 'pure_en');
    } else if (state.activeFormat === 'v5_pure') {
      list = list.filter(b => b.version === 'v5' && (b.is_pure_en || b.edition_format === 'pure_en'));
    } else if (state.activeFormat === 'v4_pure') {
      list = list.filter(b => b.version === 'v4' && (b.is_pure_en || b.edition_format === 'pure_en'));
    } else if (state.activeFormat === 'bilingual') {
      list = list.filter(b => b.is_bilingual || b.edition_format === 'bilingual');
    } else if (state.activeFormat === 'v5') {
      list = list.filter(b => b.version === 'v5');
    } else if (state.activeFormat === 'v4') {
      list = list.filter(b => b.version === 'v4');
    } else if (state.activeFormat === 'sq') {
      list = list.filter(b => b.is_sq || b.edition_format === 'sq');
    }
  }

  // 3. Filter by Imam / Author
  if (state.activeImam !== 'all') {
    list = list.filter(b => b.imam_key === state.activeImam || b.author_key === state.activeImam);
  }

  // 4. Filter by Epistemic Topic
  if (state.activeTopic !== 'all') {
    list = list.filter(b => b.topic_key === state.activeTopic || b.pillar_key === state.activeTopic);
  }

  // 5. Filter by Search Query
  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(b => 
      (b.title && b.title.toLowerCase().includes(q)) ||
      (b.arabic_title && b.arabic_title.toLowerCase().includes(q)) ||
      (b.author && b.author.toLowerCase().includes(q)) ||
      (b.filename && b.filename.toLowerCase().includes(q)) ||
      (b.topic_name && b.topic_name.toLowerCase().includes(q)) ||
      (b.topic_arabic && b.topic_arabic.toLowerCase().includes(q)) ||
      (b.edition && b.edition.toLowerCase().includes(q))
    );
  }

  if (countSubtitle) {
    let formatLabel = 'All Editions';
    if (state.activeFormat === 'pure_en') formatLabel = 'Pure English Editions';
    else if (state.activeFormat === 'v5_pure') formatLabel = 'v5 Pure EN Masterworks';
    else if (state.activeFormat === 'v4_pure') formatLabel = 'v4 Pure EN Scholarly';
    else if (state.activeFormat === 'bilingual') formatLabel = 'Bilingual Lexical Apparatus';
    else if (state.activeFormat === 'v5') formatLabel = 'v5 Sovereign Masterworks';
    else if (state.activeFormat === 'v4') formatLabel = 'v4 Pro Scholarly Editions';

    const imamLabel = state.activeImam !== 'all' ? ` • ${state.taxonomy?.imams?.[state.activeImam]?.name || state.activeImam}` : '';
    const topicLabel = state.activeTopic !== 'all' ? ` • ${state.taxonomy?.topics?.[state.activeTopic]?.title || state.activeTopic}` : '';
    countSubtitle.textContent = `Showing ${list.length} Masterworks • ${formatLabel}${imamLabel}${topicLabel}`;
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-search-placeholder">No classical treatises found matching your filter criteria.</div>';
    return;
  }

  // Hierarchical Grouping:
  // Step 1: Group by Imam
  const imamOrder = ['razi', 'ghazali', 'nawawi', 'raghib', 'heritage'];
  const imamGroups = {};

  list.forEach(b => {
    const ik = b.imam_key || 'heritage';
    if (!imamGroups[ik]) imamGroups[ik] = [];
    imamGroups[ik].push(b);
  });

  // Canonical topic order
  const topicOrder = ['kalam', 'usul', 'tafsir', 'hadith', 'lisan', 'tasawwuf', 'hikmah', 'fiqh'];

  let html = '';

  imamOrder.forEach(ik => {
    const imamBooks = imamGroups[ik];
    if (!imamBooks || imamBooks.length === 0) return;

    const firstBook = imamBooks[0];
    const imamName = firstBook.author || 'Classical Master';
    const imamArabic = firstBook.author_arabic || '';
    const era = firstBook.era || '';
    const honorific = firstBook.honorific || '';

    html += `
      <section class="library-imam-section">
        <div class="library-imam-banner">
          <div class="imam-banner-title">${escapeHtml(imamName)}</div>
          ${imamArabic ? `<div class="imam-banner-arabic">${escapeHtml(imamArabic)}</div>` : ''}
          <div class="imam-banner-meta">${escapeHtml(honorific ? honorific + ' • ' : '')}${escapeHtml(era)}</div>
        </div>
    `;

    // Step 2: Group by Topic inside this Imam
    const topicGroups = {};
    imamBooks.forEach(b => {
      const tk = b.topic_key || 'kalam';
      if (!topicGroups[tk]) topicGroups[tk] = [];
      topicGroups[tk].push(b);
    });

    topicOrder.forEach(tk => {
      const booksInTopic = topicGroups[tk];
      if (!booksInTopic || booksInTopic.length === 0) return;

      const firstTopicBook = booksInTopic[0];
      const topicTitle = firstTopicBook.topic_name || tk.toUpperCase();
      const topicArabic = firstTopicBook.topic_arabic || '';

      html += `
        <div class="library-topic-header">
          <span class="topic-badge-label">${escapeHtml(topicTitle)} ${topicArabic ? `(${escapeHtml(topicArabic)})` : ''}</span>
          <span class="topic-count-tag">${booksInTopic.length} vol${booksInTopic.length > 1 ? 's' : ''}</span>
        </div>
      `;

      booksInTopic.forEach(b => {
        const isActive = b.id === state.activeBookId;
        
        // Exact Badge Computation for v5 Pure EN, v4 Pure EN, v5 Bilingual, v4 Bilingual
        let verBadgeClass = 'v4';
        let verBadgeText = 'v4 PRO';
        if (b.version === 'v5') {
          if (b.is_pure_en || b.edition_format === 'pure_en') {
            verBadgeClass = 'v5-pure';
            verBadgeText = 'v5 PURE EN';
          } else if (b.is_bilingual || b.edition_format === 'bilingual') {
            verBadgeClass = 'v5-bilingual';
            verBadgeText = 'v5 BILINGUAL';
          } else if (b.is_sq) {
            verBadgeClass = 'sq-tag';
            verBadgeText = 'v5 SHQIP';
          } else {
            verBadgeClass = 'v5';
            verBadgeText = 'v5 MASTER';
          }
        } else {
          if (b.is_pure_en || b.edition_format === 'pure_en') {
            verBadgeClass = 'v4-pure';
            verBadgeText = 'v4 PURE EN';
          } else if (b.is_bilingual || b.edition_format === 'bilingual') {
            verBadgeClass = 'v4-bilingual';
            verBadgeText = 'v4 BILINGUAL';
          } else if (b.is_sq) {
            verBadgeClass = 'sq-tag';
            verBadgeText = 'v4 SHQIP';
          } else {
            verBadgeClass = 'v4';
            verBadgeText = 'v4 SCHOLARLY';
          }
        }

        html += `
          <div class="book-card-item ${isActive ? 'active' : ''}" onclick="selectBook('${b.id}')">
            <div class="book-card-badges">
              <span class="ver-tag ${verBadgeClass}">${verBadgeText}</span>
              ${b.is_heritage_new ? '<span class="ver-tag heritage-tag">Heritage Masterwork</span>' : ''}
              <span class="book-card-topic-tag">${escapeHtml(b.topic_name || b.pillar_name || 'Epistemic Pillar')}</span>
            </div>
            <div>
              <div class="book-card-title">${escapeHtml(b.title || 'Classical Work')}</div>
              ${b.arabic_title ? `<div style="font-family: var(--font-arabic); direction: rtl; color: var(--brand-emerald); font-size: 0.92rem; margin-top: 0.25rem;">${escapeHtml(b.arabic_title)}</div>` : ''}
            </div>
            <div class="book-card-meta">
              <span class="book-card-author">${escapeHtml(b.edition || b.author || 'Classical Master')}</span>
              <span style="font-size: 0.65rem; color: var(--text-muted);">${b.size_mb} MB</span>
            </div>
          </div>
        `;
      });
    });

    html += `</section>`;
  });

  grid.innerHTML = html;
}

// Global scope wrapper for onclick handler
window.selectBook = async function(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;

  state.activeBook = book;
  state.activeBookId = bookId;
  localStorage.setItem('raziapp_active_book_id', bookId);

  // Update Header Titles
  const headerTitle = document.getElementById('active-book-title');
  if (headerTitle) {
    headerTitle.textContent = book.title || 'Razi Sovereign Reader';
  }

  const epubBookTitle = document.getElementById('epub-hud-book-title');
  if (epubBookTitle) {
    epubBookTitle.textContent = book.title || 'Classical Treatise';
  }

  closeLibraryModal();

  // 1. Try pure client-side EPUB unpack if epub_engine and filename available
  if (window.clientEpubEngine && (book.asset_url || book.filename)) {
    const epubUrl = book.asset_url || `epubs/${book.filename}`;
    try {
      showToast('Unpacking Classical EPUB in memory...');
      const loaded = await window.clientEpubEngine.load(epubUrl, bookId);
      if (loaded && loaded.toc && loaded.toc.length > 0) {
        state.toc = loaded.toc;
        renderTocList(state.toc);
        await loadChapter(state.toc[0].href, 0);
        showToast(`Loaded: ${book.title}`);
        return;
      }
    } catch (clientErr) {
      console.warn('Client EPUB engine fallback to offline store / API:', clientErr);
    }
  }

  await loadBookToc(bookId);
};


// --- Table of Contents (Taqsim) Engine ---
async function loadBookToc(bookId) {
  const tocList = document.getElementById('toc-list');
  if (tocList) {
    tocList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Deconstructing Codex Structure...</div>';
  }

  try {
    let tocData = null;
    try {
      const res = await fetchWithTimeout(getApiUrl(`/api/book/${bookId}/toc`), {}, 1500);
      if (res.ok) {
        const data = await res.json();
        tocData = data.toc;
      }
    } catch (_) {}

    if (!tocData || tocData.length === 0) {
      const store = await getOfflineStore();
      if (store && store[bookId] && store[bookId].toc) {
        tocData = store[bookId].toc;
      }
    }

    if (!tocData || tocData.length === 0) {
      const currentBook = state.books.find(b => b.id === bookId);
      tocData = [
        { href: 'preface.xhtml', title: `Prolegomenon: ${currentBook ? currentBook.title : 'Overview'}` },
        { href: 'chapter1.xhtml', title: 'Chapter 1: Epistemic Foundations & Dialectical Proofs' }
      ];
    }

    state.toc = tocData;
    renderTocList(state.toc);

    // Load first chapter
    if (state.toc.length > 0) {
      await loadChapter(state.toc[0].href, 0);
    }
  } catch (err) {
    console.error('TOC error:', err);
    if (tocList) {
      tocList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Unable to parse codex navigation tree.</div>';
    }
  }
}

function renderTocList(items) {
  const tocList = document.getElementById('toc-list');
  if (!tocList) return;

  if (items.length === 0) {
    tocList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No chapter headings identified in this volume.</div>';
    return;
  }

  tocList.innerHTML = items.map((item, idx) => {
    const isCurrent = idx === state.activeChapterIndex;
    const cleanTitle = (item.title || `Section ${idx + 1}`).replace(/^[0-9.-]+\s*/, '');
    return `
      <div class="toc-item ${isCurrent ? 'active' : ''}" onclick="loadChapter('${item.href}', ${idx})">
        <div>${escapeHtml(cleanTitle)}</div>
      </div>
    `;
  }).join('');
}

function filterTocList(q) {
  if (!q) {
    renderTocList(state.toc);
    return;
  }
  const filtered = state.toc.filter((item, idx) => 
    (item.title && item.title.toLowerCase().includes(q)) ||
    String(idx + 1).includes(q)
  );
  renderTocList(filtered);
}

// Global scope wrapper for onclick handler
window.loadChapter = async function(href, chapterIndex, targetParagraphId = null) {
  if (!state.activeBookId) return;

  state.activeChapterHref = href;
  state.activeChapterIndex = chapterIndex;

  stopArabicAudio();

  const tocItems = document.querySelectorAll('.toc-item');
  tocItems.forEach((el, idx) => el.classList.toggle('active', idx === chapterIndex));

  closeTocSidebar();

  const bodyEl = document.getElementById('chapter-content-body');
  const pillarBadge = document.getElementById('chapter-pillar-badge');
  const chapterTitleEl = document.getElementById('chapter-title');
  const epubChapTitle = document.getElementById('epub-hud-chapter-title');

  if (bodyEl) {
    bodyEl.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">Rendering Discourse Typology...</div>';
  }

  try {
    let data = null;

    // 1. Try Pure Client-Side EPUB Engine (Primary Standalone Path)
    if (window.clientEpubEngine && window.clientEpubEngine.currentZip) {
      try {
        data = await window.clientEpubEngine.getChapter(href);
      } catch (e) {
        console.warn('Client engine chapter extract fallback:', e);
      }
    }

    // 2. Try Local Offline Store
    if (!data || !data.paragraphs || data.paragraphs.length === 0) {
      const store = await getOfflineStore();
      if (store && store[state.activeBookId]?.chapters?.[href]) {
        data = store[state.activeBookId].chapters[href];
      }
    }

    // 3. Try Remote API if connected
    if (!data || !data.paragraphs || data.paragraphs.length === 0) {
      try {
        const res = await fetchWithTimeout(getApiUrl(`/api/book/${state.activeBookId}/chapter?href=${encodeURIComponent(href)}`), {}, 1200);
        if (res.ok) {
          data = await res.json();
        }
      } catch (_) {}
    }

    if (!data || !data.paragraphs || data.paragraphs.length === 0) {
      const curBook = state.activeBook;
      data = {
        title: state.toc[chapterIndex]?.title || 'Discourse Section',
        paragraphs: [
          {
            id: 'p_offline_1',
            type: 'prolegomenon',
            arabic_text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ - الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
            text: `Volume: ${curBook ? curBook.title : 'Classical Masterwork'} by ${curBook ? curBook.author : 'Imam Fakhr al-Din al-Razi'}. Complete edition indexed in the sovereign library.`
          },
          {
            id: 'p_offline_2',
            type: 'proof',
            arabic_text: 'قَالَ رَحِمَهُ اللَّهُ: وَاعْلَمْ أَنَّ الْعِلْمَ أَشْرَفُ الْغَايَاتِ وَأَسْنَى الْمَقَاصِدِ',
            text: `Section: ${state.toc[chapterIndex]?.title || 'Epistemic Dialectic'}. Complete standalone edition.`
          }
        ]
      };
    }

    state.chapterData = data;

    if (pillarBadge) {
      pillarBadge.textContent = state.activeBook?.pillar_name || 'Razi Epistemic Pillar';
    }
    const displayTitle = data.title || (state.toc[chapterIndex]?.title) || 'Discourse Section';
    if (chapterTitleEl) chapterTitleEl.textContent = displayTitle;
    if (epubChapTitle) epubChapTitle.textContent = displayTitle;

    renderChapterContent(data.paragraphs || []);
    
    // If in EPUB mode, rebuild page slides
    if (state.isEpubMode) {
      buildEpubPages(0);
    }

    const readerViewport = document.getElementById('reader-viewport');
    if (targetParagraphId) {
      setTimeout(() => {
        const targetEl = document.getElementById(targetParagraphId);
        targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else if (readerViewport) {
      readerViewport.scrollTop = 0;
    }

    state.activeParagraphIndex = 0;
  } catch (err) {
    console.error('Chapter render error:', err);
    if (bodyEl) {
      bodyEl.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">Error reading section content from storage.</div>';
    }
  }
};

// --- Reader Viewport & Dialectics Renderer (Stream Mode) ---
function renderChapterContent(paragraphs) {
  const bodyEl = document.getElementById('chapter-content-body');
  if (!bodyEl) return;

  if (!paragraphs || paragraphs.length === 0) {
    bodyEl.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">This codex section contains no textual paragraphs.</div>';
    return;
  }

  let html = '';
  paragraphs.forEach((p, idx) => {
    const dialecticType = p.dialectic_type || p.dialectic || 'exposition';
    const tagLabel = getDialecticBadgeLabel(dialecticType);
    const textHtml = escapeHtml(p.text || '');
    
    const isObjection = dialecticType === 'irad';
    const isRefutation = dialecticType === 'jawab';
    const isProof = dialecticType === 'dalil';
    const isTaxonomy = dialecticType === 'taqsim';
    const isArabic = p.is_arabic || Boolean(p.arabic);

    html += `
      <article class="paragraph-card ${isObjection ? 'is-objection' : ''} ${isRefutation ? 'is-refutation' : ''} ${isProof ? 'is-proof' : ''} ${isTaxonomy ? 'is-taxonomy' : ''}" id="${p.id || `para-${idx}`}" data-index="${idx}" onclick="onParagraphClick(${idx})">
        <div class="dialectical-badge-row ${isObjection ? 'objection' : isRefutation ? 'refutation' : isProof ? 'proof' : isTaxonomy ? 'taxonomy' : ''}">
          <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${tagLabel}</span>
        </div>
        ${isArabic ? `<div class="arabic-text">${escapeHtml(p.arabic || p.text)}</div>` : `<div class="text-content">${textHtml}</div>`}
        <div class="card-actions-bar">
          ${isArabic ? `
            <button class="card-action-btn arabic-recite-btn" title="Recite Classical Arabic" onclick="event.stopPropagation(); reciteArabicParagraph(${idx});">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>تلاوة</span>
            </button>
          ` : ''}
          <button class="card-action-btn" title="Examine dialectic with AI" onclick="event.stopPropagation(); examineParagraphWithAi(${idx});">
            <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Examine</span>
          </button>
          <button class="card-action-btn" title="Copy scholarly citation" onclick="event.stopPropagation(); copyParagraphCitation(${idx});">
            <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Cite</span>
          </button>
        </div>
      </article>
    `;
  });

  // Next / Previous navigation in stream mode
  const prevChapter = state.activeChapterIndex > 0 ? state.toc[state.activeChapterIndex - 1] : null;
  const nextChapter = state.activeChapterIndex < state.toc.length - 1 ? state.toc[state.activeChapterIndex + 1] : null;

  html += `
    <nav style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 1rem 0; border-top: 1px solid var(--border-ui);">
      ${prevChapter ? `
        <button class="card-action-btn" style="padding: 0.5rem 0.85rem;" onclick="slideChapter('prev')">
          <svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="15 18 9 12 15 6"/></svg>
          <span>Prev</span>
        </button>
      ` : '<div></div>'}
      ${nextChapter ? `
        <button class="card-action-btn" style="padding: 0.5rem 0.85rem;" onclick="slideChapter('next')">
          <span>Next</span>
          <svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      ` : '<div></div>'}
    </nav>
  `;

  bodyEl.innerHTML = html;
}

function getDialecticBadgeLabel(type) {
  const map = {
    daawa: 'Claim [Daawa]',
    dalil: 'Proof [Dalil / Burhan]',
    istidlal: 'Inference [Istidlal]',
    irad: 'Objection [In Qila / Irad]',
    objection: 'Objection [In Qila / Irad]',
    jawab: 'Resolution [Qulna / Jawab]',
    refutation: 'Resolution [Qulna / Jawab]',
    taqsim: 'Taxonomy [Taqsim al-Hasir]',
    tahrir: 'Apparatus & Root [Tahrir]',
    arabic_source: 'Classical Arabic [Al-Matn]',
    exposition: 'Dialectical Inquiry [Nazar]'
  };
  return map[type] || 'Dialectical Inquiry [Nazar]';
}

window.onParagraphClick = function(idx) {
  setActiveParagraph(idx);
};

function setActiveParagraph(idx) {
  state.activeParagraphIndex = idx;
  const allParas = document.querySelectorAll('.paragraph-card');
  allParas.forEach(p => p.classList.remove('active-speaking'));

  const paras = state.chapterData?.paragraphs;
  const targetId = paras && paras[idx] ? (paras[idx].id || `para-${idx}`) : `para-${idx}`;
  const activeEl = document.getElementById(targetId);
  if (activeEl) {
    activeEl.classList.add('active-speaking');
  }
}

// Copy Citation
window.copyParagraphCitation = function(idx) {
  const paras = state.chapterData?.paragraphs;
  if (!paras || !paras[idx]) return;

  const p = paras[idx];
  const bookTitle = state.activeBook?.title || 'Classical Treatise';
  const author = state.activeBook?.author || 'Classical Master';
  const chapterTitle = state.chapterData?.title || 'Section';

  const citation = `"${p.text}"\n\n— ${author}, ${bookTitle} (${chapterTitle}, Section ${state.activeChapterIndex + 1}) [AynEngine Translation]`;
  
  navigator.clipboard.writeText(citation).then(() => {
    showToast('Scholarly citation copied to clipboard');
  }).catch(() => {
    showToast('Unable to copy citation');
  });
};

// --- In-Book Full-Text Search ---
async function handleInBookSearch(query) {
  const container = document.getElementById('search-results-container');
  if (!container) return;

  if (!query || query.length < 2) {
    container.innerHTML = '<div class="empty-search-placeholder">Enter at least 2 characters to search across all sections.</div>';
    return;
  }

  if (!state.activeBookId) return;

  container.innerHTML = '<div class="empty-search-placeholder">Searching codex across all chapters...</div>';

  try {
    let results = [];

    // 1. Try pure client-side in-memory search
    if (window.clientEpubEngine && window.clientEpubEngine.currentZip) {
      results = await window.clientEpubEngine.search(query, 30);
    }

    // 2. Try API fallback if client results empty and API available
    if (results.length === 0) {
      try {
        const res = await fetchWithTimeout(getApiUrl(`/api/book/${state.activeBookId}/search?q=${encodeURIComponent(query)}&limit=30`), {}, 1500);
        if (res.ok) {
          const data = await res.json();
          results = data.results || [];
        }
      } catch (_) {}
    }

    if (results.length === 0) {
      container.innerHTML = `<div class="empty-search-placeholder">No occurrences of "${escapeHtml(query)}" found in this volume.</div>`;
      return;
    }

    container.innerHTML = results.map(r => {
      const qRegex = new RegExp(`(${escapeRegex(query)})`, 'gi');
      const snippetText = r.snippet || r.text || '';
      const highlightedSnippet = escapeHtml(snippetText).replace(qRegex, '<mark>$1</mark>');
      return `
        <div class="search-result-card" onclick="jumpToSearchResult('${r.chapter_href}', '${r.paragraph_id}')">
          <div class="search-result-chap">${escapeHtml(r.chapter_title || 'Section')}</div>
          <div class="search-result-snippet">${highlightedSnippet}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Search error:', err);
    container.innerHTML = '<div class="empty-search-placeholder">Error searching within this codex.</div>';
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.jumpToSearchResult = async function(chapterHref, paragraphId) {
  closeSearchModal();
  const chapterIdx = state.toc.findIndex(t => t.href === chapterHref);
  if (chapterIdx !== -1) {
    await loadChapter(chapterHref, chapterIdx, paragraphId);
  }
};

// --- Classical Arabic Recitation Engine ---
function initAudioEngine() {
  const audio = document.getElementById('core-audio-player');
  if (!audio) return;

  audio.addEventListener('ended', () => {
    state.isPlayingArabic = false;
    stopArabicAudio();
  });

  audio.addEventListener('error', () => {
    state.isPlayingArabic = false;
    stopArabicAudio();
  });
}

window.reciteArabicParagraph = async function(idx) {
  setActiveParagraph(idx);
  const paras = state.chapterData?.paragraphs;
  if (!paras || !paras[idx]) return;

  const arabicText = paras[idx].arabic_text || paras[idx].arabic || paras[idx].text;
  if (!arabicText || arabicText.trim().length === 0) return;

  const audio = document.getElementById('core-audio-player');
  const dock = document.getElementById('arabic-audio-dock');
  const wave = document.getElementById('audio-wave-animation');
  const statusEl = document.getElementById('audio-reciter-status');
  if (dock) dock.classList.add('active');

  // 1. Try Web Speech API for instant client-side offline recitation
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(arabicText);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.88;

      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang && v.lang.startsWith('ar'));
      if (arVoice) utterance.voice = arVoice;

      utterance.onstart = () => {
        state.isPlayingArabic = true;
        if (wave) wave.classList.add('active');
        if (statusEl) statusEl.textContent = 'Reciting Classical Arabic Text (Offline Engine)';
        updateArabicPlayIcon(true);
      };

      utterance.onend = () => {
        stopArabicAudio();
      };

      utterance.onerror = () => {
        stopArabicAudio();
      };

      window.speechSynthesis.speak(utterance);
      return;
    } catch (_) {}
  }

  // 2. Fallback to server synthesis
  if (statusEl) statusEl.textContent = 'Synthesizing Arabic Vocalization...';

  try {
    const res = await fetchWithTimeout(getApiUrl('/api/tts/synthesize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: arabicText,
        voice: 'classical_arabic'
      })
    }, 2500);

    if (!res.ok) throw new Error('Arabic synthesis failed');
    const data = await res.json();

    if (audio) {
      audio.src = data.audio_url;
      audio.play().then(() => {
        state.isPlayingArabic = true;
        if (wave) wave.classList.add('active');
        if (statusEl) statusEl.textContent = 'Reciting Classical Arabic Text';
        updateArabicPlayIcon(true);
      }).catch(e => {
        console.error('Audio play failure:', e);
        stopArabicAudio();
      });
    }
  } catch (err) {
    console.error('TTS error:', err);
    stopArabicAudio();
    showToast('Arabic recitation unavailable');
  }
};

function toggleArabicAudio() {
  const audio = document.getElementById('core-audio-player');
  const wave = document.getElementById('audio-wave-animation');
  if (!audio) return;

  if (state.isPlayingArabic) {
    if ('speechSynthesis' in window) window.speechSynthesis.pause();
    audio.pause();
    state.isPlayingArabic = false;
    if (wave) wave.classList.remove('active');
    updateArabicPlayIcon(false);
  } else if (audio.src) {
    audio.play().then(() => {
      state.isPlayingArabic = true;
      if (wave) wave.classList.add('active');
      updateArabicPlayIcon(true);
    });
  }
}

function stopArabicAudio() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }
  const audio = document.getElementById('core-audio-player');
  const dock = document.getElementById('arabic-audio-dock');
  const wave = document.getElementById('audio-wave-animation');
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
  }
  state.isPlayingArabic = false;
  if (wave) wave.classList.remove('active');
  if (dock) dock.classList.remove('active');
  updateArabicPlayIcon(false);
}


function updateArabicPlayIcon(isPlaying) {
  const btn = document.getElementById('btn-audio-play-pause');
  if (!btn) return;
  const playIcon = btn.querySelector('.play-icon');
  const pauseIcon = btn.querySelector('.pause-icon');
  if (playIcon && pauseIcon) {
    playIcon.classList.toggle('hidden', isPlaying);
    pauseIcon.classList.toggle('hidden', !isPlaying);
  }
}

// --- Al-Muhaqqiq Dialectical AI Assistant ---
window.examineParagraphWithAi = function(idx) {
  setActiveParagraph(idx);
  const paras = state.chapterData?.paragraphs;
  if (!paras || !paras[idx]) return;

  state.aiContextParagraph = paras[idx];
  toggleAiDrawer();

  appendAiChatMessage('system', `Context Anchored: Section ${idx + 1} [${paras[idx].dialectic_type || 'Discourse'}]`);
  
  const input = document.getElementById('ai-input-text');
  if (input) {
    input.value = `Unpack the dialectical premise of this paragraph according to Imam al-Razi's methods:`;
    input.focus();
  }
};

async function handleAiSubmit() {
  const input = document.getElementById('ai-input-text');
  if (!input) return;
  const prompt = input.value.trim();
  if (!prompt) return;

  input.value = '';
  appendAiChatMessage('user', prompt);

  const statusEl = document.getElementById('ai-engine-status');
  if (statusEl) {
    statusEl.textContent = 'Razi Reasoner Formulating...';
  }

  const loadingMsgId = appendAiChatMessage('assistant', '<div style="color: var(--text-muted); font-style: italic;">Consulting classical dialectical framework...</div>', true);

  try {
    const contextText = state.aiContextParagraph?.text || (state.chapterData?.paragraphs?.[state.activeParagraphIndex]?.text) || '';
    const res = await fetch(getApiUrl('/api/ai/ask'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        context: contextText,
        mode: 'deep_dialectic'
      })
    });

    if (!res.ok) throw new Error('Dialectical engine communication failure');
    const data = await res.json();

    const msgEl = document.getElementById(loadingMsgId);
    if (msgEl) {
      msgEl.innerHTML = formatMarkdownDialectics(data.response || data.text || 'Resolution completed.');
    }

    if (statusEl) {
      statusEl.textContent = 'DeepSeek Flash 4.1 Standing By';
    }
  } catch (err) {
    console.error('AI query error:', err);
    const msgEl = document.getElementById(loadingMsgId);
    if (msgEl) {
      msgEl.innerHTML = '<div style="color: var(--color-objection);">Verification error in dialectical reasoning pipeline.</div>';
    }
    if (statusEl) {
      statusEl.textContent = 'Engine Offline';
    }
  }
}

function appendAiChatMessage(role, contentHtml, isTemp = false) {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return '';

  const msgId = 'ai-msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  div.id = msgId;

  if (role === 'system') {
    div.innerHTML = `<div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--brand-gold); margin-bottom: 0.25rem;">Anchor</div>${contentHtml}`;
  } else if (role === 'user') {
    div.textContent = contentHtml;
  } else {
    div.innerHTML = contentHtml;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return msgId;
}

function formatMarkdownDialectics(text) {
  if (!text) return '';
  let out = escapeHtml(text);
  out = out.replace(/^### (.*$)/gim, '<h4 style="font-size: 0.95rem; font-weight: 700; color: var(--brand-gold); margin: 0.75rem 0 0.35rem;">$1</h4>');
  out = out.replace(/^## (.*$)/gim, '<h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0.85rem 0 0.45rem;">$1</h3>');
  out = out.replace(/^# (.*$)/gim, '<h2 style="font-size: 1.15rem; font-weight: 700; color: var(--brand-gold); margin: 1rem 0 0.5rem;">$1</h2>');
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
  out = out.replace(/^\s*-\s+(.*$)/gim, '<div style="margin-left: 1rem; margin-bottom: 0.25rem;">• $1</div>');
  out = out.replace(/^\s*([0-9]+)\.\s+(.*$)/gim, '<div style="margin-left: 1rem; margin-bottom: 0.25rem;"><strong>$1.</strong> $2</div>');
  out = out.replace(/\n\n+/g, '</p><p style="margin-top: 0.65rem;">');
  out = '<p>' + out + '</p>';
  return out;
}

// --- Utilities ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg) {
  if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
    try { window.AndroidBridge.vibrate(12); } catch (_) {}
  }
  const toast = document.createElement('div');
  toast.style.position = 'absolute';
  toast.style.bottom = 'calc(var(--bottom-bar-height) + 16px)';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'var(--bg-surface)';
  toast.style.border = '1px solid var(--border-ui-strong)';
  toast.style.color = 'var(--text-primary)';
  toast.style.padding = '0.5rem 0.95rem';
  toast.style.borderRadius = '9999px';
  toast.style.fontSize = '0.76rem';
  toast.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
  toast.style.zIndex = '999';
  toast.style.pointerEvents = 'none';
  toast.style.transition = 'opacity 0.3s ease';
  toast.textContent = msg;

  const shell = document.getElementById('app-shell') || document.body;
  shell.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}


// ==========================================================================
// READER MODE TOUCH SWIPE & SMOOTH HORIZONTAL SLIDE TRANSITIONS
// ==========================================================================

function pulseSwipeIndicator(dir) {
  const el = document.getElementById(dir === 'left' ? 'reader-swipe-left' : 'reader-swipe-right');
  if (el) {
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 250);
  }
  if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
    try { window.AndroidBridge.vibrate(8); } catch (_) {}
  }
}

window.slideChapter = async function(direction) {
  if (!state.toc || state.toc.length === 0) return;
  const bodyEl = document.getElementById('chapter-content-body');
  const viewport = document.getElementById('reader-viewport');

  if (direction === 'next') {
    if (state.activeChapterIndex >= state.toc.length - 1) {
      showToast('Final section of this codex reached');
      return;
    }
    const nextToc = state.toc[state.activeChapterIndex + 1];
    pulseSwipeIndicator('right');
    if (bodyEl) {
      bodyEl.classList.remove('slide-in-right', 'slide-in-left', 'slide-out-right', 'slide-out-left');
      bodyEl.classList.add('slide-out-left');
    }
    setTimeout(async () => {
      await window.loadChapter(nextToc.href, state.activeChapterIndex + 1);
      if (viewport) viewport.scrollTop = 0;
      if (bodyEl) {
        bodyEl.classList.remove('slide-out-left');
        bodyEl.classList.add('slide-in-right');
        setTimeout(() => bodyEl.classList.remove('slide-in-right'), 300);
      }
    }, 140);
  } else if (direction === 'prev') {
    if (state.activeChapterIndex <= 0) {
      showToast('First section of this codex reached');
      return;
    }
    const prevToc = state.toc[state.activeChapterIndex - 1];
    pulseSwipeIndicator('left');
    if (bodyEl) {
      bodyEl.classList.remove('slide-in-right', 'slide-in-left', 'slide-out-right', 'slide-out-left');
      bodyEl.classList.add('slide-out-right');
    }
    setTimeout(async () => {
      await window.loadChapter(prevToc.href, state.activeChapterIndex - 1);
      if (viewport) viewport.scrollTop = 0;
      if (bodyEl) {
        bodyEl.classList.remove('slide-out-right');
        bodyEl.classList.add('slide-in-left');
        setTimeout(() => bodyEl.classList.remove('slide-in-left'), 300);
      }
    }, 140);
  }
};

function initReaderSwipeNavigation() {
  const viewport = document.getElementById('reader-viewport');
  if (!viewport) return;

  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;
  let isSwiping = false;

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || state.isEpubMode) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0;
    deltaY = 0;
    isSwiping = true;
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (!isSwiping || e.touches.length !== 1 || state.isEpubMode) return;
    deltaX = e.touches[0].clientX - startX;
    deltaY = e.touches[0].clientY - startY;
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    if (!isSwiping || state.isEpubMode) return;
    isSwiping = false;

    // Detect definitive horizontal swipe (horizontal movement > vertical movement * 1.3 and > 45px)
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && Math.abs(deltaX) > 45) {
      if (deltaX < 0) {
        // Swipe left -> next chapter/page
        window.slideChapter('next');
      } else {
        // Swipe right -> prev chapter/page
        window.slideChapter('prev');
      }
    }
  }, { passive: true });
}

// ==========================================================================
// STANDALONE WHOLE-EPUB PACKAGING & NATIVE SHARING ENGINE
// ==========================================================================

async function shareCurrentBookEpub() {
  if (!state.activeBookId) {
    showToast('Please select a book from the library first');
    return;
  }

  showToast('Packaging offline Codex EPUB archive...');

  try {
    const store = await getOfflineStore();
    const bookData = store ? store[state.activeBookId] : null;
    const book = state.activeBook || {
      id: state.activeBookId,
      title: 'Classical Masterwork',
      author: 'Classical Author'
    };

    if (!window.clientEpubEngine) {
      throw new Error('EPUB Engine not initialized');
    }

    const { blob, base64, filename } = await window.clientEpubEngine.exportEpubFromStore(book, bookData);

    let targetBlob = blob;
    if (!targetBlob && base64 && typeof atob !== 'undefined') {
      try {
        const byteChars = atob(base64);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        targetBlob = new Blob([byteNumbers], { type: 'application/epub+zip' });
      } catch (_) {}
    }

    // 1. Android Native Share Sheet via FileProvider
    if (window.AndroidBridge && typeof window.AndroidBridge.shareEpubFile === 'function') {
      window.AndroidBridge.shareEpubFile(book.title, filename, base64);
      showToast('Opening native share sheet...');
      return;
    }

    // 2. Web Share API with File support
    const epubFile = new File([targetBlob], filename, { type: 'application/epub+zip' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [epubFile] })) {
      await navigator.share({
        title: book.title,
        text: `${book.title} by ${book.author} — Sovereign Classical Codex (RaziApp)`,
        files: [epubFile]
      });
      showToast('Shared successfully');
      return;
    }

    // 3. Browser direct download fallback
    const url = targetBlob ? URL.createObjectURL(targetBlob) : ('data:application/epub+zip;base64,' + base64);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
    showToast(`Downloaded ${filename}`);
  } catch (err) {
    console.error('Error sharing EPUB:', err);
    showToast('Failed to package EPUB: ' + (err.message || 'unknown error'));
  }
}

// ==========================================================================
// AYNENGINE AI TRANSLATION STUDIO v5.1 (QUAD-LEXICAL ACTIVE RAG)
// ==========================================================================

let studioSelectedSource = null;
let studioActiveJobId = null;
let studioPollTimer = null;

function openTranslationStudio() {
  closeAllDrawers();
  const modal = document.getElementById('modal-translation-studio');
  if (modal) {
    modal.classList.add('active');
    updateBackdrop();
  }
  const openitiList = document.getElementById('openiti-results-list');
  if (openitiList && (!openitiList.children || openitiList.children.length === 0)) {
    loadOpenItiResults('');
  }
}

function closeTranslationStudio() {
  const modal = document.getElementById('modal-translation-studio');
  if (modal) {
    modal.classList.remove('active');
    updateBackdrop();
  }
}

window.openTranslationStudio = openTranslationStudio;
window.closeTranslationStudio = closeTranslationStudio;

async function loadOpenItiResults(query = '') {
  const listEl = document.getElementById('openiti-results-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Searching OpenITI corpus (7,123 classical works)...</div>';

  try {
    const res = await fetchWithTimeout(getApiUrl(`/api/translation/openiti/search?q=${encodeURIComponent(query)}&limit=30`), {}, 4500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results = data.results || [];

    if (results.length === 0) {
      listEl.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No classical works matched your query in OpenITI.</div>';
      return;
    }

    let html = '';
    results.forEach((item, idx) => {
      const isSelected = studioSelectedSource && studioSelectedSource.identifier === item.raw_url;
      html += `
        <div class="openiti-card ${isSelected ? 'selected' : ''}" data-idx="${idx}" onclick="selectOpenItiItem(${idx})">
          <div class="openiti-meta">
            <div class="openiti-title-ar">${escapeHtml(item.title_ar || 'مخطوطة كلاسيكية')}</div>
            <div class="openiti-title-lat">${escapeHtml(item.title_lat || 'Classical Manuscript')}</div>
            <div class="openiti-sub">${escapeHtml(item.author_ar || item.author_lat || 'Classical Scholar')} · AH ${escapeHtml(item.date || '—')} · ${Math.round(parseInt(item.char_length || '0', 10) / 1000)}k chars</div>
          </div>
          <button class="openiti-select-btn" type="button">
            ${isSelected ? 'Selected' : 'Select'}
          </button>
        </div>
      `;
    });

    listEl.innerHTML = html;
    window._lastOpenItiResults = results;
  } catch (e) {
    listEl.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Could not connect to OpenITI index. Ensure server is online or use Local Library tab.</div>`;
  }
}

window.selectOpenItiItem = function(idx) {
  const results = window._lastOpenItiResults || [];
  const item = results[idx];
  if (!item) return;

  studioSelectedSource = {
    type: 'openiti',
    identifier: item.raw_url || item.url,
    author: item.author_lat || item.author_ar || 'Classical Scholar',
    title_ar: item.title_ar || 'كتاب كلاسيكي',
    title_en: item.title_lat || 'Classical Treatise'
  };

  updateStudioSelectionSummary();

  const cards = document.querySelectorAll('.openiti-card');
  cards.forEach((c, i) => {
    const isThis = i === idx;
    c.classList.toggle('selected', isThis);
    const btn = c.querySelector('.openiti-select-btn');
    if (btn) btn.textContent = isThis ? 'Selected' : 'Select';
  });
};

async function loadLocalStudioSources() {
  const selectEl = document.getElementById('local-source-select');
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Loading local texts...</option>';

  try {
    const res = await fetchWithTimeout(getApiUrl('/api/translation/local_sources'), {}, 3500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const sources = data.sources || [];

    if (sources.length === 0) {
      selectEl.innerHTML = '<option value="">No local raw texts found</option>';
      return;
    }

    let html = '<option value="">Select a classical manuscript...</option>';
    sources.forEach((src, idx) => {
      html += `<option value="${escapeHtml(src.path)}" data-author="${escapeHtml(src.author)}" data-title="${escapeHtml(src.title)}">${escapeHtml(src.author)}: ${escapeHtml(src.title)} (${Math.round(src.size_bytes / 1024)} KB)</option>`;
    });
    selectEl.innerHTML = html;
    window._localSources = sources;
  } catch (e) {
    selectEl.innerHTML = '<option value="">Failed to load local texts from server</option>';
  }
}

function updateStudioSelectionSummary() {
  const summaryBox = document.getElementById('studio-selection-summary');
  const summaryAr = document.getElementById('summary-ar-title');
  const summaryEn = document.getElementById('summary-en-title');
  const summaryAuthor = document.getElementById('summary-author');

  if (!studioSelectedSource) {
    if (summaryBox) summaryBox.style.display = 'none';
    return;
  }

  if (summaryBox) summaryBox.style.display = 'block';
  if (summaryAr) summaryAr.textContent = studioSelectedSource.title_ar || '';
  if (summaryEn) summaryEn.textContent = studioSelectedSource.title_en || '';
  if (summaryAuthor) summaryAuthor.textContent = `${studioSelectedSource.author} [${studioSelectedSource.type.toUpperCase()}]`;
}

function initTranslationStudio() {
  // Modal buttons
  document.getElementById('btn-close-translation-studio')?.addEventListener('click', closeTranslationStudio);
  document.getElementById('btn-studio-cancel')?.addEventListener('click', closeTranslationStudio);

  // Source Tabs
  const tabBtns = document.querySelectorAll('.studio-tab-btn');
  const tabContents = {
    openiti: document.getElementById('tab-content-openiti'),
    local: document.getElementById('tab-content-local'),
    upload: document.getElementById('tab-content-upload')
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');

      Object.keys(tabContents).forEach(k => {
        if (tabContents[k]) tabContents[k].style.display = (k === target) ? 'block' : 'none';
      });

      if (target === 'local' && (!window._localSources || window._localSources.length === 0)) {
        loadLocalStudioSources();
      }
    });
  });

  // OpenITI Search Input Debounce
  let searchDebounce = null;
  document.getElementById('openiti-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    const query = e.target.value.trim();
    searchDebounce = setTimeout(() => loadOpenItiResults(query), 350);
  });

  // Local Select Change
  document.getElementById('local-source-select')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const val = e.target.value;
    const previewEl = document.getElementById('local-source-preview');

    if (!val || !opt) {
      studioSelectedSource = null;
      if (previewEl) previewEl.innerHTML = '';
      updateStudioSelectionSummary();
      return;
    }

    const title = opt.getAttribute('data-title') || 'Classical Treatise';
    const author = opt.getAttribute('data-author') || 'Imam Fakhr al-Din al-Razi';

    studioSelectedSource = {
      type: 'local',
      identifier: val,
      author: author,
      title_ar: title,
      title_en: title
    };

    updateStudioSelectionSummary();
    if (previewEl) {
      previewEl.innerHTML = `<div style="color: var(--text-primary); font-weight: 600;">Selected Local Source:</div><div style="font-size: 0.8rem; color: var(--brand-gold); margin-top: 4px;">${escapeHtml(val)}</div>`;
    }
  });

  // Upload Dropzone & File Input
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('upload-file-input');
  const uploadPreview = document.getElementById('upload-file-preview');

  dropzone?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadPreview) {
      uploadPreview.style.display = 'block';
      uploadPreview.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Uploading and parsing manuscript...</div>';
    }

    const reader = new FileReader();
    const isText = file.name.endsWith('.txt') || file.name.endsWith('.md');

    reader.onload = async () => {
      try {
        const payload = {
          filename: file.name,
          content_text: isText ? reader.result : null,
          content_base64: isText ? null : (reader.result.split(',')[1] || '')
        };

        const res = await fetchWithTimeout(getApiUrl('/api/translation/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 8000);

        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const d = await res.json();

        studioSelectedSource = {
          type: 'upload',
          identifier: d.file_id || file.name,
          author: 'Classical Scholar',
          title_ar: file.name.replace(/\.[^/.]+$/, ''),
          title_en: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
        };

        updateStudioSelectionSummary();

        if (uploadPreview) {
          uploadPreview.innerHTML = `
            <div style="color: var(--brand-emerald); font-weight: 600; font-size: 0.85rem;">Uploaded: ${escapeHtml(file.name)} (${d.char_count || file.size} characters)</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">"${escapeHtml((d.preview || '').substring(0, 180))}..."</div>
          `;
        }
      } catch (err) {
        if (uploadPreview) {
          uploadPreview.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem;">Upload failed: ${escapeHtml(err.message)}</div>`;
        }
      }
    };

    if (isText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });

  // Start Translation Button
  const startBtn = document.getElementById('btn-studio-start');
  const openReaderBtn = document.getElementById('btn-studio-open-reader');
  const monitorPanel = document.getElementById('studio-monitor-panel');
  const monitorBadge = document.getElementById('monitor-status-badge');
  const monitorProgress = document.getElementById('monitor-progress-text');
  const monitorFill = document.getElementById('studio-progress-fill');
  const monitorRoots = document.getElementById('monitor-roots-tags');
  const monitorPreview = document.getElementById('monitor-live-preview');

  let completedBookId = null;

  startBtn?.addEventListener('click', async () => {
    if (!studioSelectedSource || !studioSelectedSource.identifier) {
      showToast('Please select a classical work from OpenITI, Local, or Upload first');
      return;
    }

    const targetLang = document.getElementById('studio-target-lang')?.value || 'en';
    const editionMode = document.getElementById('studio-edition-mode')?.value || 'bilingual';
    const chunkLimit = parseInt(document.getElementById('studio-chunk-limit')?.value || '3', 10);
    const includeGlossary = document.getElementById('studio-include-glossary')?.checked ?? true;

    startBtn.disabled = true;
    startBtn.textContent = 'Launching AynEngine AI...';
    if (monitorPanel) monitorPanel.style.display = 'block';
    if (monitorBadge) monitorBadge.textContent = 'Queued';
    if (monitorProgress) monitorProgress.textContent = '0%';
    if (monitorFill) monitorFill.style.width = '0%';
    if (monitorRoots) monitorRoots.innerHTML = '<span class="root-tag">Lisan al-Arab</span><span class="root-tag">Kitab al-Ayn</span><span class="root-tag">Mufradat</span>';
    if (monitorPreview) monitorPreview.innerHTML = '<em>Connecting to AynEngine AI translation daemon...</em>';

    try {
      const payload = {
        source_type: studioSelectedSource.type,
        source_identifier: studioSelectedSource.identifier,
        author: studioSelectedSource.author,
        book_title_ar: studioSelectedSource.title_ar,
        book_title_en: studioSelectedSource.title_en,
        target_lang: targetLang,
        edition_mode: editionMode,
        include_rag_glossary: includeGlossary,
        max_chunks: chunkLimit > 0 ? chunkLimit : null
      };

      const res = await fetchWithTimeout(getApiUrl('/api/translation/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 5000);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }

      const d = await res.json();
      studioActiveJobId = d.job_id;
      showToast('Translation job active in background');

      // Start Polling
      if (studioPollTimer) clearInterval(studioPollTimer);
      studioPollTimer = setInterval(async () => {
        if (!studioActiveJobId) return;
        try {
          const stRes = await fetchWithTimeout(getApiUrl(`/api/translation/status/${studioActiveJobId}`), {}, 2500);
          if (!stRes.ok) return;
          const job = await stRes.json();

          if (monitorBadge) monitorBadge.textContent = job.status_message || job.status || 'Translating';
          if (monitorProgress) monitorProgress.textContent = `${job.current_chunk || 0}/${job.total_chunks || 0} (${job.progress_pct || 0}%)`;
          if (monitorFill) monitorFill.style.width = `${job.progress_pct || 0}%`;

          // RAG Roots
          if (job.active_rag_roots && monitorRoots) {
            monitorRoots.innerHTML = job.active_rag_roots.map(r => `<span class="root-tag">${escapeHtml(r)}</span>`).join('');
          }

          // Live translated snippet
          if (job.last_translated_snippet && monitorPreview) {
            monitorPreview.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-primary); line-height: 1.5;">${escapeHtml(job.last_translated_snippet)}</div>`;
          }

          if (job.status === 'completed') {
            clearInterval(studioPollTimer);
            studioPollTimer = null;
            completedBookId = job.book_id;
            if (monitorBadge) monitorBadge.textContent = 'Codex Complete';
            if (monitorFill) monitorFill.style.width = '100%';
            if (monitorProgress) monitorProgress.textContent = '100%';

            startBtn.style.display = 'none';
            if (openReaderBtn) {
              openReaderBtn.style.display = 'flex';
            }
            showToast('AynEngine translation complete! Codex indexed.');
          } else if (job.status === 'failed') {
            clearInterval(studioPollTimer);
            studioPollTimer = null;
            if (monitorBadge) monitorBadge.textContent = 'Failed';
            startBtn.disabled = false;
            startBtn.textContent = 'Retry Translation';
            showToast(`Translation error: ${job.error || 'Check server logs'}`);
          }
        } catch (_) {}
      }, 1200);

    } catch (err) {
      startBtn.disabled = false;
      startBtn.textContent = 'Start AynEngine Translation';
      showToast(`Error: ${err.message}`);
    }
  });

  // Open in Reader Button
  openReaderBtn?.addEventListener('click', async () => {
    closeTranslationStudio();
    await loadLibrary();
    if (completedBookId && window.selectBook) {
      await window.selectBook(completedBookId);
      showToast('Opened newly translated codex in reader');
    }
  });
}
