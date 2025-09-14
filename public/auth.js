// Authentication UI and state management
import { 
  signInWithGoogle, 
  signOutUser, 
  getCurrentUser, 
  onAuthChange,
  saveUserPreferences,
  getUserPreferences,
  findUserMatches
} from './firebase-config.js';

let currentUser = null;

// Initialize authentication
export async function initAuth() {
  console.log('🔐 Initializing authentication...');
  
  // Listen for auth state changes
  const unsubscribe = await onAuthChange((user) => {
    currentUser = user;
    updateAuthUI(user);
    
    if (user) {
      console.log('👤 User authenticated:', user.displayName);
      showMainApp();
    } else {
      console.log('👤 User not authenticated');
      showLoginScreen();
    }
  });
}

// Update UI based on authentication state
function updateAuthUI(user) {
  const loginSection = document.getElementById('loginSection');
  const mainApp = document.getElementById('mainApp');
  const userInfo = document.getElementById('userInfo');
  const signOutBtn = document.getElementById('signOutBtn');
  
  if (user) {
    // User is signed in
    if (userInfo) {
      userInfo.innerHTML = `
        <div class="d-flex align-items-center">
          <img src="${user.photoURL}" alt="${user.displayName}" class="rounded-circle me-2" width="32" height="32">
          <div>
            <div class="fw-semibold">${user.displayName}</div>
            <small class="text-muted">${user.email}</small>
          </div>
        </div>
      `;
    }
    
    if (signOutBtn) {
      signOutBtn.style.display = 'block';
    }
  } else {
    // User is signed out
    if (userInfo) {
      userInfo.innerHTML = '';
    }
    
    if (signOutBtn) {
      signOutBtn.style.display = 'none';
    }
  }
}

function showLoginScreen() {
  const loginSection = document.getElementById('loginSection');
  const mainApp = document.getElementById('mainApp');
  
  console.log('🔓 Showing login screen');
  if (loginSection) {
    loginSection.style.display = 'flex';
    loginSection.classList.add('d-flex', 'align-items-center', 'justify-content-center', 'min-vh-100', 'bg-light');
  }
  if (mainApp) {
    mainApp.style.display = 'none';
  }
}

function showMainApp() {
  const loginSection = document.getElementById('loginSection');
  const mainApp = document.getElementById('mainApp');
  
  console.log('🔐 Showing main app for authenticated user');
  
  // Completely hide the login section
  if (loginSection) {
    loginSection.style.display = 'none';
    loginSection.classList.remove('d-flex', 'align-items-center', 'justify-content-center', 'min-vh-100', 'bg-light');
  }
  
  // Show the main restaurant search app
  if (mainApp) {
    mainApp.style.display = 'block';
    mainApp.classList.add('container-fluid');
  }
  
  // Initialize the main app functionality once authenticated
  console.log('🚀 Main app loaded for authenticated user');
}

// Sign in with Google
export async function handleGoogleSignIn() {
  try {
    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) {
      signInBtn.disabled = true;
      signInBtn.textContent = 'Signing in...';
    }
    
    await signInWithGoogle();
  } catch (error) {
    console.error('❌ Sign in failed:', error.message);
    alert('Sign in failed. Please try again.');
    
    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) {
      signInBtn.disabled = false;
      signInBtn.textContent = 'Sign in with Google';
    }
  }
}

// Sign out
export async function handleSignOut() {
  try {
    await signOutUser();
    currentUser = null;
  } catch (error) {
    console.error('❌ Sign out failed:', error.message);
    alert('Sign out failed. Please try again.');
  }
}

// Get current authenticated user
export function getAuthenticatedUser() {
  return currentUser;
}

// Check if user is authenticated
export function isAuthenticated() {
  return currentUser !== null;
}

// Save user preferences with authentication
export async function saveAuthenticatedUserPreferences(restaurantId, restaurantName, selectedItems) {
  if (!currentUser) {
    throw new Error('User must be authenticated to save preferences');
  }
  
  try {
    const docId = await saveUserPreferences(
      currentUser.uid,
      restaurantId,
      restaurantName,
      selectedItems
    );
    
    // Find matches after saving preferences
    const matches = await findUserMatches(currentUser.uid, selectedItems);
    
    return {
      success: true,
      docId: docId,
      matches: matches
    };
  } catch (error) {
    console.error('❌ Error saving authenticated user preferences:', error.message);
    throw error;
  }
}

// Get user preferences with authentication
export async function getAuthenticatedUserPreferences() {
  if (!currentUser) {
    throw new Error('User must be authenticated to get preferences');
  }
  
  try {
    return await getUserPreferences(currentUser.uid);
  } catch (error) {
    console.error('❌ Error getting authenticated user preferences:', error.message);
    throw error;
  }
}

// Get matches for authenticated user
export async function getAuthenticatedUserMatches() {
  if (!currentUser) {
    throw new Error('User must be authenticated to get matches');
  }
  
  try {
    const preferences = await getUserPreferences(currentUser.uid);
    if (preferences.length === 0) {
      return [];
    }
    
    // Get the most recent preferences
    const latestPrefs = preferences.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    )[0];
    
    return await findUserMatches(currentUser.uid, latestPrefs.selectedItems);
  } catch (error) {
    console.error('❌ Error getting authenticated user matches:', error.message);
    throw error;
  }
}
