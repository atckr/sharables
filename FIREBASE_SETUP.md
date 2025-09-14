# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `social-diner-app`
4. Enable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google** provider
3. Enable Google sign-in
4. Add your domain to authorized domains:
   - `localhost` (for development)
   - Your production domain (when deploying)
5. Save the configuration

## 3. Enable Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

## 4. Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" → Web app icon `</>`
4. Enter app nickname: `sharables`
5. Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the Firebase configuration object

## 5. Update Firebase Configuration

Replace the configuration in `/public/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## 6. Set up Firebase Admin SDK (Optional - for server-side)

1. Go to **Project Settings** → **Service accounts**
2. Click "Generate new private key"
3. Save the JSON file securely
4. Add to your `.env` file:
```
FIREBASE_ADMIN_KEY_PATH=path/to/service-account-key.json
```

## 7. Firestore Security Rules (Production)

Update Firestore rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User preferences - users can read/write their own
    match /userPreferences/{document} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == request.resource.data.userId);
    }
    
    // Allow reading other users' preferences for matching
    match /userPreferences/{document} {
      allow read: if request.auth != null;
    }
  }
}
```

## 8. Test the Setup

1. Start your server: `node server.js`
2. Open `http://localhost:3000`
3. You should see the login screen
4. Click "Sign in with Google"
5. Complete the authentication flow
6. You should be redirected to the main app

## Current Features

✅ **Google Authentication**: Users must sign in to access the app
✅ **Firestore Integration**: User data stored securely in Firestore
✅ **User Preferences**: Save restaurant and food preferences
✅ **Matching System**: Find users with similar tastes
✅ **Protected Routes**: All restaurant search requires authentication

## Next Steps

- Deploy to Firebase Hosting or your preferred platform
- Set up production Firestore security rules
- Configure custom domain (if needed)
- Add additional authentication providers (Facebook, Apple, etc.)
