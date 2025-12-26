// HTML templates for E-ink optimized rendering
import type { Fiction, FollowedFiction, Chapter, ChapterContent, ToplistType, HistoryEntry } from "./types";
import type { CacheStats } from "./db";
import { TOPLISTS } from "./types";

// Base CSS for all pages - E-ink optimized
const BASE_CSS = `
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 12px;
  background: #fff;
  color: #000;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 18px;
  line-height: 1.5;
}
body.dark-mode {
  background: #000;
  color: #fff;
}
body.dark-mode a { color: #fff; }
body.dark-mode a:visited { color: #ccc; }
body.dark-mode .btn { background: #fff; color: #000; border-color: #fff; }
body.dark-mode .btn:visited { color: #000; }
body.dark-mode .btn-outline { background: #000; color: #fff; border-color: #fff; }
body.dark-mode .btn-outline:visited { color: #fff; }
body.dark-mode .error { background: #fff; color: #000; }
body.dark-mode .success { border-color: #fff; }
body.dark-mode li { border-color: #fff; }
body.dark-mode .nav { border-color: #fff; }
body.dark-mode .pagination { border-color: #fff; }
body.dark-mode form input, body.dark-mode form textarea { background: #000; color: #fff; border-color: #fff; }
a { color: #000; text-decoration: underline; }
a:visited { color: #333; }
h1 { font-size: 24px; margin: 0 0 16px 0; }
h2 { font-size: 20px; margin: 16px 0 12px 0; }
.btn {
  display: inline-block;
  padding: 14px 20px;
  background: #000;
  color: #fff;
  border: 2px solid #000;
  font-size: 16px;
  text-decoration: none;
  margin: 4px;
  cursor: pointer;
}
.btn:visited { color: #fff; }
.btn-outline {
  background: #fff;
  color: #000;
}
.btn-outline:visited { color: #000; }
ul { list-style: none; padding: 0; margin: 0; }
li {
  padding: 12px 0;
  border-bottom: 1px solid #000;
}
li:last-child { border-bottom: none; }
.nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #000;
}
.fiction-item {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #000;
}
.fiction-title { font-weight: bold; font-size: 18px; }
.fiction-meta { font-size: 14px; color: #333; margin-top: 4px; }
body.dark-mode .fiction-meta { color: #ccc; }
.fiction-desc { background: #f5f5f5; }
body.dark-mode .fiction-desc { background: #222; border-color: #fff; }
body.dark-mode .fiction-description { background: #222; border-color: #fff; }
body.dark-mode .desc-toggle { background: #000; color: #fff; border-color: #fff; }
.chapter-list li { padding: 10px 0; }
.error {
  background: #000;
  color: #fff;
  padding: 16px;
  margin: 16px 0;
}
.success {
  border: 2px solid #000;
  padding: 16px;
  margin: 16px 0;
}
form label {
  display: block;
  margin: 12px 0 4px 0;
  font-weight: bold;
}
form input[type="text"], form textarea {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 2px solid #000;
  font-family: monospace;
}
form textarea { min-height: 80px; resize: vertical; }
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  padding-top: 16px;
  border-top: 1px solid #000;
}
.pagination .page-info {
  font-size: 14px;
  min-width: 60px;
  text-align: center;
}
.dark-toggle {
  position: fixed;
  bottom: 12px;
  right: 12px;
  padding: 8px 12px;
  font-size: 14px;
  background: #000;
  color: #fff;
  border: 2px solid #000;
  cursor: pointer;
  z-index: 100;
}
body.dark-mode .dark-toggle {
  background: #fff;
  color: #000;
  border-color: #fff;
}
`;

