const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { CohereClient } = require('cohere-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Environment variables
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// Initialize Cohere client
const cohere = new CohereClient({
  token: COHERE_API_KEY,
});

// Initialize Firebase Admin SDK for Firestore
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account (in production, use proper service account)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'sharables-a1068'
    });
    console.log('🔥 Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.log('⚠️ Continuing without Firestore caching...');
  }
}

let db = null;
try {
  db = admin.firestore();
} catch (error) {
  console.log('⚠️ Firestore not available, caching disabled');
}

// Store user preferences temporarily (in production, use a database)
let userPreferences = {};

// In-memory storage for embeddings
const restaurantEmbeddings = {};
const userEmbeddings = {};

// Firestore collections for embeddings
const RESTAURANT_EMBEDDINGS_COLLECTION = 'restaurant_embeddings';
const USER_EMBEDDINGS_COLLECTION = 'user_embeddings';
const USER_PREFERENCES_COLLECTION = 'user_preferences';

// Firestore helper functions for embeddings
async function saveRestaurantEmbeddingToFirestore(restaurantId, embeddingData) {
  if (!db) return false;
  try {
    await db.collection(RESTAURANT_EMBEDDINGS_COLLECTION).doc(restaurantId).set(embeddingData);
    console.log('💾 Firestore: Restaurant embedding saved for:', embeddingData.restaurantName);
    return true;
  } catch (error) {
    console.error('❌ Firestore: Error saving restaurant embedding:', error.message);
    return false;
  }
}

async function loadRestaurantEmbeddingFromFirestore(restaurantId) {
  if (!db) return null;
  try {
    const doc = await db.collection(RESTAURANT_EMBEDDINGS_COLLECTION).doc(restaurantId).get();
    if (doc.exists) {
      console.log('📋 Firestore: Restaurant embedding loaded for:', restaurantId);
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Firestore: Error loading restaurant embedding:', error.message);
    return null;
  }
}

async function saveUserEmbeddingToFirestore(userId, embeddingData) {
  if (!db) return false;
  try {
    await db.collection(USER_EMBEDDINGS_COLLECTION).doc(userId).set(embeddingData);
    console.log('💾 Firestore: User embedding saved for:', userId);
    return true;
  } catch (error) {
    console.error('❌ Firestore: Error saving user embedding:', error.message);
    return false;
  }
}

async function loadUserEmbeddingFromFirestore(userId) {
  if (!db) return null;
  try {
    const doc = await db.collection(USER_EMBEDDINGS_COLLECTION).doc(userId).get();
    if (doc.exists) {
      console.log('📋 Firestore: User embedding loaded for:', userId);
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Firestore: Error loading user embedding:', error.message);
    return null;
  }
}

async function saveUserPreferencesToFirestore(userId, preferences) {
  if (!db) return false;
  try {
    await db.collection(USER_PREFERENCES_COLLECTION).doc(userId).set(preferences);
    console.log('💾 Firestore: User preferences saved for:', userId);
    return true;
  } catch (error) {
    console.error('❌ Firestore: Error saving user preferences:', error.message);
    return false;
  }
}

async function loadUserPreferencesFromFirestore(userId) {
  if (!db) return null;
  try {
    const doc = await db.collection(USER_PREFERENCES_COLLECTION).doc(userId).get();
    if (doc.exists) {
      console.log('📋 Firestore: User preferences loaded for:', userId);
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Firestore: Error loading user preferences:', error.message);
    return null;
  }
}

async function loadAllUserEmbeddingsFromFirestore() {
  if (!db) return {};
  try {
    const snapshot = await db.collection(USER_EMBEDDINGS_COLLECTION).get();
    const allEmbeddings = {};
    snapshot.forEach(doc => {
      allEmbeddings[doc.id] = doc.data();
    });
    console.log(`📋 Firestore: Loaded ${Object.keys(allEmbeddings).length} user embeddings`);
    return allEmbeddings;
  } catch (error) {
    console.error('❌ Firestore: Error loading all user embeddings:', error.message);
    return {};
  }
}

// Validation middleware
const validateLocation = (req, res, next) => {
  const { latitude, longitude } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ 
      error: 'Latitude and longitude are required',
      details: 'Please provide both latitude and longitude parameters'
    });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ 
      error: 'Invalid coordinates',
      details: 'Latitude and longitude must be valid numbers'
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ 
      error: 'Coordinates out of range',
      details: 'Latitude must be between -90 and 90, longitude between -180 and 180'
    });
  }

  req.validatedCoords = { lat, lng };
  next();
};

