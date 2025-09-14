const { CohereClient } = require('cohere-ai');
require('dotenv').config();

// Simple test to verify Cohere API key works
async function testCohereAPI() {
  console.log('🧪 Testing Cohere API Connection');
  console.log('================================\n');

  try {
    if (!process.env.COHERE_API_KEY) {
      console.log('❌ No COHERE_API_KEY found in .env file');
      console.log('Please add your Cohere API key to the .env file:');
      console.log('COHERE_API_KEY=your_api_key_here');
      return;
    }

    console.log('🔑 API Key found, testing connection...');
    
    const cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });

    // Test with a simple embedding request
    const testText = "Italian restaurant with great pizza and pasta";
    
    console.log('📝 Testing embedding generation...');
    const response = await cohere.embed({
      texts: [testText],
      model: 'embed-english-v3.0',
      input_type: 'search_document'
    });

    if (response.embeddings && response.embeddings.length > 0) {
      console.log('✅ Cohere API working successfully!');
      console.log(`📊 Generated embedding with ${response.embeddings[0].length} dimensions`);
      console.log('🎉 Ready to generate restaurant embeddings!');
      
      return true;
    } else {
      console.log('❌ Unexpected response format from Cohere API');
      return false;
    }

  } catch (error) {
    console.log('❌ Cohere API test failed:', error.message);
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('🔧 This looks like an API key issue. Please check:');
      console.log('   1. API key is correctly copied to .env file');
      console.log('   2. API key is valid and not expired');
      console.log('   3. No extra spaces or quotes around the key');
    } else if (error.message.includes('rate limit')) {
      console.log('⏱️ Rate limit reached. Wait a moment and try again.');
    } else {
      console.log('🔧 Error details:', error.message);
    }
    
    return false;
  }
}

// Test the full embedding workflow
async function testEmbeddingWorkflow() {
  console.log('\n🔄 Testing Full Embedding Workflow');
  console.log('==================================\n');

  const apiWorking = await testCohereAPI();
  
  if (!apiWorking) {
    console.log('⚠️ Skipping workflow test due to API issues');
    return;
  }

  try {
    const axios = require('axios');
    const BASE_URL = 'http://localhost:3000';

    console.log('🍕 Testing with real restaurant data...');
    
    // Test with a restaurant that should generate embeddings
    const testUser = {
      userId: 'cohere_test_user',
      restaurantId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', // Real Google Places ID
      restaurantName: 'Test Italian Restaurant',
      likes: ['Margherita Pizza', 'Caesar Salad'],
      dislikes: ['Anchovies']
    };

    const response = await axios.post(`${BASE_URL}/api/preferences`, testUser);
    console.log('✅ Preferences saved:', response.data.success);

    // Wait a moment for embedding generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test similarity matching
    const similarResponse = await axios.get(`${BASE_URL}/api/similar-users/${testUser.userId}`);
    console.log('🔍 Similarity check:', {
      hasProfile: similarResponse.data.message !== 'User has no taste profile yet',
      message: similarResponse.data.message
    });

    console.log('\n🎉 Embedding workflow test complete!');

  } catch (error) {
    console.log('❌ Workflow test failed:', error.message);
  }
}

if (require.main === module) {
  testEmbeddingWorkflow();
}

module.exports = { testCohereAPI, testEmbeddingWorkflow };
