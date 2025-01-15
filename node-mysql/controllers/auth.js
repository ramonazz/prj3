const mysql = require("mysql");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'jbje7Vc91jmXA8Ft',
    database:'movie_goers'
});


function isPasswordValid(password) {
    // Password must contain at least 6 characters, including at least one uppercase letter, one lowercase letter, and one number.
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
    return passwordRegex.test(password);
}

exports.register = (req, res) => {
    console.log(req.body);

    const { username, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!username || !email || !password || !confirmPassword) {
        return res.render('register', {
            message: 'All fields are required.'
        });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
        return res.render('register', {
            message: 'Passwords do not match.'
        });
    }

    // Validate password strength
    if (!isPasswordValid(password)) {
        return res.render('register', {
            message: 'Password must contain at least 6 characters, including one uppercase letter, one lowercase letter, and one number.'
        });
    }

    // Check if email already exists
    db.query('SELECT email FROM users WHERE email = ?', [email], (error, results) => {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ message: 'An error occurred while checking email.' });
        }

        if (results.length > 0) {
            return res.render('register', {
                message: 'The email is already in use.'
            });
        }

        // Check if username is taken
        db.query('SELECT username FROM users WHERE username = ?', [username], (error, results) => {
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ message: 'An error occurred while checking username.' });
            }

            if (results.length > 0) {
                return res.render('register', {
                    message: 'The username is taken.'
                });
            }

            // Hash the password
            bcrypt.hash(password, 8, (err, hashedPassword) => {
                if (err) {
                    console.error('Hashing error:', err);
                    return res.status(500).json({ message: 'An error occurred while hashing the password.' });
                }

                // Insert the user into the database
                db.query('INSERT INTO users SET ?', {
                    username: username,
                    email: email,
                    password_hash: hashedPassword,
                    bio: null,
                    favorite_genres: null
                }, (error, results) => {
                    if (error) {
                        console.error('Insert error:', error);
                        return res.status(500).json({ message: 'An error occurred while saving the user.' });
                    }

                    // Redirect to login page with success message
                    return res.render('login', {
                        message: 'User registered successfully. Please log in.'
                    });
                });
            });
        });
    });
};

exports.login = (req, res) => {
    const { username, password } = req.body;

    // Query the database for the user
    db.query('SELECT user_id, username, password_hash FROM users WHERE username = ?', [username], (error, results) => {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ message: 'An error occurred while processing your request.' });
        }

        // Check if user exists
        if (results.length === 0) {
            return res.render('login', {
                message: 'Invalid credentials'
            });
        }

        const user = results[0];

        // Compare the provided password with the stored hashed password
        bcrypt.compare(password, user.password_hash, (err, isPasswordMatch) => {
            if (err) {
                console.error('Hashing error:', err);
                return res.status(500).json({ message: 'An error occurred while verifying the password.' });
            }

            if (!isPasswordMatch) {
                return res.render('login', {
                    message: 'Invalid credentials'
                });
            }

            // Store the user_id and username in the session
            req.session.user_id = user.user_id; // Store user_id in session
            req.session.username = user.username; // Store username in session
            console.log('Logged in user:', req.session.username);

            // Redirect to the index page after successful login
            res.redirect('/auth/index');
        });
    });
};


exports.logout = (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
      }
  
      res.redirect("/login");
    });
  };
    