// Route to search restaurants using Google Places API
app.get('/api/restaurants', validateLocation, async (req, res) => {
  const { radius = 1000 } = req.query;
  const { lat, lng } = req.validatedCoords;
  
  console.log('🔍 Backend: Restaurant search request received');
  console.log('📍 Backend: Search parameters:', { latitude: lat, longitude: lng, radius });
  console.log('🔑 Backend: API key available:', !!GOOGLE_PLACES_API_KEY);
  
  // Validate API key
  if (!GOOGLE_PLACES_API_KEY) {
    console.error('❌ Backend: Google Places API key not configured');
    return res.status(500).json({ 
      error: 'API configuration error',
      details: 'Google Places API key is not configured'
    });
  }

  // Validate and sanitize radius
  const validRadius = Math.min(Math.max(parseInt(radius) || 1000, 100), 50000);
  if (validRadius !== parseInt(radius)) {
    console.log(`⚠️ Backend: Radius adjusted from ${radius} to ${validRadius}`);
  }
  
  try {
    const apiUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const requestBody = {
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng
          },
          radius: validRadius
        }
      }
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.websiteUri,places.nationalPhoneNumber,places.photos,places.businessStatus'
    };
    
    console.log('🌐 Backend: Making Google Places API v1 request');
    console.log('📋 Backend: Request body:', requestBody);
    console.log('📋 Backend: Headers:', { ...headers, 'X-Goog-Api-Key': '[REDACTED]' });
    
    const response = await axios.post(apiUrl, requestBody, { 
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    console.log('📡 Backend: Google API response status:', response.status);
    console.log('📦 Backend: Response data keys:', Object.keys(response.data));
    
    // New API doesn't use status field, check for places array instead
    if (!response.data.places || response.data.places.length === 0) {
      console.log('❌ Backend: No places found in response');
      return res.status(404).json({ 
        error: 'No restaurants found',
        details: 'No restaurants found in the specified area'
      });
    }

    console.log('🏪 Backend: Number of results:', response.data.places.length);

    // Transform Google Places API v1 data to Yelp-like structure with error handling
    const businesses = response.data.places.map((place, index) => {
      try {
        console.log(`🏪 Backend: Processing place ${index + 1}:`, place.displayName?.text || 'Unnamed');
        
        // Build photo URL safely (new API format)
        let imageUrl = null;
        if (place.photos && place.photos[0] && place.photos[0].name) {
          // New API uses photo names, not photo_reference
          imageUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&key=${GOOGLE_PLACES_API_KEY}`;
        }
        
        // Process categories safely (new API format)
        const categories = (place.types || [])
          .filter(type => type !== 'establishment' && type !== 'point_of_interest')
          .map(type => ({ 
            title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
          }));
        
        // Build location object safely (new API format)
        const location = {
          address1: place.formattedAddress || '',
          city: '',
          zip_code: '',
          country: '',
          state: '',
          display_address: [place.formattedAddress || 'Address not available']
        };
        
        // Build coordinates safely (new API format)
        const coordinates = {
          latitude: place.location?.latitude || lat,
          longitude: place.location?.longitude || lng
        };
        
        return {
          id: place.id,
          name: place.displayName?.text || 'Unnamed Restaurant',
          image_url: imageUrl,
          is_closed: place.businessStatus === 'CLOSED_PERMANENTLY' || place.businessStatus === 'CLOSED_TEMPORARILY',
          url: place.websiteUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
          review_count: place.userRatingCount || 0,
          categories: categories,
          rating: place.rating || 0,
          coordinates: coordinates,
          transactions: [], // Google Places doesn't provide transaction info
          price: place.priceLevel ? '$'.repeat(Math.min(place.priceLevel, 4)) : null,
          location: location,
          phone: place.nationalPhoneNumber || '',
          display_phone: place.nationalPhoneNumber || '',
          distance: null // Can be calculated client-side if needed
        };
      } catch (transformError) {
        console.error(`❌ Backend: Error transforming place ${index + 1}:`, transformError.message);
        // Return a minimal safe object for failed transformations
        return {
          id: place.id || `error_${index}`,
          name: place.displayName?.text || 'Restaurant (Error Loading Details)',
          error: true
        };
      }
    }).filter(business => !business.error); // Remove failed transformations

    console.log('✅ Backend: Successfully transformed', businesses.length, 'businesses');
    
    const responseData = { 
      businesses,
      total: businesses.length,
      location: { latitude: lat, longitude: lng },
      radius: validRadius
    };
    
    console.log('📤 Backend: Sending response with', businesses.length, 'businesses');
    res.json(responseData);
    
  } catch (error) {
    console.error('💥 Backend: Error fetching restaurants:', error.message);
    
    // Handle different types of errors
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        error: 'Request timeout',
        details: 'Google Places API request timed out'
      });
    }
    
    if (error.response) {
      console.error('📋 Backend: API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      return res.status(error.response.status || 500).json({ 
        error: 'External API error',
        details: error.response.data?.error_message || error.message
      });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'Service unavailable',
        details: 'Unable to connect to Google Places API'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to fetch restaurants'
    });
  }
});

// Route to get restaurant details using Google Places API v1
app.get('/api/restaurants/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ 
      error: 'Restaurant ID is required',
      details: 'Please provide a valid restaurant place ID'
    });
  }
  
  console.log('🏪 Backend: Restaurant details request for Google Place ID:', id);
  
  try {
    const apiUrl = `https://places.googleapis.com/v1/places/${id}`;
    const headers = {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,websiteUri,nationalPhoneNumber,photos,businessStatus,regularOpeningHours,reviews'
    };
    
    console.log('🌐 Backend: Making Google Places Details API request');
    console.log('📋 Backend: Headers:', { ...headers, 'X-Goog-Api-Key': '[REDACTED]' });
    
    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    
    console.log('✅ Backend: Restaurant details received');
    console.log('📊 Backend: Response status:', response.status);
    
    res.json(response.data);
    
  } catch (error) {
    console.error('💥 Backend: Error fetching restaurant details:', error.message);
    
    if (error.response) {
      console.error('📋 Backend: Error response:', error.response.status, error.response.data);
      return res.status(error.response.status).json({
        error: 'Google Places API error',
        details: error.response.data?.error?.message || 'Failed to fetch restaurant details'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to fetch restaurant details'
    });
  }
});

// Route to get restaurant photos using Google Places Photos API
app.get('/api/restaurants/photos/:photoName', async (req, res) => {
  const { photoName } = req.params;
  const { maxWidth = 400, maxHeight = 400 } = req.query;
  
  if (!photoName) {
    return res.status(400).json({ 
      error: 'Photo name is required',
      details: 'Please provide a valid photo reference'
    });
  }
  
  console.log('📸 Backend: Photo request for:', photoName);
  
  try {
    // Construct the Google Places Photos API URL
    const photoUrl = `https://places.googleapis.com/v1/${decodeURIComponent(photoName)}/media?maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}&key=${GOOGLE_PLACES_API_KEY}`;
    
    console.log('🌐 Backend: Redirecting to Google Places Photos API');
    
    // Redirect to the actual photo URL
    res.redirect(photoUrl);
    
  } catch (error) {
    console.error('💥 Backend: Error processing photo request:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to process photo request'
    });
  }
});

// Route to get restaurant menu data
app.get('/api/restaurants/:id/menu', async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ 
      error: 'Restaurant ID is required',
      details: 'Please provide a valid restaurant place ID'
    });
  }
  
  console.log('🍽️ Backend: Menu request for restaurant ID:', id);
  
  try {
    // Check if we have a cached menu in Firestore first
    console.log('🔍 Backend: Checking for cached menu in Firestore for restaurant:', id);
    
    try {
      const cachedMenu = await getCachedMenu(id);
      if (cachedMenu) {
        console.log('✅ Backend: Found cached menu, returning from Firestore');
        return res.json(cachedMenu);
      }
    } catch (cacheError) {
      console.log('⚠️ Backend: Cache check failed, proceeding with fresh generation:', cacheError.message);
    }
    
    // First get restaurant details including reviews
    const apiUrl = `https://places.googleapis.com/v1/places/${id}`;
    const headers = {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,websiteUri,nationalPhoneNumber,photos,businessStatus,regularOpeningHours,reviews'
    };
    
    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    const restaurant = response.data;
    
    console.log('🔍 Backend: Restaurant data received:', {
      name: restaurant.displayName?.text,
      types: restaurant.types,
      reviewCount: restaurant.reviews?.length || 0
    });
    
    // Generate menu using Cohere AI based on reviews (with caching)
    const menu = await generateMenuFromReviews(restaurant);
    
    console.log('✅ Backend: Menu ready (cached or generated):', {
      source: menu.source,
      reviewsAnalyzed: menu.reviewsAnalyzed,
      lastUpdated: menu.lastUpdated
    });
    res.json(menu);
    
  } catch (error) {
    console.error('💥 Backend: Error generating menu:', error.message);
    
    // Fallback: generate generic menu
    const fallbackMenu = generateGenericMenu();
    res.json(fallbackMenu);
  }
});