// Reader-specific CSS for paginated chapter view
const READER_CSS = `
@font-face {
  font-family: 'Literata';
  src: url('/fonts/Literata-Variable.ttf') format('truetype');
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Literata';
  src: url('/fonts/Literata-Italic-Variable.ttf') format('truetype');
  font-weight: 200 900;
  font-style: italic;
  font-display: swap;
}
${BASE_CSS}
body { padding: 0; height: 100vh; overflow: hidden; margin: 0; }
.reader-header {
  padding: 8px 12px;
  border-bottom: 2px solid #000;
  background: #fff;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  transition: transform 0.3s ease;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.reader-header.hidden {
  transform: translateY(-100%);
}
.header-left {
  flex: 0 0 65%;
  min-width: 0;
}
.header-right {
  flex: 0 0 35%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.reader-header .header-nav {
  display: flex;
  gap: 6px;
  font-size: 11px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.reader-header .header-nav a {
  color: #000;
  text-decoration: none;
  padding: 2px 6px;
  border: 1px solid #999;
}
.reader-header h1 { 
  font-size: 14px; 
  margin: 0; 
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reader-header .fiction-link { 
  font-size: 12px; 
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reader-header .settings-btn {
  background: #fff;
  border: 1px solid #999;
  padding: 4px 10px;
  font-size: 14px;
  cursor: pointer;
}
.reader-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
}
.reader-content {
  font-family: 'Literata', Georgia, serif;
  font-weight: 400;
  column-width: 95vw;
  column-gap: 5vw;
  height: 100%;
  width: 95%;
  overflow-x: scroll;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.reader-content::-webkit-scrollbar {
  display: none;
}
.reader-content p {
  margin: 0 0 1em 0;
  text-align: justify;
}
.reader-content em, .reader-content i {
  font-style: italic;
}
.reader-content strong, .reader-content b {
  font-weight: 700;
}
.click-zone {
  position: absolute;
  top: 15%;
  bottom: 15%;
  width: 40%;
  z-index: 5;
  cursor: pointer;
}
.click-zone-left { left: 0; }
.click-zone-right { right: 0; }
.tap-zone-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 15%;
  z-index: 6;
  cursor: pointer;
}
.tap-zone-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 15%;
  z-index: 6;
  cursor: pointer;
}
.page-indicator {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: #000;
  color: #fff;
  padding: 4px 12px;
  font-size: 14px;
  z-index: 10;
  transition: opacity 0.3s ease;
}
.page-indicator.hidden {
  opacity: 0;
}
.nav-fixed {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 4px;
  background: #fff;
  border-top: 1px solid #ccc;
  z-index: 10;
  transition: transform 0.3s ease;
}
.nav-fixed.hidden {
  transform: translateY(100%);
}
.nav-fixed .btn {
  flex: 1;
  text-align: center;
  margin: 0 2px;
  padding: 6px 4px;
  font-size: 12px;
  background: #fff;
  color: #000;
  border: 1px solid #999;
}
.settings-modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  justify-content: center;
  align-items: center;
}
.settings-modal.open { display: flex; }
.settings-panel {
  background: #fff;
  border: 2px solid #000;
  padding: 16px;
  width: 90%;
  max-width: 300px;
}
.settings-panel h2 { margin: 0 0 16px 0; font-size: 18px; }
.settings-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.settings-row label { font-size: 14px; }
.font-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}
.font-controls button {
  width: 36px;
  height: 36px;
  font-size: 18px;
  background: #fff;
  border: 1px solid #000;
  cursor: pointer;
}
.font-controls span {
  min-width: 40px;
  text-align: center;
  font-size: 14px;
}
.settings-close {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: #000;
  color: #fff;
  border: none;
  font-size: 14px;
  cursor: pointer;
}
/* Reader dark mode */
body.dark-mode .reader-header { background: #000; border-color: #fff; }
body.dark-mode .reader-header .header-nav a { color: #fff; border-color: #666; }
body.dark-mode .reader-header .settings-btn { background: #000; color: #fff; border-color: #666; }
body.dark-mode .page-indicator { background: #fff; color: #000; }
body.dark-mode .nav-fixed { background: #000; border-color: #444; }
body.dark-mode .nav-fixed .btn { background: #000; color: #fff; border-color: #666; }
body.dark-mode .settings-panel { background: #000; border-color: #fff; color: #fff; }
body.dark-mode .font-controls button { background: #000; color: #fff; border-color: #fff; }
body.dark-mode .settings-close { background: #fff; color: #000; }
body.dark-mode .settings-modal { background: rgba(255,255,255,0.3); }
.dark-mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dark-mode-toggle button {
  padding: 4px 12px;
  background: #fff;
  border: 1px solid #000;
  cursor: pointer;
  font-size: 12px;
}
body.dark-mode .dark-mode-toggle button { background: #000; color: #fff; border-color: #fff; }
body.dark-mode .dark-mode-toggle button.active { background: #fff; color: #000; }
.dark-mode-toggle button.active { background: #000; color: #fff; }
`;

