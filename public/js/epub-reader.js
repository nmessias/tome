(function() {
  'use strict';

  var EpubCache = {
    dbName: 'TomeEpubCache',
    storeName: 'epubs',
    version: 1,
    db: null,

    open: function(callback) {
      if (EpubCache.db) {
        callback(null, EpubCache.db);
        return;
      }

      if (!window.indexedDB) {
        callback(new Error('IndexedDB not supported'), null);
        return;
      }

      var request = indexedDB.open(EpubCache.dbName, EpubCache.version);

      request.onerror = function() {
        callback(request.error, null);
      };

      request.onsuccess = function() {
        EpubCache.db = request.result;
        callback(null, EpubCache.db);
      };

      request.onupgradeneeded = function(event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(EpubCache.storeName)) {
          db.createObjectStore(EpubCache.storeName, { keyPath: 'id' });
        }
      };
    },

    get: function(bookId, callback) {
      EpubCache.open(function(err, db) {
        if (err) {
          callback(err, null);
          return;
        }

        try {
          var tx = db.transaction(EpubCache.storeName, 'readonly');
          var store = tx.objectStore(EpubCache.storeName);
          var request = store.get(bookId);

          request.onsuccess = function() {
            callback(null, request.result ? request.result.data : null);
          };

          request.onerror = function() {
            callback(request.error, null);
          };
        } catch (e) {
          callback(e, null);
        }
      });
    },

    set: function(bookId, arrayBuffer, callback) {
      EpubCache.open(function(err, db) {
        if (err) {
          callback(err);
          return;
        }

        try {
          var tx = db.transaction(EpubCache.storeName, 'readwrite');
          var store = tx.objectStore(EpubCache.storeName);
          var request = store.put({ id: bookId, data: arrayBuffer, cachedAt: Date.now() });

          request.onsuccess = function() {
            callback(null);
          };

          request.onerror = function() {
            callback(request.error);
          };
        } catch (e) {
          callback(e);
        }
      });
    },

    remove: function(bookId, callback) {
      EpubCache.open(function(err, db) {
        if (err) {
          if (callback) callback(err);
          return;
        }

        try {
          var tx = db.transaction(EpubCache.storeName, 'readwrite');
          var store = tx.objectStore(EpubCache.storeName);
          var request = store.delete(bookId);

          request.onsuccess = function() {
            if (callback) callback(null);
          };

          request.onerror = function() {
            if (callback) callback(request.error);
          };
        } catch (e) {
          if (callback) callback(e);
        }
      });
    }
  };

  var S = {
    book: null,
    rendition: null,
    bookId: null,
    currentCfi: null,
    currentProgress: 0,
    totalLocations: 0,
    uiVisible: false,
    saveTimeout: null,
    fontSizes: [14, 16, 18, 20, 22, 24, 28, 32],
    fontIndex: 2,
    isDark: false
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function setCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/';
  }

  function saveSettings() {
    var settings = JSON.stringify({ font: S.fontSizes[S.fontIndex], dark: S.isDark });
    setCookie('reader_settings', settings);
  }

  function setUI(visible) {
    if (visible === S.uiVisible) return;
    S.uiVisible = visible;

    var header = $('.epub-header');
    var footer = $('.nav-fixed');

    if (visible) {
      if (header) header.classList.add('visible');
      if (footer) footer.classList.add('visible');
    } else {
      if (header) header.classList.remove('visible');
      if (footer) footer.classList.remove('visible');
    }
  }

  function toggleUI() {
    setUI(!S.uiVisible);
  }

  function updateProgress(percent) {
    S.currentProgress = Math.round(percent);
    var display = $('.progress-display');
    if (display) display.textContent = S.currentProgress + '%';
  }

  function updatePageIndicator() {
    if (!S.rendition || !S.rendition.location) return;

    var loc = S.rendition.location;
    var current = loc.start ? loc.start.displayed.page : 1;
    var total = loc.start ? loc.start.displayed.total : 1;

    var currentEl = $('.page-current');
    var totalEl = $('.page-total');

    if (currentEl) currentEl.textContent = current;
    if (totalEl) totalEl.textContent = total;
  }

  function showError(message) {
    var loading = $('.epub-loading');
    if (loading) {
      loading.textContent = message;
      loading.classList.add('error');
      loading.classList.remove('hidden');
    }
  }

  function showLoading(message) {
    var loading = $('.epub-loading');
    if (loading) {
      loading.textContent = message || 'Loading...';
      loading.classList.remove('error');
      loading.classList.remove('hidden');
    }
  }

  function hideLoading() {
    var loading = $('.epub-loading');
    if (loading) {
      loading.classList.add('hidden');
    }
  }

  function scheduleSave() {
    if (S.saveTimeout) clearTimeout(S.saveTimeout);
    S.saveTimeout = setTimeout(saveProgress, 2000);
  }

  function saveProgress() {
    if (!S.bookId || !S.currentCfi) return;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/epub/' + S.bookId + '/progress', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
      cfi: S.currentCfi,
      progress: S.currentProgress
    }));
  }

  function nextPage() {
    if (S.rendition) {
      S.rendition.next();
    }
  }

  function prevPage() {
    if (S.rendition) {
      S.rendition.prev();
    }
  }

  function enableNavButtons() {
    var prevBtn = $('.nav-prev');
    var nextBtn = $('.nav-next');

    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
  }

  function applyFontSize() {
    if (!S.rendition) return;

    var size = S.fontSizes[S.fontIndex];
    S.rendition.themes.fontSize(size + 'px');

    var display = $('.font-size-display');
    if (display) display.textContent = size + 'px';

    saveSettings();
  }

  function changeFontSize(delta) {
    var newIndex = S.fontIndex + delta;
    if (newIndex >= 0 && newIndex < S.fontSizes.length) {
      S.fontIndex = newIndex;
      applyFontSize();
    }
  }

  function applyTheme() {
    if (S.isDark) {
      document.body.classList.add('dark-mode');
      if (S.rendition) {
        S.rendition.themes.override('color', '#fff');
        S.rendition.themes.override('background', '#000');
      }
    } else {
      document.body.classList.remove('dark-mode');
      if (S.rendition) {
        S.rendition.themes.override('color', '#000');
        S.rendition.themes.override('background', '#fff');
      }
    }

    updateThemeButtons();
    saveSettings();
  }

  function updateThemeButtons() {
    var lightBtn = $('.theme-light');
    var darkBtn = $('.theme-dark');

    if (lightBtn) {
      if (S.isDark) {
        lightBtn.classList.remove('active');
      } else {
        lightBtn.classList.add('active');
      }
    }

    if (darkBtn) {
      if (S.isDark) {
        darkBtn.classList.add('active');
      } else {
        darkBtn.classList.remove('active');
      }
    }
  }

  function setTheme(theme) {
    S.isDark = (theme === 'dark');
    applyTheme();
  }

  function openSettingsModal(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    var modal = $('.settings-modal');
    if (modal) modal.classList.add('open');
  }

  function closeSettingsModal() {
    var modal = $('.settings-modal');
    if (modal) modal.classList.remove('open');
  }

  function openDeleteModal(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    var modal = $('.delete-modal');
    if (modal) modal.classList.add('open');
  }

  function closeDeleteModal() {
    var modal = $('.delete-modal');
    if (modal) modal.classList.remove('open');
  }

  function initEpub() {
    var wrapper = $('.epub-wrapper');
    if (!wrapper) return;

    S.bookId = wrapper.getAttribute('data-book-id');
    var savedCfi = wrapper.getAttribute('data-cfi');
    var savedProgress = parseInt(wrapper.getAttribute('data-progress') || '0', 10);

    if (!S.bookId) return;

    if (typeof ePub === 'undefined') {
      showError('EPUB library not loaded');
      return;
    }

    showLoading('Loading book...');

    EpubCache.get(S.bookId, function(err, cachedData) {
      if (!err && cachedData) {
        loadEpubFromArrayBuffer(cachedData, savedCfi, savedProgress);
      } else {
        fetchAndCacheEpub(S.bookId, savedCfi, savedProgress);
      }
    });
  }

  function fetchAndCacheEpub(bookId, savedCfi, savedProgress) {
    var epubUrl = '/api/epub/' + bookId + '/file';

    showLoading('Downloading book...');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', epubUrl, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = function() {
      if (xhr.status !== 200) {
        showError('Failed to load book (error ' + xhr.status + ')');
        return;
      }

      var arrayBuffer = xhr.response;

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        showError('Book file is empty');
        return;
      }

      EpubCache.set(bookId, arrayBuffer, function(err) {
        if (err) {
          console.warn('Failed to cache EPUB:', err);
        }
      });

      loadEpubFromArrayBuffer(arrayBuffer, savedCfi, savedProgress);
    };

    xhr.onerror = function() {
      showError('Network error - check your connection');
    };

    xhr.ontimeout = function() {
      showError('Download timed out');
    };

    xhr.timeout = 60000;
    xhr.send();
  }

  function loadEpubFromArrayBuffer(arrayBuffer, savedCfi, savedProgress) {
    showLoading('Opening book...');

    try {
      S.book = ePub(arrayBuffer);
    } catch (e) {
      console.error('Failed to parse EPUB:', e);
      showError('Failed to open book');
      return;
    }

    var container = $('#epub-container');
    if (!container) {
      showError('Reader container not found');
      return;
    }

    var width = container.offsetWidth || window.innerWidth;
    var height = container.offsetHeight || window.innerHeight;

    S.rendition = S.book.renderTo(container, {
      width: width,
      height: height,
      spread: 'none',
      flow: 'paginated'
    });

    S.rendition.themes.fontSize(S.fontSizes[S.fontIndex] + 'px');

    S.rendition.themes.register('default', {
      'body': {
        'font-family': "'Literata', Georgia, serif !important",
        'line-height': '1.6 !important',
        'padding': '20px !important'
      },
      'p': {
        'margin': '0 0 1em 0 !important'
      }
    });
    S.rendition.themes.select('default');

    if (S.isDark) {
      S.rendition.themes.override('color', '#fff');
      S.rendition.themes.override('background', '#000');
    }

    if (savedCfi && savedCfi.length > 0) {
      S.rendition.display(savedCfi);
    } else {
      S.rendition.display();
    }

    S.book.ready.then(function() {
      hideLoading();
      return S.book.locations.generate(1024);
    }).then(function(locations) {
      S.totalLocations = locations.length;

      if (savedProgress > 0) {
        updateProgress(savedProgress);
      }

      enableNavButtons();
    }).catch(function(err) {
      console.error('Error during setup:', err);
      hideLoading();
      enableNavButtons();
    });

    S.rendition.on('relocated', function(location) {
      S.currentCfi = location.start.cfi;

      if (S.totalLocations > 0 && location.start.location !== undefined) {
        var percent = (location.start.location / S.totalLocations) * 100;
        updateProgress(percent);
      }

      updatePageIndicator();
      scheduleSave();
    });

    S.rendition.on('rendered', function() {
      updatePageIndicator();
    });
  }

  function handleDeleteSubmit(e) {
    e.preventDefault();
    var form = e.target;

    EpubCache.remove(S.bookId, function() {
      form.submit();
    });
  }

  function detectInitialSettings() {
    S.isDark = document.body.classList.contains('dark-mode');

    var container = $('#epub-container');
    if (container && container.style.fontSize) {
      var size = parseInt(container.style.fontSize, 10);
      for (var i = 0; i < S.fontSizes.length; i++) {
        if (S.fontSizes[i] === size) {
          S.fontIndex = i;
          break;
        }
      }
    }

    updateThemeButtons();
  }

  function attachHandlers() {
    var tapTop = $('.tap-zone-top');
    var tapBottom = $('.tap-zone-bottom');
    if (tapTop) tapTop.onclick = toggleUI;
    if (tapBottom) tapBottom.onclick = toggleUI;

    var clickLeft = $('.click-zone-left');
    var clickRight = $('.click-zone-right');
    if (clickLeft) clickLeft.onclick = prevPage;
    if (clickRight) clickRight.onclick = nextPage;

    var prevBtn = $('.nav-prev');
    var nextBtn = $('.nav-next');
    if (prevBtn) prevBtn.onclick = prevPage;
    if (nextBtn) nextBtn.onclick = nextPage;

    var settingsBtn = $('.settings-btn');
    var settingsClose = $('.settings-close');
    var settingsModal = $('.settings-modal');

    if (settingsBtn) settingsBtn.onclick = openSettingsModal;
    if (settingsClose) settingsClose.onclick = closeSettingsModal;
    if (settingsModal) {
      settingsModal.onclick = function(e) {
        if (e.target === settingsModal) closeSettingsModal();
      };
    }

    var fontDecrease = $('.font-decrease');
    var fontIncrease = $('.font-increase');
    if (fontDecrease) fontDecrease.onclick = function() { changeFontSize(-1); };
    if (fontIncrease) fontIncrease.onclick = function() { changeFontSize(1); };

    var lightBtn = $('.theme-light');
    var darkBtn = $('.theme-dark');
    if (lightBtn) lightBtn.onclick = function() { setTheme('light'); };
    if (darkBtn) darkBtn.onclick = function() { setTheme('dark'); };

    var deleteCancel = $('.delete-cancel');
    var deleteModal = $('.delete-modal');
    var deleteForm = $('.delete-modal form');

    if (deleteCancel) deleteCancel.onclick = closeDeleteModal;
    if (deleteModal) {
      deleteModal.onclick = function(e) {
        if (e.target === deleteModal) closeDeleteModal();
      };
    }
    if (deleteForm) {
      deleteForm.onsubmit = handleDeleteSubmit;
    }

    window.onresize = function() {
      if (S.rendition && S.rendition.manager) {
        var container = $('#epub-container');
        if (container) {
          S.rendition.resize(container.offsetWidth, container.offsetHeight);
        }
      }
    };

    window.onbeforeunload = function() {
      if (S.currentCfi) {
        saveProgress();
      }
    };
  }

  function init() {
    detectInitialSettings();
    attachHandlers();
    initEpub();

    var display = $('.font-size-display');
    if (display) display.textContent = S.fontSizes[S.fontIndex] + 'px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
