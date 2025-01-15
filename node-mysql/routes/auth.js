const express = require('express');
const authController = require('../controllers/auth');
const logoutController = require('../controllers/auth');
const router = express.Router();
const mysql = require("mysql");
const axios = require('axios');


const app = express();

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'jbje7Vc91jmXA8Ft',
    database: 'movie_goers'
});

// Simplified routes with no restrictions for account creation

// Register route (open to everyone)
router.post('/register', authController.register);

// Login route (after registration)
router.post('/login', authController.login, (req, res) => {
    res.redirect('/index');  // Assuming login redirects to the main page
});

// Logout route
router.post("/logout", logoutController.logout);

// Routes related to transactions (optional for account creation)

// Route for the dashboard or home page (Index)
const tmdb = require('../tmdb'); // Import TMDb helper




router.get("/index", (req, res) => {
    const userQuery = "SELECT username, bio, favorite_genres FROM users WHERE username = ?";
    const username = req.session.username;

    if (!username) {
        return res.redirect("/login"); // Redirect to login if the user is not authenticated
    }

    db.query(userQuery, [username], (userErr, userResult) => {
        if (userErr) {
            console.error("Error retrieving user details:", userErr);
            return res.status(500).json({ message: "An error occurred while retrieving user details" });
        }

        if (userResult.length === 0) {
            console.log("No user details found");
            return res.send("No user details found");
        }

        const userDetails = userResult[0];

        tmdb.get('/movie/popular')
    .then(movieResponse => {
        const popularMovies = movieResponse.data.results;
        console.log("Popular Movies (with IDs):", popularMovies.map(movie => ({ id: movie.id, title: movie.title })));
        res.render("index", { userDetails, popularMovies });
    })
    .catch(movieErr => {
        console.error("Error fetching popular movies:", movieErr);
        res.status(500).json({ message: "An error occurred while fetching popular movies" });
    });


    });
});

// Route to add movie to watchlist
router.post('/add-to-watchlist', (req, res) => {
    const movieId = parseInt(req.body.movie_id, 10);  // Convert to integer
    const userId = req.session.user_id;

    if (!userId) {
        return res.redirect('/login'); // If user is not logged in, redirect to login
    }

    console.log(`Adding movie with ID ${movieId} to user ${userId}'s watchlist`);

    // Check if the movie exists in the movies table
    const movieCheckQuery = 'SELECT * FROM movies WHERE movie_id = ?';
    db.query(movieCheckQuery, [movieId], (error, results) => {
        if (error) {
            console.error('Error checking movie:', error);
            return res.status(500).json({ message: 'Error checking movie.' });
        }

        if (results.length === 0) {
            // Movie does not exist, fetch it from TMDb
            console.log('Movie not found in database, fetching from TMDb...');

            const tmdbAPIKey = 'bc393d56becce6f083b6447e4af26f21';  // Your TMDb API key
            const tmdbURL = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbAPIKey}&language=en-US`;

            // Fetch movie details from TMDb API
            axios.get(tmdbURL)
                .then(tmdbResponse => {
                    const movieData = tmdbResponse.data;

                    // Insert the movie into the movies table
                    const insertMovieQuery = 'INSERT INTO movies (movie_id, title, release_date, genre, poster_url, description, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    const movieDetails = {
                        movie_id: movieId,
                        title: movieData.title,
                        release_date: movieData.release_date,
                        genre: movieData.genres.map(genre => genre.name).join(', '),
                        poster_url: `https://image.tmdb.org/t/p/w500${movieData.poster_path}`,
                        description: movieData.overview,
                        tmdb_id: movieData.id
                    };

                    db.query(insertMovieQuery, Object.values(movieDetails), (insertError) => {
                        if (insertError) {
                            console.error('Error inserting movie:', insertError);
                            return res.status(500).json({ message: 'Failed to insert movie.' });
                        }

                        // After inserting the movie, add it to the watchlist
                        addToWatchlist(userId, movieId, res);
                    });
                })
                .catch(tmdbError => {
                    console.error('Error fetching from TMDb:', tmdbError);
                    return res.status(500).json({ message: 'Failed to fetch movie from TMDb.' });
                });
        } else {
            // Movie exists, directly add it to the watchlist
            addToWatchlist(userId, movieId, res);
        }
    });
});

// Function to add movie to watchlist
function addToWatchlist(userId, movieId, res) {
    const query = 'INSERT INTO watchlists (user_id, movie_id, added_at) VALUES (?, ?, NOW())';
    db.query(query, [userId, movieId], (watchlistError, results) => {
        if (watchlistError) {
            console.error('Error adding to watchlist:', watchlistError);
            return res.status(500).json({ message: 'Failed to add movie to watchlist.' });
        }

        console.log('Movie added to watchlist successfully:', results);
        res.redirect('/auth/index'); // Redirect to home page after adding
    });
}


