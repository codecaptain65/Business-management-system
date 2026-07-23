// ── Dashboard Page Logic ──

(async () => {
  // Auth guard
  const session = await requireAuth();
  if (!session) return;

  // Update user profile UI
  await updateUIUserProfile();

  // ── Date range: current month ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // ── Fetch revenue & transactions for current month ──
  const { data: txns, error: txnErr } = await db
    .from('sales_transaction')
    .select('*')
    .gte('transaction_date', monthStart)
    .lte('transaction_date', monthEnd);

  if (txnErr) console.warn('Dashboard txns query notice:', txnErr.message);

  const totalRevenue = (txns || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const totalTax = (txns || []).reduce((s, t) => s + Number(t.tax_amount || 0), 0);

  // ── Fetch expenses for current month ──
  const { data: expenses, error: expErr } = await db
    .from('expense')
    .select('*')
    .gte('logged_at', monthStart)
    .lte('logged_at', monthEnd);

  if (expErr) console.warn('Dashboard expenses query notice:', expErr.message);

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const opex = (expenses || []).filter(e => e.expense_type === 'OPEX').reduce((s, e) => s + Number(e.amount || 0), 0);
  const payroll = (expenses || []).filter(e => e.expense_type === 'SALARY').reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Update stat cards
  document.getElementById('statRevenue').textContent = formatKSh(totalRevenue);
  document.getElementById('statProfit').textContent = formatKSh(netProfit);
  document.getElementById('statExpenses').textContent = formatKSh(totalExpenses);
  document.getElementById('statTax').textContent = formatKSh(totalTax);

  // Update P&L Summary
  document.getElementById('plRevenue').textContent = formatKSh(totalRevenue);
  document.getElementById('plCogs').textContent = '- ' + formatKSh(payroll);
  document.getElementById('plOpex').textContent = '- ' + formatKSh(opex);
  document.getElementById('plNet').textContent = formatKSh(netProfit);

  // ── Low Stock Alerts ──
  const { data: allProducts, error: prodErr } = await db
    .from('product')
    .select('product_name, stock_quantity, low_stock_threshold');

  if (prodErr) console.warn('Dashboard product query notice:', prodErr.message);

  const alertProducts = (allProducts || []).filter(p => Number(p.stock_quantity) <= Number(p.low_stock_threshold));

  const alertsBody = document.getElementById('alertsBody');
  if (!alertProducts || alertProducts.length === 0) {
    alertsBody.innerHTML = '<p style="font-size:12px;color:#2eb06b;padding:8px 0;">All stock levels healthy</p>';
  } else {
    alertsBody.innerHTML = alertProducts.map(p => `
      <div class="alert-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f4f4f5;">
        <p class="alert-name" style="font-size:13px;font-weight:500;color:#18181b;">${p.product_name}</p>
        <p class="alert-qty" style="font-size:12px;font-weight:600;color:#de3d3d;background:#fce0e0;padding:2px 8px;border-radius:12px;">${p.stock_quantity} left</p>
      </div>
    `).join('');
  }

  // Update alert count badge
  const alertBadge = document.getElementById('alertCount');
  if (alertBadge) alertBadge.textContent = alertProducts.length;

  // ── Recent Transactions ──
  const { data: recentTxns, error: recErr } = await db
    .from('sales_transaction')
    .select('transaction_id, total_amount, transaction_date, staff_user_id, app_user(username), sale_item(sale_item_id)')
    .order('transaction_date', { ascending: false })
    .limit(5);

  if (recErr) console.warn('Dashboard recent txns query notice:', recErr.message);

  const txBody = document.getElementById('txBody');
  if (!recentTxns || recentTxns.length === 0) {
    txBody.innerHTML = '<tr><td colspan="5" style="color:#888;padding:12px;">No transactions yet</td></tr>';
  } else {
    txBody.innerHTML = recentTxns.map(t => {
      const time = new Date(t.transaction_date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
      const itemCount = t.sale_item ? t.sale_item.length : 1;
      const staff = (t.app_user && t.app_user.username) ? t.app_user.username : 'Ethan M.';
      return `<tr>
        <td>TXN-${String(t.transaction_id).padStart(4, '0')}</td>
        <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
        <td>${staff}</td>
        <td class="amount">${formatKSh(t.total_amount)}</td>
        <td>${time}</td>
      </tr>`;
    }).join('');
  }

  // ── Dynamic 30-Day Weekly Bar Chart Breakdown ──
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: chartTxns } = await db
    .from('sales_transaction')
    .select('total_amount, transaction_date')
    .gte('transaction_date', thirtyDaysAgo.toISOString());

  const { data: chartExp } = await db
    .from('expense')
    .select('amount, logged_at')
    .gte('logged_at', thirtyDaysAgo.toISOString());

  // Divide into 4 weeks (7-day intervals)
  const weeks = [
    { rev: 0, exp: 0 }, // W1
    { rev: 0, exp: 0 }, // W2
    { rev: 0, exp: 0 }, // W3
    { rev: 0, exp: 0 }  // W4
  ];

  (chartTxns || []).forEach(t => {
    const diffDays = Math.floor((new Date() - new Date(t.transaction_date)) / (1000 * 60 * 60 * 24));
    const weekIdx = Math.min(3, Math.floor(diffDays / 7.5));
    weeks[3 - weekIdx].rev += Number(t.total_amount || 0);
  });

  (chartExp || []).forEach(e => {
    const diffDays = Math.floor((new Date() - new Date(e.logged_at)) / (1000 * 60 * 60 * 24));
    const weekIdx = Math.min(3, Math.floor(diffDays / 7.5));
    weeks[3 - weekIdx].exp += Number(e.amount || 0);
  });

  // Calculate maximum value for chart scaling
  const maxVal = Math.max(...weeks.map(w => Math.max(w.rev, w.exp)), 1000);
  const chartBarsContainer = document.querySelector('.chart-bars');
  if (chartBarsContainer) {
    chartBarsContainer.innerHTML = weeks.map((w, i) => {
      const revHeight = Math.max(10, Math.round((w.rev / maxVal) * 130));
      const expHeight = Math.max(10, Math.round((w.exp / maxVal) * 130));
      return `
        <div class="bar-group">
          <div class="bar-pair">
            <div class="bar rev" style="height:${revHeight}px;" title="Revenue: ${formatKSh(w.rev)}"></div>
            <div class="bar exp" style="height:${expHeight}px;" title="Expenses: ${formatKSh(w.exp)}"></div>
          </div>
          <span class="bar-label">W${i + 1}</span>
        </div>
      `;
    }).join('');
  }
})();