// Reader JavaScript for click-based pagination with SPA navigation
// NOTE: Using ES5 syntax for Kindle browser compatibility (no arrow functions, optional chaining, etc.)
const READER_JS = `
<script>
(function() {
  var content = document.querySelector('.reader-content');
  var indicator = document.querySelector('.page-indicator');
  var header = document.querySelector('.reader-header');
  var footer = document.querySelector('.nav-fixed');
  var wrapper = document.querySelector('.reader-wrapper');
  var titleEl = document.querySelector('.chapter-title');
  var currentPage = 0;
  var columnWidth = 0;
  var columnGap = 0;
  var stepSize = 0;
  var totalPages = 1;
  var uiVisible = true;
  var hideTimeout = null;
  
  // Chapter cache for SPA navigation
  var chapterCache = {};
  var currentChapterId = wrapper ? wrapper.getAttribute('data-chapter-id') : null;
  
  // Auto-hide UI after 3 seconds
  function startHideTimer() {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideUI, 3000);
  }
  
  function hideUI() {
    if (uiVisible) {
      header.className = header.className + ' hidden';
      footer.className = footer.className + ' hidden';
      indicator.className = indicator.className + ' hidden';
      uiVisible = false;
    }
  }
  
  function showUI() {
    header.className = header.className.replace(' hidden', '');
    footer.className = footer.className.replace(' hidden', '');
    indicator.className = indicator.className.replace(' hidden', '');
    uiVisible = true;
    startHideTimer();
  }
  
  function toggleUI() {
    if (uiVisible) {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideUI();
    } else {
      showUI();
    }
  }
  
  // Tap zones for showing/hiding UI
  var tapTop = document.querySelector('.tap-zone-top');
  var tapBottom = document.querySelector('.tap-zone-bottom');
  if (tapTop) tapTop.onclick = toggleUI;
  if (tapBottom) tapBottom.onclick = toggleUI;
  
  // Font size settings
  var fontSizes = [14, 16, 18, 20, 22, 24, 28, 32];
  var currentFontIndex = 2; // default 18px
  
  // Load saved font size
  try {
    var saved = localStorage.getItem('readerFontSize');
    if (saved) {
      var idx = -1;
      for (var i = 0; i < fontSizes.length; i++) {
        if (fontSizes[i] === parseInt(saved, 10)) {
          idx = i;
          break;
        }
      }
      if (idx !== -1) currentFontIndex = idx;
    }
  } catch(e) {}
  
  function applyFontSize() {
    content.style.fontSize = fontSizes[currentFontIndex] + 'px';
    var display = document.querySelector('.font-size-display');
    if (display) display.textContent = fontSizes[currentFontIndex] + 'px';
    try {
      localStorage.setItem('readerFontSize', fontSizes[currentFontIndex]);
    } catch(e) {}
    setTimeout(function() {
      updatePages();
      goToPage(0);
    }, 100);
  }
  
  function increaseFontSize() {
    if (currentFontIndex < fontSizes.length - 1) {
      currentFontIndex++;
      applyFontSize();
    }
  }
  
  function decreaseFontSize() {
    if (currentFontIndex > 0) {
      currentFontIndex--;
      applyFontSize();
    }
  }
  
  // Settings modal
  var modal = document.querySelector('.settings-modal');
  var settingsBtn = document.querySelector('.settings-btn');
  var settingsClose = document.querySelector('.settings-close');
  var fontDecrease = document.querySelector('.font-decrease');
  var fontIncrease = document.querySelector('.font-increase');
  
  if (settingsBtn) {
    settingsBtn.onclick = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (hideTimeout) clearTimeout(hideTimeout);
      if (modal) modal.className = modal.className + ' open';
    };
  }
  if (settingsClose) {
    settingsClose.onclick = function() {
      if (modal) modal.className = modal.className.replace(' open', '');
      startHideTimer();
    };
  }
  if (modal) {
    modal.onclick = function(e) {
      if (e.target === modal) {
        modal.className = modal.className.replace(' open', '');
        startHideTimer();
      }
    };
  }
  if (fontDecrease) fontDecrease.onclick = decreaseFontSize;
  if (fontIncrease) fontIncrease.onclick = increaseFontSize;
  
  // Dark mode
  var isDarkMode = false;
  try {
    isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) document.body.className = document.body.className + ' dark-mode';
  } catch(e) {}
  
  function updateDarkModeButtons() {
    var lightBtn = document.querySelector('.dark-mode-light');
    var darkBtn = document.querySelector('.dark-mode-dark');
    if (lightBtn) {
      if (isDarkMode) {
        lightBtn.className = lightBtn.className.replace(' active', '');
      } else if (lightBtn.className.indexOf('active') === -1) {
        lightBtn.className = lightBtn.className + ' active';
      }
    }
    if (darkBtn) {
      if (!isDarkMode) {
        darkBtn.className = darkBtn.className.replace(' active', '');
      } else if (darkBtn.className.indexOf('active') === -1) {
        darkBtn.className = darkBtn.className + ' active';
      }
    }
  }
  
  var lightModeBtn = document.querySelector('.dark-mode-light');
  var darkModeBtn = document.querySelector('.dark-mode-dark');
  
  if (lightModeBtn) {
    lightModeBtn.onclick = function() {
      isDarkMode = false;
      document.body.className = document.body.className.replace(' dark-mode', '');
      try { localStorage.setItem('darkMode', 'false'); } catch(e) {}
      updateDarkModeButtons();
    };
  }
  
  if (darkModeBtn) {
    darkModeBtn.onclick = function() {
      isDarkMode = true;
      if (document.body.className.indexOf('dark-mode') === -1) {
        document.body.className = document.body.className + ' dark-mode';
      }
      try { localStorage.setItem('darkMode', 'true'); } catch(e) {}
      updateDarkModeButtons();
    };
  }
  
  updateDarkModeButtons();
  
  function updatePages() {
    columnWidth = content.offsetWidth;
    columnGap = window.innerWidth * 0.05;
    stepSize = columnWidth + columnGap;
    var scrollW = content.scrollWidth;
    totalPages = Math.max(1, Math.round(scrollW / stepSize));
    updateIndicator();
    updateUrl();
  }
  
  function updateIndicator() {
    indicator.textContent = (currentPage + 1) + ' / ' + totalPages;
  }
  
  // Update URL with current chapter and page
  function updateUrl() {
    if (window.history && window.history.replaceState && currentChapterId) {
      var newUrl = '/chapter/' + currentChapterId;
      if (currentPage > 0) {
        newUrl += '?p=' + (currentPage + 1);
      }
      try {
        window.history.replaceState({ chapterId: currentChapterId, page: currentPage }, '', newUrl);
      } catch(e) {}
    }
  }
  
  function goToPage(page) {
    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;
    currentPage = page;
    content.scrollLeft = currentPage * stepSize;
    updateIndicator();
    updateUrl();
  }
  
  function nextPage() {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    } else {
      // At last page, try to go to next chapter if available
      var nextBtn = document.querySelector('.nav-next');
      if (nextBtn && nextBtn.getAttribute('data-chapter-id')) {
        navigateToChapter(nextBtn.getAttribute('data-chapter-id'));
      } else {
        showUI();
      }
    }
  }
  
  function prevPage() {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    } else {
      // At first page, try to go to prev chapter if available
      var prevBtn = document.querySelector('.nav-prev');
      if (prevBtn && prevBtn.getAttribute('data-chapter-id')) {
        var prevId = prevBtn.getAttribute('data-chapter-id');
        // Navigate to prev chapter and go to last page
        navigateToChapter(prevId, true);
      } else {
        showUI();
      }
    }
  }
  
  // Click zones for pagination
  var clickLeft = document.querySelector('.click-zone-left');
  var clickRight = document.querySelector('.click-zone-right');
  if (clickLeft) clickLeft.onclick = prevPage;
  if (clickRight) clickRight.onclick = nextPage;
  
  // Keyboard navigation (for testing on desktop)
  document.onkeydown = function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { nextPage(); if (e.preventDefault) e.preventDefault(); }
    if (e.key === 'ArrowLeft') { prevPage(); if (e.preventDefault) e.preventDefault(); }
  };
  
  // ============ SPA NAVIGATION ============
  
  // Fetch chapter data via XMLHttpRequest (ES5 compatible)
  function fetchChapter(chapterId, callback) {
    if (chapterCache[chapterId]) {
      callback(null, chapterCache[chapterId]);
      return;
    }
    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/chapter/' + chapterId, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            chapterCache[chapterId] = data;
            callback(null, data);
          } catch(e) {
            callback(e, null);
          }
        } else {
          callback(new Error('Failed to load chapter'), null);
        }
      }
    };
    xhr.send();
  }
  
  // Pre-load adjacent chapters
  function preloadChapters() {
    var prevBtn = document.querySelector('.nav-prev');
    var nextBtn = document.querySelector('.nav-next');
    
    if (prevBtn) {
      var prevId = prevBtn.getAttribute('data-chapter-id');
      if (prevId && !chapterCache[prevId]) {
        fetchChapter(prevId, function() {}); // Fire and forget
      }
    }
    
    if (nextBtn) {
      var nextId = nextBtn.getAttribute('data-chapter-id');
      if (nextId && !chapterCache[nextId]) {
        fetchChapter(nextId, function() {}); // Fire and forget
      }
    }
  }
  
  // Update nav button
  function updateNavButton(selector, chapterId, text) {
    var container = footer;
    var oldBtn = container.querySelector(selector);
    if (!oldBtn) return;
    
    var parent = oldBtn.parentNode;
    var newEl;
    
    if (chapterId) {
      newEl = document.createElement('button');
      newEl.className = 'btn ' + selector.replace('.', '');
      newEl.setAttribute('data-chapter-id', chapterId);
      newEl.textContent = text;
      newEl.onclick = function() { navigateToChapter(chapterId); };
    } else {
      newEl = document.createElement('span');
      newEl.className = 'btn btn-outline';
      newEl.style.opacity = '0.3';
      newEl.textContent = text;
    }
    
    parent.replaceChild(newEl, oldBtn);
  }
  
  // Navigate to a chapter (SPA style)
  // goToLastPage: if true, scroll to last page (for prev chapter navigation)
  function navigateToChapter(chapterId, goToLastPage) {
    var cached = chapterCache[chapterId];
    if (!cached) {
      // Fallback to regular navigation if not cached
      window.location.href = '/chapter/' + chapterId;
      return;
    }
    
    // Trigger "mark as read" on Royal Road via authenticated request
    // This is a fire-and-forget POST request
    markChapterAsRead(chapterId);
    
    // Update content
    content.innerHTML = cached.content;
    
    // Update title
    if (titleEl) titleEl.textContent = cached.title;
    document.title = cached.title + ' - E-ink Road';
    
    // Update wrapper data attributes
    if (wrapper) {
      wrapper.setAttribute('data-chapter-id', cached.id);
      wrapper.setAttribute('data-fiction-id', cached.fictionId);
    }
    
    // Update current chapter ID
    currentChapterId = cached.id;
    
    // Update nav buttons
    updateNavButton('.nav-prev', cached.prevChapterId, '← Prev Ch');
    updateNavButton('.nav-next', cached.nextChapterId, 'Next Ch →');
    
    // Reset pagination
    currentPage = 0;
    content.scrollLeft = 0;
    
    // Update URL with pushState for back/forward support
    if (window.history && window.history.pushState) {
      try {
        window.history.pushState({ chapterId: cached.id, page: 0 }, '', '/chapter/' + cached.id);
      } catch(e) {}
    }
    
    // Recalculate pages after content update
    setTimeout(function() {
      updatePages();
      // If going to previous chapter, scroll to last page
      if (goToLastPage && totalPages > 1) {
        goToPage(totalPages - 1);
      }
      // Pre-load new adjacent chapters
      preloadChapters();
    }, 100);
  }
  
  // Mark chapter as read on Royal Road (fire and forget)
  function markChapterAsRead(chapterId) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/chapter/' + chapterId, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          console.log('Marked chapter ' + chapterId + ' as read');
        } else {
          console.log('Failed to mark chapter ' + chapterId + ' as read');
        }
      }
    };
    xhr.send('{}');
  }
  
  // Handle browser back/forward
  window.onpopstate = function(e) {
    if (e.state && e.state.chapterId) {
      var chapterId = e.state.chapterId;
      var page = e.state.page || 0;
      
      if (chapterCache[chapterId]) {
        // We have the chapter cached, update content
        var cached = chapterCache[chapterId];
        content.innerHTML = cached.content;
        if (titleEl) titleEl.textContent = cached.title;
        document.title = cached.title + ' - E-ink Road';
        if (wrapper) {
          wrapper.setAttribute('data-chapter-id', cached.id);
          wrapper.setAttribute('data-fiction-id', cached.fictionId);
        }
        currentChapterId = cached.id;
        updateNavButton('.nav-prev', cached.prevChapterId, '← Prev Ch');
        updateNavButton('.nav-next', cached.nextChapterId, 'Next Ch →');
        
        currentPage = 0;
        content.scrollLeft = 0;
        setTimeout(function() {
          updatePages();
          goToPage(page);
          preloadChapters();
        }, 100);
      } else {
        // Not cached, do a full page load
        window.location.href = '/chapter/' + chapterId + (page > 0 ? '?p=' + (page + 1) : '');
      }
    }
  };
  
  // Attach click handlers to nav buttons
  function attachNavHandlers() {
    var prevBtn = document.querySelector('.nav-prev');
    var nextBtn = document.querySelector('.nav-next');
    
    if (prevBtn && prevBtn.tagName === 'BUTTON') {
      prevBtn.onclick = function() {
        var id = prevBtn.getAttribute('data-chapter-id');
        if (id) navigateToChapter(id);
      };
    }
    
    if (nextBtn && nextBtn.tagName === 'BUTTON') {
      nextBtn.onclick = function() {
        var id = nextBtn.getAttribute('data-chapter-id');
        if (id) navigateToChapter(id);
      };
    }
  }
  
  // Parse initial page from URL
  function getInitialPage() {
    var match = window.location.search.match(/[?&]p=(\\d+)/);
    if (match) {
      return Math.max(0, parseInt(match[1], 10) - 1);
    }
    return 0;
  }
  
  // Initialize after a delay to let fonts load and layout settle
  function init() {
    applyFontSize();
    setTimeout(function() {
      updatePages();
      var initialPage = getInitialPage();
      if (initialPage > 0) {
        goToPage(initialPage);
      }
      startHideTimer();
      attachNavHandlers();
      preloadChapters();
    }, 200);
  }
  
  // Wait for fonts to load if possible
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() {
      setTimeout(init, 100);
    });
  } else {
    // Fallback for browsers without font loading API
    setTimeout(init, 500);
  }
  
  window.onresize = function() {
    updatePages();
    goToPage(currentPage);
  };
})();
</script>
`;


