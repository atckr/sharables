#!/usr/bin/env node

/**
 * Test script to verify menu data fetching from Toast API
 * Usage: node test-menu-api.js
 */

const axios = require('axios');
require('dotenv').config();

// Toast API configuration
const TOAST_API_BASE = 'https://ws-api.toasttab.com/restaurants/v1';
const TOAST_API_KEY = process.env.TOAST_API_KEY; // Add this to .env file

// Test restaurant data
const testRestaurants = [
    {
        name: "Williams Fresh Cafe",
        address: "170 University Ave W, Waterloo, ON N2L 3E9, Canada",
        placeId: "ChIJf93czgb0K4gR2anL3Rkcy3c"
    },
    {
        name: "Test Restaurant",
        address: "123 Main St, Toronto, ON",
        placeId: "test_place_id"
    }
];

// Alternative APIs to test if Toast doesn't work
const alternativeAPIs = {
    // Yelp Fusion API (requires API key)
    yelp: {
        baseUrl: 'https://api.yelp.com/v3/businesses',
        headers: {
            'Authorization': `Bearer ${process.env.YELP_API_KEY}`
        }
    },
    // Foursquare Places API (requires API key)
    foursquare: {
        baseUrl: 'https://api.foursquare.com/v3/places',
        headers: {
            'Authorization': process.env.FOURSQUARE_API_KEY
        }
    }
};

