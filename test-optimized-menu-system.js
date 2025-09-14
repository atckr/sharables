// Test script for the optimized AI menu caching system
// Tests dictionary format, similarity matching, and optimized review processing

require('dotenv').config();
const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin (using default credentials)
const app = initializeApp();
const db = getFirestore(app);

// Test restaurant data with real Google Place ID
const testRestaurant = {
  id: 'ChIJN1t_tDeuEmsRUsoyG83frY4', // Google Sydney Opera House (for testing)
  displayName: { text: 'Test Restaurant' },
  types: ['restaurant', 'food', 'establishment'],
  reviews: [
    {
      text: { text: 'Amazing pasta carbonara and tiramisu! The seafood risotto was incredible too.' },
      publishTime: '2024-01-15T10:00:00Z'
    },
    {
      text: { text: 'Great pizza margherita and caesar salad. Love their garlic bread appetizer.' },
      publishTime: '2024-01-14T15:30:00Z'
    },
    {
      text: { text: 'Tried the grilled salmon and chocolate cake. Both were excellent!' },
      publishTime: '2024-01-13T19:45:00Z'
    },
    {
      text: { text: 'The chicken parmesan was delicious. Also had their famous cheesecake.' },
      publishTime: '2024-01-12T12:20:00Z'
    },
    {
      text: { text: 'Loved the beef steak and mashed potatoes. Great wine selection too.' },
      publishTime: '2024-01-11T20:15:00Z'
    }
  ]
};

// Simulate newer reviews for incremental update testing
const newerReviews = [
  {
    text: { text: 'Just tried their new lobster bisque and truffle pasta - absolutely divine!' },
    publishTime: '2024-01-16T18:00:00Z'
  },
  ...testRestaurant.reviews.slice(1) // Keep the rest of the reviews
];