// Firestore cache functions
async function getCachedMenu(restaurantId) {
  if (!db) {
    console.log('⚠️ Backend: Firestore not available, skipping cache check');
    return null;
  }
  
  try {
    const menuDoc = await db.collection('cached_menus').doc(restaurantId).get();
    
    if (!menuDoc.exists) {
      return null;
    }
    
    const menuData = menuDoc.data();
    const cacheAge = Date.now() - menuData.cachedAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Return cached menu if it's less than 24 hours old
    if (cacheAge < maxAge) {
      console.log(`📋 Backend: Using cached menu (${Math.round(cacheAge / (60 * 60 * 1000))} hours old)`);
      return menuData.menu;
    } else {
      console.log('⏰ Backend: Cached menu expired, will generate fresh');
      return null;
    }
  } catch (error) {
    console.error('❌ Backend: Error reading from cache:', error.message);
    return null;
  }
}

async function saveCachedMenu(restaurantId, menu) {
  if (!db) {
    console.log('⚠️ Backend: Firestore not available, skipping cache save');
    return;
  }
  
  try {
    await db.collection('cached_menus').doc(restaurantId).set({
      menu: menu,
      cachedAt: Date.now(),
      restaurantId: restaurantId,
      lastUpdated: new Date().toISOString()
    });
    console.log('💾 Backend: Menu successfully cached in Firestore');
  } catch (error) {
    console.error('❌ Backend: Error saving to cache:', error.message);
    throw error;
  }
}

// Generate menu using Cohere AI based on restaurant reviews
async function generateMenuFromReviews(restaurant) {
  const name = restaurant.displayName?.text || 'Restaurant';
  const types = restaurant.types || [];
  const reviews = restaurant.reviews || [];
  const restaurantId = restaurant.id; // This is the real Google Place ID
  
  console.log('🤖 Backend: Processing menu for:', name, 'ID:', restaurantId);
  
  try {
    // Check if we have cached menu data
    const cachedMenu = await loadMenuFromFirestore(restaurantId);
    
    if (cachedMenu) {
      console.log('✅ Backend: Found cached menu, analyzing newest review...');
      
      if (reviews.length === 0) {
        console.log('✅ Backend: No reviews available, using cached menu');
        return cachedMenu;
      }
      
      // Analyze only the newest review first for efficiency
      const newestReview = reviews[0];
      const newItems = await extractMenuItemsFromSingleReview(newestReview, name, types);
      
      if (newItems && Object.keys(newItems).length > 0) {
        console.log('🔍 Backend: Found potential new items in newest review, checking similarity...');
        
        // Check if any new items are truly new using similarity matching
        const trulyNewItems = await findTrulyNewItems(newItems, cachedMenu.menu);
        
        if (Object.keys(trulyNewItems).length > 0) {
          console.log('🆕 Backend: Found truly new items, processing next 4 reviews...');
          
          // Process next 4 reviews for additional items
          const additionalReviews = reviews.slice(1, 5);
          const additionalItems = await extractMenuItemsFromReviews(additionalReviews, name, types);
          
          // Merge all new items
          const allNewItems = { ...trulyNewItems, ...additionalItems };
          const updatedMenu = { ...cachedMenu.menu, ...allNewItems };
          
          const menuData = {
            restaurantId: restaurantId,
            restaurantName: name,
            menuType: 'ai-generated',
            source: 'cohere-reviews-incremental',
            reviewsAnalyzed: cachedMenu.reviewsAnalyzed + 5,
            lastUpdated: new Date().toISOString(),
            menu: updatedMenu
          };
          
          await saveMenuToFirestore(restaurantId, menuData);
          return menuData;
        } else {
          console.log('✅ Backend: No truly new items found, using cached menu');
          return cachedMenu;
        }
      } else {
        console.log('✅ Backend: No new items in newest review, using cached menu');
        return cachedMenu;
      }
    }
  } catch (error) {
    console.log('⚠️ Backend: Cache check failed, generating fresh menu:', error.message);
  }
  
  console.log('🤖 Backend: First time processing restaurant, using 5 newest reviews for efficiency');
  
  try {
    // If we have reviews, use Cohere to extract menu items
    if (reviews.length > 0 && COHERE_API_KEY) {
      // For new restaurants, only use 5 newest reviews for efficiency
      const recentReviews = reviews.slice(0, 5);
      console.log(`📝 Backend: Processing ${recentReviews.length} reviews for initial menu extraction`);
      
      const menuItems = await extractMenuItemsFromReviews(recentReviews, name, types);
      
      if (menuItems && Object.keys(menuItems).length > 0) {
        const menuData = {
          restaurantId: restaurantId,
          restaurantName: name,
          menuType: 'ai-generated',
          source: 'cohere-reviews-initial',
          reviewsAnalyzed: recentReviews.length,
          lastUpdated: new Date().toISOString(),
          menu: menuItems
        };
        
        // Save to Firestore cache
        await saveMenuToFirestore(restaurantId, menuData);
        return menuData;
      }
    }
    
    // Fallback to template-based generation if no reviews or Cohere fails
    console.log('⚠️ Backend: No reviews available or Cohere failed, using template menu');
    return generateMenuByType(restaurant);
    
  } catch (error) {
    console.error('💥 Backend: Error with Cohere API:', error.message);
    // Fallback to template-based generation
    return generateMenuByType(restaurant);
  }
}

