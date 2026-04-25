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
    const href = link.getAttribute('href');
    const base = href.replace('.html', '');
    if (
      href === current ||
      current.startsWith(`${base}-`) ||
      (isShopPage && href === 'shop.html')
    ) {
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

  // Keep Camo Hat as the second product tile on all/new/shop grids
  if (['all.html', 'new.html', 'shop.html'].includes(current)) {
    document.querySelectorAll('.product-grid').forEach(grid => {
      const camoItem = grid.querySelector('.product-item a[href="camohat.html"]')?.closest('.product-item');
      const firstItem = grid.querySelector('.product-item');
      if (!camoItem || !firstItem || camoItem === firstItem) return;
      firstItem.insertAdjacentElement('afterend', camoItem);
    });
  }

  // Rotate product thumbnail images on shop/category grids every 5 seconds
  const productCarouselImages = {
    'hoodie.html': ['blackhoodie.png', 'blackhoodieback.png', 'whitehoodie.png', 'whitehoodieback.png', 'grayhoodie.png', 'grayhoodieback.png'],
    'blankhoodie.html': ['blankblackhoodie.png', 'blankblackhoodieback.png', 'blankwhitehoodie.png', 'blankwhitehoodieback.png', 'blankgrayhoodie.png', 'blankgrayhoodieback.png'],
    'shirt.html': ['blackshirt.png', 'whiteshirt.png', 'grayshirt.png', 'grayshirtback.png'],
    'blankshirt.html': ['3packwhiteshirts.png', 'blankblackshirtback.png', 'blankwhiteshirtback.png', 'blankgrayshirt.png', 'blankgrayshirtback.png', '3packblackshirts.png', '3packgrayshirts.png', '3packcomboshirts.png'],
    'joggers.html': ['blackjoggers.png', 'whitejoggers.png'],
    'shorts.html': ['blackshorts.png', 'whiteshorts.png'],
    'americandenim.html': ['blackjeans.png', 'blackjeansback.png', 'bluejeans.png', 'bluejeansback.png'],
    'dufflebag.html': ['dufflebag1.png', 'dufflebag2.png', 'dufflebag3.png', 'dufflebag4.png', 'dufflebag5.png', 'dufflebag6.png', 'dufflebag7.png', 'dufflebag8.png', 'dufflebag9.png'],
    'backpack.html': ['backpackblack.png', 'backpackwhite.png', 'backpackwhite2.png'],
    'hat.html': ['blackhat.png', 'whitehat.png'],
    'truckerhat.html': ['truckerwhitefront.png', 'truckerwhiteback.png', 'truckerwhitehat.png', 'truckerblackfront.png', 'truckerbackblack.png', 'truckerblackhat.png'],
    'camohat.html': ['camohatcamo.png', 'camohatorange.png', 'camohatblack.png'],
    'socks.html': ['blacksocks.png', 'blacksocks2.png'],
    'skateboard1.html': ['skateboard3v2.png'],
    'skateboard2.html': ['skateboard4.png'],
    'skateboard3.html': ['skateboard1.png']
  };

  document.querySelectorAll('.product-grid .product-item a[href]').forEach(link => {
    const image = link.querySelector('img');
    if (!image) return;
    const href = link.getAttribute('href');
    const gallery = productCarouselImages[href];
    if (!gallery || gallery.length < 2) return;

    let index = Math.max(gallery.indexOf(image.getAttribute('src')), 0);
    image.src = gallery[index];

    setInterval(() => {
      index = (index + 1) % gallery.length;
      image.src = gallery[index];
    }, 5000);
  });

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