async function testToastAPI(restaurant) {
    console.log(`\n🍞 Testing Toast API for: ${restaurant.name}`);
    
    if (!TOAST_API_KEY) {
        console.log('❌ Toast API key not found in environment variables');
        return null;
    }
    
    try {
        // Search for restaurant by name/location
        const searchUrl = `${TOAST_API_BASE}/restaurants/search`;
        const searchResponse = await axios.get(searchUrl, {
            headers: {
                'Authorization': `Bearer ${TOAST_API_KEY}`,
                'Content-Type': 'application/json'
            },
            params: {
                name: restaurant.name,
                address: restaurant.address
            },
            timeout: 10000
        });
        
        console.log('✅ Toast API search successful');
        console.log('📊 Response:', JSON.stringify(searchResponse.data, null, 2));
        
        // If restaurant found, get menu data
        if (searchResponse.data && searchResponse.data.length > 0) {
            const restaurantId = searchResponse.data[0].guid;
            const menuUrl = `${TOAST_API_BASE}/restaurants/${restaurantId}/menus`;
            
            const menuResponse = await axios.get(menuUrl, {
                headers: {
                    'Authorization': `Bearer ${TOAST_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            console.log('🍽️ Menu data retrieved successfully');
            console.log('📋 Menu items:', JSON.stringify(menuResponse.data, null, 2));
            
            return menuResponse.data;
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Toast API error:', error.message);
        if (error.response) {
            console.error('📋 Error response:', error.response.status, error.response.data);
        }
        return null;
    }
}

async function testYelpAPI(restaurant) {
    console.log(`\n🔍 Testing Yelp API for: ${restaurant.name}`);
    
    if (!process.env.YELP_API_KEY) {
        console.log('❌ Yelp API key not found in environment variables');
        return null;
    }
    
    try {
        // Search for business
        const searchUrl = `${alternativeAPIs.yelp.baseUrl}/search`;
        const searchResponse = await axios.get(searchUrl, {
            headers: alternativeAPIs.yelp.headers,
            params: {
                term: restaurant.name,
                location: restaurant.address,
                limit: 1
            },
            timeout: 10000
        });
        
        console.log('✅ Yelp API search successful');
        
        if (searchResponse.data.businesses && searchResponse.data.businesses.length > 0) {
            const business = searchResponse.data.businesses[0];
            console.log('🏪 Business found:', business.name);
            console.log('📞 Phone:', business.phone);
            console.log('⭐ Rating:', business.rating);
            console.log('💰 Price:', business.price);
            console.log('🏷️ Categories:', business.categories.map(cat => cat.title).join(', '));
            
            // Note: Yelp doesn't provide detailed menu data in their public API
            console.log('ℹ️ Note: Yelp API does not provide detailed menu data');
            
            return {
                name: business.name,
                rating: business.rating,
                price: business.price,
                categories: business.categories,
                phone: business.phone,
                address: business.location.display_address.join(', '),
                menu_note: 'Menu data not available via Yelp API'
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Yelp API error:', error.message);
        if (error.response) {
            console.error('📋 Error response:', error.response.status, error.response.data);
        }
        return null;
    }
}

async function generateSampleMenu(restaurant) {
    console.log(`\n🎲 Generating sample menu for: ${restaurant.name}`);
    
    // Generate realistic menu items based on restaurant type/name
    const menuCategories = {
        cafe: {
            'Beverages': ['Espresso', 'Cappuccino', 'Latte', 'Americano', 'Hot Chocolate', 'Iced Coffee'],
            'Food': ['Croissant', 'Bagel with Cream Cheese', 'Avocado Toast', 'Breakfast Sandwich', 'Muffin', 'Danish'],
            'Lunch': ['Caesar Salad', 'Grilled Chicken Sandwich', 'Soup of the Day', 'Panini', 'Wrap', 'Quiche']
        },
        restaurant: {
            'Appetizers': ['Bruschetta', 'Calamari', 'Wings', 'Nachos', 'Spinach Dip', 'Mozzarella Sticks'],
            'Main Courses': ['Grilled Salmon', 'Ribeye Steak', 'Chicken Parmesan', 'Pasta Primavera', 'Fish & Chips', 'Burger'],
            'Desserts': ['Tiramisu', 'Cheesecake', 'Chocolate Cake', 'Ice Cream', 'Crème Brûlée', 'Apple Pie']
        }
    };
    
    // Determine restaurant type
    const isCafe = restaurant.name.toLowerCase().includes('cafe') || 
                   restaurant.name.toLowerCase().includes('coffee');
    
    const selectedMenu = isCafe ? menuCategories.cafe : menuCategories.restaurant;
    
    const generatedMenu = {};
    for (const [category, items] of Object.entries(selectedMenu)) {
        generatedMenu[category] = items.map(item => ({
            name: item,
            price: (Math.random() * 20 + 5).toFixed(2), // Random price between $5-25
            description: `Delicious ${item.toLowerCase()} made fresh daily`,
            available: Math.random() > 0.1 // 90% chance of being available
        }));
    }
    
    console.log('✅ Sample menu generated successfully');
    console.log('📋 Menu:', JSON.stringify(generatedMenu, null, 2));
    
    return generatedMenu;
}

async function testMenuAPIs() {
    console.log('🧪 Starting Menu API Tests');
    console.log('=' .repeat(50));
    
    for (const restaurant of testRestaurants) {
        console.log(`\n🏪 Testing restaurant: ${restaurant.name}`);
        console.log('-'.repeat(30));
        
        // Test Toast API
        const toastResult = await testToastAPI(restaurant);
        
        // Test Yelp API as fallback
        const yelpResult = await testYelpAPI(restaurant);
        
        // Generate sample menu as final fallback
        const sampleMenu = await generateSampleMenu(restaurant);
        
        // Summary
        console.log(`\n📊 Summary for ${restaurant.name}:`);
        console.log(`Toast API: ${toastResult ? '✅ Success' : '❌ Failed'}`);
        console.log(`Yelp API: ${yelpResult ? '✅ Success' : '❌ Failed'}`);
        console.log(`Sample Menu: ✅ Generated`);
        
        console.log('\n' + '='.repeat(50));
    }
    
    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('1. If Toast API works: Use for real menu data');
    console.log('2. If Yelp API works: Use for restaurant info (no menu data)');
    console.log('3. Fallback: Use sample menu generation based on restaurant type');
    console.log('4. Consider adding more menu APIs like Zomato, MenuAPI, or restaurant-specific APIs');
    
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Add API keys to .env file if available');
    console.log('2. Implement the working API in the main application');
    console.log('3. Add error handling and fallbacks');
    console.log('4. Test with real restaurant data');
}

// Run the tests
if (require.main === module) {
    testMenuAPIs().catch(console.error);
}

module.exports = {
    testToastAPI,
    testYelpAPI,
    generateSampleMenu
};
