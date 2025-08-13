// Generic image slider for product pages
// Expects a div.image-slider with data-images="img1,img2,..."
// and an img element plus .prev and .next buttons inside.

function initSliders() {
  document.querySelectorAll('.image-slider').forEach(slider => {
    const images = slider.dataset.images ? slider.dataset.images.split(',') : [];
    if (images.length === 0) return;
    let index = 0;
    const img = slider.querySelector('img');
    if (img) {
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
    }
    const prev = slider.querySelector('.prev');
    const next = slider.querySelector('.next');

    prev.addEventListener('click', () => {
      index = (index - 1 + images.length) % images.length;
      img.src = images[index];
    });
    next.addEventListener('click', () => {
      index = (index + 1) % images.length;
      img.src = images[index];
    });

    // allow color option clicks to update slider index and image
    const product = slider.closest('.product-item');
    product?.querySelectorAll('.color-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const idx = images.indexOf(opt.dataset.image);
        if (idx !== -1) {
          index = idx;
          img.src = images[index];
        }
        if (product) {
          product.dataset.selectedColor = opt.dataset.color || '';
          product.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSliders();

  // Ensure the header line sits directly below the clock
  const header = document.querySelector('.header-container');
  const headerLine = document.querySelector('.header-line');
  const cartCounter = document.querySelector('.cart-counter');
  if (header && headerLine) {
    header.insertAdjacentElement('afterend', headerLine);
  }
  if (headerLine && cartCounter) {
    headerLine.insertAdjacentElement('afterend', cartCounter);
  }
  if (headerLine) {
    headerLine.style.borderTop = '1px solid #000';
    headerLine.style.marginTop = '5px';
    headerLine.style.width = '100%';
  }
  if (cartCounter) {
    cartCounter.style.marginTop = '5px';
  }

  const productItem = document.querySelector('.product-item');
  if (productItem) {
    productItem.style.marginTop = '20px';
    productItem.style.display = 'flex';
    productItem.style.flexDirection = 'column';
    productItem.style.alignItems = 'center';
    productItem.style.textAlign = 'center';
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
            <a href="soon.html">news</a>
        </div>
        <br>
        <br>
        <div class="footer-line">
            <a href="soon.html">random</a>
            <a href="soon.html">about</a>
            <a href="soon.html">stores</a>
            <a href="soon.html">sizing</a>
            <a href="soon.html">f.a.q.</a>
            <a href="soon.html">contact</a>
        </div>
        <div class="footer-line less-padding">
            <a href="soon.html">terms</a>
            <a href="soon.html">privacy</a>
            <a href="soon.html">accessibility</a>
            <a href="soon.html">mailing list</a>
        </div>
    </div>
    <div class="full-site-link" id="full-site-link">
        <a href="index.html">full site</a>
    </div>`;
  }

  // Footer styles
  const style = document.createElement('style');
  style.textContent = `
    .footer-links { display:flex; justify-content:center; flex-wrap:wrap; gap:15px; background-color:#f7f7f7; }
    .footer-line { display:flex; justify-content:center; flex-wrap:wrap; gap:15px; padding-bottom:10px; }
    .footer-line.extra-padding { padding-bottom:10px; }
    .footer-line.less-padding { padding-bottom:25px; }
    .footer-links a { color:#000; text-decoration:none; transition:all 0.3s ease; }
    .footer-links a:hover, .footer-links a:focus, .footer-links a:active { color:red; border:2px solid red; background:white; }
    .full-site-link { text-align:center; margin-top:20px; }
    .image-slider { position:relative; display:flex; justify-content:center; align-items:center; width:80%; max-width:400px; margin:0 auto; }
    .image-slider img { margin:0 auto; width:100%; height:auto; object-fit:contain; }
    .image-slider button { position:absolute; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:2rem; cursor:pointer; color:red; }
    .image-slider button:hover, .image-slider button:focus, .image-slider button:active { background:white; border:2px solid red; }
    .image-slider .prev { left:0; }
    .image-slider .next { right:0; }
    .product-item button { background:#000; color:#fff; border:2px solid #000; font-family:'Courier New', Courier, monospace; cursor:pointer; margin-top:5px; }
    .product-item button:hover, .product-item button:active, .product-item button:focus { background:#fff; color:red; border-color:red; }
    .product-item h1, .product-item p, .product-details { text-align:center; }
    .color-options { margin-top:10px; }
    .color-option { width:20px; height:20px; display:inline-block; cursor:pointer; margin:0 5px; border:1px solid #000; }
    .color-option.selected, .color-option:hover, .color-option:focus { border:2px solid red; }
  `;
  document.head.appendChild(style);

  window.addEventListener('scroll', function() {
    var fullSiteLink = document.getElementById('full-site-link');
    if (fullSiteLink) {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight && window.innerWidth <= 768) {
        fullSiteLink.style.display = 'block';
      } else {
        fullSiteLink.style.display = 'none';
      }
    }
  });
});
