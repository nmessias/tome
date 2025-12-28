/**
 * Reader for Kindle e-ink
 * ES5 compatible, optimized for e-ink performance
 */
(function() {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================

  var S = {
    // DOM elements (cached on init)
    els: {},
    // Base class names for fast class toggling
    base: {},
    // Pagination
    page: 0,
    totalPages: 1,
    totalPagesStr: ' / 1',
    stepSize: 0,
    // UI visibility
    uiVisible: true,
    hideTimeout: null,
    resizeTimeout: null,
    urlTimeout: null,
    // Font settings
    fontSizes: [14, 16, 18, 20, 22, 24, 28, 32],
    fontIndex: 2,
    // SPA navigation
    cache: {},
    chapterId: null
  };

  // ============================================================
  // STORAGE
  // ============================================================

  function setCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/';
  }

  function saveSettings() {
    var settings = JSON.stringify({ font: S.fontSizes[S.fontIndex] });
    setCookie('reader_settings', settings);
    try {
      localStorage.setItem('readerFontSize', S.fontSizes[S.fontIndex]);
    } catch (e) {}
  }

  // ============================================================
  // UI VISIBILITY
  // ============================================================

  function startHideTimer() {
    if (S.hideTimeout) clearTimeout(S.hideTimeout);
    S.hideTimeout = setTimeout(function() { setUI(false); }, 3000);
  }

  function setUI(visible) {
    if (visible === S.uiVisible) return;
    
    var hiddenClass = visible ? '' : ' hidden';
    S.els.header.className = S.base.header + hiddenClass;
    S.els.footer.className = S.base.footer + hiddenClass;
    S.els.indicator.className = S.base.indicator + hiddenClass;
    S.uiVisible = visible;
    
    if (visible) {
      updateIndicator();
      startHideTimer();
    }
  }

  function toggleUI() {
    if (S.uiVisible && S.hideTimeout) clearTimeout(S.hideTimeout);
    setUI(!S.uiVisible);
  }

  // ============================================================
  // FONT SIZE
  // ============================================================

  function detectFontSize() {
    // Read from server-rendered inline style
    var style = S.els.content.style.fontSize;
    if (style) {
      var size = parseInt(style, 10);
      for (var i = 0; i < S.fontSizes.length; i++) {
        if (S.fontSizes[i] === size) {
          S.fontIndex = i;
          return;
        }
      }
    }
  }

  function applyFontSize() {
    S.els.content.style.fontSize = S.fontSizes[S.fontIndex] + 'px';
    
    var display = document.querySelector('.font-size-display');
    if (display) display.textContent = S.fontSizes[S.fontIndex] + 'px';
    
    saveSettings();
    
    setTimeout(function() {
      updatePages();
      goToPage(0);
    }, 100);
  }

  function changeFontSize(delta) {
    var newIndex = S.fontIndex + delta;
    if (newIndex >= 0 && newIndex < S.fontSizes.length) {
      S.fontIndex = newIndex;
      applyFontSize();
    }
  }

  // ============================================================
  // SETTINGS MODAL
  // ============================================================

  function openModal(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (S.hideTimeout) clearTimeout(S.hideTimeout);
    S.els.modal.className = S.base.modal + ' open';
  }

  function closeModal() {
    S.els.modal.className = S.base.modal;
    startHideTimer();
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  function updatePages() {
    var columnWidth = S.els.content.offsetWidth;
    var columnGap = window.innerWidth * 0.05;
    S.stepSize = columnWidth + columnGap;
    
    var scrollW = S.els.content.scrollWidth;
    S.totalPages = Math.max(1, Math.round(scrollW / S.stepSize));
    S.totalPagesStr = ' / ' + S.totalPages;
    
    updateIndicator();
  }

  function updateIndicator() {
    S.els.indicator.textContent = (S.page + 1) + S.totalPagesStr;
  }

  function scheduleUrlUpdate() {
    if (S.urlTimeout) clearTimeout(S.urlTimeout);
    S.urlTimeout = setTimeout(updateUrl, 500);
  }

  function updateUrl() {
    if (window.history && window.history.replaceState && S.chapterId) {
      var newUrl = '/chapter/' + S.chapterId;
      if (S.page > 0) newUrl += '?p=' + (S.page + 1);
      try {
        window.history.replaceState({ chapterId: S.chapterId, page: S.page }, '', newUrl);
      } catch (e) {}
    }
  }

  function goToPage(page) {
    if (page < 0) page = 0;
    if (page >= S.totalPages) page = S.totalPages - 1;
    goToPageFast(page);
  }

  function goToPageFast(page) {
    S.page = page;
    S.els.content.scrollLeft = page * S.stepSize;
    if (S.uiVisible) updateIndicator();
    scheduleUrlUpdate();
  }

  function nextPage() {
    if (S.page < S.totalPages - 1) {
      goToPageFast(S.page + 1);
    } else {
      // At last page, go to next chapter if available
      var nextId = S.els.navNext && S.els.navNext.getAttribute('data-chapter-id');
      if (nextId) {
        navigateToChapter(nextId, false);
      } else {
        setUI(true);
      }
    }
  }

  function prevPage() {
    if (S.page > 0) {
      goToPageFast(S.page - 1);
    } else {
      // At first page, go to prev chapter (last page) if available
      var prevId = S.els.navPrev && S.els.navPrev.getAttribute('data-chapter-id');
      if (prevId) {
        navigateToChapter(prevId, true);
      } else {
        setUI(true);
      }
    }
  }

  function getInitialPage() {
    var match = window.location.search.match(/[?&]p=(\d+)/);
    if (match) return Math.max(0, parseInt(match[1], 10) - 1);
    return 0;
  }

  // ============================================================
  // SPA NAVIGATION
  // ============================================================

  function fetchChapter(id, callback) {
    if (S.cache[id]) {
      callback(S.cache[id]);
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/chapter/' + id, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          S.cache[id] = JSON.parse(xhr.responseText);
          callback(S.cache[id]);
        } catch (e) {
          callback(null);
        }
      }
    };
    xhr.send();
  }

  function preloadChapters() {
    var prevId = S.els.navPrev && S.els.navPrev.getAttribute('data-chapter-id');
    var nextId = S.els.navNext && S.els.navNext.getAttribute('data-chapter-id');
    
    if (prevId && !S.cache[prevId]) fetchChapter(prevId, function() {});
    if (nextId && !S.cache[nextId]) fetchChapter(nextId, function() {});
  }

  function updateNavButtons(prevId, nextId) {
    if (S.els.navPrev) {
      S.els.navPrev.disabled = !prevId;
      S.els.navPrev.setAttribute('data-chapter-id', prevId || '');
    }
    if (S.els.navNext) {
      S.els.navNext.disabled = !nextId;
      S.els.navNext.setAttribute('data-chapter-id', nextId || '');
    }
  }

  function renderChapter(chapter, goToLastPage) {
    // Update content
    S.els.content.innerHTML = chapter.content;
    
    // Update title
    if (S.els.titleEl) S.els.titleEl.textContent = chapter.title;
    document.title = chapter.title + ' - E-ink Royal';
    
    // Update wrapper data attributes
    if (S.els.wrapper) {
      S.els.wrapper.setAttribute('data-chapter-id', chapter.id);
      S.els.wrapper.setAttribute('data-fiction-id', chapter.fictionId);
    }
    
    // Update state
    S.chapterId = chapter.id;
    
    // Update nav buttons
    updateNavButtons(chapter.prevChapterId, chapter.nextChapterId);
    
    // Reset pagination
    S.page = 0;
    S.els.content.scrollLeft = 0;
    
    // Recalculate pages after content update
    setTimeout(function() {
      updatePages();
      if (goToLastPage && S.totalPages > 1) {
        goToPage(S.totalPages - 1);
      }
      preloadChapters();
    }, 100);
  }

  function navigateToChapter(id, goToLastPage) {
    var chapter = S.cache[id];
    
    if (!chapter) {
      // Not cached, do full page load
      window.location.href = '/chapter/' + id;
      return;
    }
    
    // Mark as read (fire and forget)
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/chapter/' + id, true);
    xhr.send();
    
    // Render chapter
    renderChapter(chapter, goToLastPage);
    
    // Update URL with pushState
    if (window.history && window.history.pushState) {
      try {
        window.history.pushState({ chapterId: id, page: 0 }, '', '/chapter/' + id);
      } catch (e) {}
    }
  }

  function onPopState(e) {
    if (!e.state || !e.state.chapterId) return;
    
    var chapter = S.cache[e.state.chapterId];
    var page = e.state.page || 0;
    
    if (chapter) {
      renderChapter(chapter, false);
      if (page > 0) {
        setTimeout(function() { goToPage(page); }, 150);
      }
    } else {
      // Not cached, do full page load
      var url = '/chapter/' + e.state.chapterId;
      if (page > 0) url += '?p=' + (page + 1);
      window.location.href = url;
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function cacheElements() {
    var els = S.els;
    
    els.content = document.querySelector('.reader-content');
    els.indicator = document.querySelector('.page-indicator');
    els.header = document.querySelector('.reader-header');
    els.footer = document.querySelector('.nav-fixed');
    els.wrapper = document.querySelector('.reader-wrapper');
    els.titleEl = document.querySelector('.chapter-title');
    els.navPrev = document.querySelector('.nav-prev');
    els.navNext = document.querySelector('.nav-next');
    els.modal = document.querySelector('.settings-modal');
    
    // Cache base class names for fast toggling
    S.base.header = els.header ? els.header.className : '';
    S.base.footer = els.footer ? els.footer.className : '';
    S.base.indicator = els.indicator ? els.indicator.className : '';
    S.base.modal = els.modal ? els.modal.className : '';
    
    // Get current chapter ID
    S.chapterId = els.wrapper ? els.wrapper.getAttribute('data-chapter-id') : null;
  }

  function attachHandlers() {
    // Tap zones - toggle UI
    var tapTop = document.querySelector('.tap-zone-top');
    var tapBottom = document.querySelector('.tap-zone-bottom');
    if (tapTop) tapTop.onclick = toggleUI;
    if (tapBottom) tapBottom.onclick = toggleUI;
    
    // Click zones - pagination
    var clickLeft = document.querySelector('.click-zone-left');
    var clickRight = document.querySelector('.click-zone-right');
    if (clickLeft) clickLeft.onclick = prevPage;
    if (clickRight) clickRight.onclick = nextPage;
    
    // Settings modal
    var settingsBtn = document.querySelector('.settings-btn');
    var settingsClose = document.querySelector('.settings-close');
    
    if (settingsBtn) settingsBtn.onclick = openModal;
    if (settingsClose) settingsClose.onclick = closeModal;
    
    // Click outside modal to close
    if (S.els.modal) {
      S.els.modal.onclick = function(e) {
        if (e.target === S.els.modal) closeModal();
      };
    }
    
    // Font size buttons
    var fontDecrease = document.querySelector('.font-decrease');
    var fontIncrease = document.querySelector('.font-increase');
    if (fontDecrease) fontDecrease.onclick = function() { changeFontSize(-1); };
    if (fontIncrease) fontIncrease.onclick = function() { changeFontSize(1); };
    
    // Nav button clicks (event delegation)
    if (S.els.footer) {
      S.els.footer.onclick = function(e) {
        var target = e.target;
        if (target.tagName !== 'BUTTON') return;
        
        var id = target.getAttribute('data-chapter-id');
        if (!id) return;
        
        var goToLast = target.className.indexOf('nav-prev') !== -1;
        navigateToChapter(id, goToLast);
      };
    }
    
    // Browser back/forward
    window.onpopstate = onPopState;
    
    // Window resize (debounced)
    window.onresize = function() {
      if (S.resizeTimeout) clearTimeout(S.resizeTimeout);
      S.resizeTimeout = setTimeout(function() {
        updatePages();
        goToPage(S.page);
      }, 150);
    };
  }

  function init() {
    cacheElements();
    detectFontSize();
    attachHandlers();
    
    // Update font display
    var display = document.querySelector('.font-size-display');
    if (display) display.textContent = S.fontSizes[S.fontIndex] + 'px';
    
    setTimeout(function() {
      updatePages();
      var initialPage = getInitialPage();
      if (initialPage > 0) goToPage(initialPage);
      startHideTimer();
      preloadChapters();
    }, 200);
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 500);
  }

})();
