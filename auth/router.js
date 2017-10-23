const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const config = require('../config');

const createAuthToken = user => {
    return jwt.sign({user}, config.JWT_SECRET, {
        subject: user.email,
        expiresIn: config.JWT_EXPIRY,
        algorithm: 'HS256'
    });
};

const router = express.Router();

//POST Router
router.post('/login', (req, res, next) => {
    passport.authenticate('basic', function(err, user, info) {
        if (err) {next(err)}
        if (!user) {
            return res.status(401).json({message: 'Incorrect email or password'})
        }
        else {
            const authToken = createAuthToken(user.apiRepr());
            return res.status(200).json({authToken});
        };
    })(req, res, next);
});

module.exports = {router, createAuthToken};
