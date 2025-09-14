// Import authentication functions
import { 
    initAuth, 
    handleGoogleSignIn, 
    handleSignOut,
    saveAuthenticatedUserPreferences,
    getAuthenticatedUserPreferences,
    getAuthenticatedUserMatches,
    isAuthenticated,
    getAuthenticatedUser
} from './auth.js';

let currentRestaurant = null;
let selectedMenuItems = [];
let currentLocation = null;

// Initialize app
function initApp() {
    console.log('🚀 Initializing Sharables app...');
    
    // Initialize authentication first
    initAuth();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize location input
    initLocationInput();
}

// Initialize location search functionality
function initLocationSearch() {
    const locationInput = document.getElementById('locationInput');
    
    // Simple location input without autocomplete
    locationInput.addEventListener('input', () => {
        // Enable search when user types
        const searchBtn = document.getElementById('searchBtn');
        searchBtn.disabled = false;
    });
}

// Get current location using Geolocation API
function getCurrentLocation() {
    console.log('🌍 Getting current location...');
    
    if (navigator.geolocation) {
        console.log('✅ Geolocation API available');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('📍 Current location detected:', location);
                
                // Update location input field
                const locationInput = document.getElementById('locationInput');
                if (locationInput) {
                    locationInput.value = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
                    console.log('📝 Updated location input field');
                }
                
                // Search for restaurants at current location
                console.log('🔍 Starting restaurant search with current location...');
                searchRestaurants(location.lat, location.lng);
            },
            (error) => {
                console.log('❌ Geolocation failed:', error.message);
                console.log('📋 Error details:', {
                    code: error.code,
                    message: error.message
                });
                // Don't search automatically if geolocation fails
            }
        );
    } else {
        console.log('❌ Geolocation API not available');
    }
}

// Search for restaurants using backend API
async function searchRestaurants(lat, lng) {
    try {
        console.log('🔍 Starting restaurant search...');
        console.log('📍 Search coordinates:', { lat, lng });
        
        showLoading(true);
        
        const radius = parseInt(document.getElementById('distanceSelect').value);
        console.log('📏 Search radius:', radius, 'meters');
        
        const apiUrl = `/api/restaurants?latitude=${lat}&longitude=${lng}&radius=${radius}`;
        console.log('🌐 API URL:', apiUrl);
        
        console.log('⏳ Fetching restaurant data...');
        const response = await fetch(apiUrl);
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Raw API response:', data);
        console.log('🏪 Number of businesses found:', data.businesses ? data.businesses.length : 0);
        
        if (data.businesses && data.businesses.length > 0) {
            console.log('✅ Displaying restaurants list');
            console.log('🏪 First restaurant sample:', data.businesses[0]);
            displayRestaurantsList(data.businesses);
        } else {
            console.log('❌ No restaurants found, showing no results message');
            showNoResults();
        }
    } catch (error) {
        console.error('💥 Error searching restaurants:', error);
        console.error('📋 Error details:', {
            message: error.message,
            stack: error.stack
        });
        alert('Failed to search restaurants. Please try again.');
    } finally {
        console.log('🏁 Search completed, hiding loading');
        showLoading(false);
    }
}

