// ── Financial Reports Page Logic ──

(async () => {
  const session = await requireAuth();
  if (!session) return;

  await updateUIUserProfile();

  // ── Current month date range ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const periodLabel = months[now.getMonth()] + ' ' + now.getFullYear();

  // Update period labels
  document.getElementById('periodLabel').textContent = periodLabel;
  document.getElementById('stmtTitle').textContent = 'Profit & Loss Statement — ' + periodLabel;
  const exportPeriodEl = document.getElementById('exportPeriod');
  if (exportPeriodEl) exportPeriodEl.textContent = periodLabel + ' ▾';

  // ── Fetch revenue from sales_transaction ──
  const { data: txns } = await db
    .from('sales_transaction')
    .select('total_amount, tax_amount')
    .gte('transaction_date', monthStart)
    .lte('transaction_date', monthEnd);

  const totalRevenue = (txns || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const totalTax = (txns || []).reduce((s, t) => s + Number(t.tax_amount || 0), 0);

  // ── Fetch expenses ──
  const { data: expenses } = await db
    .from('expense')
    .select('amount, expense_type')
    .gte('logged_at', monthStart)
    .lte('logged_at', monthEnd);

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const payroll = (expenses || []).filter(e => e.expense_type === 'SALARY').reduce((s, e) => s + Number(e.amount || 0), 0);
  const opex = (expenses || []).filter(e => e.expense_type === 'OPEX').reduce((s, e) => s + Number(e.amount || 0), 0);
  const cogs = Math.round(payroll * 0.4); // COGS estimate
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

  // ── Load Recent Exports ──
  async function loadRecentExports() {
    const { data: exports } = await db
      .from('export_engine')
      .select('*, financial_report(report_type)')
      .order('exported_at', { ascending: false })
      .limit(4);

    const exportsContainer = document.getElementById('recentExports');
    if (!exports || exports.length === 0) {
      exportsContainer.innerHTML = '<p style="font-size:12px;color:#888;padding:8px 0;">No exports logged yet</p>';
    } else {
      exportsContainer.innerHTML = exports.map(ex => {
        const date = new Date(ex.exported_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
        const isExcel = ex.export_type === 'EXCEL';
        const rptName = (ex.financial_report && ex.financial_report.report_type) ? ex.financial_report.report_type : 'PL_Report';
        return `
          <div class="export-item" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f4f4f5;">
            <div class="file-icon ${isExcel ? 'xls' : 'pdf-icon'}" style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;background:${isExcel ? '#d9f4e6;color:#2eb06b;' : '#fce0e0;color:#de3d3d;'}">${isExcel ? 'XLS' : 'PDF'}</div>
            <div>
              <div class="file-name" style="font-size:12px;font-weight:600;color:#18181b;">${rptName}_${periodLabel.replace(' ', '')}.${isExcel ? 'xlsx' : 'pdf'}</div>
              <div class="file-date" style="font-size:11px;color:#71717a;">${date}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  await loadRecentExports();

  // Export Format Selection state
  let selectedFormat = 'EXCEL';
  const formatBoxes = document.querySelectorAll('.format-box');
  formatBoxes.forEach(box => {
    box.addEventListener('click', () => {
      formatBoxes.forEach(b => b.style.outline = 'none');
      box.style.outline = '2px solid #3d52a0';
      selectedFormat = box.classList.contains('excel') ? 'EXCEL' : 'PDF';
    });
  });

  // Helper: Download CSV / Excel file
  function downloadCSV(filename, rows) {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Generate & Download button ──
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    const appUser = await getAppUser();

    try {
      // 1. Create a financial_report record in DB
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
          generated_by_user_id: appUser ? appUser.user_id : 1
        })
        .select()
        .single();

      if (rptErr) throw rptErr;

      // 2. Log in export_engine
      await db.from('export_engine').insert({
        exported_by_user_id: appUser ? appUser.user_id : 1,
        export_type: selectedFormat,
        source_report_id: report.report_id
      });

      // 3. Trigger File Download
      const reportTitle = `PL_Statement_${periodLabel.replace(' ', '_')}`;
      if (selectedFormat === 'EXCEL') {
        const csvRows = [
          ['BUSINESS MANAGEMENT SYSTEM (BMS) - FINANCIAL REPORT'],
          ['Period', periodLabel],
          ['Report Type', 'Profit & Loss Statement'],
          ['Generated At', new Date().toLocaleString('en-KE')],
          [''],
          ['Category', 'Amount (KSh)'],
          ['Gross Revenue', totalRevenue],
          ['Other Income', 0],
          ['Total Revenue', totalRevenue],
          ['Cost of Goods Sold', cogs],
          ['Payroll (Salaries)', payroll],
          ['Operating Expenses', opex],
          ['Total Expenses', totalExpenses],
          ['NET PROFIT', netProfit],
          ['TAX OBLIGATION (16% VAT)', totalTax]
        ];
        downloadCSV(`${reportTitle}.csv`, csvRows);
      } else {
        window.print();
      }

      await loadRecentExports();
      alert(`Financial Report generated successfully! Saved Report #${report.report_id}`);
    } catch (err) {
      alert('Error generating report: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate & Download';
    }
  });
})();

