// Generic image slider for product pages
// Expects a div.image-slider with data-images="img1,img2,..."
// and an img element plus .prev and .next buttons inside.

const PRODUCT_SHADOW = 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))';

function initSliders() {
  document.querySelectorAll('.image-slider').forEach(slider => {
    const allImages = slider.dataset.images ? slider.dataset.images.split(',') : [];
    if (allImages.length === 0) return;
    let images = [...allImages];
    let index = 0;
    const img = slider.querySelector('img');
    if (img) {
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.filter = PRODUCT_SHADOW;
    }
    slider.style.aspectRatio = '1 / 1';
    slider.style.overflow = 'hidden';
    const prev = slider.querySelector('.prev');
    const next = slider.querySelector('.next');

    // safeguard in case navigation buttons are missing
    if (prev) {
      prev.addEventListener('click', () => {
        index = (index - 1 + images.length) % images.length;
        img.src = images[index];
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        index = (index + 1) % images.length;
        img.src = images[index];
      });
    }

    // allow color option clicks to update slider index and image
    const product = slider.closest('.product-item');
    product?.querySelectorAll('.color-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const color = opt.dataset.color || '';
        images = color ? allImages.filter(src => src.includes(color)) : [...allImages];
        if (images.length === 0) images = [opt.dataset.image];
        const idx = images.indexOf(opt.dataset.image);
        index = idx !== -1 ? idx : 0;
        img.src = images[index];
        if (product) {
          product.dataset.selectedColor = color;
          product.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const shadowStyle = document.createElement('style');
  shadowStyle.textContent = `.image-slider img { filter: ${PRODUCT_SHADOW}; }`;
  document.head.appendChild(shadowStyle);

  initSliders();

  function updateChicagoTime() {
    const options = {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
      const currentTime = new Intl.DateTimeFormat('en-US', options)
        .format(new Date())
        .replace(',', '');
      timeEl.textContent = `${currentTime} CHICAGO`;
    }
  }
  updateChicagoTime();
  setInterval(updateChicagoTime, 1000);

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

  const categoryMap = {
    'shirt.html': 'shirts.html',
    'hat.html': 'hats.html',
    'joggers.html': 'pants.html',
    'shorts.html': 'pants.html',
    'americandenim.html': 'pants.html',
    'hoodie.html': 'sweatshirts.html',
    'dufflebag.html': 'bags.html',
    'backpack.html': 'bags.html',
    'truckerhat.html': 'hats.html',
    'socks.html': 'accessories.html',
    'skateboard1.html': 'skate.html',
    'skateboard2.html': 'skate.html',
    'skateboard3.html': 'skate.html'
  };
  const currentPage = window.location.pathname.split('/').pop();
  const category = categoryMap[currentPage];
  if (category) {
    document.querySelectorAll('.desktop-nav a, .mobile-nav a').forEach(link => {
      if (link.getAttribute('href') === category) {
        link.style.fontWeight = 'bold';
      }
    });
  }

  // Ensure the header line sits directly below the clock
  const header = document.querySelector('.header-container');
  const headerLine = document.querySelector('.header-line');
  const cartCounter = document.querySelector('.cart-counter');
  if (header && headerLine) {
    if (headerLine.parentElement !== header) {
      header.appendChild(headerLine);
    }
    headerLine.style.borderTop = '1px solid #000';
    headerLine.style.marginTop = '5px';
    headerLine.style.width = '100%';
    if (cartCounter) {
      if (cartCounter.parentElement !== header) {
        header.appendChild(cartCounter);
      }
      headerLine.insertAdjacentElement('afterend', cartCounter);
      cartCounter.style.marginTop = '5px';
    }
  }

  const productItem = document.querySelector('.product-item');
    if (productItem) {
      productItem.style.marginTop = '20px';
      productItem.style.display = 'flex';
      productItem.style.flexDirection = 'column';
      productItem.style.alignItems = 'center';
      productItem.style.textAlign = 'center';
      productItem.style.width = '100%';
    }

    document.querySelectorAll('.product-item').forEach(item => {
      const checkoutBtn = item.querySelector('button[onclick="checkout(this)"]');
      if (checkoutBtn && !item.querySelector('.view-cart-btn')) {
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Cart';
        viewBtn.className = 'view-cart-btn';
        viewBtn.addEventListener('click', () => openCart());
        checkoutBtn.insertAdjacentElement('afterend', viewBtn);
      }

      const sizeSelect = item.querySelector('.size-select select');
      if (sizeSelect) {
        sizeSelect.addEventListener('change', () => {
          item.dataset.size = sizeSelect.value;
        });
      }
    });

  // "You May Also Like" recommendation section
  const allProducts = [
    { href: 'shirt.html', img: 'blackshirt.png', alt: 'T-Shirt' },
    { href: 'hoodie.html', img: 'blackhoodie.png', alt: 'Hoodie' },
    { href: 'truckerhat.html', img: 'truckerwhitefront.png', alt: 'Trucker Hat' },
    { href: 'socks.html', img: 'blacksocks.png', alt: 'Socks' },
    { href: 'shorts.html', img: 'blackshorts.png', alt: 'Shorts' },
    { href: 'joggers.html', img: 'blackjoggers.png', alt: 'Joggers' },
    { href: 'dufflebag.html', img: 'dufflebag1.png', alt: 'Duffle Bag' },
    { href: 'backpack.html', img: 'backpackblack.png', alt: 'Backpack' },
    { href: 'skateboard1.html', img: 'skateboard3v2.png', alt: 'Skateboard 1' },
    { href: 'skateboard2.html', img: 'skateboard4.png', alt: 'Skateboard 2' },
    { href: 'skateboard3.html', img: 'skateboard1.png', alt: 'Skateboard 3' }
  ];

  function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
  }

  const recommendations = shuffle(allProducts.filter(p => p.href !== currentPage));

  // TODO: Replace random selection with personalized suggestions based on user data
  const productEl = document.querySelector('.product-item');
  if (productEl && recommendations.length) {
    const section = document.createElement('section');
    section.className = 'recommend-section';
    section.innerHTML = `
      <h2>You May Also Like</h2>
      <div class="recommend-container">
        <button class="prev">&#10094;</button>
        <div class="recommend-track"></div>
        <button class="next">&#10095;</button>
      </div>
    `;
    productEl.insertAdjacentElement('afterend', section);

    const track = section.querySelector('.recommend-track');

    function createItem(prod) {
      const link = document.createElement('a');
      link.className = 'recommend-item';
      link.href = prod.href;
      const img = document.createElement('img');
      img.src = prod.img;
      img.alt = prod.alt;
      link.appendChild(img);

      // Highlight the clicked recommendation with a red outline
      link.addEventListener('click', () => {
        track.querySelectorAll('.recommend-item').forEach(item => {
          item.classList.remove('selected');
        });
        link.classList.add('selected');
      });

      return link;
    }

    const itemsPerView = window.innerWidth >= 768 ? 4 : 3;

    function getRandomProducts(count) {
      const pool = [...recommendations];
      const selected = [];
      for (let i = 0; i < count && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
      }
      return selected;
    }

    function addItems(count, toStart = false) {
      const prods = getRandomProducts(count);
      prods.forEach(prod => {
        const item = createItem(prod);
        if (toStart) {
          track.prepend(item);
          const width = track.clientWidth / itemsPerView;
          track.scrollLeft += width;
        } else {
          track.appendChild(item);
        }
      });
    }

    addItems(itemsPerView * 2);

    const prev = section.querySelector('.prev');
    const next = section.querySelector('.next');
    prev.addEventListener('click', () => {
      addItems(itemsPerView, true);
      track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
    });
    next.addEventListener('click', () => {
      addItems(itemsPerView);
      track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
    });
  }

  // Inject footer similar to shop.html
  const footer = document.querySelector('footer');
  if (footer) {
    footer.innerHTML = `
    <br>
    <br>
    <div class="footer-links">
        <div class="footer-line extra-padding">
            <a href="shop.html">shop</a>
            <a href="all.html">view all</a>
            <a href="soon.html">preview</a>
            <a href="soon.html">lookbook</a>
            <a href="news.html">news</a>
        </div>
        <br>
        <br>
        <div class="footer-line">
            <a href="random.html">random</a>
            <a href="about.html">about</a>
            <a href="stores.html">stores</a>
            <a href="soon.html">sizing</a>
            <a href="faq.html">f.a.q.</a>
            <a href="contact.html">contact</a>
        </div>
        <div class="footer-line less-padding">
            <a href="terms.html">terms</a>
            <a href="privacy.html">privacy</a>
            <a href="accessibility.html">accessibility</a>
            <a href="mailinglist.html">mailing list</a>
        </div>
    </div>
    <div class="full-site-link" id="full-site-link">
        <a href="index.html">full site</a>
    </div>`;
  }

  // Footer styles
  const footerStyle = document.createElement('style');
  footerStyle.textContent = `
    .footer-links { display:flex; justify-content:center; flex-wrap:wrap; gap:15px; background-color:#f7f7f7; }
    .footer-line { display:flex; justify-content:center; flex-wrap:wrap; gap:15px; padding-bottom:10px; }
    .footer-line.extra-padding { padding-bottom:10px; }
    .footer-line.less-padding { padding-bottom:25px; }
    .footer-links a { color:#000; text-decoration:none; transition:all 0.3s ease; }
    .footer-links a:hover, .footer-links a:focus, .footer-links a:active { color:red; border:2px solid red; background:white; }
    .full-site-link { text-align:center; margin-top:20px; }
    .image-slider {
      position:relative;
      display:flex;
      justify-content:center;
      align-items:center;
      width:80%;
      max-width:400px;
      aspect-ratio:1/1;
      margin:0 auto;
    }
    .image-slider img {
      width:100%;
      height:100%;
      object-fit:contain;
    }
    .image-slider button { position:absolute; top:50%; transform:translateY(-50%); background:transparent; border:2px solid transparent; font-size:2rem; cursor:pointer; color:red; z-index:1; }
    .image-slider button:hover, .image-slider button:focus, .image-slider button:active { background:white; border:2px solid red; }
    .image-slider .prev { left:0; }
    .image-slider .next { right:0; }
    .product-item button { background:#000; color:#fff; border:2px solid #000; font-family:'Courier New', Courier, monospace; cursor:pointer; margin-top:10px; }
    .product-item button:hover, .product-item button:active, .product-item button:focus { background:#fff; color:red; border-color:red; }
    .product-item h1, .product-item p, .product-details { text-align:center; }
    .product-details { width:100%; margin:15px 0; padding:10px 0; }
    .product-details p { max-width:90%; margin:0 auto; }
    .color-options { margin-top:10px; }
    .color-option { width:20px; height:20px; display:inline-block; cursor:pointer; margin:0 5px; border:1px solid #000; }
    .color-option.selected, .color-option:hover, .color-option:focus, .color-option:active { border:2px solid red !important; }
    .size-select { margin-top:10px; display:flex; justify-content:center; }
    .size-select select { background:#000; color:#fff; border:1px solid #000; padding:5px; }
    .size-select select:hover, .size-select select:focus, .size-select select:active { border:2px solid red; }
    .product-item { margin-bottom:0; padding-bottom:0; }
    .recommend-section { width:100%; margin:30px auto; text-align:center; }
    .recommend-section h2 { margin:0 0 10px; }
    .recommend-container { position:relative; max-width:800px; margin:0 auto; }
    .recommend-track { display:flex; overflow-x:auto; scroll-behavior:smooth; scrollbar-width:none; }
    .recommend-track::-webkit-scrollbar { display:none; }
    .recommend-item { flex:0 0 calc(100% / 3); padding:5px; box-sizing:border-box; border:2px solid transparent; }
    .recommend-item img { width:100%; height:auto; object-fit:cover; }
    .recommend-item.selected, .recommend-item:hover, .recommend-item:focus, .recommend-item:active { border:2px solid red; }
    .recommend-container button { position:absolute; top:50%; transform:translateY(-50%); background:transparent; border:2px solid transparent; font-size:2rem; cursor:pointer; color:red; z-index:1; }
    .recommend-container button:hover, .recommend-container button:focus, .recommend-container button:active { background:white; border:2px solid red; }
    .recommend-container .prev { left:0; }
    .recommend-container .next { right:0; }
    @media (min-width:768px) {
      .recommend-item { flex:0 0 calc(100% / 4); }
      .product-item { margin-bottom:0; padding-bottom:0; }
      .recommend-section { margin:0 auto; }
    }
    `;
  document.head.appendChild(footerStyle);

  function toggleFullSiteLink() {
    var fullSiteLink = document.getElementById('full-site-link');
    if (fullSiteLink) {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
        fullSiteLink.style.display = 'block';
      } else {
        fullSiteLink.style.display = 'none';
      }
    }
  }
  window.addEventListener('scroll', toggleFullSiteLink);
  toggleFullSiteLink();
});
