const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');

const {User} = require('./models');

const router = express.Router();

const jsonParser = bodyParser.json();

//POST Router
router.post('/', jsonParser, (req, res) => {
    const requiredFields = ['email', 'password', 'firstName', 'lastName', 'dob'];
    const missingField = requiredFields.find(field => !(field in req.body));

    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        });
    }

    const stringFields = ['email', 'password', 'firstName', 'lastName'];
    const nonStringField = stringFields.find(
        field => field in req.body && typeof req.body[field] !== 'string'
    );

    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Incorrect field type: expected string',
            location: nonStringField
        });
    }

    // If the email and password aren't trimmed we give an error.  Users might
    // expect that these will work without trimming (i.e. they want the password
    // "foobar ", including the space at the end).  We need to reject such values
    // explicitly so the users know what's happening, rather than silently
    // trimming them and expecting the user to understand.
    // We'll silently trim the other fields, because they aren't credentials used
    // to log in, so it's less of a problem.
    const explicityTrimmedFields = ['email', 'password'];
    const nonTrimmedField = explicityTrimmedFields.find(
        field => req.body[field].trim() !== req.body[field]
    );

    if (nonTrimmedField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Cannot start or end with whitespace',
            location: nonTrimmedField
        });
    }

    const sizedFields = {
        email: {
            min: 1
        },
        password: {
            min: 8,
            // bcrypt truncates after 72 characters, so let's not give the illusion
            // of security by storing extra (unused) info
            max: 72
        }
    };
    const tooSmallField = Object.keys(sizedFields).find(
        field =>
            'min' in sizedFields[field] &&
            req.body[field].trim().length < sizedFields[field].min
    );
    const tooLargeField = Object.keys(sizedFields).find(
        field =>
            'max' in sizedFields[field] &&
            req.body[field].trim().length > sizedFields[field].max
    );

    if (tooSmallField || tooLargeField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: tooSmallField
                ? `Password must be at least ${sizedFields[tooSmallField]
                      .min} characters long`
                : `Password must be at most ${sizedFields[tooLargeField]
                      .max} characters long`,
            location: tooSmallField || tooLargeField
        });
    }

    let {email, password, firstName, lastName, dob} = req.body;
    // email and password come in pre-trimmed, otherwise we throw an error
    // before this
    firstName = firstName.trim();
    lastName = lastName.trim();

    return User.find({email: email})
    .count()
    .then(count => {
        if (count > 0) {
                // There is an existing user with the same email
            return Promise.reject({
                    code: 422,
                    reason: 'ValidationError',
                    message: 'email already taken',
                    location: 'email'
            });
        }
        // If there is no existing user, hash the password
        return User.hashPassword(password);
    }).then(hash => {
        return User.create({
            email,
            password: hash,
            firstName,
            lastName,
            dob,
            merchant: req.body.merchant || false
        });
    }).then(user => {
        return res.status(201).json(user);
    }).catch(err => {
        // Forward validation errors on to the client, otherwise give a 500
        // error because something unexpected has happened
        if (err.reason === 'ValidationError') {
            return res.status(err.code).json(err);
        }
        res.status(500).json({code: 500, message: 'Internal server error'});
    });
});

//PUT Router (update user info)
router.put('/', passport.authenticate('jwt', {session: false}), (req, res) => {
  const allowedFields = ['email', 'firstName', 'lastName'];
  for (field in req.body) {
    if (!(allowedFields.includes(field))) {
        const message = `Invalid ${field} field in request body`;
        console.error(message);
        return res.status(400).send(message);
    };
  }

    User.findOneAndUpdate({_id: req.user.id},
      {$set: req.body}, {new: true})
    .then(user => res.status(201).json(user.apiRepr())
    ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update user'});
    });
});

//PUT Router (add deals to user)
router.put('/add/:id', passport.authenticate('jwt', {session: false}), (req, res) => {

    User.findById(req.user.id)
    .then(user => {

        let userDeals = user.deals.filter(deal => deal.toString() !== req.params.id);
        let deals = [...userDeals, req.params.id];

        return User.findOneAndUpdate({_id: req.user.id}, {$set: {deals: deals}}, {new: true})
    }).then(user => res.status(201).json(user.apiRepr())
    ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update deals'});
    });
});

//PUT Router (remove deals from user)
router.delete('/delete/:id', passport.authenticate('jwt', {session: false}), (req, res) => {

    User.findById(req.user.id)
    .then(user => {
        const deals = user.deals.filter(deal => deal.toString() !== req.params.id);

        const userDeletedDeals = user.deletedDeals.filter(deal => deal.toString() !== req.params.id);
        const deletedDeals = [...userDeletedDeals, req.params.id];

        return User.findOneAndUpdate({_id: req.user.id}, {$set: {deals: deals, deletedDeals: deletedDeals}}, {new: true})

    }).then(user => res.status(200).json(user.apiRepr())
    ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update deals'});
    });
});

//PUT Router (add deals to redeemed deals)
router.put('/redeem/:id', passport.authenticate('jwt', {session: false}), (req, res) => {

    User.findById(req.user.id)
    .then(user => {
        const deals = user.deals.filter(deal => deal.toString() !== req.params.id);

        const userRedeemedDeals = user.redeemedDeals.filter(deal => deal.toString() !== req.params.id);
        const redeemedDeals = [...userRedeemedDeals, req.params.id];

        return User.findOneAndUpdate({_id: req.user.id}, {$set: {deals: deals, redeemedDeals: redeemedDeals}}, {new: true})
    }).then(user => res.status(201).json(user.apiRepr())
    ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update redeemed deals'});
    });
});

//GET Router
router.get('/deals/', passport.authenticate('jwt', {session: false}), (req, res) => {
  User.findById(req.user.id).populate('deals')
  .then(user => res.json({deals: user.deals.map(deal => deal.apiPopulateRepr())}));
});



module.exports = {router};
