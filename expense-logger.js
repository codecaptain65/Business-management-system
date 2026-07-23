// ── Expense Logger Page Logic ──

let currentAppUser = null;

async function loadExpenses() {
  // Fetch all expenses, ordered by most recent
  const { data: expenses, error } = await db
    .from('expense')
    .select('*, app_user(username)')
    .order('logged_at', { ascending: false });

  if (error) { console.warn('Error loading expenses:', error.message); }

  const list = expenses || [];

  // Update summary cards
  const opexTotal = list.filter(e => e.expense_type === 'OPEX').reduce((s, e) => s + Number(e.amount || 0), 0);
  const payrollTotal = list.filter(e => e.expense_type === 'SALARY').reduce((s, e) => s + Number(e.amount || 0), 0);
  const otherTotal = list.filter(e => e.expense_type === 'OTHER' || e.expense_type === 'TAX').reduce((s, e) => s + Number(e.amount || 0), 0);

  document.getElementById('sumOpex').textContent = formatKSh(opexTotal);
  document.getElementById('sumPayroll').textContent = formatKSh(payrollTotal);
  document.getElementById('sumOther').textContent = formatKSh(otherTotal);

  // Populate ledger table
  const tbody = document.getElementById('expenseLedger');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#888;padding:12px;">No expenses logged yet</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(e => {
    const date = new Date(e.logged_at);
    const dateStr = date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
    const typeLower = (e.expense_type || 'other').toLowerCase();
    const staff = (e.app_user && e.app_user.username) ? e.app_user.username : 'Ethan M.';
    return `<tr>
      <td>${dateStr}</td>
      <td><span class="badge ${typeLower}">${e.expense_type}</span></td>
      <td>${e.description || '—'}</td>
      <td class="amount-cell">${formatKSh(e.amount)}</td>
      <td>${staff}</td>
    </tr>`;
  }).join('');
}

(async () => {
  // Auth guard
  const session = await requireAuth();
  if (!session) return;

  await updateUIUserProfile();
  currentAppUser = await getAppUser();

  // Set default fiscal period to current month
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const currentPeriod = months[now.getMonth()] + ' ' + now.getFullYear();
  document.getElementById('fiscalPeriod').value = currentPeriod;
  const ledgerPeriodEl = document.getElementById('ledgerPeriod');
  if (ledgerPeriodEl) ledgerPeriodEl.textContent = 'Period: ' + currentPeriod;

  // Load existing expenses
  await loadExpenses();

  // Handle form submission
  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('logBtn');
    const errEl = document.getElementById('expenseError');
    const successEl = document.getElementById('expenseSuccess');
    errEl.style.display = 'none';
    successEl.style.display = 'none';

    const expenseType = document.getElementById('expenseType').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDesc').value.trim();
    const fiscalPeriod = document.getElementById('fiscalPeriod').value.trim();

    // Validation
    if (!expenseType) { errEl.textContent = 'Please select an expense type'; errEl.style.display = 'block'; return; }
    if (isNaN(amount) || amount < 0) { errEl.textContent = 'Amount must be >= 0'; errEl.style.display = 'block'; return; }
    if (expenseType === 'OPEX' && !description) { errEl.textContent = 'Description required for OPEX entries'; errEl.style.display = 'block'; return; }

    btn.disabled = true;
    btn.textContent = 'Logging...';

    const { error } = await db.from('expense').insert({
      expense_type: expenseType,
      amount: amount,
      description: description || null,
      logged_by_user_id: currentAppUser ? currentAppUser.user_id : 1,
      fiscal_period: fiscalPeriod || currentPeriod
    });

    if (error) {
      errEl.textContent = 'Failed to log expense: ' + error.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Log Expense';
      return;
    }

    // Success
    successEl.textContent = 'Expense logged successfully!';
    successEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Log Expense';

    // Reset form fields (except fiscal period)
    document.getElementById('expenseType').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDesc').value = '';

    // Reload ledger & summary cards
    await loadExpenses();

    // Hide success message after 3 seconds
    setTimeout(() => { successEl.style.display = 'none'; }, 3000);
  });
})();

