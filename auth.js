// auth.js
// Responsibility: email/password login & registration via Supabase Auth,
//                 session restore on load, routing between the welcome
//                 gate and the app, and the Profile tab's signed-in vs
//                 guest view.
//
// Guest-first: the app works fully without an account (localStorage only,
// unchanged behavior). Signing in unlocks persistence to Supabase — see
// db.js, which checks `currentUser` before writing anything.
//
// Connects to: supabaseClient.js (the client), db.js (reads currentUser),
//              index.html (#screen-welcome, #screen-profile), app.js (showScreen)

let currentUser = null;

const GUEST_FLAG_KEY = 'careerCopilotGuest';

// ─── Restore session on load & route to welcome gate or home ─────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session ? data.session.user : null;

  const isGuest = localStorage.getItem(GUEST_FLAG_KEY) === '1';
  if (!currentUser && !isGuest) {
    showScreen('screen-welcome');
  }

  renderProfileScreen();
  updateHomeGreeting();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    renderProfileScreen();
    updateHomeGreeting();
  });
});

// ─── Continue as Guest ─────────────────────────────────────────────────────────
function continueAsGuest() {
  localStorage.setItem(GUEST_FLAG_KEY, '1');
  showScreen('screen-home');
}

// ─── Register ──────────────────────────────────────────────────────────────────
async function handleRegister() {
  const username = document.getElementById('register-username').value.trim();
  const email    = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const errorEl  = document.getElementById('register-error');
  errorEl.classList.remove('visible');

  if (!username || !email || !password) {
    errorEl.textContent = 'Please enter a username, email and password.';
    errorEl.classList.add('visible');
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters.';
    errorEl.classList.add('visible');
    return;
  }

  setAuthLoading('register-submit-btn', true);
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;

    currentUser = data.user;
    localStorage.removeItem(GUEST_FLAG_KEY);
    renderProfileScreen();
    updateHomeGreeting();
    showToast('Account created! You\'re signed in.');
    showScreen('screen-home');
  } catch (err) {
    errorEl.textContent = err.message || 'Could not create account.';
    errorEl.classList.add('visible');
  } finally {
    setAuthLoading('register-submit-btn', false);
  }
}

// ─── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  errorEl.classList.remove('visible');

  if (!email || !password) {
    errorEl.textContent = 'Please enter your email and password.';
    errorEl.classList.add('visible');
    return;
  }

  setAuthLoading('login-submit-btn', true);
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentUser = data.user;
    localStorage.removeItem(GUEST_FLAG_KEY);
    renderProfileScreen();
    updateHomeGreeting();
    const username = currentUser.user_metadata && currentUser.user_metadata.username;
    showToast(username ? `Welcome back, ${username}!` : 'Signed in!');
    showScreen('screen-home');
  } catch (err) {
    errorEl.textContent = err.message || 'Could not sign in.';
    errorEl.classList.add('visible');
  } finally {
    setAuthLoading('login-submit-btn', false);
  }
}

// ─── Sign Out ──────────────────────────────────────────────────────────────────
async function handleSignOut() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  localStorage.removeItem(GUEST_FLAG_KEY);
  renderProfileScreen();
  updateHomeGreeting();
  showToast('Signed out.');
  showScreen('screen-welcome');
}

// ─── Log Out (home screen power icon) ───────────────────────────────────────
function confirmLogout() {
  if (window.confirm('Are you sure you want to log out?')) {
    handleSignOut();
  }
}

// ─── Toggle Login / Register forms (on the welcome gate) ─────────────────────
function showAuthForm(which) {
  document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
  document.getElementById('auth-tab-login').classList.toggle('tab-btn--active', which === 'login');
  document.getElementById('auth-tab-register').classList.toggle('tab-btn--active', which === 'register');
}

// ─── Profile tab ────────────────────────────────────────────────────────────────
function openProfile() {
  renderProfileScreen();
  showScreen('screen-profile');
}

function renderProfileScreen() {
  const userView  = document.getElementById('profile-user-view');
  const guestView = document.getElementById('profile-guest-view');
  if (!userView || !guestView) return; // screen not in DOM yet

  if (currentUser) {
    userView.classList.remove('hidden');
    guestView.classList.add('hidden');
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-username').textContent =
      (currentUser.user_metadata && currentUser.user_metadata.username) || '—';
  } else {
    userView.classList.add('hidden');
    guestView.classList.remove('hidden');
  }
}

// ─── Home greeting ──────────────────────────────────────────────────────────────
// "First Last" -> take the first word. A single-word username (nickname) is used as-is.
function updateHomeGreeting() {
  const el = document.getElementById('home-greeting');
  if (!el) return;

  const username = currentUser && currentUser.user_metadata && currentUser.user_metadata.username;
  if (!username) {
    el.textContent = 'Hi there! 👋';
    return;
  }

  const firstName = username.trim().split(/\s+/)[0];
  el.textContent = `Hi ${firstName}! 👋`;
}

function setAuthLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  if (btn) btn.disabled = on;
}
