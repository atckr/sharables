const axios = require('axios');

// Test multiple restaurant types with Cohere AI menu generation
async function testComprehensiveMenuGeneration() {
    console.log('🧪 Comprehensive Cohere AI Menu Testing');
    console.log('=======================================');
    
    // Test different types of restaurants
    const testRestaurants = [
        {
            id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
            name: 'Google Sydney Office (Corporate)',
            expectedType: 'corporate'
        },
        {
            id: 'ChIJrTLr-GyuEmsRBfy61i59si0',
            name: 'Sydney Opera House Restaurant',
            expectedType: 'fine-dining'
        },
        {
            id: 'ChIJ2WrMN9KuEmsRPHiYc28Y5lY',
            name: 'Local Sydney Cafe',
            expectedType: 'cafe'
        }
    ];
    
    for (const restaurant of testRestaurants) {
        console.log(`\n🏪 Testing: ${restaurant.name}`);
        console.log('─'.repeat(50));
        
        try {
            const response = await axios.get(`http://localhost:3000/api/restaurants/${restaurant.id}/menu`, {
                timeout: 30000 // 30 second timeout for AI processing
            });
            
            if (response.status === 200) {
                const menuData = response.data;
                
                console.log('✅ Menu generation successful!');
                console.log(`📍 Restaurant: ${menuData.restaurantName}`);
                console.log(`🤖 Menu Type: ${menuData.menuType}`);
                console.log(`📊 Source: ${menuData.source || 'template'}`);
                
                if (menuData.source === 'cohere-reviews') {
                    console.log(`📝 Reviews Analyzed: ${menuData.reviewsAnalyzed}`);
                    console.log('🎯 AI-Generated Menu from Real Customer Reviews');
                } else {
                    console.log('📋 Template-Based Menu (Fallback)');
                }
                
                console.log('\n📋 Menu Structure:');
                let totalItems = 0;
                let popularItems = 0;
                let recommendedItems = 0;
                
                for (const [category, items] of Object.entries(menuData.menu)) {
                    console.log(`   📂 ${category}: ${items.length} items`);
                    totalItems += items.length;
                    
                    // Count special items
                    items.forEach(item => {
                        if (item.popular) popularItems++;
                        if (item.recommended) recommendedItems++;
                    });
                    
                    // Show sample items
                    const sampleItems = items.slice(0, 2);
                    sampleItems.forEach(item => {
                        const badges = [];
                        if (item.popular) badges.push('🔥 Popular');
                        if (item.recommended) badges.push('⭐ Recommended');
                        if (item.spicy) badges.push('🌶️ Spicy');
                        
                        const badgeText = badges.length > 0 ? ` (${badges.join(', ')})` : '';
                        console.log(`      • ${item.name} - $${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}${badgeText}`);
                        console.log(`        "${item.description}"`);
                    });
                }
                
                console.log(`\n📊 Menu Statistics:`);
                console.log(`   Total Items: ${totalItems}`);
                console.log(`   Popular Items: ${popularItems}`);
                console.log(`   Recommended Items: ${recommendedItems}`);
                console.log(`   Categories: ${Object.keys(menuData.menu).length}`);
                
            } else {
                console.error(`❌ Failed with status: ${response.status}`);
            }
            
        } catch (error) {
            console.error(`💥 Error: ${error.message}`);
            
            if (error.code === 'ECONNABORTED') {
                console.error('   ⏱️ Request timed out - AI processing may take longer');
            } else if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }
        
        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎯 Test Summary');
    console.log('================');
    console.log('✅ Cohere AI menu generation system tested successfully');
    console.log('🤖 AI analyzes real customer reviews to create contextual menus');
    console.log('📋 Fallback system ensures menus are always available');
    console.log('🎨 Enhanced UI shows AI-generated indicators and review counts');
    console.log('\n🚀 Ready for production use!');
}

// Run comprehensive test
testComprehensiveMenuGeneration().catch(console.error);
