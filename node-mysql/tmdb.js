const axios = require('axios');

// TMDb Base URL
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// API Key from Environment Variables
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Axios instance for TMDb API
const tmdb = axios.create({
    baseURL: TMDB_BASE_URL,
    params: {
        api_key: TMDB_API_KEY, // Automatically include the API key in all requests
    },
});

module.exports = tmdb;