// Dark mode toggle script for non-reader pages
// NOTE: Using ES5 syntax for Kindle browser compatibility
const DARK_MODE_JS = `
<script>
(function() {
  function hasDarkMode() {
    return document.body.className.indexOf('dark-mode') !== -1;
  }
  
  try {
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.className = document.body.className + ' dark-mode';
    }
  } catch(e) {}
  
  var toggle = document.querySelector('.dark-toggle');
  if (toggle) {
    toggle.onclick = function() {
      if (hasDarkMode()) {
        document.body.className = document.body.className.replace(' dark-mode', '');
      } else {
        document.body.className = document.body.className + ' dark-mode';
      }
      try {
        localStorage.setItem('darkMode', hasDarkMode() ? 'true' : 'false');
      } catch(e) {}
    };
  }
})();
</script>
`;

// Helper to wrap content in HTML document
function html(title: string, content: string, css: string = BASE_CSS, includeToggle: boolean = true): string {
  const toggleButton = includeToggle ? '<button class="dark-toggle">Dark</button>' : '';
  const toggleScript = includeToggle ? DARK_MODE_JS : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - E-ink Road</title>
  <style>${css}</style>
</head>
<body>
${content}
${toggleButton}
${toggleScript}
</body>
</html>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Pagination constants
const ITEMS_PER_PAGE = 10;

// Pagination helper
function pagination(currentPage: number, totalItems: number, basePath: string): string {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return '';
  
  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  
  return `
    <div class="pagination">
      ${prevPage 
        ? `<a href="${basePath}?page=${prevPage}" class="btn btn-outline">← Prev</a>`
        : `<span class="btn btn-outline" style="opacity: 0.3;">← Prev</span>`}
      <span class="page-info">${currentPage} / ${totalPages}</span>
      ${nextPage 
        ? `<a href="${basePath}?page=${nextPage}" class="btn btn-outline">Next →</a>`
        : `<span class="btn btn-outline" style="opacity: 0.3;">Next →</span>`}
    </div>
  `;
}

// Get paginated slice of items
function paginate<T>(items: T[], page: number): T[] {
  const start = (page - 1) * ITEMS_PER_PAGE;
  return items.slice(start, start + ITEMS_PER_PAGE);
}

// Navigation bar component
function nav(currentPath: string = ""): string {
  const links = [
    { href: "/", label: "Home" },
    { href: "/follows", label: "Follows" },
    { href: "/history", label: "History" },
    { href: "/toplists", label: "Top Lists" },
    { href: "/search", label: "Search" },
    { href: "/cache", label: "Cache" },
    { href: "/setup", label: "Setup" },
  ];
  return `<nav class="nav">
    ${links.map(l =>
      `<a href="${l.href}" class="btn ${currentPath === l.href ? '' : 'btn-outline'}">${l.label}</a>`
    ).join("\n    ")}
  </nav>`;
}

// Home page
export function homePage(): string {
  return html("Home", `
    ${nav("/")}
    <h1>E-ink Road</h1>
    <p>Royal Road proxy for Kindle e-ink browser.</p>
    <ul>
      <li><a href="/follows">My Follows</a> - View your followed fictions</li>
      <li><a href="/history">History</a> - Recently read chapters</li>
      <li><a href="/toplists">Top Lists</a> - Browse popular fictions</li>
      <li><a href="/search">Search</a> - Find fictions by title</li>
      <li><a href="/cache">Cache</a> - Manage cached data</li>
      <li><a href="/setup">Setup</a> - Configure session cookies</li>
    </ul>
  `);
}

// Setup page (cookie configuration)
export function setupPage(message?: string, isError?: boolean): string {
  const alert = message
    ? `<div class="${isError ? 'error' : 'success'}">${escapeHtml(message)}</div>`
    : "";

  return html("Setup", `
    ${nav("/setup")}
    <h1>Cookie Setup</h1>
    ${alert}
    <p>Enter your Royal Road session cookies below. You can find these in your browser's developer tools (F12 → Application → Cookies).</p>
    <form method="POST" action="/setup">
      <label for="identity">.AspNetCore.Identity.Application cookie:</label>
      <textarea name="identity" id="identity" placeholder="Paste your .AspNetCore.Identity.Application cookie value here (this is the main auth cookie)"></textarea>

      <p style="margin-top: 16px; font-size: 14px;"><strong>Optional:</strong> These may help if you have issues:</p>

      <label for="cfclearance">cf_clearance cookie (Cloudflare bypass):</label>
      <textarea name="cfclearance" id="cfclearance" placeholder="Optional - paste if you get Cloudflare errors"></textarea>

      <div style="margin-top: 16px;">
        <button type="submit" class="btn">Save Cookies</button>
        <a href="/setup/clear" class="btn btn-outline">Clear Cookies</a>
      </div>
    </form>
  `);
}

// Follows page - list of followed fictions
export function followsPage(fictions: FollowedFiction[], page: number = 1): string {
  if (fictions.length === 0) {
    return html("My Follows", `
      ${nav("/follows")}
      <h1>My Follows</h1>
      <p>No followed fictions found. Make sure your cookies are configured in <a href="/setup">Setup</a>.</p>
    `);
  }

  const paginatedFictions = paginate(fictions, page);
  const list = paginatedFictions.map(f => {
    const latestLink = f.latestChapterId
      ? `<a href="/chapter/${f.latestChapterId}">${escapeHtml(f.latestChapter || 'Latest')}</a>`
      : escapeHtml(f.latestChapter || '');
    const lastReadLink = f.lastReadChapterId
      ? `<a href="/chapter/${f.lastReadChapterId}">${escapeHtml(f.lastRead || 'Last read')}</a>`
      : escapeHtml(f.lastRead || '');

    // Determine next chapter to read:
    // - If there's unread content and we have lastReadChapterId, link to fiction page (they'll continue from there)
    // - If hasUnread and latestChapterId exists but no lastRead, they haven't started - show latest
    // - If nextChapterId is set, use that directly
    let nextChapterButton = '';
    if (f.nextChapterId) {
      nextChapterButton = `<a href="/chapter/${f.nextChapterId}" class="btn" style="padding: 6px 12px; font-size: 14px; margin-top: 8px; display: inline-block;">Continue →</a>`;
    } else if (f.hasUnread && f.latestChapterId) {
      // Show "Read New" button linking to latest chapter when there's unread content
      nextChapterButton = `<a href="/chapter/${f.latestChapterId}" class="btn" style="padding: 6px 12px; font-size: 14px; margin-top: 8px; display: inline-block;">Read New →</a>`;
    } else if (f.lastReadChapterId) {
      // Already reading, link to fiction page to continue
      nextChapterButton = `<a href="/fiction/${f.id}" class="btn btn-outline" style="padding: 6px 12px; font-size: 14px; margin-top: 8px; display: inline-block;">View Chapters</a>`;
    } else {
      // Haven't started, show start button
      nextChapterButton = `<a href="/fiction/${f.id}" class="btn btn-outline" style="padding: 6px 12px; font-size: 14px; margin-top: 8px; display: inline-block;">Start Reading</a>`;
    }

    return `
    <li class="fiction-item">
      <div class="fiction-title">
        <a href="/fiction/${f.id}">${escapeHtml(f.title)}</a>
        ${f.hasUnread ? ' <strong>[NEW]</strong>' : ''}
      </div>
      <div class="fiction-meta">
        by ${escapeHtml(f.author || 'Unknown')}
      </div>
      ${f.latestChapter ? `<div class="fiction-meta">Latest: ${latestLink}</div>` : ''}
      ${f.lastRead ? `<div class="fiction-meta">Last read: ${lastReadLink}</div>` : ''}
      ${nextChapterButton}
    </li>
  `;
  }).join("");

  return html("My Follows", `
    ${nav("/follows")}
    <h1>My Follows (${fictions.length})</h1>
    <ul>${list}</ul>
    ${pagination(page, fictions.length, "/follows")}
  `);
}

// Toplists dashboard
export function toplistsPage(): string {
  const list = TOPLISTS.map(t => `
    <li>
      <a href="/toplist/${t.slug}" class="fiction-title">${escapeHtml(t.name)}</a>
    </li>
  `).join("");

  return html("Top Lists", `
    ${nav("/toplists")}
    <h1>Top Lists</h1>
    <ul>${list}</ul>
  `);
}

// History page - list of recently read chapters
export function historyPage(history: HistoryEntry[], page: number = 1): string {
  if (history.length === 0) {
    return html("History", `
      ${nav("/history")}
      <h1>History</h1>
      <p>No reading history found. Make sure your cookies are configured in <a href="/setup">Setup</a>.</p>
    `);
  }

  const paginatedHistory = paginate(history, page);
  const list = paginatedHistory.map(h => `
    <li class="fiction-item">
      <div class="fiction-title">
        <a href="/chapter/${h.chapterId}">${escapeHtml(h.chapterTitle)}</a>
      </div>
      <div class="fiction-meta">
        <a href="/fiction/${h.fictionId}">${escapeHtml(h.fictionTitle)}</a>
      </div>
      <div class="fiction-meta">${escapeHtml(h.readAt)}</div>
    </li>
  `).join("");

  return html("History", `
    ${nav("/history")}
    <h1>History (${history.length})</h1>
    <ul>${list}</ul>
    ${pagination(page, history.length, "/history")}
  `);
}

// Toplist page - list of fictions from a specific toplist
export function toplistPage(toplist: ToplistType, fictions: Fiction[], page: number = 1): string {
  if (fictions.length === 0) {
    return html(toplist.name, `
      ${nav("/toplists")}
      <h1>${escapeHtml(toplist.name)}</h1>
      <p>No fictions found. Try again later.</p>
      <a href="/toplists" class="btn">Back to Top Lists</a>
    `);
  }

  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedFictions = paginate(fictions, page);
  const list = paginatedFictions.map((f, i) => {
    const hasDesc = f.description && f.description.length > 0;
    const descId = `desc-${f.id}`;
    return `
    <li class="fiction-item">
      <div class="fiction-title">
        ${startIndex + i + 1}. <a href="/fiction/${f.id}">${escapeHtml(f.title)}</a>
        ${hasDesc ? `<button class="desc-toggle" data-target="${descId}" style="margin-left: 8px; padding: 2px 6px; font-size: 12px; background: #fff; border: 1px solid #000; cursor: pointer;">Info</button>` : ''}
      </div>
      <div class="fiction-meta">
        by ${escapeHtml(f.author || 'Unknown')}
        ${f.stats?.rating ? ` • ${f.stats.rating.toFixed(1)}★` : ''}
        ${f.stats?.pages ? ` • ${f.stats.pages} pages` : ''}
      </div>
      ${hasDesc ? `<div id="${descId}" class="fiction-desc" style="display: none; margin-top: 8px; padding: 8px; background: #f5f5f5; font-size: 14px; border-left: 3px solid #000;">${escapeHtml(f.description || '')}</div>` : ''}
    </li>
  `;
  }).join("");

  // ES5-compatible toggle script
  const toggleScript = `
<script>
(function() {
  var toggles = document.querySelectorAll('.desc-toggle');
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].onclick = function() {
      var targetId = this.getAttribute('data-target');
      var target = document.getElementById(targetId);
      if (target) {
        if (target.style.display === 'none') {
          target.style.display = 'block';
          this.textContent = 'Hide';
        } else {
          target.style.display = 'none';
          this.textContent = 'Info';
        }
      }
    };
  }
})();
</script>
  `;

  return html(toplist.name, `
    ${nav("/toplists")}
    <h1>${escapeHtml(toplist.name)}</h1>
    <ul>${list}</ul>
    ${pagination(page, fictions.length, `/toplist/${toplist.slug}`)}
    <div style="margin-top: 16px;">
      <a href="/toplists" class="btn btn-outline">Back to Top Lists</a>
    </div>
    ${toggleScript}
  `);
}

// Fiction detail page
export function fictionPage(fiction: Fiction, chapterPage: number = 1): string {
  const chapters = fiction.chapters || [];
  const CHAPTERS_PER_PAGE = 20;
  const totalChapterPages = Math.ceil(chapters.length / CHAPTERS_PER_PAGE);
  const startIdx = (chapterPage - 1) * CHAPTERS_PER_PAGE;
  const paginatedChapters = chapters.slice(startIdx, startIdx + CHAPTERS_PER_PAGE);
  
  const chapterList = paginatedChapters.map((c, i) => `
    <li>
      <a href="/chapter/${c.id}">${escapeHtml(c.title || `Chapter ${startIdx + i + 1}`)}</a>
      ${c.date ? `<span class="fiction-meta"> • ${escapeHtml(c.date)}</span>` : ''}
    </li>
  `).join("");

  const stats = fiction.stats;
  const statsLine = [
    stats?.rating ? `${stats.rating.toFixed(1)}★` : null,
    stats?.pages ? `${stats.pages} pages` : null,
    stats?.followers ? `${stats.followers.toLocaleString()} followers` : null,
  ].filter(Boolean).join(" • ");

  // Continue Reading button if we have progress
  const continueButton = fiction.continueChapterId
    ? `<a href="/chapter/${fiction.continueChapterId}" class="btn" style="margin-bottom: 16px; display: block; text-align: center;">Continue Reading</a>`
    : (chapters.length > 0 
      ? `<a href="/chapter/${chapters[0].id}" class="btn btn-outline" style="margin-bottom: 16px; display: block; text-align: center;">Start Reading</a>`
      : '');

  // Chapter pagination
  const chapterPagination = totalChapterPages > 1 ? `
    <div class="pagination">
      ${chapterPage > 1 
        ? `<a href="/fiction/${fiction.id}?page=${chapterPage - 1}" class="btn btn-outline">← Prev</a>`
        : `<span class="btn btn-outline" style="opacity: 0.3;">← Prev</span>`}
      <span class="page-info">${chapterPage} / ${totalChapterPages}</span>
      ${chapterPage < totalChapterPages 
        ? `<a href="/fiction/${fiction.id}?page=${chapterPage + 1}" class="btn btn-outline">Next →</a>`
        : `<span class="btn btn-outline" style="opacity: 0.3;">Next →</span>`}
    </div>
  ` : '';

  // Cover image (proxied through our server for caching)
  const coverImage = fiction.coverUrl
    ? `<div class="fiction-cover">
        <img src="/img/cover/${fiction.id}" alt="${escapeHtml(fiction.title)}" style="max-width: 150px; max-height: 200px; border: 1px solid #000;">
       </div>`
    : '';

  // Full description with toggle for long descriptions
  const hasLongDesc = fiction.description && fiction.description.length > 300;
  const descriptionSection = fiction.description 
    ? `<div class="fiction-description" style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-left: 3px solid #000;">
        <strong>Description:</strong>
        ${hasLongDesc 
          ? `<p id="desc-short" style="margin: 8px 0 0 0;">${escapeHtml(fiction.description.slice(0, 300))}... <button id="desc-expand" style="padding: 2px 8px; font-size: 12px; background: #fff; border: 1px solid #000; cursor: pointer;">Show More</button></p>
             <p id="desc-full" style="display: none; margin: 8px 0 0 0;">${escapeHtml(fiction.description)} <button id="desc-collapse" style="padding: 2px 8px; font-size: 12px; background: #fff; border: 1px solid #000; cursor: pointer;">Show Less</button></p>`
          : `<p style="margin: 8px 0 0 0;">${escapeHtml(fiction.description)}</p>`
        }
       </div>`
    : '';

  // ES5-compatible description toggle script
  const descToggleScript = hasLongDesc ? `
<script>
(function() {
  var expandBtn = document.getElementById('desc-expand');
  var collapseBtn = document.getElementById('desc-collapse');
  var shortDesc = document.getElementById('desc-short');
  var fullDesc = document.getElementById('desc-full');
  
  if (expandBtn) {
    expandBtn.onclick = function() {
      shortDesc.style.display = 'none';
      fullDesc.style.display = 'block';
    };
  }
  if (collapseBtn) {
    collapseBtn.onclick = function() {
      shortDesc.style.display = 'block';
      fullDesc.style.display = 'none';
    };
  }
})();
</script>
  ` : '';

  return html(fiction.title, `
    ${nav()}
    <div class="fiction-header" style="display: flex; gap: 16px; margin-bottom: 16px;">
      ${coverImage}
      <div class="fiction-info" style="flex: 1;">
        <h1 style="margin: 0 0 8px 0;">${escapeHtml(fiction.title)}</h1>
        <div class="fiction-meta">
          by ${escapeHtml(fiction.author || 'Unknown')}
          ${statsLine ? ` • ${statsLine}` : ''}
        </div>
      </div>
    </div>

    ${descriptionSection}

    ${continueButton}

    <h2>Chapters (${chapters.length})</h2>
    <ul class="chapter-list">${chapterList || '<li>No chapters found</li>'}</ul>
    ${chapterPagination}

    <div style="margin-top: 16px;">
      <a href="/follows" class="btn btn-outline">Back to Follows</a>
    </div>
    ${descToggleScript}
  `);
}

// Chapter reader page - paginated for e-ink (SPA-style navigation)
export function chapterPage(chapter: ChapterContent): string {
  // Extract chapter IDs from URLs
  const prevChapterId = chapter.prevChapterUrl 
    ? chapter.prevChapterUrl.replace("/chapter/", "") 
    : "";
  const nextChapterId = chapter.nextChapterUrl 
    ? chapter.nextChapterUrl.replace("/chapter/", "") 
    : "";

  const content = `
    <header class="reader-header">
      <div class="header-left">
        <h1 class="chapter-title">${escapeHtml(chapter.title)}</h1>
        ${chapter.fictionTitle ? `<a href="/fiction/${chapter.fictionId}" class="fiction-link">${escapeHtml(chapter.fictionTitle)}</a>` : ''}
      </div>
      <div class="header-right">
        <div class="header-nav">
          <a href="/">Home</a>
          <a href="/follows">Follows</a>
          <a href="/history">History</a>
        </div>
        <button class="settings-btn">Aa</button>
      </div>
    </header>

    <div class="reader-wrapper" data-chapter-id="${chapter.id}" data-fiction-id="${chapter.fictionId}">
      <div class="tap-zone-top"></div>
      <div class="tap-zone-bottom"></div>
      <div class="click-zone click-zone-left"></div>
      <div class="click-zone click-zone-right"></div>
      <div class="reader-content">
        ${chapter.content}
      </div>
    </div>

    <div class="page-indicator">1 / 1</div>

    <nav class="nav-fixed">
      ${prevChapterId
        ? `<button class="btn nav-prev" data-chapter-id="${prevChapterId}">← Prev Ch</button>`
        : `<span class="btn btn-outline" style="opacity: 0.3;">← Prev Ch</span>`}
      <a href="/fiction/${chapter.fictionId}" class="btn btn-outline">Index</a>
      ${nextChapterId
        ? `<button class="btn nav-next" data-chapter-id="${nextChapterId}">Next Ch →</button>`
        : `<span class="btn btn-outline" style="opacity: 0.3;">Next Ch →</span>`}
    </nav>

    <div class="settings-modal">
      <div class="settings-panel">
        <h2>Settings</h2>
        <div class="settings-row">
          <label>Font Size</label>
          <div class="font-controls">
            <button class="font-decrease">-</button>
            <span class="font-size-display">18px</span>
            <button class="font-increase">+</button>
          </div>
        </div>
        <div class="settings-row">
          <label>Theme</label>
          <div class="dark-mode-toggle">
            <button class="dark-mode-light">Light</button>
            <button class="dark-mode-dark">Dark</button>
          </div>
        </div>
        <button class="settings-close">Close</button>
      </div>
    </div>
    ${READER_JS}
  `;

  return html(chapter.title, content, READER_CSS, false);
}

// Error page
export function errorPage(title: string, message: string, retryUrl?: string): string {
  return html(title, `
    ${nav()}
    <h1>${escapeHtml(title)}</h1>
    <div class="error">${escapeHtml(message)}</div>
    <div style="margin-top: 16px;">
      ${retryUrl ? `<a href="${retryUrl}" class="btn">Retry</a>` : ''}
      <a href="/" class="btn btn-outline">Home</a>
    </div>
  `);
}

// Loading page (for slow operations)
export function loadingPage(message: string = "Loading..."): string {
  return html("Loading", `
    <h1>${escapeHtml(message)}</h1>
    <p>Please wait...</p>
  `);
}

// Search page
export function searchPage(query: string = "", results: Fiction[] = [], page: number = 1): string {
  const searchForm = `
    <form method="GET" action="/search" style="margin-bottom: 20px;">
      <label for="q">Search fictions:</label>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <input type="text" name="q" id="q" value="${escapeHtml(query)}" placeholder="Enter title..." style="flex: 1;">
        <button type="submit" class="btn">Search</button>
      </div>
    </form>
  `;

  if (!query) {
    return html("Search", `
      ${nav("/search")}
      <h1>Search</h1>
      ${searchForm}
      <p>Enter a title to search Royal Road.</p>
    `);
  }

  if (results.length === 0) {
    return html("Search", `
      ${nav("/search")}
      <h1>Search</h1>
      ${searchForm}
      <p>No results found for "${escapeHtml(query)}".</p>
    `);
  }

  const paginatedResults = paginate(results, page);
  const list = paginatedResults.map(f => `
    <li class="fiction-item">
      <div class="fiction-title">
        <a href="/fiction/${f.id}">${escapeHtml(f.title)}</a>
      </div>
      <div class="fiction-meta">
        by ${escapeHtml(f.author || 'Unknown')}
        ${f.stats?.rating ? ` • ${f.stats.rating.toFixed(1)}★` : ''}
      </div>
    </li>
  `).join("");

  return html("Search", `
    ${nav("/search")}
    <h1>Search Results</h1>
    ${searchForm}
    <p>Found ${results.length} results for "${escapeHtml(query)}"</p>
    <ul>${list}</ul>
    ${pagination(page, results.length, `/search?q=${encodeURIComponent(query)}`)}
  `);
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Cache management page
export function cachePage(stats: CacheStats, message?: string): string {
  const alert = message
    ? `<div class="success">${escapeHtml(message)}</div>`
    : "";

  const typeRows = stats.byType.map(t => `
    <tr>
      <td>${escapeHtml(t.type)}</td>
      <td style="text-align: right;">${t.count}</td>
      <td style="text-align: right;">${formatBytes(t.size)}</td>
      <td><a href="/cache/clear/${t.type}" class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;">Clear</a></td>
    </tr>
  `).join("");

  const totalSize = stats.totalSize + stats.imageSize;

  return html("Cache Management", `
    ${nav()}
    <h1>Cache Management</h1>
    ${alert}
    
    <div style="margin-bottom: 20px;">
      <h2>Summary</h2>
      <ul>
        <li><strong>Total text entries:</strong> ${stats.totalEntries}</li>
        <li><strong>Total text size:</strong> ${formatBytes(stats.totalSize)}</li>
        <li><strong>Cached images:</strong> ${stats.imageCount}</li>
        <li><strong>Image cache size:</strong> ${formatBytes(stats.imageSize)}</li>
        <li><strong>Total cache size:</strong> ${formatBytes(totalSize)}</li>
        ${stats.expiredCount > 0 ? `<li><strong>Expired entries:</strong> ${stats.expiredCount}</li>` : ''}
      </ul>
    </div>

    <div style="margin-bottom: 20px;">
      <h2>Cache by Type</h2>
      ${stats.byType.length > 0 ? `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="text-align: left; padding: 8px 4px;">Type</th>
              <th style="text-align: right; padding: 8px 4px;">Count</th>
              <th style="text-align: right; padding: 8px 4px;">Size</th>
              <th style="padding: 8px 4px;"></th>
            </tr>
          </thead>
          <tbody>
            ${typeRows}
          </tbody>
        </table>
      ` : '<p>No cached entries.</p>'}
    </div>

    <div style="margin-bottom: 20px;">
      <h2>Actions</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${stats.expiredCount > 0 ? `<a href="/cache/clear/expired" class="btn btn-outline">Clear Expired (${stats.expiredCount})</a>` : ''}
        ${stats.imageCount > 0 ? `<a href="/cache/clear/images" class="btn btn-outline">Clear Images (${stats.imageCount})</a>` : ''}
        <a href="/cache/clear/all" class="btn">Clear All Cache</a>
      </div>
    </div>

    <div style="margin-top: 20px;">
      <a href="/" class="btn btn-outline">Back to Home</a>
    </div>
  `);
}
