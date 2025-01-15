const express = require('express');

const router = express.Router();


router.get('/register', (req, res) => {
    res.render('register');
});

router.get('/login', (req, res) => {
    res.render('login');
});


router.get('/reviews', (req, res) => {
    res.render('reviews');
});


router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
  });


module.exports = router; 