const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const {Deal} = require('./models.js');

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
router.get('/', (req, res) => {
  //Checks that requests have valid keys
  Object.keys(req.query).map(key => {
    if (!(key === 'type')) {
        const message = 'Can only search by deal type';
        console.error(message);
        return res.status(400).send(message);
      };
    })

  //Accepts the search criteria from the param GET request to be used in .find() 
    const searchCriteria = Object.keys(req.query).map(key => {
      if (Array.isArray(req.query[key])) {
        return req.query[key].map(value => ({[key]: value}))
      }
      else {
        return ([{[key]: req.query[key]}]);
      }
    }).map(values => ({$or: values}));

    console.log(searchCriteria);

    Deal
      .find(searchCriteria)  //Accepts the variable above to filter search results
      .populate('merchant')
      .limit()
      .then(deals => {
      	res.json({deals: deals.map((deal) => deal.apiPopulateRepr())});
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
  const allowedFields = ['name', 'description', 'barcode', 'merchant', 'id'];
  for (field in req.body) {
    if (!(allowedFields.includes(field))) {
        const message = `Invalid ${field} field in request body`;
        console.error(message);
        return res.status(400).send(message);
    };
  }

  const {name, description, barcode} = req.body;
  const updatedFields = {name, description, barcode};

  Deal.findOneAndUpdate({_id: req.params.id, merchant: req.body.merchant},
      {$set: updatedFields}, {new: true})
  .then(deal => res.status(201).json(deal.apiRepr())
  ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update deal'});
  });

});

//DELETE Router
router.delete('/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
  Deal.findOneAndRemove({_id: req.params.id, merchant: req.body.id})
  .then(deal => {
    if(deal) {
      res.json({message: 'Removed from database'}).status(204);
    }
    else {
      res.json({message: 'Cannot delete deal'}).status(401);
    }
  }).catch(err => {
    console.error(err);
  });
});

module.exports = {router};