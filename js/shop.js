import { apiFetch, authHeaders, requireAuth } from './api.js';
import { toast, openModal, closeModal } from './ui.js';

const gridEl = document.getElementById('products-grid');
const brandListEl = document.getElementById('brand-list');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');

const buyModal = document.getElementById('buy-now-modal');
const buyCancelBtn = document.getElementById('buy-cancel');
const buyPlaceBtn = document.getElementById('buy-place');
const buyAddressEl = document.getElementById('buy-address');

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    brand: params.get('brand') || '',
    search: params.get('search') || ''
  };
}

function setUrlParams({ brand, search }) {
  const params = new URLSearchParams();
  if (brand) params.set('brand', brand);
  if (search) params.set('search', search);
  const query = params.toString();
  window.location.href = query ? `/index.html?${query}` : '/index.html';
}

function fallbackImg(label) {
  return `https://placehold.co/600x600/png?text=${encodeURIComponent(label)}`;
}

async function loadBrands() {
  const data = await apiFetch('/products/brands');
  const brands = data.brands || [];

  // Render All button first
  const allBtn = document.createElement('button');
  allBtn.className = 'side-btn';
  allBtn.textContent = 'All Brands';
  allBtn.onclick = () => setUrlParams({ brand: '', search: getUrlParams().search });
  brandListEl.appendChild(allBtn);

  for (const brand of brands) {
    const btn = document.createElement('button');
    btn.className = 'side-btn';
    btn.textContent = brand;
    btn.onclick = () => setUrlParams({ brand, search: getUrlParams().search });
    brandListEl.appendChild(btn);
  }
}

async function loadProducts() {
  const { brand, search } = getUrlParams();
  const params = new URLSearchParams();
  if (brand) params.set('brand', brand);
  if (search) params.set('search', search);
  const query = params.toString();

  const path = query ? `/products?${query}` : '/products';
  gridEl.innerHTML = '';

  const data = await apiFetch(path);
  const products = data.products || [];
  if (products.length === 0) {
    gridEl.innerHTML = `<div class="notice" style="grid-column: 1 / -1;">No products found.</div>`;
    return;
  }

  for (const p of products) {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = p.imageUrl || fallbackImg(p.brand);
    img.alt = p.name;
    img.onclick = () => {
      window.location.href = `/product.html?id=${p._id}`;
    };

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = p.name;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = p.brand;

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = `₹ ${Number(p.price).toFixed(0)}`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn'; 
    addBtn.type = 'button';
    addBtn.textContent = 'Add to Cart';
    addBtn.dataset.productId = p._id;
    // addBtn.onclick = () => addToCart(p._id);
    addBtn.onclick = (e) => {e.stopPropagation();addToCart(p._id);};
    

    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn btn-primary';
    buyBtn.type = 'button';
    buyBtn.textContent = 'Buy Now';
    buyBtn.dataset.productId = p._id;
    // buyBtn.onclick = () => openBuyModal(p._id);
    buyBtn.onclick = (e) => {e.stopPropagation();openBuyModal(p._id);};


    actions.appendChild(addBtn);
    actions.appendChild(buyBtn);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(price);
    body.appendChild(actions);

    card.appendChild(img);
    card.appendChild(body);

    card.onclick = () => {
      window.location.href = `/product.html?id=${p._id}`;
    };

    gridEl.appendChild(card);
  }
}

async function addToCart(productId) {
  const me = await requireAuth('/index.html');
  if (!me) return;

  await apiFetch('/cart/add', {
    method: 'POST',
    headers: authHeaders(),
    body: { productId, quantity: 1 }
  });

  toast('Added to cart');
  
}


function openBuyModal(productId) {
  buyModal.dataset.productId = String(productId);
  buyAddressEl.value = '';
  openModal(buyModal);
}

buyCancelBtn.onclick = () => closeModal(buyModal);

buyPlaceBtn.onclick = async () => {
  try {
    const productId = buyModal.dataset.productId;
    const deliveryAddress = String(buyAddressEl.value || '').trim();
    if (!deliveryAddress) {
      toast('Please enter delivery address');
      return;
    }

    const me = await requireAuth('/index.html');
    if (!me) return;

    await apiFetch('/orders/checkout', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        deliveryAddress,
        paymentMethod: 'COD',
        items: [{ productId, quantity: 1 }]
      }
    });

    toast('Order placed');
    closeModal(buyModal);
    window.location.href = '/orders.html';
  } catch (err) {
    toast(err.message || 'Checkout failed');
  }
};

searchBtn.onclick = () => {
  const { brand } = getUrlParams();
  const search = String(searchInput.value || '').trim();
  setUrlParams({ brand, search });
};

clearBtn.onclick = () => {
  searchInput.value = '';
  setUrlParams({ brand: '', search: '' });
};

// Init
const { search } = getUrlParams();
searchInput.value = search;

brandListEl.innerHTML = '';  
gridEl.innerHTML = '';

loadBrands()
  .then(loadProducts)
  .catch((err) => {
    gridEl.innerHTML = `<div class="notice">Failed to load products: ${err.message}</div>`;
  });




const categoryToggle = document.getElementById('category-toggle');

if (categoryToggle) {
  categoryToggle.addEventListener('click', () => {
    if (brandListEl.classList.contains('open')) {
      brandListEl.classList.remove('open');
    } else {
      brandListEl.classList.add('open');
    }
  });
}