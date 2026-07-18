// ── Dashboard Page Logic ──

(async () => {
  // Auth guard
  const session = await requireAuth();
  if (!session) return;

  // Show user info in sidebar
  const appUser = await getAppUser();
  if (appUser) {
    const initials = appUser.username.charAt(0).toUpperCase();
    document.querySelector('.user-avatar').textContent = initials;
    document.querySelector('.user-name').textContent = appUser.username;
    document.querySelector('.user-role').textContent = appUser.app_role?.role_name || 'Staff';
    document.querySelector('.topbar-avatar').textContent = initials;
    document.querySelector('.page-sub').textContent =
      'Good morning, ' + appUser.username.split(' ')[0] + ' — here is your business overview';
  }

  // ── Date range: current month ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // ── Fetch revenue ──
  const { data: txns } = await db
    .from('sales_transaction')
    .select('total_amount, tax_amount')
    .gte('transaction_date', monthStart)
    .lte('transaction_date', monthEnd);

  const totalRevenue = (txns || []).reduce((s, t) => s + Number(t.total_amount), 0);
  const totalTax = (txns || []).reduce((s, t) => s + Number(t.tax_amount || 0), 0);

  // ── Fetch expenses ──
  const { data: expenses } = await db
    .from('expense')
    .select('amount, expense_type')
    .gte('logged_at', monthStart)
    .lte('logged_at', monthEnd);

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
  const opex = (expenses || []).filter(e => e.expense_type === 'OPEX').reduce((s, e) => s + Number(e.amount), 0);
  const payroll = (expenses || []).filter(e => e.expense_type === 'SALARY').reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Update stat cards
  document.getElementById('statRevenue').textContent = formatKSh(totalRevenue);
  document.getElementById('statProfit').textContent = formatKSh(netProfit);
  document.getElementById('statExpenses').textContent = formatKSh(totalExpenses);
  document.getElementById('statTax').textContent = formatKSh(totalTax);

  // Update P&L
  document.getElementById('plRevenue').textContent = formatKSh(totalRevenue);
  document.getElementById('plCogs').textContent = '- ' + formatKSh(payroll);
  document.getElementById('plOpex').textContent = '- ' + formatKSh(opex);
  document.getElementById('plNet').textContent = formatKSh(netProfit);

  // ── Low stock alerts ──
  const { data: allProducts } = await db
    .from('product')
    .select('product_name, stock_quantity, low_stock_threshold');

  const alertProducts = (allProducts || []).filter(p => p.stock_quantity <= p.low_stock_threshold);

  const alertsBody = document.getElementById('alertsBody');
  if (alertProducts.length === 0) {
    alertsBody.innerHTML = '<p style="font-size:12px;color:#2eb06b;">All stock levels healthy</p>';
  } else {
    alertsBody.innerHTML = alertProducts.map(p => `
      <div class="alert-item">
        <p class="alert-name">${p.product_name}</p>
        <p class="alert-qty">${p.stock_quantity} units left</p>
      </div>
    `).join('');
  }

  // Update alert count badge
  const alertBadge = document.getElementById('alertCount');
  if (alertBadge) alertBadge.textContent = alertProducts.length;

  // ── Recent transactions ──
  const { data: recentTxns } = await db
    .from('sales_transaction')
    .select('transaction_id, total_amount, transaction_date, staff_user_id, app_user(username), sale_item(sale_item_id)')
    .order('transaction_date', { ascending: false })
    .limit(5);

  const txBody = document.getElementById('txBody');
  if (!recentTxns || recentTxns.length === 0) {
    txBody.innerHTML = '<tr><td colspan="5" style="color:#888;">No transactions yet</td></tr>';
  } else {
    txBody.innerHTML = recentTxns.map(t => {
      const time = new Date(t.transaction_date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
      const itemCount = t.sale_item ? t.sale_item.length : 0;
      const staff = t.app_user ? t.app_user.username : '—';
      return `<tr>
        <td>TXN-${String(t.transaction_id).padStart(4, '0')}</td>
        <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
        <td>${staff}</td>
        <td class="amount">${formatKSh(t.total_amount)}</td>
        <td>${time}</td>
      </tr>`;
    }).join('');
  }
})();
