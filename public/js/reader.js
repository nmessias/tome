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
    // SPA navigation
    cache: {},
    chapterId: null,
    // E-ink refresh (prevents ghosting)
    refreshCount: 0,
    REFRESH_INTERVAL: 10,
    // Remote control
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
    var settings = JSON.stringify({ font: S.fontSizes[S.fontIndex] });
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
      if (callback) callback();
    }, 100);
  }

  function maybeRefresh(callback) {
    S.refreshCount++;
    if (S.refreshCount >= S.REFRESH_INTERVAL) {
      S.refreshCount = 0;
      triggerEinkRefresh(callback);
    } else if (callback) {
      callback();
    }
  }

  function nextPage() {
    if (S.page < S.totalPages - 1) {
      maybeRefresh(function() {
        goToPageFast(S.page + 1);
      });
    } else {
      // At last page, go to next chapter if available
      var nextId = S.els.navNext && S.els.navNext.getAttribute('data-chapter-id');
      if (nextId) {
        S.refreshCount = 0; // Reset on chapter change
        navigateToChapter(nextId, false);
      } else {
        setUI(true);
      }
    }
  }

  function prevPage() {
    if (S.page > 0) {
      maybeRefresh(function() {
        goToPageFast(S.page - 1);
      });
    } else {
      // At first page, go to prev chapter (last page) if available
      var prevId = S.els.navPrev && S.els.navPrev.getAttribute('data-chapter-id');
      if (prevId) {
        S.refreshCount = 0; // Reset on chapter change
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
    
    // Get current chapter ID
    S.chapterId = els.wrapper ? els.wrapper.getAttribute('data-chapter-id') : null;
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
    
    var remoteBtn = document.getElementById('remote-btn');
    if (remoteBtn) remoteBtn.onclick = enableRemote;

    var remoteDisableBtn = document.getElementById('remote-disable-btn');
    if (remoteDisableBtn) remoteDisableBtn.onclick = disableRemote;

    var remoteReconnectBtn = document.getElementById('remote-reconnect-btn');
    if (remoteReconnectBtn) remoteReconnectBtn.onclick = reconnectRemote;
    
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
    
    window.onpopstate = onPopState;
    
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
    
    var display = document.querySelector('.font-size-display');
    if (display) display.textContent = S.fontSizes[S.fontIndex] + 'px';
    
    updatePages();
    var initialPage = window.__INITIAL_PAGE__ ? window.__INITIAL_PAGE__ - 1 : getInitialPage();
    if (initialPage > 0) {
      goToPage(initialPage);
    }
    
    // Use requestAnimationFrame to ensure the scroll has been applied before showing
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
