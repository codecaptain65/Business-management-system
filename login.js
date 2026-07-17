// ── Login Page Logic ──

// If already logged in, redirect to dashboard
(async () => {
  const session = await getCurrentSession();
  if (session) window.location.href = 'dashboard.html';
})();

// Show/Hide password toggle
document.getElementById('showBtn').addEventListener('click', () => {
  const pw = document.getElementById('passwordInput');
  const btn = document.getElementById('showBtn');
  if (pw.type === 'password') { pw.type = 'text'; btn.textContent = 'Hide'; }
  else { pw.type = 'password'; btn.textContent = 'Show'; }
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('signInBtn');
  const errEl = document.getElementById('errorMsg');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  window.location.href = 'dashboard.html';
});