// Extract menu items from reviews and return as dictionary
async function extractMenuItemsFromReviews(reviews, restaurantName, restaurantTypes) {
  try {
    const reviewTexts = reviews
      .map(review => review.text?.text || '')
      .filter(text => text.length > 0)
      .join(' ');
    
    if (reviewTexts.length === 0) return {};
    
    const prompt = `Analyze these restaurant reviews and extract menu items mentioned by customers.

Restaurant: ${restaurantName}
Type: ${restaurantTypes.join(', ')}

Reviews:
${reviewTexts}

Extract menu items and return as a simple dictionary where key=item_name and value=description:
{
  "Item Name": "Brief description based on customer feedback (max 30 words)",
  "Another Item": "Description from reviews"
}

Rules:
1. Only items explicitly mentioned in reviews
2. Descriptions from customer feedback only
3. No pricing information
4. Max 30 words per description
5. Food/drink items only

Return only JSON dictionary, no additional text.`;
    
    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      max_tokens: 800,
      temperature: 0.2,
      stop_sequences: []
    });
    
    const generatedText = response.generations[0].text.trim();
    const menuItems = JSON.parse(generatedText);
    
    console.log('🍽️ Backend: Extracted', Object.keys(menuItems).length, 'menu items');
    return menuItems;
    
  } catch (error) {
    console.error('❌ Backend: Error extracting menu items:', error.message);
    return {};
  }
}

// Extract menu items from a single review
async function extractMenuItemsFromSingleReview(review, restaurantName, restaurantTypes) {
  try {
    const reviewText = review.text?.text || '';
    if (reviewText.length === 0) return {};
    
    const prompt = `Analyze this single restaurant review and extract any menu items mentioned.

Restaurant: ${restaurantName}
Type: ${restaurantTypes.join(', ')}

Review:
${reviewText}

Extract menu items as dictionary:
{
  "Item Name": "Brief description from review (max 20 words)"
}

Rules:
1. Only items explicitly mentioned
2. Max 20 words per description
3. Return {} if no items found

Return only JSON, no additional text.`;
    
    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      max_tokens: 400,
      temperature: 0.1,
      stop_sequences: []
    });
    
    const generatedText = response.generations[0].text.trim();
    const menuItems = JSON.parse(generatedText);
    
    console.log('🔍 Backend: Found', Object.keys(menuItems).length, 'items in single review');
    return menuItems;
    
  } catch (error) {
    console.error('❌ Backend: Error extracting from single review:', error.message);
    return {};
  }
}

// Find truly new items using similarity matching
async function findTrulyNewItems(newItems, existingMenu) {
  try {
    const existingItemNames = Object.keys(existingMenu);
    const newItemNames = Object.keys(newItems);
    
    if (existingItemNames.length === 0) {
      return newItems; // All items are new if no existing menu
    }
    
    const trulyNewItems = {};
    
    for (const newItemName of newItemNames) {
      // Use Cohere to check similarity with existing items
      const isNew = await isItemTrulyNew(newItemName, existingItemNames);
      if (isNew) {
        trulyNewItems[newItemName] = newItems[newItemName];
      }
    }
    
    console.log('🆕 Backend: Found', Object.keys(trulyNewItems).length, 'truly new items out of', newItemNames.length);
    return trulyNewItems;
    
  } catch (error) {
    console.error('❌ Backend: Error finding truly new items:', error.message);
    return newItems; // Return all items if similarity check fails
  }
}

// Check if an item is truly new using similarity matching
async function isItemTrulyNew(newItemName, existingItemNames) {
  try {
    // Create embeddings for comparison
    const allItems = [newItemName, ...existingItemNames];
    
    const response = await cohere.embed({
      texts: allItems,
      model: 'embed-english-v3.0',
      input_type: 'search_document'
    });
    
    const embeddings = response.embeddings;
    const newItemEmbedding = embeddings[0];
    
    // Check similarity with each existing item
    for (let i = 1; i < embeddings.length; i++) {
      const similarity = cosineSimilarity(newItemEmbedding, embeddings[i]);
      if (similarity > 0.8) { // High similarity threshold
        console.log(`🔄 Backend: "${newItemName}" is similar to "${existingItemNames[i-1]}" (${similarity.toFixed(3)})`);
        return false; // Not truly new
      }
    }
    
    return true; // Truly new item
    
  } catch (error) {
    console.error('❌ Backend: Error checking item similarity:', error.message);
    return true; // Assume new if similarity check fails
  }

}

