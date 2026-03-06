// Simple cookie consent handler used by src/index.html
function hideCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

function showCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = '';
}

function handleCookieConsent(accepted) {
  try {
    localStorage.setItem('cookieConsent', accepted ? 'true' : 'false');
  } catch (e) {
    // ignore localStorage errors
  }
  // hide banner after choice
  hideCookieBanner();
}

// On load, hide the banner if consent already given
document.addEventListener('DOMContentLoaded', () => {
  try {
    const consent = localStorage.getItem('cookieConsent');
    if (consent !== null) {
      hideCookieBanner();
    } else {
      showCookieBanner();
    }
  } catch (e) {
    showCookieBanner();
  }
});

// expose for tests if needed
window.handleCookieConsent = handleCookieConsent;
