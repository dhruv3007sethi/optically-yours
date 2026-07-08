// ============================================
// OPTICALLY YOURS — Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollAnimations();
  initMobileMenu();
  initContactForm();
});

// ---------- Navbar Scroll Effect ----------
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// ---------- Scroll Animations ----------
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger animation delay
          const delay = entry.target.dataset.delay || 0;
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    elements.forEach((el, i) => {
      if (!el.dataset.delay) {
        el.dataset.delay = (i % 4) * 100;
      }
      observer.observe(el);
    });
  } else {
    // Fallback: show everything immediately
    elements.forEach(el => el.classList.add('visible'));
  }
}

// ---------- Mobile Menu ----------
function initMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (!toggle || !navLinks) return;

  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');

    // Animate hamburger to X
    const spans = toggle.querySelectorAll('span');
    if (navLinks.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      const spans = toggle.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    });
  });
}

// ---------- Contact Form ----------
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = form.querySelector('.btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Message Sent!';
    btn.style.background = '#2ecc71';

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
      form.reset();
    }, 2500);
  });
}

// ---------- Product Filters ----------
const BRAND_STORE_KEY = 'customBrands';

function loadCustomBrands() {
  try {
    return JSON.parse(localStorage.getItem(BRAND_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCustomBrands(data) {
  localStorage.setItem(BRAND_STORE_KEY, JSON.stringify(data));
}

function initProductFilters() {
  const grid = document.querySelector('.products-grid');
  const addCard = document.querySelector('.add-brand-card');
  const uploadInput = document.getElementById('brand-upload');
  const groups = [...document.querySelectorAll('.products-filters')];
  const brandRow = document.getElementById('brand-filters');
  const categoryRow = document.querySelector('.category-filters');
  const state = {};

  // Build a custom-brand card element from a stored entry
  function makeBrandCard(entry) {
    const card = document.createElement('div');
    card.className = 'product-card fade-in visible';
    card.dataset.brand = entry.brand;
    card.dataset.customBrand = entry.id;
    card.innerHTML =
      '<div class="product-image img-placeholder" style="background: var(--white);">' +
      '<button type="button" class="brand-remove" title="Remove">\u00d7</button>' +
      '<img src="' + entry.src + '" alt="' + (entry.name || 'Brand') + '" style="object-fit: contain;">' +
      '</div>';
    card.querySelector('.brand-remove').addEventListener('click', () => removeBrand(entry.id, card));
    return card;
  }

  // Render all stored custom brands into the grid (before the add card)
  function renderCustomBrands() {
    const data = loadCustomBrands();
    Object.keys(data).forEach(brand => {
      data[brand].forEach(entry => {
        grid.insertBefore(makeBrandCard({ ...entry, brand }), addCard);
      });
    });
  }

  function removeBrand(id, card) {
    const data = loadCustomBrands();
    Object.keys(data).forEach(brand => {
      data[brand] = data[brand].filter(e => e.id !== id);
    });
    saveCustomBrands(data);
    card.remove();
  }

  renderCustomBrands();

  if (addCard) {
    addCard.querySelector('.add-brand-btn').addEventListener('click', () => {
      uploadInput.dataset.targetBrand = state.brand;
      uploadInput.click();
    });
  }
  if (uploadInput) {
    uploadInput.addEventListener('change', () => {
      const file = uploadInput.files[0];
      const brand = uploadInput.dataset.targetBrand;
      if (!file || !brand || brand === 'all') return;
      const reader = new FileReader();
      reader.onload = () => {
        const entry = {
          id: 'b' + Date.now(),
          name: file.name.replace(/\.[^.]+$/, ''),
          src: reader.result
        };
        const data = loadCustomBrands();
        data[brand] = data[brand] || [];
        data[brand].push(entry);
        saveCustomBrands(data);
        grid.insertBefore(makeBrandCard({ ...entry, brand }), addCard);
        apply();
      };
      reader.readAsDataURL(file);
      uploadInput.value = '';
    });
  }

  groups.forEach(g => {
    if (!g.dataset.group) return;
    const active = g.querySelector('.filter-btn.active');
    state[g.dataset.group] = active && active.dataset.filter ? active.dataset.filter : 'all';
  });

  function apply() {
    const cards = [...document.querySelectorAll('.product-card:not(.add-brand-card)')];
    cards.forEach(card => {
      const show = Object.entries(state).every(([group, val]) =>
        val === 'all' || (card.dataset[group] || '') === val
      );
      if (show) {
        card.style.display = '';
        card.style.animation = 'fadeInUp 0.4s ease forwards';
      } else {
        card.style.display = 'none';
      }
    });
    // Add-brand card only appears when a specific brand is selected
    if (addCard) {
      addCard.hidden = !(state.brand && state.brand !== 'all');
    }
  }

  groups.forEach(group => {
    const groupName = group.dataset.group;
    const buttons = [...group.querySelectorAll('.filter-btn')];
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // "Brands" toggle button reveals/hides the brand row
        if (btn.dataset.toggle === 'brands') {
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state[groupName] = 'all';
          if (brandRow) {
            brandRow.hidden = false;
            // Default to showing Lenses first
            state.brand = 'lenses';
            brandRow.querySelectorAll('.filter-btn').forEach(b =>
              b.classList.toggle('active', b.dataset.filter === 'lenses')
            );
          }
          if (categoryRow) {
            categoryRow.hidden = true;
            state.category = 'all';
            categoryRow.querySelectorAll('.filter-btn').forEach((b, i) =>
              b.classList.toggle('active', i === 0)
            );
          }
          apply();
          return;
        }
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state[groupName] = btn.dataset.filter;
        // Picking a real audience option collapses the brand row + resets brand
        if (groupName === 'audience' && brandRow) {
          brandRow.hidden = true;
          state.brand = 'all';
          brandRow.querySelectorAll('.filter-btn').forEach((b, i) =>
            b.classList.toggle('active', i === 0)
          );
          if (categoryRow) {
            categoryRow.hidden = false;
          }
        }
        apply();
      });
    });
  });

  apply();
}

// ---------- Animated Counter (for stats) ----------
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const increment = target / (duration / 16);
  const timer = setInterval(() => {
    start += increment;
    if (start >= target) {
      el.textContent = target;
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(start);
    }
  }, 16);
}

// ---------- Bar Fill Animation ----------
function initBarAnimations() {
  const bars = document.querySelectorAll('.bar-fill');
  if (!bars.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const width = entry.target.dataset.width;
        entry.target.style.width = width;
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  bars.forEach(bar => observer.observe(bar));
}

// Re-init on page load for bar animations
document.addEventListener('DOMContentLoaded', () => {
  initBarAnimations();
  if (document.querySelector('.filter-btn')) {
    initProductFilters();
  }
});