// Generate menu based on restaurant type
function generateMenuByType(restaurant) {
  const name = restaurant.displayName?.text || 'Restaurant';
  const types = restaurant.types || [];
  
  console.log('🏷️ Backend: Restaurant types:', types);
  
  // Menu templates based on restaurant type - converted to dictionary format
  const menuTemplates = {
    cafe: {
      'Espresso': 'Rich, bold espresso shot',
      'Cappuccino': 'Espresso with steamed milk and foam',
      'Latte': 'Smooth espresso with steamed milk',
      'Americano': 'Espresso with hot water',
      'Hot Chocolate': 'Rich chocolate with whipped cream',
      'Iced Coffee': 'Freshly brewed coffee over ice',
      'Cold Brew': 'Smooth cold-brewed coffee',
      'Iced Latte': 'Espresso with cold milk over ice',
      'Frappuccino': 'Blended coffee drink with ice',
      'Croissant': 'Buttery, flaky pastry',
      'Bagel with Cream Cheese': 'Fresh bagel with cream cheese',
      'Avocado Toast': 'Smashed avocado on artisan bread',
      'Breakfast Sandwich': 'Egg, cheese, and choice of meat',
      'Muffin': 'Freshly baked daily',
      'Scone': 'Traditional British pastry'
    },
    restaurant: {
      'Bruschetta': 'Toasted bread with tomatoes and basil',
      'Calamari': 'Crispy fried squid with marinara',
      'Wings': 'Buffalo or BBQ sauce',
      'Spinach Dip': 'Creamy spinach dip with tortilla chips',
      'Mozzarella Sticks': 'Breaded mozzarella with marinara',
      'Grilled Salmon': 'Atlantic salmon with lemon herb butter',
      'Ribeye Steak': '12oz ribeye with garlic mashed potatoes',
      'Chicken Parmesan': 'Breaded chicken with marinara and mozzarella',
      'Pasta Primavera': 'Fresh vegetables with penne pasta',
      'Fish & Chips': 'Beer-battered cod with fries',
      'Burger': 'Angus beef with lettuce, tomato, onion',
      'Tiramisu': 'Classic Italian dessert',
      'Cheesecake': 'New York style with berry compote',
      'Chocolate Cake': 'Rich chocolate layer cake',
      'Ice Cream': 'Vanilla, chocolate, or strawberry'
    },
    pizza: {
      'Margherita': 'Tomato sauce, mozzarella, fresh basil',
      'Pepperoni': 'Classic pepperoni with mozzarella',
      'Supreme': 'Pepperoni, sausage, peppers, onions, mushrooms',
      'Hawaiian': 'Ham and pineapple',
      'Meat Lovers': 'Pepperoni, sausage, bacon, ham',
      'Garlic Bread': 'Fresh bread with garlic butter',
      'Caesar Salad': 'Romaine lettuce with Caesar dressing',
      'Wings': 'Buffalo or BBQ sauce'
    },
    asian: {
      'Spring Rolls': 'Fresh vegetables wrapped in rice paper',
      'Dumplings': 'Steamed or fried pork dumplings',
      'Edamame': 'Steamed soybeans with sea salt',
      'Kung Pao Chicken': 'Spicy chicken with peanuts',
      'Sweet and Sour Pork': 'Battered pork with sweet and sour sauce',
      'Beef and Broccoli': 'Tender beef with fresh broccoli',
      'Fried Rice': 'Wok-fried rice with egg and vegetables',
      'Lo Mein': 'Soft noodles with vegetables'
    }
  };
  
  // Determine restaurant category
  let category = 'restaurant'; // default
  
  if (types.includes('cafe') || name.toLowerCase().includes('cafe') || name.toLowerCase().includes('coffee')) {
    category = 'cafe';
  } else if (types.includes('meal_delivery') && (types.includes('pizza') || name.toLowerCase().includes('pizza'))) {
    category = 'pizza';
  } else if (types.some(type => ['chinese_restaurant', 'japanese_restaurant', 'korean_restaurant', 'thai_restaurant', 'vietnamese_restaurant'].includes(type))) {
    category = 'asian';
  }
  
  console.log('🍽️ Backend: Selected menu category:', category);
  
  const selectedTemplate = menuTemplates[category];
  
  // Template menus are now in dictionary format: menu[item_name] = description
  const menu = { ...selectedTemplate };
  
  return {
    restaurantId: restaurant.id,
    restaurantName: name,
    menuType: category,
    source: 'template-based',
    reviewsAnalyzed: 0,
    lastUpdated: new Date().toISOString(),
    menu: menu
  };
}

// Generate generic menu as fallback
function generateGenericMenu() {
  return {
    restaurantId: 'unknown',
    restaurantName: 'Restaurant',
    menuType: 'generic',
    source: 'fallback-generic',
    reviewsAnalyzed: 0,
    lastUpdated: new Date().toISOString(),
    menu: {
      'Popular Items': [
        { name: 'House Special', description: 'Chef\'s signature dish', available: true, popular: true },
        { name: 'Grilled Chicken', description: 'Seasoned grilled chicken breast', available: true },
        { name: 'Caesar Salad', description: 'Fresh romaine with Caesar dressing', available: true },
        { name: 'Pasta of the Day', description: 'Ask your server for today\'s selection', available: true },
        { name: 'Chocolate Dessert', description: 'Decadent chocolate creation', available: true }
      ]
    }
  };
}

