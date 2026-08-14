/**
 * Reader for Kindle e-ink — Phase 1: unified /read/:source/... scheme (ADR-0002).
 * One navigation format for every source; source identity comes from the
 * wrapper's data attributes, never from URL forks.
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
    // Pagination
    page: 0,
    totalPages: 1,
    totalPagesStr: ' / 1',
    stepSize: 0,
    // UI visibility
    uiVisible: false,
    resizeTimeout: null,
    urlTimeout: null,
    // Font settings
    fontSizes: [14, 16, 18, 20, 22, 24, 28, 32],
    fontIndex: 2,
    // Line height settings
    lineHeights: [1.2, 1.4, 1.6, 1.8, 2.0, 2.4],
    lineHeightIndex: 2,
    // Desktop mode
    isDesktop: false,
    // SPA navigation (unified scheme)
    cache: {},
    source: null,       // source name, e.g. 'royalroad' | 'freewebnovel'
    fictionRef: null,   // fiction ref as it appears in /read/:source/:fictionRef
    chapterRef: null,   // current chapter ref
    trackProgress: false,
    // E-ink refresh (prevents ghosting)
    remoteWs: null,
    remoteToken: null,
    remoteConnected: false
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
    var theme = 'light';
    if (document.body.classList.contains('dark-mode')) theme = 'dark';
    else if (document.body.classList.contains('sepia-mode')) theme = 'sepia';
    
    var settings = JSON.stringify({
      font: S.fontSizes[S.fontIndex],
      lineHeight: S.lineHeights[S.lineHeightIndex],
      dark: theme === 'dark',
      theme: theme,
      readingWidth: S.widths[S.widthIndex]
    });
    setCookie('reader_settings', settings);
    try {
      localStorage.setItem('readerFontSize', S.fontSizes[S.fontIndex]);
    } catch (e) {}
  }

  // ============================================================
  // UI VISIBILITY
  // ============================================================

  function setUI(visible) {
    if (visible === S.uiVisible) return;
    S.uiVisible = visible;
    
    if (visible) {
      S.els.header.classList.add('visible');
      S.els.footer.classList.add('visible');
    } else {
      S.els.header.classList.remove('visible');
      S.els.footer.classList.remove('visible');
    }
  }

  function toggleUI() {
    setUI(!S.uiVisible);
  }

  // ============================================================
  // FONT SIZE
  // ============================================================

  function detectFontSize() {
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
    var lh = S.els.content.style.lineHeight;
    if (lh) {
      var lhVal = parseFloat(lh);
      for (var i = 0; i < S.lineHeights.length; i++) {
        if (S.lineHeights[i] === lhVal) {
          S.lineHeightIndex = i;
          break;
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
    S.els.modal.classList.add('open');
  }

  function closeModal() {
    S.els.modal.classList.remove('open');
  }

  // ============================================================
  // REMOTE CONTROL
  // ============================================================

  var REMOTE_STORAGE_KEY = 'tome_remote_token';
  var REMOTE_WS_URL_KEY = 'tome_remote_ws_url';

  function getStoredRemoteToken() {
    try {
      return sessionStorage.getItem(REMOTE_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getStoredRemoteWsUrl() {
    try {
      return sessionStorage.getItem(REMOTE_WS_URL_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveRemoteSession(token, wsUrl) {
    try {
      sessionStorage.setItem(REMOTE_STORAGE_KEY, token);
      sessionStorage.setItem(REMOTE_WS_URL_KEY, wsUrl);
    } catch (e) {}
  }

  function clearRemoteSession() {
    try {
      sessionStorage.removeItem(REMOTE_STORAGE_KEY);
      sessionStorage.removeItem(REMOTE_WS_URL_KEY);
    } catch (e) {}
  }

  function showRemoteIcon(show) {
    var icon = document.getElementById('remote-icon');
    if (icon) {
      icon.style.display = show ? 'inline' : 'none';
    }
  }

  function updateRemoteStatus(text) {
    var status = document.getElementById('remote-status');
    if (status) status.textContent = text;
  }

  function updateRemoteUI() {
    var btn = document.getElementById('remote-btn');
    var disableBtn = document.getElementById('remote-disable-btn');
    var qrContainer = document.getElementById('remote-qr');
    var reconnectPrompt = document.getElementById('remote-reconnect');

    if (S.remoteWs && S.remoteWs.readyState === WebSocket.OPEN) {
      if (btn) btn.textContent = 'New QR';
      if (disableBtn) disableBtn.style.display = 'inline-block';
      if (reconnectPrompt) reconnectPrompt.style.display = 'none';
    } else if (S.remoteToken) {
      if (btn) btn.textContent = 'Enable';
      if (disableBtn) disableBtn.style.display = 'inline-block';
    } else {
      if (btn) btn.textContent = 'Enable';
      if (disableBtn) disableBtn.style.display = 'none';
      if (qrContainer) qrContainer.style.display = 'none';
      if (reconnectPrompt) reconnectPrompt.style.display = 'none';
    }

    showRemoteIcon(S.remoteConnected);
  }

  function showRemoteDisconnected() {
    S.remoteConnected = false;
    showRemoteIcon(false);
    
    var indicator = S.els.indicator;
    if (indicator) {
      var original = indicator.textContent;
      indicator.textContent = 'Remote disconnected';
      setTimeout(function() {
        indicator.textContent = original;
      }, 2000);
    }
  }

  function connectRemoteWs(wsUrl) {
    if (S.remoteWs) {
      try { S.remoteWs.close(); } catch (e) {}
    }

    try {
      S.remoteWs = new WebSocket(wsUrl);
    } catch (e) {
      updateRemoteStatus('Connection failed');
      updateRemoteUI();
      return;
    }

    S.remoteWs.onopen = function() {
      updateRemoteStatus('Connected - scan QR with phone');
      updateRemoteUI();
    };

    S.remoteWs.onmessage = function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'controller_joined') {
          S.remoteConnected = true;
          showRemoteIcon(true);
          updateRemoteStatus('Phone connected!');
        } else if (data.type === 'controller_left') {
          S.remoteConnected = false;
          showRemoteIcon(false);
          updateRemoteStatus('Phone disconnected');
        } else if (data.action === 'next') {
          nextPage();
        } else if (data.action === 'prev') {
          prevPage();
        }
      } catch (err) {}
    };

    S.remoteWs.onerror = function() {
      updateRemoteStatus('Connection error');
      updateRemoteUI();
    };

    S.remoteWs.onclose = function() {
      if (S.remoteConnected) {
        showRemoteDisconnected();
      }
      S.remoteWs = null;
      updateRemoteUI();
    };
  }

  function reconnectRemote() {
    var storedToken = getStoredRemoteToken();
    var storedWsUrl = getStoredRemoteWsUrl();
    
    if (!storedToken || !storedWsUrl) {
      clearRemoteSession();
      updateRemoteUI();
      return;
    }

    updateRemoteStatus('Reconnecting...');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/remote/validate/' + storedToken, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.valid) {
              S.remoteToken = storedToken;
              var qrImg = document.getElementById('remote-qr-img');
              if (qrImg) qrImg.src = '/api/remote/qr/' + storedToken;
              var qrContainer = document.getElementById('remote-qr');
              if (qrContainer) qrContainer.style.display = 'block';
              var reconnectPrompt = document.getElementById('remote-reconnect');
              if (reconnectPrompt) reconnectPrompt.style.display = 'none';
              connectRemoteWs(storedWsUrl);
              return;
            }
          } catch (e) {}
        }
        clearRemoteSession();
        S.remoteToken = null;
        updateRemoteStatus('Session expired');
        updateRemoteUI();
      }
    };
    xhr.send();
  }

  function disableRemote() {
    var token = S.remoteToken || getStoredRemoteToken();
    
    if (S.remoteWs) {
      try { S.remoteWs.close(); } catch (e) {}
      S.remoteWs = null;
    }

    if (token) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/remote/invalidate/' + token, true);
      xhr.send();
    }

    S.remoteToken = null;
    S.remoteConnected = false;
    clearRemoteSession();
    
    var qrContainer = document.getElementById('remote-qr');
    if (qrContainer) qrContainer.style.display = 'none';
    var reconnectPrompt = document.getElementById('remote-reconnect');
    if (reconnectPrompt) reconnectPrompt.style.display = 'none';
    
    updateRemoteStatus('Remote disabled');
    updateRemoteUI();
  }

  function enableRemote() {
    var btn = document.getElementById('remote-btn');
    var qrContainer = document.getElementById('remote-qr');
    var qrImg = document.getElementById('remote-qr-img');
    
    if (!btn || !qrContainer || !qrImg) return;

    btn.textContent = 'Loading...';
    btn.disabled = true;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/remote/create', true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        btn.disabled = false;
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            S.remoteToken = data.token;
            var wsUrl = data.wsUrl + '?role=reader';
            saveRemoteSession(data.token, wsUrl);
            qrImg.src = data.qrUrl;
            qrContainer.style.display = 'block';
            var reconnectPrompt = document.getElementById('remote-reconnect');
            if (reconnectPrompt) reconnectPrompt.style.display = 'none';
            updateRemoteStatus('Waiting for connection...');
            connectRemoteWs(wsUrl);
            updateRemoteUI();
          } catch (e) {
            btn.textContent = 'Error';
          }
        } else {
          btn.textContent = 'Error';
        }
      }
    };
    xhr.send();
  }

  function checkSavedRemoteSession() {
    var storedToken = getStoredRemoteToken();
    if (!storedToken) return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/remote/validate/' + storedToken, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.valid) {
              S.remoteToken = storedToken;
              var reconnectPrompt = document.getElementById('remote-reconnect');
              if (reconnectPrompt) reconnectPrompt.style.display = 'block';
              updateRemoteUI();
              return;
            }
          } catch (e) {}
        }
        clearRemoteSession();
      }
    };
    xhr.send();
  }

  // ============================================================
  // DESKTOP MODE
  // ============================================================

  function checkDesktop() {
    return window.innerWidth >= 768;
  }

  function updateDesktopProgress() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    var bar = document.querySelector('.progress-bar');
    if (bar) bar.style.width = Math.min(progress, 100) + '%';
  }

  function updateProgressBar() {
    if (S.isDesktop) {
      updateDesktopProgress();
      return;
    }
    var bar = document.querySelector('.progress-bar');
    if (bar && S.totalPages > 0) {
      bar.style.width = ((S.page + 1) / S.totalPages * 100) + '%';
    }
  }

  // ============================================================
  // LINE HEIGHT
  // ============================================================

  function applyLineHeight() {
    var height = S.lineHeights[S.lineHeightIndex];
    S.els.content.style.lineHeight = '' + height;
    var display = document.querySelector('.line-height-display');
    if (display) display.textContent = height.toFixed(1);
    saveSettings();
    if (!S.isDesktop) {
      setTimeout(function() {
        updatePages();
        goToPage(0);
      }, 100);
    }
  }

  function changeLineHeight(delta) {
    var newIndex = S.lineHeightIndex + delta;
    if (newIndex >= 0 && newIndex < S.lineHeights.length) {
      S.lineHeightIndex = newIndex;
      applyLineHeight();
    }
  }

  // ============================================================
  // THEME
  // ============================================================

  function setTheme(theme) {
    document.body.classList.remove('dark-mode', 'sepia-mode');
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else if (theme === 'sepia') {
      document.body.classList.add('sepia-mode');
    }
    var btns = document.querySelectorAll('.theme-btn');
    for (var i = 0; i < btns.length; i++) {
      var t = btns[i].getAttribute('data-theme');
      btns[i].classList.toggle('active', t === theme);
    }
    saveSettings();
  }

  // ============================================================
  // READING WIDTH
  // ============================================================

  S.widths = [480, 520, 560, 600, 650, 700, 750, 800, 900, 1000, 1200];
  S.widthIndex = 4; // default 650px

  function applyReadingWidth() {
    var width = S.widths[S.widthIndex];
    S.els.content.style.maxWidth = width + 'px';
    var display = document.querySelector('.width-display');
    if (display) display.textContent = width + 'px';
    saveSettings();
  }

  function changeReadingWidth(delta) {
    var newIndex = S.widthIndex + delta;
    if (newIndex >= 0 && newIndex < S.widths.length) {
      S.widthIndex = newIndex;
      applyReadingWidth();
    }
  }

  function detectReadingWidth() {
    var maxWidth = parseInt(S.els.content.style.maxWidth, 10);
    if (maxWidth) {
      for (var i = 0; i < S.widths.length; i++) {
        if (S.widths[i] === maxWidth) {
          S.widthIndex = i;
          return;
        }
      }
      // Find closest match
      var closest = 0;
      var minDiff = Math.abs(S.widths[0] - maxWidth);
      for (var i = 1; i < S.widths.length; i++) {
        var diff = Math.abs(S.widths[i] - maxWidth);
        if (diff < minDiff) { minDiff = diff; closest = i; }
      }
      S.widthIndex = closest;
    }
  }

  // ============================================================
  // KEYBOARD NAVIGATION
  // ============================================================

  function handleKeyboard(e) {
    if (S.els.modal && S.els.modal.classList.contains('open')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (S.isDesktop) {
      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          var prevRef = S.els.navPrev && S.els.navPrev.getAttribute('data-ref');
          if (prevRef) navigateToChapter(prevRef, true);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          var nextRef = S.els.navNext && S.els.navNext.getAttribute('data-ref');
          if (nextRef) navigateToChapter(nextRef, false);
          break;
        }
        case 'ArrowDown':
          e.preventDefault();
          window.scrollBy({ top: 60, behavior: 'instant' });
          break;
        case 'ArrowUp':
          e.preventDefault();
          window.scrollBy({ top: -60, behavior: 'instant' });
          break;
        case ' ':
        case 'PageDown':
          e.preventDefault();
          window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'instant' });
          break;
        case 'PageUp':
          e.preventDefault();
          window.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'instant' });
          break;
        case 'Home':
          e.preventDefault();
          window.scrollTo(0, 0);
          break;
        case 'End':
          e.preventDefault();
          window.scrollTo(0, document.documentElement.scrollHeight);
          break;
      }
    } else {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          nextPage();
          break;
      }
    }
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  function updatePages() {
    if (S.isDesktop) {
      updateDesktopProgress();
      return;
    }
    var columnWidth = S.els.content.offsetWidth;
    var columnGap = window.innerWidth * 0.05;
    S.stepSize = columnWidth + columnGap;
    
    var scrollW = S.els.content.scrollWidth;
    S.totalPages = Math.max(1, Math.round(scrollW / S.stepSize));
    S.totalPagesStr = ' / ' + S.totalPages;
    
    updateIndicator();
    updateProgressBar();
  }

  function updateIndicator() {
    S.els.indicator.textContent = (S.page + 1) + S.totalPagesStr;
    updateProgressBar();
  }

  function scheduleUrlUpdate() {
    if (S.urlTimeout) clearTimeout(S.urlTimeout);
    S.urlTimeout = setTimeout(updateUrl, 500);
  }

  function updateUrl() {
    if (window.history && window.history.replaceState && S.chapterRef) {
      var newUrl = chapterUrl(S.chapterRef);
      if (S.page > 0) newUrl += '?p=' + (S.page + 1);
      try {
        window.history.replaceState({ source: S.source, fictionRef: S.fictionRef, chapterRef: S.chapterRef, page: S.page }, '', newUrl);
      } catch (e) {}
    }
  }

  /** Unified chapter URL: /read/:source/:fictionRef/:chapterRef */
  function chapterUrl(chapterRef) {
    return '/read/' + encodeURIComponent(S.source) + '/' + encodeURIComponent(S.fictionRef) + '/' + encodeURIComponent(chapterRef);
  }

  /** Unified chapter API URL: /api/read/:source/:fictionRef/:chapterRef */
  function chapterApiUrl(chapterRef) {
    return '/api/read/' + encodeURIComponent(S.source) + '/' + encodeURIComponent(S.fictionRef) + '/' + encodeURIComponent(chapterRef);
  }

  function goToPage(page) {
    if (page < 0) page = 0;
    if (page >= S.totalPages) page = S.totalPages - 1;
    goToPageFast(page);
  }

  function goToPageFast(page) {
    S.page = page;
    S.els.content.scrollLeft = page * S.stepSize;
    updateIndicator();
    scheduleUrlUpdate();
  }

  // ============================================================
  // E-INK REFRESH
  // ============================================================

  function triggerEinkRefresh(callback) {
    // Flash screen black briefly to clear e-ink ghosting
    document.body.style.backgroundColor = '#000';
    setTimeout(function() {
      document.body.style.backgroundColor = '#fff';
      
      // Stabilization delay: give e-ink time to complete refresh cycle 
      // before rendering new content to prevent light font weights
      setTimeout(function() {
        if (callback) callback();
      }, 100);
    }, 100);
  }

  function nextPage() {
    if (S.page < S.totalPages - 1) {
      goToPageFast(S.page + 1);
    } else {
      // At last page, go to next chapter if available
      var nextRef = S.els.navNext && S.els.navNext.getAttribute('data-ref');
      if (nextRef) {
        triggerEinkRefresh(function() {
          navigateToChapter(nextRef, false);
        });
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
      var prevRef = S.els.navPrev && S.els.navPrev.getAttribute('data-ref');
      if (prevRef) {
        triggerEinkRefresh(function() {
          navigateToChapter(prevRef, true);
        });
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
  // SPA NAVIGATION (unified scheme)
  // ============================================================

  function fetchChapter(chapterRef, callback) {
    if (S.cache[chapterRef]) {
      callback(S.cache[chapterRef]);
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', chapterApiUrl(chapterRef), true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          S.cache[chapterRef] = data;
          callback(data);
        } catch (e) {
          callback(null);
        }
      }
    };
    xhr.send();
  }

  function preloadChapters() {
    var prevRef = S.els.navPrev && S.els.navPrev.getAttribute('data-ref');
    var nextRef = S.els.navNext && S.els.navNext.getAttribute('data-ref');
    
    if (prevRef && !S.cache[prevRef]) fetchChapter(prevRef, function() {});
    if (nextRef && !S.cache[nextRef]) fetchChapter(nextRef, function() {});
  }

  function updateNavButtons(prevRef, nextRef) {
    if (S.els.navPrev) {
      S.els.navPrev.disabled = !prevRef;
      S.els.navPrev.setAttribute('data-ref', prevRef || '');
    }
    if (S.els.navNext) {
      S.els.navNext.disabled = !nextRef;
      S.els.navNext.setAttribute('data-ref', nextRef || '');
    }
  }

  /** Fire-and-forget progress report (mark read / update local progress). */
  function reportProgress(chapterRef) {
    if (!S.trackProgress) return;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', chapterApiUrl(chapterRef), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ chapter: chapterRef }));
  }

  function renderChapter(chapter, goToLastPage) {
    S.els.content.innerHTML = chapter.content;
    
    if (S.els.titleEl) S.els.titleEl.textContent = chapter.title;
    document.title = chapter.title + ' - Tome';
    
    S.chapterRef = chapter.ref || S.chapterRef;
    
    updateNavButtons(chapter.prevRef, chapter.nextRef);
    
    S.page = 0;
    if (S.isDesktop) {
      window.scrollTo(0, 0);
    } else {
      S.els.content.scrollLeft = 0;
    }
    
    setTimeout(function() {
      updatePages();
      if (!S.isDesktop && goToLastPage && S.totalPages > 1) {
        goToPage(S.totalPages - 1);
      }
      preloadChapters();
    }, 100);
  }

  function navigateToChapter(chapterRef, goToLastPage) {
    var chapter = S.cache[chapterRef];
    
    if (!chapter) {
      // Not cached — full page load
      window.location.href = chapterUrl(chapterRef);
      return;
    }
    
    reportProgress(chapterRef);
    
    // Render chapter
    renderChapter(chapter, goToLastPage);
    
    // Update URL with pushState
    if (window.history && window.history.pushState) {
      try {
        window.history.pushState({ source: S.source, fictionRef: S.fictionRef, chapterRef: S.chapterRef, page: 0 }, '', chapterUrl(S.chapterRef));
      } catch (e) {}
    }
  }

  function onPopState(e) {
    if (!e.state) return;
    
    var chapterRef = e.state.chapterRef;
    var page = e.state.page || 0;
    
    if (!chapterRef) return;
    
    var chapter = S.cache[chapterRef];
    if (chapter) {
      renderChapter(chapter, false);
      if (page > 0) {
        setTimeout(function() { goToPage(page); }, 150);
      }
    } else {
      var url = chapterUrl(chapterRef);
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
    
    // Get current source/refs from the wrapper (unified data attributes)
    if (els.wrapper) {
      S.source = els.wrapper.getAttribute('data-source') || null;
      S.fictionRef = els.wrapper.getAttribute('data-fiction-ref') || null;
      S.chapterRef = els.wrapper.getAttribute('data-chapter-ref') || null;
      S.trackProgress = els.wrapper.getAttribute('data-track-progress') === '1';
    }
    
    // Fallback: detect from unified URL if data attributes weren't set
    if (!S.source || !S.fictionRef) {
      var urlMatch = window.location.pathname.match(/^\/read\/([\w-]+)\/([^/]+)\/([^/]+)/);
      if (urlMatch) {
        S.source = urlMatch[1];
        S.fictionRef = urlMatch[2];
        S.chapterRef = S.chapterRef || urlMatch[3];
      }
    }
  }

  function attachHandlers() {
    var tapTop = document.querySelector('.tap-zone-top');
    var tapBottom = document.querySelector('.tap-zone-bottom');
    if (tapTop) tapTop.onclick = toggleUI;
    if (tapBottom) tapBottom.onclick = toggleUI;
    
    var clickLeft = document.querySelector('.click-zone-left');
    var clickRight = document.querySelector('.click-zone-right');
    if (clickLeft) clickLeft.onclick = prevPage;
    if (clickRight) clickRight.onclick = nextPage;
    
    var settingsBtn = document.querySelector('.settings-btn');
    var settingsClose = document.querySelector('.settings-close');
    
    if (settingsBtn) settingsBtn.onclick = openModal;
    if (settingsClose) settingsClose.onclick = closeModal;
    
    if (S.els.modal) {
      S.els.modal.onclick = function(e) {
        if (e.target === S.els.modal) closeModal();
      };
    }
    
    var fontDecrease = document.querySelector('.font-decrease');
    var fontIncrease = document.querySelector('.font-increase');
    if (fontDecrease) fontDecrease.onclick = function() { changeFontSize(-1); };
    if (fontIncrease) fontIncrease.onclick = function() { changeFontSize(1); };
    
    var lineDecrease = document.querySelector('.line-decrease');
    var lineIncrease = document.querySelector('.line-increase');
    if (lineDecrease) lineDecrease.onclick = function() { changeLineHeight(-1); };
    if (lineIncrease) lineIncrease.onclick = function() { changeLineHeight(1); };
    
    var themeBtns = document.querySelectorAll('.theme-btn');
    for (var i = 0; i < themeBtns.length; i++) {
      (function(btn) {
        btn.onclick = function() {
          setTheme(btn.getAttribute('data-theme'));
        };
      })(themeBtns[i]);
    }
    
    var widthDecrease = document.querySelector('.width-decrease');
    var widthIncrease = document.querySelector('.width-increase');
    if (widthDecrease) widthDecrease.onclick = function() { changeReadingWidth(-1); };
    if (widthIncrease) widthIncrease.onclick = function() { changeReadingWidth(1); };
    
    var remoteBtn = document.getElementById('remote-btn');
    if (remoteBtn) remoteBtn.onclick = enableRemote;

    var remoteDisableBtn = document.getElementById('remote-disable-btn');
    if (remoteDisableBtn) remoteDisableBtn.onclick = disableRemote;

    var remoteReconnectBtn = document.getElementById('remote-reconnect-btn');
    if (remoteReconnectBtn) remoteReconnectBtn.onclick = reconnectRemote;
    
    document.onkeydown = handleKeyboard;
    
    if (S.els.footer) {
      S.els.footer.onclick = function(e) {
        var target = e.target;
        while (target && target.tagName !== 'BUTTON' && target !== S.els.footer) {
          target = target.parentNode;
        }
        if (!target || target.tagName !== 'BUTTON') return;
        
        var ref = target.getAttribute('data-ref');
        if (!ref) return;
        
        var goToLast = target.className.indexOf('nav-prev') !== -1;
        navigateToChapter(ref, goToLast);
      };
    }
    
    window.onpopstate = onPopState;
    
    window.onresize = function() {
      if (S.resizeTimeout) clearTimeout(S.resizeTimeout);
      S.resizeTimeout = setTimeout(function() {
        var wasDesktop = S.isDesktop;
        S.isDesktop = checkDesktop();
        if (S.isDesktop !== wasDesktop) {
          if (S.isDesktop) {
            setUI(false);
          } else {
            updatePages();
            goToPage(0);
          }
        } else if (!S.isDesktop) {
          updatePages();
          goToPage(S.page);
        }
        if (S.isDesktop) updateDesktopProgress();
      }, 150);
    };
    
    if (S.isDesktop) {
      window.addEventListener('scroll', function() {
        updateDesktopProgress();
      }, { passive: true });
    }
  }

  function init() {
    cacheElements();
    detectFontSize();
    detectReadingWidth();
    
    S.isDesktop = checkDesktop();
    
    attachHandlers();
    
    var display = document.querySelector('.font-size-display');
    if (display) display.textContent = S.fontSizes[S.fontIndex] + 'px';
    
    var lhDisplay = document.querySelector('.line-height-display');
    if (lhDisplay) lhDisplay.textContent = S.lineHeights[S.lineHeightIndex].toFixed(1);
    
    var widthDisplay = document.querySelector('.width-display');
    if (widthDisplay) widthDisplay.textContent = S.widths[S.widthIndex] + 'px';
    
    if (S.isDesktop) {
      S.els.content.classList.add('ready');
      updateDesktopProgress();
      preloadChapters();
      return;
    }
    
    updatePages();
    var initialPage = window.__INITIAL_PAGE__ ? window.__INITIAL_PAGE__ - 1 : getInitialPage();
    if (initialPage > 0) {
      goToPage(initialPage);
    }
    
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          S.els.content.classList.add('ready');
        });
      });
    } else {
      setTimeout(function() {
        S.els.content.classList.add('ready');
      }, 50);
    }
    
    preloadChapters();
    checkSavedRemoteSession();
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
