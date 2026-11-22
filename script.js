'use strict';
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
const menuButton = document.getElementById('menu-toggle');
const nav = document.getElementById('main-nav');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('is-open', !expanded);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }));
}
const search = document.getElementById('search');
const searchStatus = document.getElementById('search-status');
if (search && searchStatus) {
  search.addEventListener('submit', event => {
    event.preventDefault();
    const zipInput = document.getElementById('zip');
    const zip = zipInput.value.trim();
    if (zip && !/^\d{5}$/.test(zip)) {
      searchStatus.textContent = 'Enter a valid five-digit ZIP code or leave this field blank.';
      zipInput.focus();
      return;
    }
    searchStatus.textContent = 'Vehicle search is coming soon. No public listings are live yet. We are onboarding licensed Georgia dealerships.';
  });
}
