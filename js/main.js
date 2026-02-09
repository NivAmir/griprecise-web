// main.js
// Handles login, signup, navbar updates, and dashboard interactions using Firebase Auth

import { 
    auth, database, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    ref, set
} from "./firebase.js";




document.addEventListener("DOMContentLoaded", function () {
    // 1. טיפול בטפסי התחברות (אם קיימים בדף)
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    if (signupForm) signupForm.addEventListener("submit", handleSignup);

    // 2. הדגשת הלינק הפעיל בתפריט הניווט
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === window.location.pathname.split('/').pop() || link.href === window.location.href) {
            link.classList.add('active');
        }
    });

    // 3. מעקב כללי אחר מצב התחברות (לצורך ה-Navbar)
    onAuthStateChanged(auth, (user) => {
        if (typeof updateNavbarUser === "function") updateNavbarUser(user);
        
    });
});




// =========================
// LOGIN & SIGNUP FUNCTIONS (Firebase Auth)
// =========================
async function handleLogin(e) {
  e.preventDefault();

  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const loginErrorBox = document.getElementById("loginError");
  const loginSuccessBox = document.getElementById("loginSuccess");
  const loginSpinner = document.getElementById("loginSpinner");

  // clear previous messages
  loginErrorBox.classList.add("d-none");
  loginSuccessBox.classList.add("d-none");
  loginErrorBox.textContent = "";
  loginSuccessBox.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  // client-side basic validation
  if (!email) {
    loginErrorBox.textContent = "Please enter your email.";
    loginErrorBox.classList.remove("d-none");
    return;
  }
  if (!email.includes("@") || !email.includes(".")) {
    loginErrorBox.textContent = "Please enter a valid email address.";
    loginErrorBox.classList.remove("d-none");
    return;
  }
  if (!password) {
    loginErrorBox.textContent = "Please enter your password.";
    loginErrorBox.classList.remove("d-none");
    return;
  }

  // show spinner
  loginSpinner.classList.remove("d-none");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // success
    
    loginSuccessBox.classList.remove("d-none");

    const emailName = userCredential.user.email.split("@")[0];
    loginSuccessBox.textContent = `Welcome ${emailName}!`;
  

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 4000);
  } catch (err) {
    console.error("Login error", err);
    loginSpinner.classList.add("d-none");

    // map common firebase codes to friendly messages
    let msg = "Login failed. Please try again.";
    if (err.code === "auth/invalid-email") msg = "Invalid email format.";
    else if (err.code === "auth/user-not-found") msg = "No account found with this email.";
    else if (err.code === "auth/wrong-password") msg = "Incorrect password.";
    else if (err.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
    else if (err.code === "auth/network-request-failed") msg = "Network error. Check your connection.";

    loginErrorBox.textContent = msg;
    loginErrorBox.classList.remove("d-none");
  }
}

