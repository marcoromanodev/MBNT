// Generic image slider for product pages
// Expects a div.image-slider with data-images="img1,img2,..."
// and an img element plus .prev and .next buttons inside.

function initSliders() {
  document.querySelectorAll('.image-slider').forEach(slider => {
    const images = slider.dataset.images ? slider.dataset.images.split(',') : [];
    if (images.length === 0) return;
    let index = 0;
    const img = slider.querySelector('img');
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

    // allow color option clicks to update slider index
    slider.closest('.product-item')?.querySelectorAll('.color-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const idx = images.indexOf(opt.dataset.image);
        if (idx !== -1) {
          index = idx;
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSliders();

  // Ensure header layout matches shop.html
  document.body.style.height = 'auto';
  document.body.style.display = 'block';

  const header = document.querySelector('.header-container');
  if (header) {
    header.style.position = 'relative';
    header.style.height = 'auto';
  }

  const logo = document.querySelector('.logo-container');
  if (logo) {
    logo.style.position = 'static';
    logo.style.top = '';
    logo.style.left = '';
    logo.style.transform = '';
    logo.style.width = '20vw';
    logo.style.height = '20vh';
    logo.style.marginTop = '0';
  }

  const timeEl = document.querySelector('.time');
  if (timeEl) {
    timeEl.style.position = 'static';
    timeEl.style.left = '';
    timeEl.style.transform = '';
    timeEl.style.top = '';
    timeEl.style.marginTop = '10px';
  }

  const headerLine = document.querySelector('.header-line');
  if (headerLine) {
    headerLine.style.position = 'static';
    headerLine.style.bottom = '';
    headerLine.style.width = '100%';
    headerLine.style.marginTop = '10px';
  }

  const productItem = document.querySelector('.product-item');
  if (productItem) {
    productItem.style.marginTop = '20px';
    productItem.style.display = 'flex';
    productItem.style.flexDirection = 'column';
    productItem.style.alignItems = 'center';
  }

  // Inject footer similar to shop.html
  const footer = document.querySelector('footer');
  if (footer) {
    footer.innerHTML = `
    <br>
    <br>
    <div class="footer-links">
        <div class="footer-line extra-padding">
            <a href="#">shop</a>
            <a href="#">view all</a>
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
    .image-slider { position:relative; display:flex; align-items:center; }
    .image-slider button { position:absolute; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:2rem; cursor:pointer; }
    .image-slider .prev { left:10px; }
    .image-slider .next { right:10px; }
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
