const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const {Deal} = require('./models.js');
const {User} = require('../users/models.js');

const router = express.Router();

const jsonParser = bodyParser.json();

//GET Router (by deal id)
router.get('/:id', (req, res) => {
  Deal.findById(req.params.id).populate('merchant')
  .then(deal => res.status(201).json(deal.apiPopulateRepr()));
});

//GET Router (by deal id)
router.get('/merchant/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
  Deal.find({merchant: req.params.id})
  .then(deals => res.json({deals: deals.map((deal) => deal.apiRepr())}));
});

// GET Router
router.get('/', passport.authenticate('jwt', {session: false}), (req, res) => {

  //Checks that requests have valid keys
  Object.keys(req.query).map(key => {
    if (key !== 'type' && key !== 'lat' && key !== 'lng') {
        const message = 'Can only search by deal type';
        console.error(message);
        return res.status(400).send(message);
      };
    })

    let query = req.query.type.split(',');
    let lat = req.query.lat;
    let lng = req.query.lng;

    const deals = Deal.find().populate('merchant');
    const user = User.findById(req.user.id);
    Promise.all([deals, user])
    .then(([deals, user]) => {
      const myDeals = user.deals.map(deal => deal.toString());
      const redeemedDeals = user.redeemedDeals.map(deal => deal.toString());
      const resDeals = deals.filter(deal => 
        !(myDeals.includes(deal._id.toString())) 
        && !(redeemedDeals.includes(deal._id.toString())) 
        && query.includes(deal.merchant.type)
        && deal.active
      );

    if (lat !== undefined && lng !== undefined) {
      function sortByLocation(a, b) {
        if ((Math.abs(a.merchant.lat - lat) + Math.abs(a.merchant.lng - lng)) < (Math.abs(b.merchant.lat - lat) + Math.abs(b.merchant.lng - lng))) {
          return -1
        }
        else {return 1}
      };
      resDeals.sort(sortByLocation)
    };

    res.json({deals: resDeals.map((deal) => deal.apiPopulateRepr())});
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Internal server error'});
    });
});

//POST Router
router.post('/', passport.authenticate('jwt', {session: false}), (req, res) => {
  //Checks that required fields are submitted
  const requiredFields = ['name', 'merchant', 'description', 'barcode'];
  for (let i=0; i<requiredFields.length; i++) {
    const field = requiredFields[i];
    if (!(field in req.body)) {
      const message = `Missing \`${field}\` in request body`
      console.error(message);
      return res.status(400).send(message);
    };
  }
  Deal.create({
    name: req.body.name,
    description: req.body.description,
    barcode: req.body.barcode,
    merchant: req.body.merchant,
    publishedAt: Date.now()
	})
    .then(deal => res.status(201).json(deal.apiRepr()))
    .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Internal server error'});
    });
});

//PUT Router
router.put('/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
  //Checks that only certain fields are submitted
  const allowedFields = ['name', 'description', 'barcode', 'merchant', 'id', 'active'];
  for (field in req.body) {
    if (!(allowedFields.includes(field))) {
        const message = `Invalid ${field} field in request body`;
        console.error(message);
        return res.status(400).send(message);
    };
  }

  const reqKeys = Object.keys(req.body).filter(key => key !== 'merchant' && key !== 'id');
  let reqBody = {};
  for (index in reqKeys) {
    reqBody[reqKeys[index]] = req.body[reqKeys[index]];
  }

  Deal.findOneAndUpdate({_id: req.params.id, merchant: req.body.merchant},
      {$set: reqBody}, {new: true})
  .then(deal => { return res.status(201).json(deal.apiRepr())
  }).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update deal'});
  });

});

//DELETE Router
router.delete('/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
  Deal.findOneAndRemove({_id: req.params.id, merchant: req.body.id})
  .then(deal => {
    if(deal) {
      res.json({message: 'Removed from database'}).status(200);
    }
    else {
      res.json({message: 'Cannot delete deal'}).status(401);
    }
  }).catch(err => {
    console.error(err);
  });
});

module.exports = {router};