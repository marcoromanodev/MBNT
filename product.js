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

document.addEventListener('DOMContentLoaded', initSliders);
