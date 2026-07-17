// ── Point of Sale Page Logic ──

let basket = [];
let selectedPayment = 'Cash';
let currentPosUser = null;
let productsList = [];

function renderBasket() {
  const container = document.getElementById('basketItems');
  if (basket.length === 0) {
    container.innerHTML = '<p style="padding:20px;color:#888;font-size:13px;">No items in basket. Search and add products above.</p>';
  } else {
    container.innerHTML = basket.map((item, i) => `
      <div class="item-row">
        <div class="item-product"><div class="item-name">${item.product_name}</div></div>
        <div class="item-sku">${item.sku}</div>
        <div class="item-qty">
          <button class="qty-btn" onclick="changeQty(${i}, -1)">-</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
        </div>
        <div class="item-unit">${formatKSh(item.unit_price)}</div>
        <div class="item-total">${formatKSh(item.unit_price * item.qty)}</div>
        <div class="item-x"><button class="x-btn" onclick="removeItem(${i})">X</button></div>
      </div>
    `).join('');
  }
  updateTotals();
}

function updateTotals() {
  const subtotal = basket.reduce((s, item) => s + item.unit_price * item.qty, 0);
  const discountPct = parseFloat(document.getElementById('discountInput').value) || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const tax = afterDiscount * 0.16;
  const grand = afterDiscount + tax;

  document.getElementById('subtotalVal').textContent = formatKSh(subtotal);
  document.getElementById('discountVal').textContent = formatKSh(discountAmt);
  document.getElementById('taxVal').textContent = formatKSh(tax);
  document.getElementById('grandVal').textContent = formatKSh(grand);

  // Update change due
  const tendered = parseFloat(document.getElementById('cashTendered').value) || 0;
  const change = tendered - grand;
  document.getElementById('changeDue').value = change >= 0 ? formatKSh(change) : 'KSh 0.00';
}

function changeQty(index, delta) {
  basket[index].qty += delta;
  if (basket[index].qty <= 0) basket.splice(index, 1);
  renderBasket();
}

function removeItem(index) {
  basket.splice(index, 1);
  renderBasket();
}

function addToBasket(product) {
  const existing = basket.find(b => b.product_id === product.product_id);
  if (existing) {
    if (existing.qty < product.stock_quantity) existing.qty++;
  } else {
    basket.push({
      product_id: product.product_id,
      product_name: product.product_name,
      sku: product.sku,
      unit_price: Number(product.unit_price),
      qty: 1,
      stock_quantity: product.stock_quantity
    });
  }
  renderBasket();
  document.getElementById('productSearch').value = '';
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchResults').style.display = 'none';
}

// Make functions available globally for inline onclick handlers
window.changeQty = changeQty;
window.removeItem = removeItem;
window.addToBasket = addToBasket;

(async () => {
  const session = await requireAuth();
  if (!session) return;

  currentPosUser = await getAppUser();

  // Load all products for search
  const { data } = await supabase.from('product').select('*').order('product_name');
  productsList = data || [];

  // Generate a transaction reference
  const { count } = await supabase.from('sales_transaction').select('*', { count: 'exact', head: true });
  const txnNum = (count || 0) + 1;
  document.getElementById('basketSub').textContent =
    'TXN-' + String(txnNum).padStart(4, '0') + ' • Today ' +
    new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  // Product search
  const searchInput = document.getElementById('productSearch');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) { searchResults.innerHTML = ''; searchResults.style.display = 'none'; return; }
    const matches = productsList.filter(p =>
      p.product_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 6);

    searchResults.style.display = 'block';
    if (matches.length === 0) {
      searchResults.innerHTML = '<div style="padding:10px;color:#888;font-size:12px;">No products found</div>';
    } else {
      searchResults.innerHTML = matches.map(p => `
        <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f1;font-size:13px;"
             onmouseover="this.style.background='#f4f4f5'" onmouseout="this.style.background='#fff'"
             onclick='addToBasket(${JSON.stringify(p).replace(/'/g, "\\'")})'>
          <strong>${p.product_name}</strong>
          <span style="color:#888;margin-left:8px;">${p.sku}</span>
          <span style="float:right;color:#3d52a0;font-weight:600;">${formatKSh(p.unit_price)}</span>
          <span style="float:right;color:#888;font-size:11px;margin-right:12px;">(${p.stock_quantity} in stock)</span>
        </div>
      `).join('');
    }
  });

  // Add button — add first search result
  document.getElementById('addBtn').addEventListener('click', () => {
    const q = searchInput.value.trim().toLowerCase();
    const match = productsList.find(p =>
      p.product_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
    if (match) addToBasket(match);
  });

  // Payment method buttons
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPayment = btn.textContent;
    });
  });

  // Discount & cash tendered → recalculate
  document.getElementById('discountInput').addEventListener('input', updateTotals);
  document.getElementById('cashTendered').addEventListener('input', updateTotals);

  // Clear basket
  document.getElementById('clearBtn').addEventListener('click', () => {
    basket = [];
    renderBasket();
  });

  // Process checkout
  document.getElementById('processBtn').addEventListener('click', async () => {
    if (basket.length === 0) { alert('Basket is empty'); return; }

    const processBtn = document.getElementById('processBtn');
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';

    const subtotal = basket.reduce((s, item) => s + item.unit_price * item.qty, 0);
    const discountPct = parseFloat(document.getElementById('discountInput').value) || 0;
    const afterDiscount = subtotal * (1 - discountPct / 100);
    const taxAmount = afterDiscount * 0.16;
    const grandTotal = afterDiscount + taxAmount;

    // 1. Insert sales_transaction
    const { data: txn, error: txnErr } = await supabase
      .from('sales_transaction')
      .insert({
        total_amount: grandTotal,
        discount_applied: discountPct,
        tax_amount: taxAmount,
        payment_method: selectedPayment,
        staff_user_id: currentPosUser ? currentPosUser.user_id : null
      })
      .select()
      .single();

    if (txnErr) {
      alert('Error creating transaction: ' + txnErr.message);
      processBtn.disabled = false;
      processBtn.textContent = 'Process Checkout';
      return;
    }

    // 2. Insert sale_items
    const saleItems = basket.map(item => ({
      transaction_id: txn.transaction_id,
      product_id: item.product_id,
      quantity_sold: item.qty,
      unit_price_at_sale: item.unit_price,
      line_total: item.unit_price * item.qty
    }));

    const { error: itemsErr } = await supabase.from('sale_item').insert(saleItems);
    if (itemsErr) console.error('Error inserting sale items:', itemsErr);

    // 3. Update stock quantities
    for (const item of basket) {
      await supabase.from('product')
        .update({ stock_quantity: item.stock_quantity - item.qty })
        .eq('product_id', item.product_id);
    }

    // 4. Generate receipt
    const receiptNum = 'RCP-' + String(txn.transaction_id).padStart(4, '0');
    await supabase.from('receipt').insert({
      transaction_id: txn.transaction_id,
      receipt_number: receiptNum,
      subtotal: subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal
    });

    // Done — reset
    alert('Transaction complete! Receipt: ' + receiptNum);
    basket = [];
    renderBasket();
    document.getElementById('discountInput').value = '0';
    document.getElementById('cashTendered').value = '';
    document.getElementById('changeDue').value = 'KSh 0.00';
    processBtn.disabled = false;
    processBtn.textContent = 'Process Checkout';

    // Refresh product stock data
    const { data: refreshed } = await supabase.from('product').select('*').order('product_name');
    productsList = refreshed || [];
  });

  // Initial render
  renderBasket();
})();
