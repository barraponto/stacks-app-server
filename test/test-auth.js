const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {User} = require('../users/models')
const {closeServer, runServer, app} = require('../server');
const {TEST_DATABASE_URL} = require('../config');
const {createAuthToken} = require('../auth/router');

chai.use(chaiHttp);

function tearDownDb() {
  return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
      .then(result => resolve(result))
      .catch(err => reject(err))
  });
}

function seedUserData() {
  console.info('Seeding user data');
  const seedUsers = [];
  for (let i=1; i<=5; i++) {

    const username = faker.internet.userName();
    const password = 'testpassword';
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();

    seedUsers.push({
      username: username,
      password: password,
      firstName: firstName,
      lastName: lastName
    });
  };
  
  const hashes = seedUsers.map(user => User.hashPassword(user.password));
  return Promise.all(hashes).then((hashedpasswords) => {
    seedUsers.forEach((user, index) => {
      user.password = hashedpasswords[index];
    });
  return User.insertMany(seedUsers);
  });
}

describe('Auth API resource', function() {

  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedUserData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  describe('GET jwt endpoint', function() {
    it('should return the user when sent a valid jwt token', function() {
      let returnedUser;
      
      return User.findOne().then(user => {
        token = createAuthToken(user.apiRepr());
        returnedUser = user;
        return token;
      }).then(token => {
        return chai.request(app)
        .get('/auth/protected')
        .set("Authorization", "Bearer " + token)
      }).then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.id.should.equal(returnedUser.id);
      });
    });
    it('should return an error when sent an invalid jwt token', function() {   
        token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

        return chai.request(app)
          .get('/auth/protected')
          .set("Authorization", "Bearer " + token)
        .catch(err => {
          err.should.have.status(401);
          err.response.text.should.equal('Unauthorized');
        });
    });
  });

  describe('POST Basic endpoint', function() {
    it('when sent a valid user should return a valid jwt token', function() {
      let token;
      
      return User.findOne().then(user => {
        token = createAuthToken(user.apiRepr());
        return chai.request(app)
        .post('/auth/login')
        .auth(user.username, 'testpassword')
      }).then(function(res) {
          res.should.have.status(200);
          res.body.authToken.should.equal(token);
      });
    });
    it('when sent an invalid user should return an error', function() {
      
      return chai.request(app)
        .post('/auth/login')
        .auth(faker.internet.userName(), faker.internet.password())
      .catch(err => {
        err.should.have.status(401);
        err.response.text.should.equal('{"message":"Incorrect username or password"}');
      });
    });
  });
});