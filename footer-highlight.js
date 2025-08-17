document.addEventListener('DOMContentLoaded', () => {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('footer a').forEach(link => {
    if (link.getAttribute('href') === current) {
      link.style.fontWeight = 'bold';
    }
  });

  document.querySelectorAll('.full-site-link a').forEach(link => {
    link.style.color = 'red';
  });
});
