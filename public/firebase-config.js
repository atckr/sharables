// Firebase configuration for frontend
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Fetch Firebase configuration from backend
let firebaseConfig = {};
let app, auth, db, analytics, provider;

async function initializeFirebaseConfig() {
  try {
    console.log('🔧 Fetching Firebase config from backend...');
    const response = await fetch('/api/firebase-config');
    firebaseConfig = await response.json();
    console.log('✅ Firebase config loaded from environment variables');
    
    // Initialize Firebase with config from backend
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
    provider = new GoogleAuthProvider();
    
    // Configure Google Auth Provider
    provider.addScope('email');
    provider.addScope('profile');
    
    console.log('🔥 Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load Firebase config:', error);
    return false;
  }
}

// Initialize Firebase when the module loads
const firebaseInitPromise = initializeFirebaseConfig();

// Authentication functions
export const signInWithGoogle = async () => {
  try {
    await firebaseInitPromise; // Wait for Firebase to initialize
    console.log('🔐 Starting Google sign-in...');
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    console.log('✅ Google sign-in successful:', user.displayName);
    
    // Save user data to Firestore
    await saveUserToFirestore(user);
    
    return user;
  } catch (error) {
    console.error('❌ Google sign-in error:', error.message);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await firebaseInitPromise; // Wait for Firebase to initialize
    console.log('🔐 Signing out user...');
    await signOut(auth);
    console.log('✅ User signed out successfully');
  } catch (error) {
    console.error('❌ Sign out error:', error.message);
    throw error;
  }
};

export const getCurrentUser = async () => {
  await firebaseInitPromise; // Wait for Firebase to initialize
  return auth.currentUser;
};

export const onAuthChange = async (callback) => {
  await firebaseInitPromise; // Wait for Firebase to initialize
  return onAuthStateChanged(auth, callback);
};

// Firestore functions
const saveUserToFirestore = async (user) => {
  try {
    await firebaseInitPromise; // Wait for Firebase to initialize
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create new user document
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });
      console.log('👤 New user created in Firestore');
    } else {
      // Update last login time
      await setDoc(userRef, {
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
      console.log('👤 User login time updated');
    }
  } catch (error) {
    console.error('❌ Error saving user to Firestore:', error.message);
  }
};

export const saveUserPreferences = async (userId, restaurantId, restaurantName, selectedItems) => {
  try {
    await firebaseInitPromise; // Wait for Firebase to initialize
    console.log('💾 Saving user preferences to Firestore...');
    
    const preferencesRef = collection(db, 'userPreferences');
    const docRef = await addDoc(preferencesRef, {
      userId: userId,
      restaurantId: restaurantId,
      restaurantName: restaurantName,
      selectedItems: selectedItems,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Preferences saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error saving preferences:', error.message);
    throw error;
  }
};

export const getUserPreferences = async (userId) => {
  try {
    await firebaseInitPromise; // Wait for Firebase to initialize
    console.log('📖 Getting user preferences from Firestore...');
    
    const preferencesRef = collection(db, 'userPreferences');
    const q = query(preferencesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const preferences = [];
    querySnapshot.forEach((doc) => {
      preferences.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log('✅ Retrieved', preferences.length, 'preference records');
    return preferences;
  } catch (error) {
    console.error('❌ Error getting preferences:', error.message);
    throw error;
  }
};

export const findUserMatches = async (userId, userItems) => {
  try {
    await firebaseInitPromise; // Wait for Firebase to initialize
    console.log('🔍 Finding matches for user:', userId);
    
    // Get all other users' preferences
    const preferencesRef = collection(db, 'userPreferences');
    const querySnapshot = await getDocs(preferencesRef);
    
    const matches = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId !== userId && data.selectedItems) {
        // Calculate simple similarity based on common items
        const commonItems = userItems.filter(item => 
          data.selectedItems.some(otherItem => 
            otherItem.toLowerCase().includes(item.toLowerCase()) ||
            item.toLowerCase().includes(otherItem.toLowerCase())
          )
        );
        
        if (commonItems.length > 0) {
          const similarity = commonItems.length / Math.max(userItems.length, data.selectedItems.length);
          
          if (similarity > 0.3) { // 30% similarity threshold
            matches.push({
              userId: data.userId,
              restaurantName: data.restaurantName,
              selectedItems: data.selectedItems,
              commonItems: commonItems,
              similarity: Math.round(similarity * 1000) / 1000,
              timestamp: data.timestamp
            });
          }
        }
      }
    });
    
    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);
    
    console.log('✅ Found', matches.length, 'potential matches');
    return matches;
  } catch (error) {
    console.error('❌ Error finding matches:', error.message);
    return [];
  }
};

// Export auth and db for use in other files
export { auth, db };
