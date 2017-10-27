const express = require('express');
const aws = require('aws-sdk');
const bodyParser = require('body-parser');
const passport = require('passport');

const {Merchant} = require('./models');
const {User} = require('../users/models');

const router = express.Router();

const jsonParser = bodyParser.json();

aws.config.region = 'eu-west-1';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

//POST Router
router.post('/', jsonParser, (req, res) => {
    const requiredFields = ['email', 'password', 'name', 'type', 'address', 'tel', 'lat', 'lng'];
    const missingField = requiredFields.find(field => !(field in req.body));

    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        });
    }

    const stringFields = ['email', 'password', 'name', 'type', 'address'];
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
        email: {min: 4},
        password: {min: 8,max: 72}
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

    let {email, password, name, type, logo, address, tel, lat, lng} = req.body;
    let userId;
    // email and password come in pre-trimmed, otherwise we throw an error before this
    name = name.trim();

    return User.find({email: email}).count()
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
            firstName: '',
            lastName: '',
            dob: '',
            merchant: true
        });
    }).then(user => {
      userId = user._id;
        return Merchant.create({
            name,
            user: userId,
            type,
            address,
            tel,
            lat,
            lng,
            publishedAt: Date.now()
        });
    }).then(merchant => res.status(201).json(merchant.apiRepr())
    ).catch(err => {
        User.findByIdAndRemove(userId);
        // Forward validation errors on to the client, otherwise give a 500
        // error because something unexpected has happened
        if (err.reason === 'ValidationError') {
            return res.status(err.code).json(err);
        }
        res.status(500).json({code: 500, message: 'Internal server error'});
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
  const allowedFields = ['name', 'type', 'email', 'logo', 'address', 'tel', 'lat', 'lng'];
  for (field in req.body) {
    if (!(allowedFields.includes(field))) {
        const message = `Invalid ${field} field in request body`;
        console.error(message);
        return res.status(400).send(message);
    };
  }

  const merchantKeys = Object.keys(req.body).filter(key => key !== 'email');
  let merchantUpdate = {};

  for (index in merchantKeys) {
    merchantUpdate[merchantKeys[index]] = req.body[merchantKeys[index]];
  }

  let merchant;
  if (merchantKeys.length > 0) {
    merchant = Merchant.findOneAndUpdate({_id: req.params.id, user: req.user.id}, {$set: merchantUpdate}, {new: true});
  }

  let user;
  if (req.body.email) {
    user = User.findOneAndUpdate({_id: req.user.id}, {$set: {email: req.body.email}}, {new: true});
  }

  return Promise.all([merchant, user])
  .then(([merchant, user]) => res.status(201).json(merchant.apiRepr())
  ).catch(err => {
      console.error(err);
      res.status(401).json({message: 'Cannot update merchant'});
  });

});

router.get('/sign-s3', (req, res) => {
  const s3 = new aws.S3();
  const fileName = req.query['file-name'];
  const fileType = req.query['file-type'];
  const s3Params = {
    Bucket: S3_BUCKET_NAME,
    Key: fileName,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read'
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if(err){
      console.log(err);
      return res.sendStatus(500);
    }
    const returnData = {
      signedRequest: data,
      url: `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`
    };
    res.json(returnData);
  });
});

module.exports = {router};
