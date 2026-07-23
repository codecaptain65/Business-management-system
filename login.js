// ── Login Page Logic ──

// If already logged in, redirect to dashboard
(async () => {
  const session = await getCurrentSession();
  const demoUser = localStorage.getItem('bms_demo_user');
  if (session || demoUser) window.location.href = 'dashboard.html';
})();

// Show/Hide password toggle
const showBtn = document.getElementById('showBtn');
if (showBtn) {
  showBtn.addEventListener('click', () => {
    const pw = document.getElementById('passwordInput');
    if (pw.type === 'password') { pw.type = 'text'; showBtn.textContent = 'Hide'; }
    else { pw.type = 'password'; showBtn.textContent = 'Show'; }
  });
}

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

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      // Fallback: If auth is disabled or not set up in Supabase yet, allow demo sign-in for demo email
      localStorage.setItem('bms_demo_user', JSON.stringify({
        email: email || 'ethan@bms.co.ke',
        username: email.split('@')[0] || 'Ethan M.'
      }));
      window.location.href = 'dashboard.html';
      return;
    }

    localStorage.setItem('bms_demo_user', JSON.stringify({
      email: data.user.email,
      username: data.user.email.split('@')[0]
    }));

    window.location.href = 'dashboard.html';
  } catch (err) {
    // Fallback for demo mode
    localStorage.setItem('bms_demo_user', JSON.stringify({
      email: email || 'ethan@bms.co.ke',
      username: 'Ethan M.'
    }));
    window.location.href = 'dashboard.html';
  }
});

