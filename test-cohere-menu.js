const axios = require('axios');

// Test the Cohere AI menu generation endpoint
async function testCohereMenuGeneration() {
    console.log('🧪 Testing Cohere AI Menu Generation');
    console.log('=====================================');
    
    // Test with a sample restaurant ID (this would be a real Google Places ID)
    const testRestaurantId = 'ChIJN1t_tDeuEmsRUsoyG83frY4'; // Sample ID
    
    try {
        console.log(`🍽️ Testing menu generation for restaurant ID: ${testRestaurantId}`);
        
        const response = await axios.get(`http://localhost:3000/api/restaurants/${testRestaurantId}/menu`);
        
        if (response.status === 200) {
            const menuData = response.data;
            
            console.log('✅ Menu generation successful!');
            console.log('📊 Menu Data:');
            console.log(`   Restaurant: ${menuData.restaurantName}`);
            console.log(`   Menu Type: ${menuData.menuType}`);
            console.log(`   Source: ${menuData.source || 'template'}`);
            
            if (menuData.reviewsAnalyzed) {
                console.log(`   Reviews Analyzed: ${menuData.reviewsAnalyzed}`);
            }
            
            console.log('📋 Menu Categories:');
            for (const [category, items] of Object.entries(menuData.menu)) {
                console.log(`   - ${category}: ${items.length} items`);
                
                // Show first item as example
                if (items.length > 0) {
                    const firstItem = items[0];
                    console.log(`     Example: ${firstItem.name} - $${firstItem.price}`);
                    if (firstItem.popular) console.log('       🔥 Popular item');
                    if (firstItem.recommended) console.log('       ⭐ Recommended item');
                }
            }
            
        } else {
            console.error('❌ Menu generation failed with status:', response.status);
        }
        
    } catch (error) {
        console.error('💥 Error testing menu generation:', error.message);
        
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

// Run the test
testCohereMenuGeneration();
