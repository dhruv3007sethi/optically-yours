// Site-wide inline admin editor. Only activates when an admin key is stored
// in localStorage (set by admin.html after a correct login). Lets a logged-in
// admin double-click any text to edit it, click any image to replace it, and
// reorder/replace the home-page hero slides — then "Save Page" commits the
// whole page's HTML back to the site (via /api/save-page).
// offers.html is data-driven (data/offers.json), so instead of whole-page
// editing it gets a dedicated Add/Remove Offer flow that calls /api/save-offers.
(function () {
  const ADMIN_KEY_STORAGE = 'adminKey';
  const EXPECTED_ADMIN_KEY = '181275';
  const EDITABLE_TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,span,li,strong,em,label';

  const adminKey = localStorage.getItem(ADMIN_KEY_STORAGE);
  if (adminKey !== EXPECTED_ADMIN_KEY) return;

  const fileName = (location.pathname.split('/').pop() || 'index.html');

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'admin-edit-styles';
    style.textContent = `
      body.admin-edit-mode img:not(.admin-edit-toolbar img) {
        cursor: pointer;
        outline: 2px dashed transparent;
        outline-offset: 2px;
        transition: outline-color 0.15s ease;
      }
      body.admin-edit-mode img:not(.admin-edit-toolbar img):hover {
        outline-color: #B8942E;
      }
      body.admin-edit-mode ${EDITABLE_TEXT_SELECTOR} {
        cursor: text;
      }
      body.admin-edit-mode ${EDITABLE_TEXT_SELECTOR}:hover {
        outline: 1px dashed #4a90d9;
        outline-offset: 2px;
      }
      body.admin-edit-mode nav ${EDITABLE_TEXT_SELECTOR}:hover,
      body.admin-edit-mode a ${EDITABLE_TEXT_SELECTOR}:hover,
      body.admin-edit-mode button ${EDITABLE_TEXT_SELECTOR}:hover {
        outline: none;
      }
      .admin-edit-toolbar {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 2000;
        background: #1a1a1a; color: #fff; padding: 10px 16px;
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; box-shadow: 0 -2px 10px rgba(0,0,0,0.25);
      }
      .admin-edit-toolbar strong { color: #D4AF37; }
      .admin-edit-toolbar button {
        background: #D4AF37; color: #1a1a1a; border: none; border-radius: 6px;
        padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .admin-edit-toolbar button.secondary { background: transparent; color: #fff; border: 1px solid #666; }
      .admin-edit-toolbar .admin-edit-status { color: #ccc; margin-left: auto; }
      .admin-edit-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 2100;
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .admin-edit-modal {
        background: #fff; color: #1a1a1a; border-radius: 12px; max-width: 480px; width: 100%;
        max-height: 85vh; overflow-y: auto; padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .admin-edit-modal h3 { margin-top: 0; }
      .admin-edit-slide-row {
        display: flex; align-items: center; gap: 10px; padding: 8px 0;
        border-bottom: 1px solid #eee;
      }
      .admin-edit-slide-row img { width: 64px; height: 44px; object-fit: cover; border-radius: 4px; }
      .admin-edit-slide-row .admin-edit-slide-actions { display: flex; gap: 6px; margin-left: auto; }
      .admin-edit-slide-row button {
        border: 1px solid #ccc; background: #fff; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;
      }
      .admin-edit-modal-close {
        display: block; margin-top: 16px; background: #1a1a1a; color: #fff; border: none;
        border-radius: 6px; padding: 8px 16px; cursor: pointer;
      }
      .admin-edit-modal label {
        display: block; font-size: 0.85rem; font-weight: 600; color: #555; margin: 12px 0 4px;
      }
      .admin-edit-modal select, .admin-edit-modal input[type="file"] {
        width: 100%; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;
      }
      .admin-edit-modal-add-btn {
        margin-top: 16px; background: #B8942E; color: #fff; border: none;
        border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600;
      }
      .product-remove-btn {
        position: absolute; top: 8px; right: 8px; z-index: 5;
        background: #C0392B; color: #fff; border: none; border-radius: 50%;
        width: 24px; height: 24px; line-height: 24px; text-align: center; padding: 0;
        font-size: 16px; cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'admin-edit-toolbar';
    const addProductBtn = fileName === 'products.html'
      ? '<button id="admin-edit-add-product">Add Product Image</button>'
      : '';
    bar.innerHTML = `
      <strong>Edit Mode</strong>
      <span>Double-click text to edit &middot; click images to replace</span>
      ${addProductBtn}
      <button id="admin-edit-save">Save Page</button>
      <button id="admin-edit-exit" class="secondary">Exit Edit Mode</button>
      <span class="admin-edit-status" id="admin-edit-status"></span>
    `;
    document.body.appendChild(bar);

    document.getElementById('admin-edit-exit').addEventListener('click', () => {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      location.reload();
    });
    document.getElementById('admin-edit-save').addEventListener('click', savePage);
    if (addProductBtn) {
      document.getElementById('admin-edit-add-product').addEventListener('click', openAddProductModal);
    }
  }

  function makeTextEditable(el) {
    el.setAttribute('contenteditable', 'true');
    el.focus();
    const finish = () => {
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur', finish);
    };
    el.addEventListener('blur', finish);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function promptForImage() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files[0];
        resolve(file ? await readFileAsDataUrl(file) : null);
      };
      input.click();
    });
  }

  async function replaceImage(img) {
    const dataUrl = await promptForImage();
    if (dataUrl) img.src = dataUrl;
  }

  function openHeroSlideModal(container) {
    const overlay = document.createElement('div');
    overlay.className = 'admin-edit-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-edit-modal">
        <h3>Hero Slides</h3>
        <div id="admin-edit-slide-list"></div>
        <button class="admin-edit-modal-add-btn" id="admin-edit-slide-add">Add Image</button>
        <button class="admin-edit-modal-close" id="admin-edit-slide-close">Done</button>
      </div>
    `;
    document.body.appendChild(overlay);

    function renderSlideList() {
      const slides = Array.from(container.querySelectorAll('img.hero-slide'));
      const list = overlay.querySelector('#admin-edit-slide-list');
      list.innerHTML = '';
      slides.forEach((slide, i) => {
        const row = document.createElement('div');
        row.className = 'admin-edit-slide-row';
        row.innerHTML = `
          <img src="${slide.src}" alt="">
          <span>Slide ${i + 1}${slide.classList.contains('is-active') ? ' (active)' : ''}</span>
          <div class="admin-edit-slide-actions">
            <button data-action="up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
            <button data-action="down" ${i === slides.length - 1 ? 'disabled' : ''}>&darr;</button>
            <button data-action="replace">Replace</button>
            <button data-action="remove" ${slides.length <= 1 ? 'disabled' : ''}>Remove</button>
          </div>
        `;
        row.querySelector('[data-action="up"]').addEventListener('click', () => {
          if (i > 0) container.insertBefore(slide, slides[i - 1]);
          renderSlideList();
        });
        row.querySelector('[data-action="down"]').addEventListener('click', () => {
          if (i < slides.length - 1) container.insertBefore(slides[i + 1], slide);
          renderSlideList();
        });
        row.querySelector('[data-action="replace"]').addEventListener('click', async () => {
          const dataUrl = await promptForImage();
          if (dataUrl) slide.src = dataUrl;
          renderSlideList();
        });
        row.querySelector('[data-action="remove"]').addEventListener('click', () => {
          if (slides.length > 1) slide.remove();
          renderSlideList();
        });
        list.appendChild(row);
      });
      // Ensure exactly one slide keeps the is-active class so the slideshow keeps working.
      const remaining = Array.from(container.querySelectorAll('img.hero-slide'));
      if (remaining.length && !remaining.some((s) => s.classList.contains('is-active'))) {
        remaining[0].classList.add('is-active');
      }
    }

    renderSlideList();
    overlay.querySelector('#admin-edit-slide-add').addEventListener('click', async () => {
      const dataUrl = await promptForImage();
      if (!dataUrl) return;
      const img = document.createElement('img');
      img.className = 'hero-slide';
      img.alt = '';
      img.src = dataUrl;
      container.appendChild(img);
      renderSlideList();
    });
    overlay.querySelector('#admin-edit-slide-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function addProductRemoveButtons() {
    document.querySelectorAll('.product-card').forEach((card) => {
      if (card.querySelector('.product-remove-btn')) return;
      const container = card.querySelector('.product-image') || card;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'product-remove-btn';
      btn.innerHTML = '&times;';
      btn.title = 'Remove this product image';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Remove this product image?')) card.remove();
      });
      container.style.position = container.style.position || 'relative';
      container.appendChild(btn);
    });
  }

  function openAddProductModal() {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    const overlay = document.createElement('div');
    overlay.className = 'admin-edit-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-edit-modal">
        <h3>Add Product Image</h3>
        <label for="admin-edit-product-type">Type</label>
        <select id="admin-edit-product-type">
          <option value="audience">Men / Women / Kids</option>
          <option value="brand">Brand</option>
        </select>

        <div id="admin-edit-audience-fields">
          <label for="admin-edit-audience">Audience</label>
          <select id="admin-edit-audience">
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="kids">Kids</option>
          </select>
        </div>

        <div id="admin-edit-brand-fields" style="display:none;">
          <label for="admin-edit-brand">Brand</label>
          <select id="admin-edit-brand">
            <option value="lenses">Lenses</option>
            <option value="frames">Frames</option>
          </select>
        </div>

        <label for="admin-edit-product-image">Image *</label>
        <input type="file" id="admin-edit-product-image" accept="image/*">

        <label for="admin-edit-product-alt">Alt text (optional)</label>
        <input type="text" id="admin-edit-product-alt" placeholder="e.g. Men's optical frame">

        <button class="admin-edit-modal-add-btn" id="admin-edit-product-add">Add to Grid</button>
        <button class="admin-edit-modal-close" id="admin-edit-product-close">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const typeSelect = overlay.querySelector('#admin-edit-product-type');
    const audienceFields = overlay.querySelector('#admin-edit-audience-fields');
    const brandFields = overlay.querySelector('#admin-edit-brand-fields');
    typeSelect.addEventListener('change', () => {
      const isBrand = typeSelect.value === 'brand';
      audienceFields.style.display = isBrand ? 'none' : 'block';
      brandFields.style.display = isBrand ? 'block' : 'none';
    });

    overlay.querySelector('#admin-edit-product-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#admin-edit-product-add').addEventListener('click', async () => {
      const fileInput = overlay.querySelector('#admin-edit-product-image');
      const file = fileInput.files[0];
      if (!file) {
        alert('Image is required.');
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const alt = overlay.querySelector('#admin-edit-product-alt').value.trim();

      const card = document.createElement('div');
      card.className = 'product-card';

      if (typeSelect.value === 'brand') {
        const brand = overlay.querySelector('#admin-edit-brand').value;
        card.dataset.brand = brand;
        card.innerHTML = `<div class="product-image img-placeholder" style="background: var(--white);"><img src="${dataUrl}" alt="${alt}" style="object-fit: contain;"></div>`;
      } else {
        const audience = overlay.querySelector('#admin-edit-audience').value;
        card.dataset.audience = audience;
        card.innerHTML = `<div class="product-image img-placeholder blur-fill" style="--bg: url('${dataUrl}');"><img src="${dataUrl}" alt="${alt}"></div>`;
      }

      grid.appendChild(card);
      addProductRemoveButtons();
      overlay.remove();
    });
  }

  function setStatus(text, isError) {
    const status = document.getElementById('admin-edit-status');
    if (!status) return;
    status.textContent = text;
    status.style.color = isError ? '#ff8080' : '#ccc';
  }

  async function fetchOffers() {
    const res = await fetch('data/offers.json', { cache: 'no-store' });
    const offers = await res.json();
    return Array.isArray(offers) ? offers : [];
  }

  async function saveOffersToServer(offers) {
    const res = await fetch('/api/save-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ offers }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Save failed');
  }

  function openAddOfferModal() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-edit-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-edit-modal">
        <h3>Add Offer</h3>
        <label for="admin-edit-offer-title">Title *</label>
        <input type="text" id="admin-edit-offer-title" placeholder="e.g. The Designer Double">
        <label for="admin-edit-offer-image">Image *</label>
        <input type="file" id="admin-edit-offer-image" accept="image/*">
        <label for="admin-edit-offer-description">Description</label>
        <textarea id="admin-edit-offer-description" style="width:100%; min-height:80px; padding:6px 10px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
        <button class="admin-edit-modal-add-btn" id="admin-edit-offer-add">Add Offer</button>
        <button class="admin-edit-modal-close" id="admin-edit-offer-cancel">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#admin-edit-offer-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#admin-edit-offer-add').addEventListener('click', async () => {
      const title = overlay.querySelector('#admin-edit-offer-title').value.trim();
      const file = overlay.querySelector('#admin-edit-offer-image').files[0];
      const description = overlay.querySelector('#admin-edit-offer-description').value.trim();
      if (!title) {
        alert('Title is required.');
        return;
      }
      if (!file) {
        alert('Image is required.');
        return;
      }
      const image = await readFileAsDataUrl(file);
      setStatus('Saving...', false);
      try {
        const offers = await fetchOffers();
        offers.push({ title, image, description });
        await saveOffersToServer(offers);
        overlay.remove();
        location.reload();
      } catch (err) {
        setStatus(err.message, true);
      }
    });
  }

  async function removeOfferAt(index) {
    if (!confirm('Remove this offer?')) return;
    setStatus('Removing...', false);
    try {
      const offers = await fetchOffers();
      offers.splice(index, 1);
      await saveOffersToServer(offers);
      location.reload();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function buildOffersToolbar() {
    const bar = document.createElement('div');
    bar.className = 'admin-edit-toolbar';
    bar.innerHTML = `
      <strong>Edit Mode</strong>
      <span>Manage the offers shown on this page</span>
      <button id="admin-edit-add-offer">Add Offer</button>
      <button id="admin-edit-exit" class="secondary">Exit Edit Mode</button>
      <span class="admin-edit-status" id="admin-edit-status"></span>
    `;
    document.body.appendChild(bar);

    document.getElementById('admin-edit-exit').addEventListener('click', () => {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      location.reload();
    });
    document.getElementById('admin-edit-add-offer').addEventListener('click', openAddOfferModal);
  }

  function initOffersEditMode() {
    document.body.classList.add('admin-edit-mode');
    injectStyles();
    buildOffersToolbar();

    document.body.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.offer-admin-remove');
      if (!removeBtn) return;
      e.preventDefault();
      e.stopPropagation();
      removeOfferAt(Number(removeBtn.dataset.index));
    }, true);
  }

  // Browser extensions (custom cursors, sidebars, password managers, etc.) mutate the
  // live DOM. Since savePage() serializes document.documentElement, those mutations
  // would otherwise get baked permanently into the saved page. Strip anything that
  // isn't part of this site's own authored markup or runtime behavior.
  function stripExtensionArtifacts(clone) {
    // Extensions almost always inject via custom elements (tag names always contain
    // a hyphen per the Web Components spec) — this site defines none, so any is foreign.
    clone.querySelectorAll('*').forEach((el) => {
      if (el.tagName.includes('-')) el.remove();
    });
    // This site's authored <head> never contains an id'd <style> tag other than the
    // one we inject ourselves (already stripped above) — any other is an extension.
    const head = clone.querySelector('head');
    if (head) head.querySelectorAll('style[id]').forEach((el) => el.remove());
  }

  // Reset transient runtime state (scroll animations, nav scroll shadow, hero rotation)
  // back to the page's initial-load appearance before persisting.
  function stripRuntimeState(clone) {
    const navbar = clone.querySelector('.navbar');
    if (navbar) navbar.classList.remove('scrolled');
    clone.querySelectorAll('.fade-in.visible, .fade-in-left.visible, .fade-in-right.visible').forEach((el) => {
      el.classList.remove('visible');
    });
    clone.querySelectorAll('.hero-slideshow').forEach((slideshow) => {
      const slides = Array.from(slideshow.querySelectorAll('img.hero-slide'));
      slides.forEach((s, i) => s.classList.toggle('is-active', i === 0));
    });
  }

  async function savePage() {
    setStatus('Saving...', false);
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('.admin-edit-toolbar, .admin-edit-modal-overlay, .product-remove-btn').forEach((el) => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    const style = clone.querySelector('#admin-edit-styles');
    if (style) style.remove();
    const cloneBody = clone.querySelector('body');
    cloneBody.classList.remove('admin-edit-mode');
    if (!cloneBody.className.trim()) cloneBody.removeAttribute('class');
    stripExtensionArtifacts(clone);
    stripRuntimeState(clone);
    const html = '<!DOCTYPE html>\n' + clone.outerHTML;

    try {
      const res = await fetch('/api/save-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ file: fileName, html }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setStatus('Saved.', false);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function initEditMode() {
    document.body.classList.add('admin-edit-mode');
    injectStyles();
    buildToolbar();
    if (fileName === 'products.html') addProductRemoveButtons();

    document.body.addEventListener('dblclick', (e) => {
      const el = e.target.closest(EDITABLE_TEXT_SELECTOR);
      if (!el || el.closest('.admin-edit-toolbar') || el.closest('nav') || el.closest('a') || el.closest('button')) return;
      e.preventDefault();
      makeTextEditable(el);
    });

    document.body.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img || img.closest('.admin-edit-toolbar') || img.closest('.admin-edit-modal-overlay')) return;
      e.preventDefault();
      e.stopPropagation();
      const heroContainer = img.closest('.hero-visual .hero-slideshow, .hero-image.hero-slideshow');
      if (heroContainer) {
        openHeroSlideModal(heroContainer);
      } else {
        replaceImage(img);
      }
    }, true);
  }

  if (fileName === 'admin.html') return;

  function init() {
    if (fileName === 'offers.html') {
      initOffersEditMode();
    } else {
      initEditMode();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
