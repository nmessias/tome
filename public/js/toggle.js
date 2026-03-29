/**
 * Theme toggle for non-reader pages
 * ES5 syntax for Kindle browser compatibility
 */
(function() {
  function setCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    var expires = 'expires=' + d.toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + ';' + expires + ';path=/';
  }

  function getTheme() {
    if (document.body.classList.contains('dark-mode')) return 'dark';
    if (document.body.classList.contains('sepia-mode')) return 'sepia';
    return 'light';
  }

  function saveSettings(theme) {
    var settings = JSON.stringify({ dark: theme === 'dark', theme: theme, font: 18 });
    setCookie('reader_settings', settings);
    try {
      localStorage.setItem('darkMode', theme === 'dark' ? 'true' : 'false');
    } catch(e) {}
  }

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
    saveSettings(theme);
  }

  var isKindle = document.body.classList.contains('kindle');
  var themeBtns = document.querySelectorAll('.theme-btn');
  for (var i = 0; i < themeBtns.length; i++) {
    (function(btn) {
      btn.onclick = function() {
        setTheme(btn.getAttribute('data-theme'));
      };
    })(themeBtns[i]);
  }

  var toggle = document.querySelector('.dark-toggle');
  if (toggle) {
    toggle.onclick = function() {
      var current = getTheme();
      setTheme(current === 'dark' ? 'light' : 'dark');
    };
  }
})();