// Display restaurants in a list format (without map)
function displayRestaurantsList(restaurants) {
    console.log('🎨 Starting to display restaurants list');
    console.log('📋 Restaurants to display:', restaurants.length);
    
    const restaurantsList = document.getElementById('restaurantsList');
    const restaurantResults = document.getElementById('restaurantResults');
    
    if (!restaurantsList) {
        console.error('❌ Restaurant list element not found!');
        return;
    }
    
    restaurantsList.innerHTML = '';
    
    restaurants.forEach((restaurant, index) => {
        console.log(`🏪 Processing restaurant ${index + 1}:`, restaurant.name);
        console.log(`📊 Restaurant data:`, {
            name: restaurant.name,
            rating: restaurant.rating,
            image_url: restaurant.image_url,
            location: restaurant.location,
            categories: restaurant.categories
        });
        
        const restaurantElement = document.createElement('div');
        restaurantElement.className = 'list-group-item list-group-item-action';
        restaurantElement.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <div>
                    <h5 class="mb-1">${restaurant.name}</h5>
                    <p class="mb-1 text-muted">${restaurant.location?.display_address?.join(', ') || 'Address not available'}</p>
                    <div class="d-flex gap-3">
                        <small class="text-warning">⭐ ${restaurant.rating || 'N/A'}</small>
                        <small class="text-success">${restaurant.price || ''}</small>
                        ${restaurant.categories ? `<small class="text-info">${restaurant.categories.map(cat => cat.title).slice(0,2).join(', ')}</small>` : ''}
                    </div>
                </div>
                <div class="text-end">
                    <i class="material-icons text-muted">arrow_forward_ios</i>
                </div>
            </div>
        `;
        
        restaurantElement.addEventListener('click', () => {
            console.log('🖱️ Restaurant clicked:', restaurant.name);
            showRestaurantDetails(restaurant);
        });
        
        restaurantsList.appendChild(restaurantElement);
    });
    
    restaurantResults.style.display = 'block';
    
    console.log('✅ Restaurants list display completed');
}

// Show no results message
function showNoResults() {
    const noResults = document.getElementById('noResults');
    const restaurantResults = document.getElementById('restaurantResults');
    
    restaurantResults.style.display = 'none';
    noResults.style.display = 'block';
}

// Parse restaurant data from string (for onclick handlers)
function parseRestaurantData(restaurantStr) {
    try {
        return JSON.parse(restaurantStr.replace(/&quot;/g, '"'));
    } catch (e) {
        console.error('Error parsing restaurant data:', e);
        return null;
    }
}

async function showRestaurantDetails(restaurant) {
    console.log('🏪 Frontend: Showing restaurant details for:', restaurant.name);
    
    // Update sidebar with restaurant info
    const sidebar = document.getElementById('restaurantSidebar');
    const sidebarTitle = document.getElementById('sidebarRestaurantName');
    const sidebarInfo = document.getElementById('sidebarRestaurantInfo');
    const sidebarPhotos = document.getElementById('restaurantPhotos');
    const sidebarMenu = document.getElementById('sidebarMenuSection');
    
    if (!sidebar || !sidebarTitle || !sidebarInfo || !sidebarPhotos || !sidebarMenu) {
        console.error('❌ Frontend: Sidebar elements not found');
        return;
    }
    
    // Show sidebar and update title
    sidebar.style.display = 'block';
    sidebarTitle.textContent = restaurant.name;
    sidebarTitle.setAttribute('data-restaurant-id', restaurant.id);
    
    // Show loading state
    sidebarInfo.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div><div class="mt-2">Loading restaurant details...</div></div>';
    sidebarPhotos.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div><div class="mt-2">Loading photos...</div></div>';
    
    // Show the menu section and set loading state
    sidebarMenu.style.display = 'block';
    const menuItemsContainer = document.getElementById('sidebarMenuItems');
    if (menuItemsContainer) {
        menuItemsContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div><div class="mt-2">Loading menu...</div></div>';
    }
    
    try {
        // Fetch detailed restaurant information from Google Places Details API
        console.log('🌐 Frontend: Fetching restaurant details from API for ID:', restaurant.id);
        const response = await fetch(`/api/restaurants/${restaurant.id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const detailedRestaurant = await response.json();
        console.log('✅ Frontend: Received detailed restaurant data:', detailedRestaurant);
        
        // Display detailed restaurant info
        displayDetailedRestaurantInfo(detailedRestaurant, restaurant);
        
        // Display photos from Google Places
        displayRestaurantPhotos(detailedRestaurant);
        
        // Fetch and display real menu data
        await displayRestaurantMenu(restaurant);
        
    } catch (error) {
        console.error('❌ Frontend: Error fetching restaurant details:', error);
        
        // Fall back to basic info from search results
        const basicInfo = `
            <div class="alert alert-warning mb-3">
                <i class="material-icons me-2">warning</i>
                Could not load detailed information. Showing basic details.
            </div>
            <div class="mb-3">
                <div class="d-flex align-items-center mb-2">
                    <i class="material-icons text-warning me-1">star</i>
                    <span class="fw-bold">${restaurant.rating || 'N/A'}</span>
                    <span class="text-muted ms-1">(${restaurant.review_count || 0} reviews)</span>
                </div>
                ${restaurant.price ? `<div class="mb-2"><span class="fw-bold text-success">${restaurant.price}</span></div>` : ''}
                ${restaurant.categories && restaurant.categories.length > 0 ? 
                    `<div class="mb-2">${restaurant.categories.map(cat => `<span class="badge bg-secondary me-1">${cat.title}</span>`).join('')}</div>` : ''}
                ${restaurant.location && restaurant.location.display_address ? 
                    `<div class="text-muted"><i class="material-icons me-1" style="font-size: 16px;">location_on</i>${restaurant.location.display_address.join(', ')}</div>` : ''}
            </div>
        `;
        
        sidebarInfo.innerHTML = basicInfo;
        sidebarPhotos.innerHTML = '<div class="text-center py-3 text-muted"><i class="material-icons mb-2" style="font-size: 2rem;">no_photography</i><div>No photos available</div></div>';
        
        // Show menu section before loading menu
        const menuSection = document.getElementById('sidebarMenuSection');
        if (menuSection) {
            menuSection.style.display = 'block';
        }
        await displayRestaurantMenu(restaurant);
    }
}

// Display detailed restaurant information from Google Places API
function displayDetailedRestaurantInfo(detailedRestaurant, fallbackRestaurant) {
    const sidebarInfo = document.getElementById('sidebarRestaurantInfo');
    
    try {
        // Extract information from Google Places API response
        const name = detailedRestaurant.displayName?.text || fallbackRestaurant.name;
        const rating = detailedRestaurant.rating || fallbackRestaurant.rating;
        const userRatingCount = detailedRestaurant.userRatingCount || fallbackRestaurant.review_count;
        const priceLevel = detailedRestaurant.priceLevel;
        const address = detailedRestaurant.formattedAddress || (fallbackRestaurant.location?.display_address?.join(', '));
        const phone = detailedRestaurant.nationalPhoneNumber;
        const website = detailedRestaurant.websiteUri;
        const businessStatus = detailedRestaurant.businessStatus;
        const types = detailedRestaurant.types || [];
        const openingHours = detailedRestaurant.regularOpeningHours?.weekdayDescriptions;
        const reviews = detailedRestaurant.reviews || [];
        
        // Build price display
        let priceDisplay = '';
        if (priceLevel && priceLevel > 0) {
            priceDisplay = '$'.repeat(Math.min(priceLevel, 4));
        } else if (fallbackRestaurant.price) {
            priceDisplay = fallbackRestaurant.price;
        }
        
        // Build categories from types
        const categories = types
            .filter(type => type !== 'establishment' && type !== 'point_of_interest')
            .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
            .slice(0, 5); // Limit to 5 categories
        
        // Build the detailed info HTML
        let detailedInfo = `
            <div class="mb-3">
                <div class="d-flex align-items-center mb-2">
                    <i class="material-icons text-warning me-1">star</i>
                    <span class="fw-bold">${rating || 'N/A'}</span>
                    <span class="text-muted ms-1">(${userRatingCount || 0} reviews)</span>
                </div>
                ${priceDisplay ? `<div class="mb-2"><span class="fw-bold text-success">${priceDisplay}</span></div>` : ''}
                ${categories.length > 0 ? 
                    `<div class="mb-2">${categories.map(cat => `<span class="badge bg-secondary me-1">${cat}</span>`).join('')}</div>` : ''}
                ${businessStatus && businessStatus !== 'OPERATIONAL' ? 
                    `<div class="mb-2"><span class="badge bg-warning text-dark">${businessStatus.replace(/_/g, ' ')}</span></div>` : ''}
            </div>
        `;
        
        // Add contact information
        if (address || phone || website) {
            detailedInfo += '<div class="mb-3">';
            if (address) {
                detailedInfo += `<div class="mb-1"><i class="material-icons me-2" style="font-size: 16px;">location_on</i>${address}</div>`;
            }
            if (phone) {
                detailedInfo += `<div class="mb-1"><i class="material-icons me-2" style="font-size: 16px;">phone</i><a href="tel:${phone}" class="text-decoration-none">${phone}</a></div>`;
            }
            if (website) {
                detailedInfo += `<div class="mb-1"><i class="material-icons me-2" style="font-size: 16px;">language</i><a href="${website}" target="_blank" class="text-decoration-none">Visit Website</a></div>`;
            }
            detailedInfo += '</div>';
        }
        
        // Add opening hours
        if (openingHours && openingHours.length > 0) {
            detailedInfo += `
                <div class="mb-3">
                    <h6 class="fw-bold mb-2"><i class="material-icons me-1" style="font-size: 16px;">schedule</i>Hours</h6>
                    <div class="small">
                        ${openingHours.slice(0, 7).map(hour => `<div>${hour}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        // Add recent reviews
        if (reviews && reviews.length > 0) {
            detailedInfo += `
                <div class="mb-3">
                    <h6 class="fw-bold mb-2"><i class="material-icons me-1" style="font-size: 16px;">rate_review</i>Recent Reviews</h6>
                    ${reviews.slice(0, 2).map(review => `
                        <div class="border-start border-3 border-light ps-3 mb-2">
                            <div class="d-flex align-items-center mb-1">
                                <div class="text-warning me-2">${'★'.repeat(review.rating || 0)}${'☆'.repeat(5 - (review.rating || 0))}</div>
                                <small class="text-muted">${review.authorAttribution?.displayName || 'Anonymous'}</small>
                            </div>
                            <div class="small">${(review.text?.text || '').substring(0, 150)}${(review.text?.text || '').length > 150 ? '...' : ''}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        sidebarInfo.innerHTML = detailedInfo;
        
    } catch (error) {
        console.error('❌ Frontend: Error displaying detailed restaurant info:', error);
        sidebarInfo.innerHTML = `
            <div class="alert alert-danger">
                <i class="material-icons me-2">error</i>
                Error displaying restaurant details
            </div>
        `;
    }
}

// Display restaurant photos from Google Places API
function displayRestaurantPhotos(detailedRestaurant) {
    const sidebarPhotos = document.getElementById('restaurantPhotos');
    
    try {
        const photos = detailedRestaurant.photos || [];
        
        if (photos.length === 0) {
            sidebarPhotos.innerHTML = `
                <div class="text-center py-3 text-muted">
                    <i class="material-icons mb-2" style="font-size: 2rem;">no_photography</i>
                    <div>No photos available</div>
                </div>
            `;
            return;
        }
        
        // Display up to 6 photos in a grid
        const photosToShow = photos.slice(0, 6);
        let photosHtml = '<div class="row g-2">';
        
        photosToShow.forEach((photo, index) => {
            const photoName = photo.name;
            // Use backend route for photos to handle API key properly
            const photoUrl = `/api/restaurants/photos/${encodeURIComponent(photoName)}?maxWidth=400&maxHeight=300`;
            
            photosHtml += `
                <div class="col-6">
                    <div class="position-relative">
                        <img src="${photoUrl}" 
                             class="img-fluid rounded" 
                             style="width: 100%; height: 120px; object-fit: cover; cursor: pointer;"
                             onclick="showPhotoModal('${photoUrl}')"
                             onerror="this.parentElement.innerHTML='<div class=\\'d-flex align-items-center justify-content-center bg-light rounded\\' style=\\'height: 120px;\\'><i class=\\'material-icons text-muted\\'>broken_image</i></div>'"
                             alt="Restaurant photo ${index + 1}">
                    </div>
                </div>
            `;
        });
        
        photosHtml += '</div>';
        
        if (photos.length > 6) {
            photosHtml += `<div class="text-center mt-2"><small class="text-muted">+${photos.length - 6} more photos</small></div>`;
        }
        
        sidebarPhotos.innerHTML = photosHtml;
        
    } catch (error) {
        console.error('❌ Frontend: Error displaying restaurant photos:', error);
        sidebarPhotos.innerHTML = `
            <div class="alert alert-warning">
                <i class="material-icons me-2">warning</i>
                Could not load photos
            </div>
        `;
    }
}

// Show photo in modal (simple implementation)
function showPhotoModal(photoUrl) {
    // Create a simple modal to show the full-size photo
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Restaurant Photo</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="${photoUrl}" class="img-fluid" alt="Restaurant photo">
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

// Display restaurant menu from API
async function displayRestaurantMenu(restaurant) {
    // First show the menu section
    const menuSection = document.getElementById('sidebarMenuSection');
    if (menuSection) {
        menuSection.style.display = 'block';
    }
    
    const sidebarMenu = document.getElementById('sidebarMenuItems');
    
    if (!sidebarMenu) {
        console.error('❌ Frontend: sidebarMenuItems element not found');
        return;
    }
    
    // Show loading state
    sidebarMenu.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div><div class="mt-2">Loading menu...</div></div>';
    
    try {
        console.log('🍽️ Frontend: Fetching menu for restaurant ID:', restaurant.id);
        const response = await fetch(`/api/restaurants/${restaurant.id}/menu`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const menuData = await response.json();
        console.log('✅ Frontend: Received menu data:', menuData);
        
        // Display the menu
        displayMenuData(menuData, restaurant);
        
    } catch (error) {
        console.error('❌ Frontend: Error fetching menu:', error);
        
        // Fallback to sample menu
        displaySampleMenu(restaurant);
    }
}

// Display menu data with categories and items
function displayMenuData(menuData, restaurant) {
    const sidebarMenu = document.getElementById('sidebarMenuItems');
    
    let menuHtml = `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="fw-bold mb-0">
                    <i class="material-icons me-1" style="font-size: 16px;">restaurant_menu</i>
                    ${menuData.menuType === 'ai-generated' ? '🤖 AI-Generated' : menuData.menuType.charAt(0).toUpperCase() + menuData.menuType.slice(1)} Menu
                </h6>
                <small class="text-muted">Updated: ${new Date(menuData.lastUpdated).toLocaleDateString()}</small>
            </div>
            ${menuData.source === 'cohere-reviews' ? 
                `<div class="alert alert-info py-2 mb-3">
                    <i class="material-icons me-1" style="font-size: 14px;">auto_awesome</i>
                    <small>Menu generated from ${menuData.reviewsAnalyzed} customer reviews using AI</small>
                </div>` : 
                '<p class="small text-muted mb-3">Rate these items to help us understand your taste preferences!</p>'
            }
        </div>
    `;
    
    // Display each menu category
    for (const [categoryName, items] of Object.entries(menuData.menu)) {
        menuHtml += `
            <div class="mb-4">
                <h6 class="fw-bold text-primary mb-3">${categoryName}</h6>
        `;
        
        items.forEach((item, index) => {
            const unavailableClass = !item.available ? 'opacity-50' : '';
            const popularBadge = item.popular ? '<span class="badge bg-warning text-dark ms-2">Popular</span>' : '';
            const recommendedBadge = item.recommended ? '<span class="badge bg-success ms-2">⭐ Recommended</span>' : '';
            const spicyBadge = item.spicy ? '<span class="badge bg-danger ms-2">🌶️ Spicy</span>' : '';
            
            menuHtml += `
                <div class="card mb-2 ${unavailableClass}">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center flex-wrap">
                                    <h6 class="mb-1 me-2">${item.name}</h6>
                                    ${popularBadge}
                                    ${recommendedBadge}
                                    ${spicyBadge}
                                </div>
                                <p class="text-muted small mb-2">${item.description}</p>
                                ${!item.available ? '<small class="text-danger">Currently unavailable</small>' : ''}
                            </div>
                            <div class="btn-group btn-group-sm ms-3" role="group">
                                <button type="button" 
                                        class="btn btn-outline-success like-btn" 
                                        data-item="${item.name}" 
                                        data-action="like"
                                        onclick="rateMenuItem('${item.name}', 'like', this)"
                                        ${!item.available ? 'disabled' : ''}>
                                    <i class="material-icons" style="font-size: 16px;">thumb_up</i>
                                </button>
                                <button type="button" 
                                        class="btn btn-outline-danger dislike-btn" 
                                        data-item="${item.name}" 
                                        data-action="dislike"
                                        onclick="rateMenuItem('${item.name}', 'dislike', this)"
                                        ${!item.available ? 'disabled' : ''}>
                                    <i class="material-icons" style="font-size: 16px;">thumb_down</i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        menuHtml += '</div>';
    }
    
    // Add save preferences button
    menuHtml += `
        <div class="mt-4 pt-3 border-top text-center">
            <button class="btn btn-primary btn-lg" onclick="saveUserPreferences('${restaurant.id}', '${restaurant.name}')">
                <i class="material-icons me-2" style="font-size: 18px;">save</i>
                Save My Taste Preferences
            </button>
            <p class="small text-muted mt-2">Rate items above to find dining companions with similar tastes!</p>
        </div>
    `;
    
    sidebarMenu.innerHTML = menuHtml;
}

// Display sample menu items based on restaurant category with like/dislike buttons (fallback)
function displaySampleMenu(restaurant) {
    // First show the menu section
    const menuSection = document.getElementById('sidebarMenuSection');
    if (menuSection) {
        menuSection.style.display = 'block';
    }
    
    const sidebarMenu = document.getElementById('sidebarMenuItems');
    
    if (!sidebarMenu) {
        console.error('❌ Frontend: sidebarMenuItems element not found');
        return;
    }
    const categories = restaurant.categories ? restaurant.categories.map(cat => cat.title.toLowerCase()) : [];
    
    let sampleItems = [];
    
    // Generate menu items based on restaurant type
    if (categories.some(cat => cat.includes('italian'))) {
        sampleItems = ['Margherita Pizza', 'Spaghetti Carbonara', 'Chicken Parmigiana', 'Caesar Salad', 'Tiramisu'];
    } else if (categories.some(cat => cat.includes('chinese'))) {
        sampleItems = ['Kung Pao Chicken', 'Sweet and Sour Pork', 'Fried Rice', 'Spring Rolls', 'Peking Duck'];
    } else if (categories.some(cat => cat.includes('mexican'))) {
        sampleItems = ['Chicken Tacos', 'Beef Burrito', 'Guacamole', 'Quesadillas', 'Churros'];
    } else if (categories.some(cat => cat.includes('japanese'))) {
        sampleItems = ['Salmon Sashimi', 'Chicken Teriyaki', 'Miso Soup', 'California Roll', 'Tempura'];
    } else if (categories.some(cat => cat.includes('indian'))) {
        sampleItems = ['Chicken Tikka Masala', 'Biryani', 'Naan Bread', 'Samosas', 'Mango Lassi'];
    } else if (categories.some(cat => cat.includes('american') || cat.includes('burger'))) {
        sampleItems = ['Classic Burger', 'Buffalo Wings', 'Mac and Cheese', 'BBQ Ribs', 'Apple Pie'];
    } else {
        sampleItems = ['House Special', 'Chef\'s Recommendation', 'Seasonal Salad', 'Grilled Chicken', 'Chocolate Dessert'];
    }
    
    // Build menu HTML with like/dislike buttons
    let menuHtml = '';
    
    sampleItems.forEach((item, index) => {
        menuHtml += `
            <div class="d-flex align-items-center justify-content-between mb-2 p-2 border rounded">
                <span class="fw-medium">${item}</span>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" 
                            class="btn btn-outline-success like-btn" 
                            data-item="${item}" 
                            data-action="like"
                            onclick="rateMenuItem('${item}', 'like', this)">
                        <i class="material-icons" style="font-size: 16px;">thumb_up</i>
                    </button>
                    <button type="button" 
                            class="btn btn-outline-danger dislike-btn" 
                            data-item="${item}" 
                            data-action="dislike"
                            onclick="rateMenuItem('${item}', 'dislike', this)">
                        <i class="material-icons" style="font-size: 16px;">thumb_down</i>
                    </button>
                </div>
            </div>
        `;
    });
    
    // Add save preferences button
    menuHtml += `
        <div class="mt-3 text-center">
            <button class="btn btn-primary" onclick="saveUserPreferences('${restaurant.id}', '${restaurant.name}')">
                <i class="material-icons me-1" style="font-size: 16px;">save</i>
                Save My Preferences
            </button>
        </div>
    `;
    
    sidebarMenu.innerHTML = menuHtml;
}

// Track user preferences for menu items
let userTasteProfile = {
    likes: [],
    dislikes: []
};

// Rate menu item (like or dislike)
window.rateMenuItem = async function(item, action, buttonElement) {
    console.log(`🍽️ Frontend: User ${action}d "${item}"`);
    
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
        alert('Please sign in to rate menu items');
        return;
    }
    
    // Get current restaurant info
    const currentRestaurant = getCurrentRestaurant();
    if (!currentRestaurant) {
        console.error('No restaurant selected');
        return;
    }
    
    // Get the other button in the same group
    const buttonGroup = buttonElement.parentElement;
    const likeBtn = buttonGroup.querySelector('.like-btn');
    const dislikeBtn = buttonGroup.querySelector('.dislike-btn');
    
    // Remove item from both arrays first
    userTasteProfile.likes = userTasteProfile.likes.filter(i => i !== item);
    userTasteProfile.dislikes = userTasteProfile.dislikes.filter(i => i !== item);
    
    // Reset button states
    likeBtn.classList.remove('btn-success');
    likeBtn.classList.add('btn-outline-success');
    dislikeBtn.classList.remove('btn-danger');
    dislikeBtn.classList.add('btn-outline-danger');
    
    // Add to appropriate array and update button state
    if (action === 'like') {
        userTasteProfile.likes.push(item);
        likeBtn.classList.remove('btn-outline-success');
        likeBtn.classList.add('btn-success');
    } else if (action === 'dislike') {
        userTasteProfile.dislikes.push(item);
        dislikeBtn.classList.remove('btn-outline-danger');
        dislikeBtn.classList.add('btn-danger');
    }
    
    console.log('👤 Frontend: Updated taste profile:', userTasteProfile);
    
    // Auto-save preferences to backend
    await saveUserPreferencesAuto(currentRestaurant.id, currentRestaurant.displayName);
}

// Get current restaurant from the sidebar
function getCurrentRestaurant() {
    const restaurantName = document.getElementById('sidebarRestaurantName');
    const restaurantId = restaurantName ? restaurantName.getAttribute('data-restaurant-id') : null;
    const displayName = restaurantName ? restaurantName.textContent : null;
    
    if (restaurantId && displayName) {
        return { id: restaurantId, displayName: displayName };
    }
    return null;
}

// Auto-save user preferences (called automatically when rating items)
async function saveUserPreferencesAuto(restaurantId, restaurantName) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        console.log('💾 Frontend: Auto-saving preferences...', {
            likes: userTasteProfile.likes.length,
            dislikes: userTasteProfile.dislikes.length
        });
        
        const response = await fetch('/api/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.uid,
                restaurantId: restaurantId,
                restaurantName: restaurantName,
                likes: userTasteProfile.likes,
                dislikes: userTasteProfile.dislikes
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Frontend: Preferences auto-saved successfully');
            
            // Show subtle feedback
            showToast('Preferences updated!', 'success');
        } else {
            console.error('❌ Frontend: Failed to auto-save preferences');
        }
    } catch (error) {
        console.error('💥 Frontend: Error auto-saving preferences:', error);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create toast element if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 2000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Save user preferences to backend
async function saveUserPreferences(restaurantId, restaurantName) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please sign in to save preferences');
        return;
    }
    
    const allSelectedItems = [...userTasteProfile.likes, ...userTasteProfile.dislikes];
    
    if (allSelectedItems.length === 0) {
        alert('Please rate at least one menu item before saving preferences');
        return;
    }
    
    try {
        console.log('💾 Frontend: Saving user preferences...');
        
        const response = await fetch('/api/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                restaurantId: restaurantId,
                restaurantName: restaurantName,
                selectedItems: allSelectedItems,
                tasteProfile: userTasteProfile
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Frontend: Preferences saved successfully:', result);
        
        // Show success message and potential matches
        if (result.matches && result.matches.length > 0) {
            showMatchesModal(result.matches);
        } else {
            alert(`Preferences saved! You've rated ${allSelectedItems.length} items.`);
        }
        
    } catch (error) {
        console.error('❌ Frontend: Error saving preferences:', error);
        alert('Failed to save preferences. Please try again.');
    }
}

// Legacy function - now handled by saveUserPreferences
async function submitPreferences() {
    console.log('⚠️ Frontend: submitPreferences is deprecated, use saveUserPreferences instead');
}

// Show matches modal
function showMatchesModal(matches) {
    const modal = new bootstrap.Modal(document.getElementById('matchesModal'));
    const matchesContent = document.getElementById('matchesContent');
    
    if (matches.length === 0) {
        matchesContent.innerHTML = `
            <div class="text-center py-4">
                <i class="material-icons text-muted mb-3" style="font-size: 3rem;">person_search</i>
                <h5>No matches found</h5>
                <p class="text-muted">Be the first to try this combination! Your preferences have been saved and others with similar tastes will be able to find you.</p>
            </div>
        `;
    } else {
        matchesContent.innerHTML = `
            <div class="mb-3">
                <h6 class="text-success">Found ${matches.length} dining companion${matches.length > 1 ? 's' : ''} with similar tastes!</h6>
            </div>
            <div class="row">
                ${matches.map(match => `
                    <div class="col-12 mb-3">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">${match.userName}</h6>
                                <p class="card-text mb-2"><strong>Restaurant:</strong> ${match.restaurantName}</p>
                                <p class="card-text mb-2"><strong>Selected Items:</strong> ${match.selectedItems.join(', ')}</p>
                                <small class="text-muted">${new Date(match.timestamp).toLocaleString()}</small>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    modal.show();
}

// Show loading state
function showLoading(show) {
    const loadingSection = document.getElementById('loadingSection');
    const restaurantResults = document.getElementById('restaurantResults');
    const noResults = document.getElementById('noResults');
    
    if (show) {
        loadingSection.style.display = 'block';
        restaurantResults.style.display = 'none';
        noResults.style.display = 'none';
    } else {
        loadingSection.style.display = 'none';
    }
}

// Initialize the application (moved to line 18)

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, setting up event listeners');
    
    // Initialize the application
    initApp();
});

function setupEventListeners() {
    console.log('🔧 Setting up event listeners');
    
    // Current location button
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    if (currentLocationBtn) {
        console.log('✅ Found current location button');
        currentLocationBtn.addEventListener('click', async () => {
        console.log('🖱️ Current location button clicked');
        
        if (!isAuthenticated()) {
            alert('Please sign in to use location services.');
            return;
        }
        
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }
        
        showLoading(true);
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                console.log('📍 Location obtained:', position.coords);
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                currentLocation = userLocation;
                
                // Update location input to show coordinates
                const locationInput = document.getElementById('locationInput');
                if (locationInput) {
                    locationInput.value = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
                }
                
                // Search for restaurants
                await searchRestaurants(userLocation.lat, userLocation.lng);
            },
            (error) => {
                console.error('❌ Geolocation error:', error);
                showLoading(false);
                
                let errorMessage = 'Unable to get your location. ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location access was denied. Please enable location permissions.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out.';
                        break;
                    default:
                        errorMessage += 'Please enter your location manually.';
                        break;
                }
                alert(errorMessage);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
        });
    } else {
        console.log('❌ Current location button not found');
    }
    
    // Manual location search (Enter key on location input)
    const locationInput = document.getElementById('locationInput');
    if (locationInput) {
        locationInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                if (!isAuthenticated()) {
                    alert('Please sign in to search for restaurants.');
                    return;
                }
                
                const location = locationInput.value.trim();
                
                if (location) {
                    // Try to parse coordinates
                    const coords = location.split(',');
                    if (coords.length === 2) {
                        const lat = parseFloat(coords[0].trim());
                        const lng = parseFloat(coords[1].trim());
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            await searchRestaurants(lat, lng);
                            return;
                        }
                    }
                    
                    // If not coordinates, treat as address (for demo, use SF)
                    alert('For demo purposes, using San Francisco coordinates. In production, this would geocode the address.');
                    await searchRestaurants(37.7749, -122.4194);
                } else {
                    alert('Please enter a location or use current location.');
                }
            }
        });
    }
    
    // Distance select change
    const distanceSelect = document.getElementById('distanceSelect');
    if (distanceSelect) {
        distanceSelect.addEventListener('change', () => {
            if (currentLocation) {
                searchRestaurants(currentLocation.lat, currentLocation.lng);
            } else {
                // For demo purposes, search in San Francisco
                searchRestaurants(37.7749, -122.4194);
            }
        });
    }
    
    // Close sidebar button
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('restaurantSidebar');
            if (sidebar) {
                sidebar.style.display = 'none';
            }
        });
    }
}

// Test function to debug current location
window.testCurrentLocation = function() {
    console.log('🧪 Testing current location functionality');
    console.log('🔐 Is authenticated:', isAuthenticated());
    console.log('🌍 Geolocation available:', !!navigator.geolocation);
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ Location success:', position.coords);
                alert(`Location: ${position.coords.latitude}, ${position.coords.longitude}`);
            },
            (error) => {
                console.error('❌ Location error:', error);
                alert(`Location error: ${error.message}`);
            }
        );
    }
};
