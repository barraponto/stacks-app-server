const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const passport = require('passport');
const path = require('path');

mongoose.Promise = global.Promise;

const {PORT, DATABASE_URL} = require('./config');

const app = express();
app.use(morgan('common'));
app.use(bodyParser.json());

app.use(express.static('public'));

// CORS
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

//Passport
app.use(passport.initialize());
const {basicStrategy, jwtStrategy} = require('./auth/strategies');
passport.use(basicStrategy);
passport.use(jwtStrategy);

//Routers
const {router: usersRouter} = require('./users/router');
app.use('/users', usersRouter);

const {router: authRouter} = require('./auth/router');
app.use('/auth', authRouter);

const {router: dealsRouter} = require('./deals/router');
app.use('/deals', dealsRouter);

const {router: merchantsRouter} = require('./merchants/router');
app.use('/merchants', merchantsRouter);

//Routing
app.use('/mapapi', (req, res) => {
  axios.get('https://maps.googleapis.com/maps/api/js?key=AIzaSyDwl8AK9K-T03AnIEtQlgxVYlYsZD73tMU&libraries=places')
  .then((script) => res.send(script.data));
});

app.use('*', (req, res) => {
    return res.status(404).json({message: 'Not Found'});
});

//Server Connections
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl=DATABASE_URL, port=PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
      .on('error', err => {
        mongoose.disconnect();
        reject(err);
      });
    });
  });
}

// this function closes the server, and returns a promise
function closeServer() {
  return mongoose.disconnect().then(() => {
     return new Promise((resolve, reject) => {
       console.log('Closing server');
       server.close(err => {
           if (err) {
               return reject(err);
           }
           resolve();
       });
     });
  });
}

if (require.main === module) {
  runServer().catch(err => console.error(err));
};

module.exports = {app, runServer, closeServer};