// Generate restaurant embedding using Cohere AI
async function generateRestaurantEmbedding(restaurantId, restaurantName) {
  try {
    // Check in-memory cache first
    if (restaurantEmbeddings[restaurantId]) {
      console.log('📋 Backend: Restaurant embedding already exists for:', restaurantName);
      return restaurantEmbeddings[restaurantId];
    }

    // Check Firestore cache
    const firestoreEmbedding = await loadRestaurantEmbeddingFromFirestore(restaurantId);
    if (firestoreEmbedding) {
      restaurantEmbeddings[restaurantId] = firestoreEmbedding;
      return firestoreEmbedding;
    }

    console.log('🤖 Backend: Generating restaurant embedding for:', restaurantName);
    
    // Get restaurant details including description and photos
    const apiUrl = `https://places.googleapis.com/v1/places/${restaurantId}`;
    const headers = {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,types,editorialSummary,photos'
    };
    
    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    const restaurant = response.data;
    
    // Create text description for embedding
    const restaurantDescription = [
      restaurant.displayName?.text || restaurantName,
      restaurant.types?.join(', ') || '',
      restaurant.editorialSummary?.text || ''
    ].filter(text => text.length > 0).join('. ');
    
    // Generate embedding using Cohere
    const embeddingResponse = await cohere.embed({
      texts: [restaurantDescription],
      model: 'embed-english-v3.0',
      input_type: 'search_document'
    });
    
    const embedding = embeddingResponse.embeddings[0];
    
    // Store restaurant embedding
    const embeddingData = {
      restaurantId,
      restaurantName,
      description: restaurantDescription,
      embedding: embedding,
      createdAt: new Date().toISOString()
    };
    
    restaurantEmbeddings[restaurantId] = embeddingData;
    
    // Save to Firestore
    await saveRestaurantEmbeddingToFirestore(restaurantId, embeddingData);
    
    console.log('✅ Backend: Restaurant embedding generated successfully');
    return embeddingData;
    
  } catch (error) {
    console.error('❌ Backend: Error generating restaurant embedding:', error.message);
    return null;
  }
}

// Update user embedding with new restaurant preferences
async function updateUserEmbedding(userId, restaurantId, likes, dislikes) {
  try {
    console.log('👤 Backend: Updating user embedding for:', userId);
    
    // Get restaurant embedding
    const restaurantEmbedding = restaurantEmbeddings[restaurantId];
    if (!restaurantEmbedding) {
      console.log('⚠️ Backend: Restaurant embedding not found, skipping user embedding update');
      return;
    }
    
    // Initialize user embedding if doesn't exist
    if (!userEmbeddings[userId]) {
      userEmbeddings[userId] = {
        userId,
        restaurantPreferences: [],
        averageEmbedding: null,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Create preference vector based on likes/dislikes
    const preferenceScore = (likes.length - dislikes.length) / Math.max(likes.length + dislikes.length, 1);
    
    // Weight the restaurant embedding by preference score
    const weightedEmbedding = restaurantEmbedding.embedding.map(val => val * preferenceScore);
    
    // Add or update restaurant preference in user embedding
    const existingIndex = userEmbeddings[userId].restaurantPreferences.findIndex(
      pref => pref.restaurantId === restaurantId
    );
    
    const restaurantPreference = {
      restaurantId,
      restaurantName: restaurantEmbedding.restaurantName,
      likes,
      dislikes,
      preferenceScore,
      weightedEmbedding,
      timestamp: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      userEmbeddings[userId].restaurantPreferences[existingIndex] = restaurantPreference;
    } else {
      userEmbeddings[userId].restaurantPreferences.push(restaurantPreference);
    }
    
    // Recalculate average embedding
    const allEmbeddings = userEmbeddings[userId].restaurantPreferences.map(pref => pref.weightedEmbedding);
    const avgEmbedding = new Array(allEmbeddings[0].length).fill(0);
    
    for (const embedding of allEmbeddings) {
      for (let i = 0; i < embedding.length; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < avgEmbedding.length; i++) {
      avgEmbedding[i] /= allEmbeddings.length;
    }
    
    userEmbeddings[userId].averageEmbedding = avgEmbedding;
    userEmbeddings[userId].lastUpdated = new Date().toISOString();
    
    // Save to Firestore
    await saveUserEmbeddingToFirestore(userId, userEmbeddings[userId]);
    
    console.log('✅ Backend: User embedding updated successfully');
    
  } catch (error) {
    console.error('❌ Backend: Error updating user embedding:', error.message);
  }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Route to save user preferences with likes/dislikes structure
app.post('/api/preferences', async (req, res) => {
  try {
    const { userId, restaurantId, restaurantName, selectedItems, tasteProfile } = req.body;
    
    if (!userId || !restaurantId || !restaurantName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'userId, restaurantId, and restaurantName are required'
      });
    }
    
    console.log('💾 Backend: Saving preferences for user:', userId);
    console.log('🏪 Backend: Restaurant:', restaurantName);
    console.log('📝 Backend: Selected items:', selectedItems?.length || 0);
    console.log('👅 Backend: Taste profile:', tasteProfile);
    
    // Initialize user preferences if not exists
    if (!userPreferences[userId]) {
      userPreferences[userId] = {};
    }
    
    // Store preferences per restaurant with 2D array structure:
    // [0] = likes array, [1] = dislikes array
    userPreferences[userId][restaurantId] = [
      tasteProfile?.likes || [],
      tasteProfile?.dislikes || []
    ];
    
    // Save to Firestore for persistence
    try {
      await saveUserPreferencesToFirestore(userId, userPreferences[userId]);
    } catch (firestoreError) {
      console.error('⚠️ Backend: Failed to save to Firestore:', firestoreError.message);
    }
    
    // Generate or update user embedding based on preferences
    try {
      await updateUserEmbedding(userId, tasteProfile);
    } catch (embeddingError) {
      console.error('⚠️ Backend: Failed to update user embedding:', embeddingError.message);
    }
    
    console.log('✅ Backend: Preferences saved successfully');
    
    res.json({
      success: true,
      message: 'Preferences saved successfully',
      userPreferences: userPreferences[userId]
    });
  } catch (error) {
    console.error('💥 Backend: Error saving preferences:', error.message);
    res.status(500).json({ 
      error: 'Failed to save preferences',
      details: error.message
    });
  }
});

// Function to find matches using Cohere API with better error handling
async function findMatches(userId, userItems) {
  try {
    if (!process.env.COHERE_API_KEY) {
      console.warn('⚠️ Backend: Cohere API key not configured, skipping matches');
      return [];
    }

    if (!userItems || userItems.length === 0) {
      return [];
    }

    const userItemsText = userItems.join(', ');
    const potentialMatches = [];

    console.log('🔍 Backend: Finding matches for user:', userId);
    console.log('📝 Backend: User items:', userItemsText);

    // Compare with other users' preferences
    for (const [otherUserId, preferences] of Object.entries(userPreferences)) {
      if (otherUserId === userId) continue;
      
      if (!preferences.selectedItems || preferences.selectedItems.length === 0) {
        continue;
      }

      const otherItemsText = preferences.selectedItems.join(', ');
      
      try {
        // Use Cohere to calculate similarity
        const response = await cohere.embed({
          texts: [userItemsText, otherItemsText],
          model: 'embed-english-v3.0',
          inputType: 'search_document'
        });

        if (response.embeddings && response.embeddings.length === 2) {
          const similarity = cosineSimilarity(response.embeddings[0], response.embeddings[1]);
          
          console.log(`🔗 Backend: Similarity with user ${otherUserId}:`, similarity.toFixed(3));
          
          if (similarity > 0.7) { // Threshold for matching
            potentialMatches.push({
              userId: otherUserId,
              restaurantName: preferences.restaurantName,
              selectedItems: preferences.selectedItems,
              similarity: Math.round(similarity * 1000) / 1000, // Round to 3 decimal places
              timestamp: preferences.timestamp
            });
          }
        }
      } catch (embedError) {
        console.error(`❌ Backend: Error calculating similarity with user ${otherUserId}:`, embedError.message);
        continue; // Skip this comparison and continue with others
      }
    }

    // Sort by similarity score (highest first)
    const sortedMatches = potentialMatches.sort((a, b) => b.similarity - a.similarity);
    
    console.log('✅ Backend: Found', sortedMatches.length, 'potential matches');
    return sortedMatches;
    
  } catch (error) {
    console.error('💥 Backend: Error in findMatches:', error.message);
    return []; // Return empty array instead of throwing
  }
}

// Helper function to calculate cosine similarity with error handling
function cosineSimilarity(vecA, vecB) {
  try {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
      throw new Error('Invalid vectors for similarity calculation');
    }
    
    const dotProduct = vecA.reduce((sum, a, i) => sum + (a * vecB[i]), 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + (a * a), 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + (b * b), 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    return dotProduct / (magnitudeA * magnitudeB);
  } catch (error) {
    console.error('❌ Backend: Error calculating cosine similarity:', error.message);
    return 0;
  }
}

// Route to get user matches
app.get('/api/matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userPref = userPreferences[userId];
    
    if (!userPref) {
      return res.status(404).json({ 
        error: 'User preferences not found',
        details: 'No preferences found for this user ID'
      });
    }

    console.log('🔍 Backend: Getting matches for user:', userId);
    
    // Return matches for this user
    const matches = await findMatches(userId, userPref.selectedItems);
    
    res.json({
      userId: userId,
      userPreferences: {
        restaurantName: userPref.restaurantName,
        itemCount: userPref.selectedItems.length,
        timestamp: userPref.timestamp
      },
      matches: matches,
      matchCount: matches.length
    });
    
  } catch (error) {
    console.error('💥 Backend: Error getting matches:', error.message);
    res.status(500).json({ 
      error: 'Failed to get matches',
      details: error.message
    });
  }
});

