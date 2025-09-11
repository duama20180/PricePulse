import { createChart } from './chart_utils.js';

let currentPage = 1;
const itemsPerPage = 9;
let products = []; // Глобальний масив усіх товарів
let totalProducts = 0; // Загальна кількість товарів
let selectedProducts = new Set();
let isSelectionMode = false;
let priceHistory = {}; // Кеш для цінової історії
let charts = {};

console.log('Script loaded successfully');

async function fetchProducts(page = 1) {
  console.log(`Starting fetchProducts for page ${page}...`);
  try {
    const response = await fetch(`http://localhost:5000/api/products?page=${page}&per_page=${itemsPerPage}`);
    console.log('Fetch response headers:', response.headers);
    console.log('Fetch response status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const newProducts = data.products;
    if (page === 1) {
      products = newProducts; // Ініціалізація для першої сторінки
    } else {
      // Додаємо лише унікальні продукти
      const existingIds = new Set(products.map(p => p.product_id));
      products = [
        ...products,
        ...newProducts.filter(p => !existingIds.has(p.product_id))
      ];
    }
    totalProducts = data.total_count; // Оновлюємо загальну кількість
    console.log('Products data:', products, 'Total count:', totalProducts);
    
    // Завантажуємо цінову історію лише для поточної сторінки
    const currentPageProducts = products.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    await loadPriceHistoryForProducts(currentPageProducts);
    displayProducts();
  } catch (error) {
    console.error('Error in fetchProducts:', error.message);
    if (error.message.includes('CORS')) {
      alert('Помилка CORS: перевірте конфігурацію сервера. Спробуйте перезапустити сервер або зверніться до розробника.');
    } else {
      alert('Помилка завантаження продуктів. Перевірте консоль для деталей.');
    }
  }
}

async function loadPriceHistoryForProducts(productsToLoad) {
  console.log('Loading price history for products:', productsToLoad.map(p => p.product_id));
  const fetchPromises = productsToLoad.map(async (product) => {
    if (!priceHistory[product.product_id]) { // Завантажуємо лише якщо ще немає в кеші
      try {
        const response = await fetch(`http://localhost:5000/api/price_history/${product.product_id}`);
        console.log(`Fetch response for ${product.product_id}, status:`, response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        priceHistory[product.product_id] = data; // Зберігаємо дані як є
        console.log(`Price history for ${product.product_id}:`, priceHistory[product.product_id]);
      } catch (error) {
        console.error(`Error in fetchPriceHistory for ${product.product_id}:`, error);
        priceHistory[product.product_id] = [];
      }
    }
  });
  await Promise.all(fetchPromises); // Чекаємо завершення всіх запитів
}

async function deleteProduct(productId) {
  console.log(`Starting deleteProduct for ${productId}...`);
  try {
    const response = await fetch(`http://localhost:5000/api/delete_product/${productId}`, {
      method: 'DELETE'
    });
    console.log(`Delete response for ${productId}, status:`, response.status);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const result = await response.json();
    console.log('Delete result:', result.message);
    return true; // Повертаємо успіх
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    return false; // Повертаємо провал
  }
}

function displayProducts() {
  console.log('Starting displayProducts...');
  const container = document.getElementById('productContainer');
  if (!container) {
    console.error('Error: Product container not found in DOM!');
    return;
  }
  container.innerHTML = '<div class="spinner">Завантаження...</div>';
  
  const start = (currentPage - 1) * itemsPerPage;
  const end = Math.min(start + itemsPerPage, totalProducts); // Використовуємо totalProducts
  const paginatedProducts = products.slice(start, end);
  console.log('Paginated Products:', paginatedProducts);

  setTimeout(() => {
    container.innerHTML = '';
    if (paginatedProducts.length === 0) {
      container.innerHTML = '<p>Немає товарів для відображення.</p>';
      console.log('No products to display.');
      return;
    }

    paginatedProducts.forEach(product => {
      if (!product.product_id) {
        console.warn('Product ID is undefined:', product);
        return;
      }

      const history = priceHistory[product.product_id] || [];
      console.log(`History for ${product.product_id}:`, history); // Додатковий лог
      const latestPrice = history.length > 0 ? history[0].price_uah : '---';

      const card = document.createElement('div');
      card.className = 'product-card';
      const isChecked = selectedProducts.has(product.product_id);
      const checkbox = isSelectionMode ? 
        `<input type="checkbox" class="product-checkbox" data-id="${product.product_id}" ${isChecked ? 'checked' : ''}>` : '';

      card.innerHTML = `
        ${checkbox}
        <div class="product-image" style="background-image: url('${product.photo_url || 'https://via.placeholder.com/100'}');"></div>
        <div class="product-info">
          <div class="product-name">${product.bouquet_name || 'Невідома назва'}</div>
          <div class="product-price">Актуальна ціна: ${latestPrice} грн.</div>
          <div class="product-chart"><canvas id="chart-${product.product_id}" class="chart-canvas"></canvas></div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (!isSelectionMode) openProductModal(product);
      });

      container.appendChild(card);
      const chart = createChart(`chart-${product.product_id}`, history, false); // Явно false для карток
      if (chart) charts[`chart-${product.product_id}`] = chart;

      if (isSelectionMode) {
        const checkboxElement = card.querySelector('.product-checkbox');
        if (checkboxElement) {
          checkboxElement.addEventListener('change', (e) => {
            handleCheckbox(product.product_id, e.target.checked);
          });
        }
      }
    });

    const totalPages = Math.ceil(totalProducts / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = `Сторінка ${currentPage} з ${totalPages}`;
    const pagination = document.getElementById('pagination');
    if (pagination) {
      pagination.style.display = totalPages > 1 ? 'flex' : 'none';
      const prevBtn = document.getElementById('prevPageBtn');
      const nextBtn = document.getElementById('nextPageBtn');
      if (prevBtn) prevBtn.disabled = currentPage === 1;
      if (nextBtn) nextBtn.disabled = currentPage === totalPages;
    }
    updateSelectedCount();
  }, 0);
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    fetchProducts(currentPage);
  }
}

function nextPage() {
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    fetchProducts(currentPage);
  }
}

function openProductModal(product) {
  console.log('Opening modal for product:', product);
  const modal = document.getElementById('productModal');
  if (!modal) {
    console.error('Modal not found!');
    return;
  }
  
  const modalImage = document.getElementById('modalImage');
  const modalName = document.getElementById('modalName');
  const modalPrice = document.getElementById('modalPrice');
  const modalOldPrice = document.getElementById('modalOldPrice');
  const modalChartCanvas = document.getElementById('modalChart');

  if (!modalImage || !modalName || !modalPrice || !modalOldPrice || !modalChartCanvas) {
    console.error('Modal elements not found!');
    return;
  }

  const history = priceHistory[product.product_id] || [];
  const latestPrice = history.length > 0 ? history[0].price_uah : '---';
  const oldPrice = history.length > 1 ? history[1].price_uah : null;

  modalImage.src = product.photo_url || 'https://via.placeholder.com/200';
  modalName.textContent = product.bouquet_name || 'Невідома назва';
  modalPrice.textContent = `Актуальна ціна: ${latestPrice} грн`;
  modalOldPrice.textContent = oldPrice ? `Попередня ціна: ${oldPrice} грн` : '';
  modalOldPrice.style.display = oldPrice ? 'block' : 'none';

  modal.style.display = 'flex';

  // Оновлення графіка
  if (charts['modalChart']) {
    charts['modalChart'].destroy();
  }
  const chart = createChart('modalChart', history, true); // Явно true для модального вікна
  if (chart) charts['modalChart'] = chart;
}

function closeModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.style.display = 'none';
}

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  selectedProducts.clear(); // Очищаємо вибір при перемиканні
  updateToolbar();
  displayProducts();
}

function cancelSelection() {
  selectedProducts.clear();
  isSelectionMode = false;
  updateToolbar();
  displayProducts();
}

function updateToolbar() {
  const toggleBtn = document.getElementById('toggleSelectBtn');
  const cancelBtn = document.getElementById('cancelSelectBtn');
  if (toggleBtn && cancelBtn) {
    toggleBtn.textContent = isSelectionMode ? 'Видалити товари' : 'Вибрати товари';
    cancelBtn.style.display = isSelectionMode ? 'inline-block' : 'none';
  }
  updateSelectedCount();
}

function handleCheckbox(id, checked) {
  if (checked) {
    selectedProducts.add(id);
  } else {
    selectedProducts.delete(id);
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  const countDiv = document.getElementById('selectedCount');
  if (countDiv) {
    if (selectedProducts.size > 0) {
      countDiv.textContent = `Вибрано: ${selectedProducts.size}`;
      countDiv.style.display = 'block';
    } else {
      countDiv.textContent = '';
      countDiv.style.display = 'none';
    }
  } else {
    console.warn('Element with id "selectedCount" not found!');
  }
}

async function deleteSelected() {
  if (selectedProducts.size === 0) {
    alert("Не вибрано жодного товару.");
    return;
  }

  if (!confirm(`Ви впевнені, що хочете видалити ${selectedProducts.size} товар(ів)? Ця дія незворотна.`)) {
    return;
  }

  let deletedCount = 0;
  for (const productId of selectedProducts) {
    const success = await deleteProduct(productId);
    if (success) {
      products = products.filter(p => p.product_id !== productId);
      delete priceHistory[productId];
      totalProducts--;
      deletedCount++;
    }
  }
  selectedProducts.clear();
  isSelectionMode = false;
  updateToolbar();
  currentPage = 1; // Повертаємося на першу сторінку для оновлення
  products = []; // Очищаємо масив для нового завантаження
  await fetchProducts(); // Повторно завантажуємо товари
  alert(`Успішно видалено ${deletedCount} товар(ів).`);
}

function openAddModal() {
  const container = document.getElementById('productContainer');
  const pagination = document.getElementById('pagination');
  if (container && pagination) {
    container.innerHTML = `
      <div class="modal-content" style="margin: auto; width: 50%; text-align: center;">
        <h3>Додати товар за посиланням</h3>
        <input type="text" id="productLinkInput" placeholder="Вставте посилання" style="width: 100%; padding: 10px; margin: 10px 0;" />
        <div style="display: flex; justify-content: center; gap: 10px;">
          <button id="addProductConfirm" style="background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 6px;">Додати</button>
          <button id="cancelAddBtn" style="background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 6px;">Скасувати</button>
        </div>
      </div>
    `;
    pagination.style.display = 'none';

    document.getElementById('addProductConfirm').addEventListener('click', addProduct);
    document.getElementById('cancelAddBtn').addEventListener('click', cancelAddModal);
  }
}

function cancelAddModal() {
  currentPage = 1; // Повертаємося на першу сторінку при закритті модального вікна
  products = []; // Скидаємо масив продуктів
  fetchProducts(currentPage); // Завантажуємо товари заново
}

async function addProduct() {
  const link = document.getElementById('productLinkInput')?.value.trim();
  if (!link) {
    alert("Посилання не може бути порожнім.");
    return;
  }

  const fakeId = 'product-' + Date.now();
  const newProduct = {
    product_id: fakeId,
    bouquet_name: 'Новий товар',
    photo_url: link
  };

  try {
    const response = await fetch('http://localhost:5000/api/add_product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct)
    });
    if (!response.ok) throw new Error('Failed to add product');
    const result = await response.json();
    console.log(result.message);
    products.unshift(newProduct);
    await fetchPriceHistory(fakeId); // Завантажуємо історію лише для нового продукту
    totalProducts++; // Оновлюємо загальну кількість
    cancelAddModal(); // Закриваємо модал і скидаємо сторінку
  } catch (error) {
    console.error('Error adding product:', error);
    alert("Помилка при додаванні товару.");
  }
}

function openSettings() {
  alert('Налаштування відкрито');
}

function logout() {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM fully loaded, setting up event listeners...');
  const viewTrackedBtn = document.getElementById("viewTracked");
  const addProductBtn = document.getElementById("addProductLink");
  const toggleSelectBtn = document.getElementById("toggleSelectBtn");
  const cancelSelectBtn = document.getElementById("cancelSelectBtn");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (viewTrackedBtn) {
    viewTrackedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('View Tracked clicked');
      currentPage = 1; // Повертаємося на першу сторінку при оновленні
      products = []; // Скидаємо масив продуктів
      fetchProducts();
    });
  } else {
    console.warn("⛔ Кнопка #viewTracked не знайдена в DOM!");
  }

  if (addProductBtn) {
    addProductBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('Add Product clicked');
      openAddModal();
    });
  } else {
    console.warn("⛔ Кнопка #addProductLink не знайдена в DOM!");
  }

  if (toggleSelectBtn) {
    toggleSelectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('Toggle Select clicked');
      if (isSelectionMode && selectedProducts.size > 0) {
        deleteSelected(); // Викликаємо видалення, якщо є вибрані товари
      } else {
        toggleSelectionMode(); // Перемикаємо режим, якщо немає видалення
      }
    });
  } else {
    console.warn("⛔ Кнопка #toggleSelectBtn не знайдена в DOM!");
  }

  if (cancelSelectBtn) {
    cancelSelectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('Cancel Select clicked');
      cancelSelection();
    });
  } else {
    console.warn("⛔ Кнопка #cancelSelectBtn не знайдена в DOM!");
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      prevPage();
    });
  } else {
    console.warn("⛔ Кнопка #prevPageBtn не знайдена в DOM!");
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      nextPage();
    });
  } else {
    console.warn("⛔ Кнопка #nextPageBtn не знайдена в DOM!");
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  } else {
    console.warn("⛔ Кнопка #closeModalBtn не знайдена в DOM!");
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSettings();
    });
  } else {
    console.warn("⛔ Кнопка #settingsBtn не знайдена в DOM!");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  } else {
    console.warn("⛔ Кнопка #logoutBtn не знайдена в DOM!");
  }
  
  document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('productModal')) {
      closeModal();
    }
  });

  fetchProducts();
});