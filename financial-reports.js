// ── Financial Reports Page Logic ──

(async () => {
  const session = await requireAuth();
  if (!session) return;

  // ── Current month range ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const periodLabel = months[now.getMonth()] + ' ' + now.getFullYear();

  // Update period labels
  document.getElementById('periodLabel').textContent = periodLabel;
  document.getElementById('stmtTitle').textContent = 'Profit & Loss Statement — ' + periodLabel;

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
  const payroll = (expenses || []).filter(e => e.expense_type === 'SALARY').reduce((s, e) => s + Number(e.amount), 0);
  const opex = (expenses || []).filter(e => e.expense_type === 'OPEX').reduce((s, e) => s + Number(e.amount), 0);
  const cogs = payroll; // simplified: COGS = payroll for this model
  const netProfit = totalRevenue - totalExpenses;

  // ── Update stat cards ──
  document.getElementById('rptRevenue').textContent = formatKSh(totalRevenue);
  document.getElementById('rptExpenses').textContent = formatKSh(totalExpenses);
  document.getElementById('rptProfit').textContent = formatKSh(netProfit);
  document.getElementById('rptTax').textContent = formatKSh(totalTax);

  // ── Update P&L statement ──
  document.getElementById('stmtSales').textContent = formatKSh(totalRevenue);
  document.getElementById('stmtOtherIncome').textContent = formatKSh(0);
  document.getElementById('stmtGrossRevenue').textContent = formatKSh(totalRevenue);
  document.getElementById('stmtCogs').textContent = formatKSh(cogs);
  document.getElementById('stmtPayroll').textContent = formatKSh(payroll);
  document.getElementById('stmtOpex').textContent = formatKSh(opex);
  document.getElementById('stmtTotalExpenses').textContent = formatKSh(totalExpenses);
  document.getElementById('stmtNetProfit').textContent = formatKSh(netProfit);

  // ── Recent exports ──
  const { data: exports } = await db
    .from('export_engine')
    .select('*, financial_report(report_type)')
    .order('exported_at', { ascending: false })
    .limit(3);

  const exportsContainer = document.getElementById('recentExports');
  if (!exports || exports.length === 0) {
    exportsContainer.innerHTML = '<p style="font-size:12px;color:#888;">No exports yet</p>';
  } else {
    exportsContainer.innerHTML = exports.map(ex => {
      const date = new Date(ex.exported_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
      const isExcel = ex.export_type === 'EXCEL';
      return `<div class="export-item">
        <div class="file-icon ${isExcel ? 'xls' : 'pdf-icon'}">${isExcel ? 'XLS' : 'PDF'}</div>
        <div>
          <div class="file-name">${ex.financial_report?.report_type || 'Report'}_${periodLabel.replace(' ', '')}.${isExcel ? 'xlsx' : 'pdf'}</div>
          <div class="file-date">${date}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Generate & Download button ──
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const appUser = await getAppUser();

    // Create a financial_report record
    const { data: report, error: rptErr } = await db
      .from('financial_report')
      .insert({
        report_type: 'PL',
        period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        tax_obligation: totalTax,
        generated_by_user_id: appUser ? appUser.user_id : null
      })
      .select()
      .single();

    if (rptErr) { alert('Error generating report: ' + rptErr.message); return; }

    // Log in export_engine
    await db.from('export_engine').insert({
      exported_by_user_id: appUser ? appUser.user_id : null,
      export_type: 'EXCEL',
      source_report_id: report.report_id
    });

    alert('Report generated and saved! Report ID: ' + report.report_id);
    location.reload();
  });
})();
