// ── Supabase Configuration ──
const SUPABASE_URL = 'https://gxouidkuyoqsioufqitc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b3VpZGt1eW9xc2lvdWZxaXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzQ5MzAsImV4cCI6MjA5NjgxMDkzMH0.YaCz_m9r2YynWVH_R1efLsHSjtpG68LXT8P_KyHnIQE';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth Helpers ──
async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getCurrentSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function signOut() {
  await db.auth.signOut();
  localStorage.removeItem('bms_demo_user');
  window.location.href = 'index.html';
}

// Auth guard — call on every protected page
async function requireAuth() {
  const session = await getCurrentSession();
  const demoUser = localStorage.getItem('bms_demo_user');
  if (!session && !demoUser) {
    window.location.href = 'index.html';
    return null;
  }
  return session || { user: JSON.parse(demoUser) };
}

// Get the app_user row for the logged-in Supabase Auth user
async function getAppUser() {
  const user = await getCurrentUser();
  const email = user ? user.email : (JSON.parse(localStorage.getItem('bms_demo_user') || '{}').email || 'ethan@bms.co.ke');
  
  // Query app_user joining app_role
  const { data, error } = await db
    .from('app_user')
    .select('*, app_role(*)')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.warn('getAppUser notice:', error.message);
  }

  if (data) return data;

  // Fallback demo user if DB user record doesn't exist yet
  return {
    user_id: 1,
    username: 'Ethan M.',
    email: email,
    app_role: { role_name: 'OWNER' }
  };
}

// Format number as KSh currency
function formatKSh(num) {
  const n = Number(num) || 0;
  return 'KSh ' + n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Update topbar user details dynamically across pages
async function updateUIUserProfile() {
  const appUser = await getAppUser();
  if (!appUser) return;
  const username = appUser.username || 'Ethan M.';
  const initials = username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'E';
  const roleName = appUser.app_role ? (appUser.app_role.role_name || 'Owner') : 'Owner';

  document.querySelectorAll('.user-avatar, .topbar-avatar').forEach(el => el.textContent = initials);
  document.querySelectorAll('.user-name').forEach(el => el.textContent = username);
  document.querySelectorAll('.user-role').forEach(el => el.textContent = roleName);
  
  const pageSub = document.querySelector('.page-sub');
  if (pageSub && pageSub.textContent.includes('Good morning')) {
    pageSub.textContent = `Good morning, ${username.split(' ')[0]} — here is your business overview`;
  }
}

