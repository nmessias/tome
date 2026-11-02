/**
 * "Loading..." feedback for full page loads. An uncached Royal Road page takes
 * ~15s and the Kindle keeps showing the old page meanwhile, which reads as a
 * missed tap. ES5 for the Kindle browser.
 */
(function() {
  function show() { document.body.classList.add('is-loading'); }
  function hide() { document.body.classList.remove('is-loading'); }

  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target;
    while (a && a.tagName !== 'A') a = a.parentNode;
    if (!a || a.target || a.hasAttribute('download')) return;
    var href = a.getAttribute('href') || '';
    // Only same-site navigations; in-page anchors and JS links stay quiet.
    if (href.charAt(0) !== '/' || href.charAt(1) === '/') return;
    show();
  });
  document.addEventListener('submit', show);
  // Back/forward restores the page as it was left, banner included.
  window.addEventListener('pageshow', hide);
})();
