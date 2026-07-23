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
  const item = basket[index];
  if (delta > 0 && item.qty >= item.stock_quantity) {
    alert(`Only ${item.stock_quantity} units available in stock!`);
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) basket.splice(index, 1);
  renderBasket();
}

function removeItem(index) {
  basket.splice(index, 1);
  renderBasket();
}

function addToBasket(product) {
  const existing = basket.find(b => b.product_id === product.product_id);
  if (existing) {
    if (existing.qty < product.stock_quantity) {
      existing.qty++;
    } else {
      alert(`Only ${product.stock_quantity} units available in stock!`);
      return;
    }
  } else {
    if (product.stock_quantity <= 0) {
      alert('Product is out of stock!');
      return;
    }
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

// Make functions available globally for inline handlers
window.changeQty = changeQty;
window.removeItem = removeItem;
window.addToBasket = addToBasket;

function showReceiptModal(receiptData) {
  let modal = document.getElementById('receiptModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'receiptModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999;';
    document.body.appendChild(modal);
  }

  const itemsHtml = receiptData.items.map(item => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:6px 0;">${item.product_name}</td>
      <td style="text-align:center;">${item.qty}</td>
      <td style="text-align:right;">${formatKSh(item.unit_price)}</td>
      <td style="text-align:right;">${formatKSh(item.unit_price * item.qty)}</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div style="background:#fff;width:420px;max-width:90%;border-radius:12px;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);font-size:13px;font-family:Inter,sans-serif;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="margin:0;font-size:18px;color:#18181b;">Business Suite BMS</h2>
        <p style="margin:4px 0 0;color:#71717a;font-size:12px;">Official Sales Receipt</p>
      </div>
      <div style="background:#f4f4f5;padding:10px;border-radius:8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Receipt #: <strong>${receiptData.receiptNumber}</strong></span>
          <span>Payment: <strong>${receiptData.paymentMethod}</strong></span>
        </div>
        <div style="display:flex;justify-content:space-between;color:#71717a;font-size:11px;">
          <span>Date: ${receiptData.dateStr}</span>
          <span>Staff: ${receiptData.staff}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="border-bottom:2px solid #e4e4e7;text-align:left;color:#71717a;font-size:11px;">
            <th style="padding-bottom:6px;">Item</th>
            <th style="padding-bottom:6px;text-align:center;">Qty</th>
            <th style="padding-bottom:6px;text-align:right;">Price</th>
            <th style="padding-bottom:6px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="border-top:1px solid #e4e4e7;padding-top:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Subtotal:</span><span>${formatKSh(receiptData.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Discount (${receiptData.discountPct}%):</span><span>-${formatKSh(receiptData.subtotal * (receiptData.discountPct/100))}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>16% VAT:</span><span>${formatKSh(receiptData.taxAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;color:#3d52a0;margin-top:8px;padding-top:8px;border-top:2px dashed #e4e4e7;">
          <span>Grand Total:</span><span>${formatKSh(receiptData.grandTotal)}</span>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button onclick="window.print()" style="flex:1;background:#2eb06b;color:#fff;border:none;padding:10px;border-radius:6px;font-weight:600;cursor:pointer;">Print Receipt</button>
        <button onclick="document.getElementById('receiptModal').remove()" style="flex:1;background:#f4f4f5;color:#18181b;border:none;padding:10px;border-radius:6px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
}

(async () => {
  const session = await requireAuth();
  if (!session) return;

  await updateUIUserProfile();
  currentPosUser = await getAppUser();

  // Load products for search
  const { data, error } = await db.from('product').select('*').order('product_name');
  if (error) console.warn('POS product fetch notice:', error.message);
  productsList = data || [];

  // Generate transaction reference badge
  const { count } = await db.from('sales_transaction').select('*', { count: 'exact', head: true });
  const txnNum = (count || 0) + 1;
  document.getElementById('basketSub').textContent =
    'TXN-' + String(txnNum).padStart(4, '0') + ' • Today ' +
    new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  // Product search
  const searchInput = document.getElementById('productSearch');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 1) { searchResults.innerHTML = ''; searchResults.style.display = 'none'; return; }
    const matches = productsList.filter(p =>
      p.product_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 8);

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
          <span style="float:right;color:${p.stock_quantity <= p.low_stock_threshold ? '#de3d3d' : '#888'};font-size:11px;margin-right:12px;">(${p.stock_quantity} in stock)</span>
        </div>
      `).join('');
    }
  });

  // Add button — add first search match
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

  // Discount & cash tendered inputs
  document.getElementById('discountInput').addEventListener('input', updateTotals);
  document.getElementById('cashTendered').addEventListener('input', updateTotals);

  // Clear basket
  document.getElementById('clearBtn').addEventListener('click', () => {
    basket = [];
    renderBasket();
  });

  // Process checkout
  document.getElementById('processBtn').addEventListener('click', async () => {
    if (basket.length === 0) { alert('Basket is empty!'); return; }

    const processBtn = document.getElementById('processBtn');
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';

    const subtotal = basket.reduce((s, item) => s + item.unit_price * item.qty, 0);
    const discountPct = parseFloat(document.getElementById('discountInput').value) || 0;
    const afterDiscount = subtotal * (1 - discountPct / 100);
    const taxAmount = afterDiscount * 0.16;
    const grandTotal = afterDiscount + taxAmount;

    try {
      // 1. Insert sales_transaction
      const { data: txn, error: txnErr } = await db
        .from('sales_transaction')
        .insert({
          total_amount: grandTotal,
          discount_applied: discountPct,
          tax_amount: taxAmount,
          payment_method: selectedPayment,
          staff_user_id: currentPosUser ? currentPosUser.user_id : 1
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      // 2. Insert sale_items
      const saleItems = basket.map(item => ({
        transaction_id: txn.transaction_id,
        product_id: item.product_id,
        quantity_sold: item.qty,
        unit_price_at_sale: item.unit_price,
        line_total: item.unit_price * item.qty
      }));

      const { error: itemsErr } = await db.from('sale_item').insert(saleItems);
      if (itemsErr) console.error('Error inserting sale items:', itemsErr);

      // 3. Update stock quantities & generate stock_alert if low
      for (const item of basket) {
        const newQty = item.stock_quantity - item.qty;
        await db.from('product')
          .update({ stock_quantity: Math.max(0, newQty) })
          .eq('product_id', item.product_id);

        if (newQty <= (item.low_stock_threshold || 10)) {
          await db.from('stock_alert').insert({
            product_id: item.product_id,
            current_stock: Math.max(0, newQty),
            threshold: item.low_stock_threshold || 10,
            is_resolved: false
          });
        }
      }

      // 4. Generate receipt
      const receiptNum = 'RCP-' + String(txn.transaction_id).padStart(5, '0');
      await db.from('receipt').insert({
        transaction_id: txn.transaction_id,
        receipt_number: receiptNum,
        subtotal: subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal
      });

      // Show receipt modal
      showReceiptModal({
        receiptNumber: receiptNum,
        items: [...basket],
        subtotal: subtotal,
        discountPct: discountPct,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        paymentMethod: selectedPayment,
        dateStr: new Date().toLocaleString('en-KE'),
        staff: currentPosUser ? (currentPosUser.username || 'Ethan M.') : 'Ethan M.'
      });

      // Reset basket and fields
      basket = [];
      renderBasket();
      document.getElementById('discountInput').value = '0';
      document.getElementById('cashTendered').value = '';
      document.getElementById('changeDue').value = 'KSh 0.00';

      // Refresh product stock list
      const { data: refreshed } = await db.from('product').select('*').order('product_name');
      productsList = refreshed || [];
    } catch (err) {
      alert('Error completing transaction: ' + err.message);
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Process Checkout';
    }
  });

  renderBasket();
})();