async function handleSignup(e) {
  e.preventDefault();

  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const signupErrorBox = document.getElementById("signupError");
  const signupSuccessBox = document.getElementById("signupSuccess");
  const signupSpinner = document.getElementById("signupSpinner");

  // Clear previous messages
  signupErrorBox.classList.add("d-none");
  signupSuccessBox.classList.add("d-none");
  signupErrorBox.textContent = "";
  signupSuccessBox.textContent = "";

  // Basic validation
  if (!email || !email.includes("@") || !email.includes(".")) {
    signupErrorBox.textContent = "Please enter a valid email.";
    signupErrorBox.classList.remove("d-none");
    return;
  }
  if (!password || password.length < 6) {
    signupErrorBox.textContent = "Password must be at least 6 characters.";
    signupErrorBox.classList.remove("d-none");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Gather extra fields
    const accountType = document.querySelector("input[name='accountType']:checked")?.value || "regular";
    const experience = document.getElementById("signupExperience")?.value || "beginner";
    const notes = document.getElementById("signupNotes")?.value || "";

    // Default pressures per material
    const materialDefaults = {
      glass: 50,
      wood: 100,
      plastic: 150,
      metal: 200
    };

    // Create materials object with pressures
    const materials = {};

    if (document.getElementById("signupMatPlastic")?.checked) materials["plastic"] = materialDefaults["plastic"];
    if (document.getElementById("signupMatMetal")?.checked)   materials["metal"] = materialDefaults["metal"];
    if (document.getElementById("signupMatGlass")?.checked)   materials["glass"] = materialDefaults["glass"];
    if (document.getElementById("signupMatWood")?.checked)    materials["wood"] = materialDefaults["wood"];

    // If no material selected, default to "automatic"
    if (Object.keys(materials).length === 0) {
      materials["automatic"] = 0; // Pressure is irrelevant for automatic
    }

    // Write to Firebase
    await set(ref(database, `users/${userId}`), {
      email,
      accountType,
      materials,   // single object now contains pressures
      experience,
      notes
    });

    // Show success
    signupSpinner.classList.remove("d-none");
    signupSuccessBox.classList.remove("d-none");
    const emailName = email.split("@")[0];
    signupSuccessBox.textContent = `Account created successfully! Welcome, ${emailName}`;

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 4000);

  } catch (err) {
    console.error("Signup error", err);
    signupSpinner.classList.add("d-none");

    let msg = "Registration failed. Please try again.";
    if (err.code === "auth/email-already-in-use") msg = "This email is already in use.";
    else if (err.code === "auth/invalid-email") msg = "Invalid email format.";
    else if (err.code === "auth/weak-password") msg = "Weak password. Choose a stronger one (min 6 chars).";
    else if (err.code === "auth/network-request-failed") msg = "Network error. Check your connection.";

    signupErrorBox.textContent = msg;
    signupErrorBox.classList.remove("d-none");
  }
}




// =========================
// LOGOUT FUNCTION (Firebase)
// =========================
async function handleLogout(e) {
  e && e.preventDefault && e.preventDefault();
  try {
    await signOut(auth);
    // small UI feedback could be added; keep simple
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout error", err);
    // leave as console error; UI for logout failures is optional
    alert("Logout failed: " + err.message);
  }
}

// =========================
// NAVBAR MANAGEMENT
// =========================
function updateNavbarUser(user) {
  const navMenu = document.querySelector(".navbar-nav");
  if (!navMenu) return;

  // Remove any existing Dashboard / Logout entries to avoid duplicates
  const existingDashboard = navMenu.querySelector('a[href="dashboard.html"]');
  const existingLogout = navMenu.querySelector('#logoutBtn');

  if (existingDashboard) existingDashboard.parentElement.remove();
  if (existingLogout) existingLogout.parentElement.remove();

  // If no user logged in → ensure login link exists and return
  if (!user) {
    // Ensure login link exists
    if (!navMenu.querySelector('a[href="login.html"]')) {
      const li = document.createElement('li');
      li.classList.add('nav-item');
      li.innerHTML = `<a class="nav-link" href="login.html">Login</a>`;
      navMenu.appendChild(li);
    }
    return;
  }

  // User is logged in → remove login/signup links if present
  const loginLink = navMenu.querySelector('a[href="login.html"]');
  if (loginLink) loginLink.parentElement.remove();

  // Add Dashboard link
  const dashboardItem = document.createElement("li");
  dashboardItem.classList.add("nav-item");
  dashboardItem.innerHTML = `<a class="nav-link" href="dashboard.html">Dashboard</a>`;
  navMenu.appendChild(dashboardItem);

  // Add Logout link with user email (shortened)
  const logoutItem = document.createElement("li");
  logoutItem.classList.add("nav-item");
  const shortId = user.email ? user.email.split('@')[0] : (user.uid || 'user');
  logoutItem.innerHTML = `
    <a class="nav-link text-danger" href="#" id="logoutBtn">
      Logout (${shortId})
    </a>
  `;
  navMenu.appendChild(logoutItem);

  // Attach logout handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.removeEventListener("click", handleLogout);
    logoutBtn.addEventListener("click", handleLogout);
  }

  highlightActiveLink();
}









function highlightActiveLink() {
  const current = window.location.pathname.split('/').pop();

  document.querySelectorAll(".nav-link").forEach(link => {
    const href = link.getAttribute("href");
    if (href === current) {
      link.classList.add("active");
    }
  });
}
