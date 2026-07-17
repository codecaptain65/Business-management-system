// ── Supabase Configuration ──
const SUPABASE_URL = 'https://gxouidkuyoqsioufqitc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b3VpZGt1eW9xc2lvdWZxaXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzQ5MzAsImV4cCI6MjA5NjgxMDkzMH0.YaCz_m9r2YynWVH_R1efLsHSjtpG68LXT8P_KyHnIQE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth Helpers ──
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// Auth guard — call on every protected page
async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// Get the app_user row for the logged-in Supabase Auth user
async function getAppUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('app_user')
    .select('*, app_role(*)')
    .eq('email', user.email)
    .single();
  if (error) { console.error('getAppUser error:', error); return null; }
  return data;
}

// Format number as KSh currency
function formatKSh(num) {
  return 'KSh ' + Number(num).toLocaleString('en-KE', { minimumFractionDigits: 0 });
}