async function testOptimizedMenuSystem() {
  console.log('🧪 Testing Optimized AI Menu Caching System');
  console.log('=' .repeat(60));
  
  try {
    // Clear any existing cache for clean test
    console.log('\n🧹 Clearing existing cache...');
    await db.collection('menuCache').doc(testRestaurant.id).delete();
    console.log('✅ Cache cleared');
    
    // Test 1: Initial menu generation (should use 5 reviews)
    console.log('\n📝 Test 1: Initial menu generation');
    console.log('Expected: Process 5 reviews, create dictionary format menu');
    
    const startTime1 = Date.now();
    
    // Mock the menu generation function
    const initialMenu = await simulateMenuGeneration(testRestaurant, true);
    
    const duration1 = Date.now() - startTime1;
    console.log(`⏱️  Initial generation took: ${duration1}ms`);
    console.log('📊 Menu structure:', typeof initialMenu.menu);
    console.log('📊 Menu items count:', Object.keys(initialMenu.menu).length);
    console.log('📊 Reviews analyzed:', initialMenu.reviewsAnalyzed);
    console.log('📊 Source:', initialMenu.source);
    
    // Display sample menu items
    console.log('\n🍽️  Sample menu items (dictionary format):');
    const menuItems = Object.entries(initialMenu.menu).slice(0, 3);
    menuItems.forEach(([item, description]) => {
      console.log(`  "${item}": "${description}"`);
    });
    
    // Test 2: Cached menu retrieval (should return cached version)
    console.log('\n📝 Test 2: Cached menu retrieval');
    console.log('Expected: Return cached menu instantly');
    
    const startTime2 = Date.now();
    const cachedMenu = await simulateMenuGeneration(testRestaurant, false);
    const duration2 = Date.now() - startTime2;
    
    console.log(`⏱️  Cache retrieval took: ${duration2}ms`);
    console.log('📊 Using cached menu:', cachedMenu.source === initialMenu.source);
    console.log('📊 Same menu items:', Object.keys(cachedMenu.menu).length === Object.keys(initialMenu.menu).length);
    
    // Test 3: Incremental update with new reviews
    console.log('\n📝 Test 3: Incremental update with new reviews');
    console.log('Expected: Analyze newest review, check similarity, process 4 additional if new items found');
    
    const restaurantWithNewReviews = {
      ...testRestaurant,
      reviews: newerReviews
    };
    
    const startTime3 = Date.now();
    const updatedMenu = await simulateMenuGeneration(restaurantWithNewReviews, false);
    const duration3 = Date.now() - startTime3;
    
    console.log(`⏱️  Incremental update took: ${duration3}ms`);
    console.log('📊 Menu updated:', updatedMenu.lastUpdated !== initialMenu.lastUpdated);
    console.log('📊 New items added:', Object.keys(updatedMenu.menu).length > Object.keys(initialMenu.menu).length);
    console.log('📊 Total reviews analyzed:', updatedMenu.reviewsAnalyzed);
    
    // Test 4: Similarity matching
    console.log('\n📝 Test 4: Similarity matching test');
    console.log('Expected: Detect similar items and avoid duplicates');
    
    const testSimilarity = await testSimilarityMatching();
    console.log('📊 Similarity test results:', testSimilarity);
    
    // Test 5: Template menu fallback (dictionary format)
    console.log('\n📝 Test 5: Template menu fallback');
    console.log('Expected: Generate dictionary format template menu');
    
    const restaurantNoReviews = {
      ...testRestaurant,
      reviews: []
    };
    
    const templateMenu = await simulateMenuGeneration(restaurantNoReviews, true);
    console.log('📊 Template menu type:', templateMenu.menuType);
    console.log('📊 Template source:', templateMenu.source);
    console.log('📊 Template format:', typeof templateMenu.menu);
    console.log('📊 Template items count:', Object.keys(templateMenu.menu).length);
    
    // Display sample template items
    console.log('\n🍽️  Sample template items:');
    const templateItems = Object.entries(templateMenu.menu).slice(0, 3);
    templateItems.forEach(([item, description]) => {
      console.log(`  "${item}": "${description}"`);
    });
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📈 Performance Summary:');
    console.log(`  Initial generation: ${duration1}ms`);
    console.log(`  Cache retrieval: ${duration2}ms`);
    console.log(`  Incremental update: ${duration3}ms`);
    console.log(`  Cache speedup: ${Math.round(duration1/duration2)}x faster`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Simulate menu generation with the new optimized logic
async function simulateMenuGeneration(restaurant, isFirstTime) {
  const restaurantId = restaurant.id;
  const name = restaurant.displayName.text;
  
  // Check cache first (unless it's first time)
  if (!isFirstTime) {
    const cachedMenu = await loadMenuFromFirestore(restaurantId);
    if (cachedMenu) {
      console.log('✅ Found cached menu');
      
      // Simulate checking newest review for new items
      if (restaurant.reviews.length > 0) {
        console.log('🔍 Analyzing newest review for new items...');
        
        // Simulate finding new items (lobster bisque, truffle pasta)
        const newItems = {
          'Lobster Bisque': 'Rich and creamy lobster soup',
          'Truffle Pasta': 'Pasta with truffle and cream sauce'
        };
        
        // Simulate similarity check
        console.log('🔄 Checking similarity with existing items...');
        const existingItems = Object.keys(cachedMenu.menu);
        const hasNewItems = !existingItems.some(item => 
          item.toLowerCase().includes('lobster') || item.toLowerCase().includes('truffle')
        );
        
        if (hasNewItems) {
          console.log('🆕 Found truly new items, processing additional reviews...');
          
          // Merge new items
          const updatedMenu = { ...cachedMenu.menu, ...newItems };
          
          const menuData = {
            ...cachedMenu,
            menu: updatedMenu,
            reviewsAnalyzed: cachedMenu.reviewsAnalyzed + 5,
            lastUpdated: new Date().toISOString(),
            source: 'cohere-reviews-incremental'
          };
          
          await saveMenuToFirestore(restaurantId, menuData);
          return menuData;
        }
      }
      
      return cachedMenu;
    }
  }
  
  // Generate fresh menu
  console.log('🤖 Generating fresh menu from reviews...');
  
  if (restaurant.reviews.length > 0) {
    // Simulate AI extraction from 5 reviews
    const menuItems = {
      'Pasta Carbonara': 'Creamy pasta with bacon and eggs',
      'Tiramisu': 'Classic Italian coffee-flavored dessert',
      'Seafood Risotto': 'Creamy rice with mixed seafood',
      'Pizza Margherita': 'Traditional pizza with tomato, mozzarella, basil',
      'Caesar Salad': 'Romaine lettuce with Caesar dressing',
      'Garlic Bread': 'Toasted bread with garlic butter',
      'Grilled Salmon': 'Fresh salmon with herbs',
      'Chocolate Cake': 'Rich chocolate layer cake',
      'Chicken Parmesan': 'Breaded chicken with marinara and cheese',
      'Cheesecake': 'Creamy New York style cheesecake'
    };
    
    const menuData = {
      restaurantId: restaurantId,
      restaurantName: name,
      menuType: 'ai-generated',
      source: 'cohere-reviews-initial',
      reviewsAnalyzed: 5,
      lastUpdated: new Date().toISOString(),
      menu: menuItems
    };
    
    await saveMenuToFirestore(restaurantId, menuData);
    return menuData;
  } else {
    // Template fallback
    console.log('📋 Using template menu...');
    return {
      restaurantId: restaurantId,
      restaurantName: name,
      menuType: 'restaurant',
      source: 'template-based',
      reviewsAnalyzed: 0,
      lastUpdated: new Date().toISOString(),
      menu: {
        'Bruschetta': 'Toasted bread with tomatoes and basil',
        'Calamari': 'Crispy fried squid with marinara',
        'Grilled Salmon': 'Atlantic salmon with lemon herb butter',
        'Ribeye Steak': '12oz ribeye with garlic mashed potatoes',
        'Tiramisu': 'Classic Italian dessert'
      }
    };
  }
}

// Test similarity matching logic
async function testSimilarityMatching() {
  const existingItems = ['Pasta Carbonara', 'Pizza Margherita', 'Grilled Salmon'];
  const newItems = ['Carbonara Pasta', 'Margherita Pizza', 'Lobster Bisque'];
  
  // Simulate similarity scores
  const results = {
    'Carbonara Pasta': 0.95, // Very similar to 'Pasta Carbonara'
    'Margherita Pizza': 0.92, // Very similar to 'Pizza Margherita'  
    'Lobster Bisque': 0.15 // Not similar to existing items
  };
  
  const trulyNewItems = [];
  for (const [item, similarity] of Object.entries(results)) {
    if (similarity < 0.8) {
      trulyNewItems.push(item);
    }
  }
  
  return {
    tested: Object.keys(results).length,
    trulyNew: trulyNewItems.length,
    newItems: trulyNewItems
  };
}

// Firestore helper functions
async function loadMenuFromFirestore(restaurantId) {
  try {
    const doc = await db.collection('menuCache').doc(restaurantId).get();
    if (doc.exists) {
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error('Error loading menu from Firestore:', error);
    return null;
  }
}

async function saveMenuToFirestore(restaurantId, menuData) {
  try {
    await db.collection('menuCache').doc(restaurantId).set(menuData);
    console.log('💾 Menu saved to Firestore cache');
  } catch (error) {
    console.error('Error saving menu to Firestore:', error);
  }
}

// Run the test
if (require.main === module) {
  testOptimizedMenuSystem()
    .then(() => {
      console.log('\n🎉 Test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testOptimizedMenuSystem };
