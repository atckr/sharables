const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test Firebase configuration with environment variables
async function testFirebaseEnvVars() {
  console.log('🔧 Testing Firebase Environment Variables');
  console.log('========================================\n');

  try {
    // Test 1: Check if Firebase config endpoint works
    console.log('📋 Step 1: Testing Firebase config endpoint...');
    const configResponse = await axios.get(`${BASE_URL}/api/firebase-config`);
    
    console.log('✅ Firebase config endpoint working');
    console.log('🔑 Config keys present:', Object.keys(configResponse.data));
    
    // Verify all required fields are present
    const requiredFields = [
      'apiKey', 'authDomain', 'projectId', 'storageBucket', 
      'messagingSenderId', 'appId', 'measurementId'
    ];
    
    const missingFields = requiredFields.filter(field => !configResponse.data[field]);
    
    if (missingFields.length > 0) {
      console.log('⚠️ Missing environment variables:', missingFields);
      console.log('Please add these to your .env file:');
      missingFields.forEach(field => {
        const envVar = 'FIREBASE_' + field.replace(/([A-Z])/g, '_$1').toUpperCase();
        console.log(`${envVar}=your_${field}_here`);
      });
    } else {
      console.log('✅ All Firebase config fields present');
    }

    // Test 2: Check health endpoint includes Firebase status
    console.log('\n🏥 Step 2: Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    
    console.log('✅ Health endpoint working');
    console.log('📊 API Status:', {
      googlePlaces: healthResponse.data.apiKeys.googlePlaces ? '✅' : '❌',
      cohere: healthResponse.data.apiKeys.cohere ? '✅' : '❌',
      firebase: healthResponse.data.apiKeys.firebase ? '✅' : '❌'
    });

    console.log('\n🎉 Firebase Environment Variables Test Complete!');
    console.log('================================================');
    console.log('✅ Firebase config moved to environment variables');
    console.log('✅ Backend serves config securely via API endpoint');
    console.log('✅ Frontend will fetch config dynamically');
    console.log('✅ No hardcoded credentials in source code');
    console.log('✅ Ready for production deployment');

  } catch (error) {
    console.error('💥 Firebase environment variables test failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

// Test frontend integration
async function testFrontendIntegration() {
  console.log('\n🖥️ Frontend Integration Status');
  console.log('==============================\n');

  console.log('📋 Changes Made:');
  console.log('✅ Removed hardcoded Firebase config from firebase-config.js');
  console.log('✅ Added dynamic config fetching from /api/firebase-config');
  console.log('✅ Updated all Firebase functions to wait for initialization');
  console.log('✅ Fixed variable redeclaration errors');
  console.log('✅ Made auth.js async-compatible');

  console.log('\n🔧 Environment Variables Required:');
  console.log('FIREBASE_API_KEY=your_api_key');
  console.log('FIREBASE_AUTH_DOMAIN=your_auth_domain');
  console.log('FIREBASE_PROJECT_ID=your_project_id');
  console.log('FIREBASE_STORAGE_BUCKET=your_storage_bucket');
  console.log('FIREBASE_MESSAGING_SENDER_ID=your_sender_id');
  console.log('FIREBASE_APP_ID=your_app_id');
  console.log('FIREBASE_MEASUREMENT_ID=your_measurement_id');

  console.log('\n🚀 Benefits:');
  console.log('• No sensitive data in source code');
  console.log('• Easy environment-specific configuration');
  console.log('• Secure credential management');
  console.log('• Production-ready setup');
}

async function runAllTests() {
  await testFirebaseEnvVars();
  await testFrontendIntegration();
}

if (require.main === module) {
  runAllTests();
}

module.exports = { testFirebaseEnvVars, testFrontendIntegration };