// Route to find similar users based on embedding similarity
app.get('/api/similar-users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;
    
    console.log('🔍 Backend: Finding similar users for:', userId);
    
    // Load user embedding from Firestore if not in memory
    if (!userEmbeddings[userId]) {
      const firestoreEmbedding = await loadUserEmbeddingFromFirestore(userId);
      if (firestoreEmbedding) {
        userEmbeddings[userId] = firestoreEmbedding;
      }
    }
    
    // Check if user has embedding
    if (!userEmbeddings[userId] || !userEmbeddings[userId].averageEmbedding) {
      return res.json({
        success: true,
        message: 'User has no taste profile yet',
        similarUsers: []
      });
    }
    
    const currentUserEmbedding = userEmbeddings[userId].averageEmbedding;
    const similarities = [];
    
    // Load all user embeddings from Firestore for comparison
    const allFirestoreEmbeddings = await loadAllUserEmbeddingsFromFirestore();
    const allUserEmbeddings = { ...userEmbeddings, ...allFirestoreEmbeddings };
    
    // Calculate similarity with all other users
    for (const [otherUserId, otherUserData] of Object.entries(allUserEmbeddings)) {
      if (otherUserId === userId || !otherUserData.averageEmbedding) continue;
      
      const similarity = cosineSimilarity(currentUserEmbedding, otherUserData.averageEmbedding);
      
      if (similarity > 0.1) { // Only include users with meaningful similarity
        similarities.push({
          userId: otherUserId,
          similarity: similarity,
          restaurantCount: otherUserData.restaurantPreferences.length,
          lastUpdated: otherUserData.lastUpdated
        });
      }
    }
    
    // Sort by similarity and limit results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilarUsers = similarities.slice(0, parseInt(limit));
    
    console.log(`✅ Backend: Found ${topSimilarUsers.length} similar users`);
    
    res.json({
      success: true,
      similarUsers: topSimilarUsers,
      totalUsers: similarities.length
    });
    
  } catch (error) {
    console.error('💥 Backend: Error finding similar users:', error.message);
    res.status(500).json({
      error: 'Failed to find similar users',
      details: error.message
    });
  }
});