// Route to show user's watchlist
router.get('/cards', (req, res) => {
    const userId = req.session.user_id;

    // If user is not logged in, redirect to login
    if (!userId) {
        return res.redirect('/login');
    }

    // Query to get movies in the user's watchlist
    const query = `SELECT movies.* 
                   FROM watchlists 
                   JOIN movies ON watchlists.movie_id = movies.movie_id 
                   WHERE watchlists.user_id = ?`;

    db.query(query, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching watchlist:', error);
            return res.status(500).json({ message: 'Failed to fetch watchlist.' });
        }

        // Render the watchlist page with the fetched movies
        res.render('watchlist', { movies: results });
    });
});
// Route to add or update a rating for a movie
router.post('/add-rating', (req, res) => {
    const userId = req.session.user_id;  // Get the logged-in user's ID
    const movieId = req.body.movie_id;   // Get the movie ID
    const rating = req.body.rating;      // Get the rating from the form
    const reviewText = req.body.review_text || ''; // Optional review text

    if (!userId) {
        return res.redirect('/login');  // Redirect to login if user is not logged in
    }

    // Check if the user has already rated this movie
    const checkQuery = 'SELECT * FROM reviews WHERE user_id = ? AND movie_id = ?';
    db.query(checkQuery, [userId, movieId], (checkError, results) => {
        if (checkError) {
            console.error('Error checking existing rating:', checkError);
            return res.status(500).json({ message: 'Error checking existing rating.' });
        }

        if (results.length > 0) {
            // If the user has already rated this movie, update the rating
            const updateQuery = 'UPDATE reviews SET rating = ?, review_text = ?, created_at = NOW() WHERE user_id = ? AND movie_id = ?';
            db.query(updateQuery, [rating, reviewText, userId, movieId], (updateError) => {
                if (updateError) {
                    console.error('Error updating rating:', updateError);
                    return res.status(500).json({ message: 'Error updating rating.' });
                }

                res.redirect('/auth/index');  // Redirect back to homepage after updating
            });
        } else {
            // If the user has not rated this movie, insert a new rating
            const insertQuery = 'INSERT INTO reviews (user_id, movie_id, rating, review_text) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [userId, movieId, rating, reviewText], (insertError) => {
                if (insertError) {
                    console.error('Error inserting rating:', insertError);
                    return res.status(500).json({ message: 'Error adding rating.' });
                }

                res.redirect('/auth/index');  // Redirect back to homepage after adding
            });
        }
    });
});
// Route to display user's ratings
router.get('/ratings', (req, res) => {
    const userId = req.session.user_id;

    if (!userId) {
        return res.redirect('/login');  // Redirect to login if user is not logged in
    }

    // Query to fetch all ratings by the user
    const query = 'SELECT movies.title, reviews.rating, reviews.review_text, reviews.created_at FROM reviews JOIN movies ON reviews.movie_id = movies.movie_id WHERE reviews.user_id = ?';
    db.query(query, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching ratings:', error);
            return res.status(500).json({ message: 'Failed to fetch ratings.' });
        }

        // Render the ratings page with the fetched ratings
        res.render('ratings', { ratings: results });
    });
});

// Route to handle movie search
router.get('/search', (req, res) => {
    const query = req.query.query;

    if (!query) {
        return res.render('index', { message: 'Please enter a search query.' });
    }

    // Call TMDb API to search for movies
    const tmdbAPIKey = 'bc393d56becce6f083b6447e4af26f21';  // Your TMDb API key
    const tmdbURL = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbAPIKey}&query=${query}`;

    axios.get(tmdbURL)
        .then(response => {
            const movies = response.data.results;

            if (movies.length === 0) {
                return res.render('searchResults', { message: 'No movies found.', query });
            }

            // Render the search results page with movie data
            res.render('searchResults', { movies, query });
        })
        .catch(error => {
            console.error('Error fetching from TMDb:', error);
            res.status(500).json({ message: 'Error fetching search results.' });
        });
});

// Route to handle individual movie details
router.get('/movies/:id', (req, res) => {
    const movieId = req.params.id; // Extract movie ID from the URL

    // Fetch movie details from TMDb API
    tmdb.get(`/movie/${movieId}`)
        .then(response => {
            const movie = response.data;

            // Render a details page and pass the movie data
            res.render('movieDetails', { movie });
        })
        .catch(error => {
            console.error('Error fetching movie details:', error);
            res.status(500).send('Unable to fetch movie details.');
        });
});


module.exports = router;
