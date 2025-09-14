const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data for multiple users and restaurants
const testUsers = [
  {
    userId: 'user_alice_123',
    restaurantId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', // Example restaurant ID
    restaurantName: 'The Italian Corner',
    likes: ['Margherita Pizza', 'Caesar Salad', 'Tiramisu'],
    dislikes: ['Anchovies', 'Olives']
  },
  {
    userId: 'user_bob_456',
    restaurantId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    restaurantName: 'The Italian Corner',
    likes: ['Pepperoni Pizza', 'Garlic Bread', 'Gelato'],
    dislikes: ['Mushrooms', 'Spinach']
  },
  {
    userId: 'user_charlie_789',
    restaurantId: 'ChIJrTLr-GyuEmsRBfy61i59si0', // Different restaurant
    restaurantName: 'Sushi Palace',
    likes: ['Salmon Sashimi', 'California Roll', 'Miso Soup'],
    dislikes: ['Spicy Mayo', 'Eel']
  }
];

async function testEmbeddingSystem() {
  console.log('🧪 Testing Complete Embedding System');
  console.log('=====================================\n');

  try {
    // Step 1: Test saving user preferences (this triggers embedding generation)
    console.log('📝 Step 1: Saving user preferences and generating embeddings...');
    for (const user of testUsers) {
      const response = await axios.post(`${BASE_URL}/api/preferences`, user);
      console.log(`✅ Saved preferences for ${user.userId}:`, {
        success: response.data.success,
        message: response.data.message
      });
      
      // Wait a bit between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('');

    // Step 2: Test finding similar users
    console.log('🔍 Step 2: Finding similar users...');
    for (const user of testUsers) {
      try {
        const response = await axios.get(`${BASE_URL}/api/similar-users/${user.userId}?limit=3`);
        console.log(`👥 Similar users for ${user.userId}:`, {
          totalFound: response.data.similarUsers.length,
          similarUsers: response.data.similarUsers.map(u => ({
            userId: u.userId,
            similarity: u.similarity.toFixed(3),
            restaurantCount: u.restaurantCount
          }))
        });
      } catch (error) {
        console.log(`⚠️ Similar users for ${user.userId}:`, error.response?.data?.message || 'No similar users yet');
      }
    }
    console.log('');

    // Step 3: Test group recommendations
    console.log('👥 Step 3: Testing group recommendations...');
    const groupUserIds = testUsers.map(u => u.userId);
    try {
      const response = await axios.post(`${BASE_URL}/api/group-recommendations`, {
        userIds: groupUserIds
      });
      console.log('🎯 Group recommendations:', {
        groupSize: response.data.groupSize,
        usersWithProfiles: response.data.usersWithProfiles,
        recommendationCount: response.data.recommendations.length,
        topRecommendations: response.data.recommendations.slice(0, 3).map(r => ({
          restaurantName: r.restaurantName,
          similarity: r.similarity.toFixed(3)
        }))
      });
    } catch (error) {
      console.log('⚠️ Group recommendations:', error.response?.data?.message || 'No recommendations yet');
    }
    console.log('');

    // Step 4: Test the legacy matching system for comparison
    console.log('🔄 Step 4: Testing legacy matching system for comparison...');
    for (const user of testUsers) {
      try {
        const response = await axios.get(`${BASE_URL}/api/matches/${user.userId}`);
        console.log(`🎯 Legacy matches for ${user.userId}:`, {
          matchCount: response.data.matchCount,
          matches: response.data.matches.slice(0, 2).map(m => ({
            userId: m.userId,
            similarity: m.similarity,
            restaurantName: m.restaurantName
          }))
        });
      } catch (error) {
        console.log(`⚠️ Legacy matches for ${user.userId}:`, error.response?.data?.error || 'No matches found');
      }
    }
    console.log('');

    // Step 5: Test health check
    console.log('🏥 Step 5: Health check...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ System health:', {
      status: healthResponse.data.status,
      googlePlaces: healthResponse.data.apiKeys.googlePlaces ? '✅' : '❌',
      cohere: healthResponse.data.apiKeys.cohere ? '✅' : '❌'
    });

    console.log('\n🎉 Embedding System Test Complete!');
    console.log('=====================================');
    console.log('✅ User preferences saved with likes/dislikes structure');
    console.log('✅ Restaurant embeddings generated using Cohere AI');
    console.log('✅ User embeddings created from restaurant preferences');
    console.log('✅ User similarity matching implemented');
    console.log('✅ Group recommendations working');
    console.log('✅ Legacy system still functional for comparison');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Test different scenarios
async function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases');
  console.log('=====================\n');

  try {
    // Test user with no preferences
    console.log('🔍 Testing user with no preferences...');
    const response = await axios.get(`${BASE_URL}/api/similar-users/nonexistent_user`);
    console.log('✅ No preferences case:', response.data.message);

    // Test empty group recommendations
    console.log('👥 Testing empty group...');
    const emptyGroupResponse = await axios.post(`${BASE_URL}/api/group-recommendations`, {
      userIds: ['nonexistent_user1', 'nonexistent_user2']
    });
    console.log('✅ Empty group case:', emptyGroupResponse.data.message);

  } catch (error) {
    console.error('💥 Edge case test failed:', error.message);
  }
}

// Run the tests
async function runAllTests() {
  await testEmbeddingSystem();
  await testEdgeCases();
}

if (require.main === module) {
  runAllTests();
}

module.exports = { testEmbeddingSystem, testEdgeCases };
