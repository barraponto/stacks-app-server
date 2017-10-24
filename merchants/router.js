const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');

const {Merchant} = require('./models');

const router = express.Router();

const jsonParser = bodyParser.json();

//NOTES
//For POST should we require JWT token?

//POST Router
router.post('/', jsonParser, (req, res) => {
    const requiredFields = ['name', 'type', 'logo', 'address', 'tel', 'lat', 'lng'];
    const missingField = requiredFields.find(field => !(field in req.body));

    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        });
    }

    Merchant.create({
        name: req.body.name,
        user: req.body.user,
        type: req.body.type, 
        logo: req.body.logo,
        address: req.body.address,
        tel: req.body.tel,
        lat: req.body.lat,
        lng: req.body.lng,
        publishedAt: Date.now()
    })
    .then(merchant => res.status(201).json(merchant.apiRepr()))
    .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Internal server error'});
    }); 
});

//GET Router
router.get('/', passport.authenticate('jwt', {session: false}), (req, res) => {
  Merchant.findOne({user: req.user.id})
  .then(merchant => res.status(201).json(merchant.apiRepr()))
  .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Internal server error'});
  }); 
});

//PUT Router
router.put('/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
  const allowedFields = ['name', 'type', 'logo', 'address', 'tel', 'lat', 'lng'];
  for (field in req.body) {
    if (!(allowedFields.includes(field))) {
        const message = `Invalid ${field} field in request body`;
        console.error(message);
        return res.status(400).send(message);
    };
  }

  Merchant.findOneAndUpdate({_id: req.params.id, user: req.user.id}, {$set: req.body}, {new: true})
  .then(merchant => res.status(201).json(merchant.apiRepr())
  ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update merchant'});
  });

});

module.exports = {router};