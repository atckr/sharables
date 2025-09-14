# 🍽️ Social Diner - Restaurant Matching App

A social dining app that matches users based on their restaurant preferences and menu choices using AI-powered taste profiling.

## Features

- **Interactive Map**: Google Maps integration to search and explore restaurants by location
- **Restaurant Discovery**: Powered by Yelp API to find nearby restaurants with ratings and details
- **Menu Selection**: Interactive menu items based on restaurant categories
- **AI Matching**: Uses Cohere API to match users with similar taste profiles
- **Real-time Results**: Instant matching with similarity scores

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **APIs**: Google Maps, Yelp Fusion, Cohere AI
- **Styling**: Modern CSS with gradients and animations

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Get API Keys

You'll need to obtain API keys from:

- **Google Maps API**: [Google Cloud Console](https://console.cloud.google.com/)
  - Enable Maps JavaScript API and Places API
- **Yelp API**: [Yelp Developers](https://www.yelp.com/developers)
  - Create an app to get your API key
- **Cohere API**: [Cohere Dashboard](https://dashboard.cohere.ai/)
  - Sign up for a free account

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   YELP_API_KEY=your_yelp_api_key_here
   COHERE_API_KEY=your_cohere_api_key_here
   PORT=3000
   ```

### 4. Update Google Maps API Key in HTML

Edit `public/index.html` and replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API key:

```html
<script async defer 
    src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&libraries=places&callback=initMap">
</script>
```

### 5. Run the Application

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## How to Use

1. **Search Location**: Enter a dining location in the search box or allow location access
2. **Explore Restaurants**: Click on restaurant markers on the map to view details
3. **Select Menu Items**: Choose items you'd like to try from the sample menu
4. **Enter Your Name**: Provide a user ID/name for matching
5. **Find Matches**: Click "Find My Dining Matches!" to discover users with similar tastes
6. **View Results**: See your matches with similarity scores and their preferences

## API Endpoints

- `GET /api/restaurants?latitude=lat&longitude=lng` - Search restaurants by location
- `GET /api/restaurants/:id` - Get restaurant details
- `POST /api/preferences` - Submit user preferences and find matches
- `GET /api/matches/:userId` - Get matches for a specific user

## Project Structure

```
├── server.js              # Express server and API routes
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
├── README.md             # This file
└── public/
    ├── index.html        # Main HTML page
    ├── styles.css        # CSS styling
    └── app.js           # Frontend JavaScript
```

## Features in Detail

### Restaurant Search
- Uses Yelp Fusion API to find restaurants within a specified radius
- Displays restaurants on Google Maps with custom markers
- Shows ratings, reviews, and restaurant details

### Menu Generation
- Generates sample menu items based on restaurant categories
- Interactive selection with visual feedback
- Supports multiple cuisine types (Italian, Chinese, Mexican, etc.)

### AI-Powered Matching
- Uses Cohere's embedding API to analyze taste preferences
- Calculates cosine similarity between user preferences
- Returns matches with similarity scores above 70%

### User Experience
- Responsive design that works on desktop and mobile
- Modern UI with gradients and smooth animations
- Loading states and error handling
- Modal dialogs for results display

## Future Enhancements

- User authentication and profiles
- Real menu data integration (OpenMenu API)
- Chat functionality between matches
- Restaurant reservations integration
- Push notifications for new matches
- Social features (reviews, photos)
- Advanced filtering options

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes!

## Support

If you encounter any issues or have questions, please check the API documentation for the respective services or create an issue in the repository.
