// Test script for ultra-fast menu generation (no caching/Firestore)
require('dotenv').config();
const { CohereClient } = require('cohere-ai');

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Test restaurant data
const testRestaurant = {
  id: 'test-fast-restaurant',
  displayName: { text: 'Fast Test Restaurant' },
  types: ['restaurant', 'food'],
  reviews: [
    { text: { text: 'Amazing pasta carbonara and tiramisu! The seafood risotto was incredible.' } },
    { text: { text: 'Great pizza margherita and caesar salad. Love their garlic bread.' } },
    { text: { text: 'Tried the grilled salmon and chocolate cake. Both were excellent!' } }
  ]
};

// Ultra-fast menu extraction (same as server.js)
async function extractMenuItemsFast(reviews, restaurantName, restaurantTypes) {
  try {
    console.log('⚡ Starting fast extraction...');
    const startTime = Date.now();
    
    // Combine and truncate review text for speed
    const reviewTexts = reviews
      .map(review => review.text?.text || '')
      .filter(text => text.length > 0)
      .join(' ')
      .substring(0, 1000); // Limit input length for speed
    
    if (reviewTexts.length === 0) return {};
    
    // Ultra-minimal prompt for guaranteed JSON
    const prompt = `Food items from: ${reviewTexts.substring(0, 500)}

JSON format:
{"Pizza":"Italian flatbread","Pasta":"Italian noodles"}`;
    
    const response = await cohere.generate({
      model: 'command-light',
      prompt: prompt,
      max_tokens: 200,
      temperature: 0,
      stop_sequences: ['}', '\n']
    });
    
    let generatedText = response.generations[0].text.trim();
    
    // Ensure we have valid JSON
    if (!generatedText.startsWith('{')) {
      generatedText = '{' + generatedText;
    }
    if (!generatedText.endsWith('}')) {
      generatedText = generatedText + '}';
    }
    
    let menuItems;
    try {
      menuItems = JSON.parse(generatedText);
    } catch (parseError) {
      // Extract key-value pairs manually if JSON fails
      console.log('⚠️ Using regex fallback parsing');
      menuItems = {};
      const matches = generatedText.match(/"([^"]+)"\s*:\s*"([^"]+)"/g);
      if (matches) {
        matches.forEach(match => {
          const [, key, value] = match.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
          menuItems[key] = value;
        });
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`⚡ Fast extracted ${Object.keys(menuItems).length} items in ${duration}ms`);
    return { menuItems, duration };
    
  } catch (error) {
    console.error('❌ Fast extraction failed:', error.message);
    return { menuItems: {}, duration: 0 };
  }
}

// Fast menu generation (no caching/Firestore)
async function generateMenuFast(restaurant) {
  const name = restaurant.displayName?.text || 'Restaurant';
  const types = restaurant.types || [];
  const reviews = restaurant.reviews || [];
  
  console.log('🚀 Fast menu generation for:', name);
  const totalStartTime = Date.now();
  
  try {
    if (reviews.length > 0 && process.env.COHERE_API_KEY) {
      // Use only 3 reviews max for speed
      const maxReviews = Math.min(3, reviews.length);
      const recentReviews = reviews.slice(0, maxReviews);
      console.log(`⚡ Processing ${maxReviews} reviews`);
      
      const { menuItems, duration: extractionTime } = await extractMenuItemsFast(recentReviews, name, types);
      
      if (menuItems && Object.keys(menuItems).length > 0) {
        const totalDuration = Date.now() - totalStartTime;
        console.log(`🎯 Total generation time: ${totalDuration}ms`);
        
        return {
          restaurantId: restaurant.id,
          restaurantName: name,
          menuType: 'ai-generated',
          source: 'cohere-fast',
          reviewsAnalyzed: maxReviews,
          extractionTime: extractionTime,
          totalTime: totalDuration,
          menu: menuItems
        };
      }
    }
    
    // Fast template fallback
    const totalDuration = Date.now() - totalStartTime;
    console.log('⚡ Using template fallback');
    
    return {
      restaurantId: restaurant.id,
      restaurantName: name,
      menuType: 'template',
      source: 'template-fast',
      totalTime: totalDuration,
      menu: {
        'Grilled Salmon': 'Fresh salmon with herbs',
        'Pasta Carbonara': 'Creamy pasta with bacon',
        'Caesar Salad': 'Romaine lettuce with dressing',
        'Tiramisu': 'Classic Italian dessert'
      }
    };
    
  } catch (error) {
    console.error('💥 Fast generation error:', error.message);
    const totalDuration = Date.now() - totalStartTime;
    
    return {
      restaurantId: restaurant.id,
      restaurantName: name,
      menuType: 'template',
      source: 'error-fallback',
      totalTime: totalDuration,
      error: error.message,
      menu: {
        'House Special': 'Restaurant specialty dish',
        'Daily Special': 'Chef recommended dish',
        'Seasonal Item': 'Fresh seasonal ingredients'
      }
    };
  }
}

// Run speed test
async function testFastGeneration() {
  console.log('🧪 Testing Ultra-Fast Menu Generation');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Fast generation with reviews
    console.log('\n📝 Test 1: Fast AI Generation');
    const result1 = await generateMenuFast(testRestaurant);
    
    console.log('📊 Results:');
    console.log(`  Source: ${result1.source}`);
    console.log(`  Reviews analyzed: ${result1.reviewsAnalyzed || 0}`);
    console.log(`  Total time: ${result1.totalTime}ms`);
    console.log(`  Menu items: ${Object.keys(result1.menu).length}`);
    console.log(`  Under 5s: ${result1.totalTime < 5000 ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n🍽️ Sample menu items:');
    Object.entries(result1.menu).slice(0, 3).forEach(([item, desc]) => {
      console.log(`  "${item}": "${desc}"`);
    });
    
    // Test 2: Template fallback speed
    console.log('\n📝 Test 2: Template Fallback Speed');
    const noReviewsRestaurant = { ...testRestaurant, reviews: [] };
    const result2 = await generateMenuFast(noReviewsRestaurant);
    
    console.log('📊 Fallback Results:');
    console.log(`  Source: ${result2.source}`);
    console.log(`  Total time: ${result2.totalTime}ms`);
    console.log(`  Menu items: ${Object.keys(result2.menu).length}`);
    console.log(`  Under 1s: ${result2.totalTime < 1000 ? '✅ YES' : '❌ NO'}`);
    
    // Test 3: Multiple runs for consistency
    console.log('\n📝 Test 3: Speed Consistency (5 runs)');
    const times = [];
    
    for (let i = 0; i < 5; i++) {
      const result = await generateMenuFast(testRestaurant);
      times.push(result.totalTime);
      console.log(`  Run ${i + 1}: ${result.totalTime}ms`);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    console.log('\n📈 Performance Summary:');
    console.log(`  Average time: ${Math.round(avgTime)}ms`);
    console.log(`  Fastest: ${minTime}ms`);
    console.log(`  Slowest: ${maxTime}ms`);
    console.log(`  All under 5s: ${maxTime < 5000 ? '✅ YES' : '❌ NO'}`);
    console.log(`  Consistency: ${maxTime - minTime < 2000 ? '✅ GOOD' : '⚠️ VARIABLE'}`);
    
    console.log('\n🎉 Fast generation test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testFastGeneration()
    .then(() => {
      console.log('\n✅ All tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { generateMenuFast, extractMenuItemsFast };
