document.addEventListener('DOMContentLoaded', () => {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const isShopPage =
    current === 'shop.html' ||
    document.querySelector('.product-item') ||
    document.querySelector('.product-grid');

  // Ensure all shop and product pages use a sticky header like the t-shirt page
  const header = document.querySelector('.header-container');
  if (header) {
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.zIndex = '1000';
  }

  const { documentElement: html, body } = document;
  [html, body].forEach(el => {
    el.style.display = 'block';
    el.style.minHeight = '100%';
  });
  body.style.flexDirection = '';
  body.style.alignItems = '';

  document.querySelectorAll('footer a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current || (isShopPage && href === 'shop.html')) {
      link.style.fontWeight = 'bold';
    }
  });

  // Bold the current category in navigation lists
  document.querySelectorAll('.desktop-nav a, .mobile-nav a').forEach(link => {
    if (link.getAttribute('href') === current) {
      link.style.fontWeight = 'bold';
    }
  });

  // Recolor only links that still use the browser's default blue or purple
  document.querySelectorAll('a').forEach(link => {
    const color = getComputedStyle(link).color;
    if (
      color === 'rgb(0, 0, 238)' ||
      color === 'rgb(0, 0, 255)' ||
      color === 'blue' ||
      color === 'rgb(85, 26, 139)' ||
      color === 'purple'
    ) {
      link.style.color = 'red';
    }
  });

  // Inject the "Latest Purchases" ticker
  const purchases = [
    'olivia in los angeles bought a tote bag',
    'liam in new york bought a hoodie',
    'emma in chicago bought socks',
    'noah in toronto bought a skateboard'
  ];

  const ticker = document.createElement('div');
  ticker.className = 'purchase-ticker';

  const label = document.createElement('div');
  label.className = 'ticker-label';
  label.textContent = 'LATEST PURCHASES';
  ticker.appendChild(label);

  const track = document.createElement('div');
  track.className = 'ticker-track';
  const content = purchases.join(' \u00A0\u00A0\u2022\u00A0\u00A0 ');
  track.innerHTML = content + ' \u00A0\u00A0\u2022\u00A0\u00A0 ' + content;
  ticker.appendChild(track);

  const banner = document.getElementById('cookie-banner');
  if (banner && banner.parentNode) {
    banner.parentNode.insertBefore(ticker, banner.nextSibling);
  } else {
    document.body.insertBefore(ticker, document.body.firstChild);
  }

  const labelWidth = label.offsetWidth;
  ticker.style.setProperty('--label-width', labelWidth + 'px');
  window.addEventListener('resize', () => {
    ticker.style.setProperty('--label-width', label.offsetWidth + 'px');
  });

  const style = document.createElement('style');
  style.textContent = `
    .purchase-ticker {
      position: relative;
      overflow: hidden;
      background: #f2f2f2;
      color: #000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      padding: 5px 0 5px calc(var(--label-width) + 20px);
      width: 100%;
      box-sizing: border-box;
    }
    .purchase-ticker .ticker-label {
      position: absolute;
      left: 0;
      top: 0;
      font-weight: bold;
      padding: 5px 10px;
      background: #f2f2f2;
      z-index: 2;
    }
    .purchase-ticker .ticker-track {
      display: inline-block;
      white-space: nowrap;
      animation: ticker-scroll 25s linear infinite;
    }
    .purchase-ticker::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: calc(var(--label-width) + 20px);
      height: 100%;
      background: linear-gradient(to right, #f2f2f2 0%, rgba(242, 242, 242, 0) 100%);
      z-index: 1;
      pointer-events: none;
    }
    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @media (max-width: 768px) {
      .purchase-ticker, .purchase-ticker .ticker-label {
        font-size: 0.6rem;
      }
    }
  `;
  document.head.appendChild(style);

  // Allow long press on the logo to return to the homepage
  const logoOverlay = document.querySelector('.logo-overlay');
  if (logoOverlay) {
    let pressTimer;
    let moved = false;

    const restoreOverlay = () => {
      logoOverlay.style.display = 'block';
    };

    const cancel = () => {
      clearTimeout(pressTimer);
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('mouseup', cancel);
      document.removeEventListener('touchend', cancel);
      document.removeEventListener('touchcancel', cancel);
      logoOverlay.style.display = 'none';
      setTimeout(restoreOverlay, 1000);
    };

    const moveHandler = () => {
      moved = true;
      cancel();
    };

    const startPress = () => {
      moved = false;
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('touchmove', moveHandler);
      document.addEventListener('mouseup', cancel);
      document.addEventListener('touchend', cancel);
      document.addEventListener('touchcancel', cancel);
      pressTimer = setTimeout(() => {
        if (!moved) {
          window.location.href = 'index.html';
        }
        cancel();
      }, 600);
    };

    logoOverlay.addEventListener('mousedown', startPress);
    logoOverlay.addEventListener('touchstart', startPress);
  }
});