// Route to get group recommendations based on multiple users
app.post('/api/group-recommendations', async (req, res) => {
  try {
    const { userIds, restaurantIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid userIds array'
      });
    }
    
    console.log('👥 Backend: Generating group recommendations for users:', userIds);
    
    // Get user embeddings for the group
    const groupEmbeddings = [];
    for (const userId of userIds) {
      if (userEmbeddings[userId] && userEmbeddings[userId].averageEmbedding) {
        groupEmbeddings.push(userEmbeddings[userId].averageEmbedding);
      }
    }
    
    if (groupEmbeddings.length === 0) {
      return res.json({
        success: true,
        message: 'No users in group have taste profiles yet',
        recommendations: []
      });
    }
    
    // Calculate average group embedding
    const embeddingLength = groupEmbeddings[0].length;
    const avgGroupEmbedding = new Array(embeddingLength).fill(0);
    
    for (const embedding of groupEmbeddings) {
      for (let i = 0; i < embeddingLength; i++) {
        avgGroupEmbedding[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < embeddingLength; i++) {
      avgGroupEmbedding[i] /= groupEmbeddings.length;
    }
    
    // Find restaurants that match the group's taste profile
    const restaurantRecommendations = [];
    
    for (const [restaurantId, restaurantData] of Object.entries(restaurantEmbeddings)) {
      if (restaurantIds && !restaurantIds.includes(restaurantId)) continue;
      
      const similarity = cosineSimilarity(avgGroupEmbedding, restaurantData.embedding);
      
      if (similarity > 0.2) { // Threshold for group recommendations
        restaurantRecommendations.push({
          restaurantId,
          restaurantName: restaurantData.restaurantName,
          similarity: similarity,
          description: restaurantData.description
        });
      }
    }
    
    // Sort by similarity
    restaurantRecommendations.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`✅ Backend: Generated ${restaurantRecommendations.length} group recommendations`);
    
    res.json({
      success: true,
      recommendations: restaurantRecommendations.slice(0, 10), // Top 10 recommendations
      groupSize: userIds.length,
      usersWithProfiles: groupEmbeddings.length
    });
    
  } catch (error) {
    console.error('💥 Backend: Error generating group recommendations:', error.message);
    res.status(500).json({
      error: 'Failed to generate group recommendations',
      details: error.message
    });
  }
});

// Firebase config endpoint for frontend
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    apiKeys: {
      googlePlaces: !!GOOGLE_PLACES_API_KEY,
      cohere: !!process.env.COHERE_API_KEY,
      firebase: !!process.env.FIREBASE_API_KEY
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error.message);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Load menu from Firestore cache
async function loadMenuFromFirestore(restaurantId) {
  try {
    const menuDoc = await db.collection('menus').doc(restaurantId).get();
    if (menuDoc.exists) {
      console.log('📖 Backend: Loaded cached menu from Firestore');
      return menuDoc.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Backend: Error loading menu from Firestore:', error.message);
    return null;
  }
}

// Save menu to Firestore cache
async function saveMenuToFirestore(restaurantId, menuData) {
  try {
    await db.collection('menus').doc(restaurantId).set(menuData);
    console.log('💾 Backend: Saved menu to Firestore cache');
  } catch (error) {
    console.error('❌ Backend: Error saving menu to Firestore:', error.message);
  }
}

// Extract new menu items from recent reviews
async function extractNewMenuItems(newReviews, existingMenu, restaurantName, restaurantTypes) {
  try {
    const reviewTexts = newReviews
      .map(review => review.text?.text || '')
      .filter(text => text.length > 0)
      .join(' ');
    
    if (reviewTexts.length === 0) return null;
    
    // Get existing menu items for comparison
    const existingItems = [];
    Object.values(existingMenu).forEach(category => {
      if (Array.isArray(category)) {
        category.forEach(item => existingItems.push(item.name.toLowerCase()));
      }
    });
    
    const prompt = `Analyze these recent restaurant reviews and extract ONLY NEW menu items that are NOT already in the existing menu.

Restaurant: ${restaurantName}
Type: ${restaurantTypes.join(', ')}

Existing Menu Items: ${existingItems.join(', ')}

Recent Reviews:
${reviewTexts}

Extract ONLY new menu items mentioned in reviews that are NOT in the existing menu. Return JSON:
{
  "Category Name": [
    {
      "name": "New Item Name",
      "description": "Brief description (max 30 words)",
      "available": true,
      "popular": false,
      "recommended": true/false
    }
  ]
}

Rules:
1. Only include items NOT in existing menu
2. Only items explicitly mentioned in reviews
3. Keep descriptions under 30 words
4. Return empty object {} if no new items found

Return only JSON, no additional text.`;
    
    const response = await cohere.generate({
      model: 'command',
      prompt: prompt,
      max_tokens: 800,
      temperature: 0.2,
      stop_sequences: []
    });
    
    const generatedText = response.generations[0].text.trim();
    const newMenuData = JSON.parse(generatedText);
    
    console.log('🔍 Backend: Extracted new items:', Object.keys(newMenuData).length, 'categories');
    return newMenuData;
    
  } catch (error) {
    console.error('❌ Backend: Error extracting new menu items:', error.message);
    return null;
  }
}

// Merge new menu items with existing menu
function mergeMenuItems(existingMenu, newItems) {
  const merged = { ...existingMenu };
  
  Object.keys(newItems).forEach(category => {
    if (merged[category]) {
      // Add new items to existing category
      merged[category] = [...merged[category], ...newItems[category]];
    } else {
      // Create new category
      merged[category] = newItems[category];
    }
  });
  
  console.log('🔄 Backend: Merged menu items');
  return merged;
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to view the app`);
  console.log(`🔑 Google Places API: ${GOOGLE_PLACES_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🤖 Cohere API: ${process.env.COHERE_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
});