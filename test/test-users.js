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

describe('Users API resource', function() {

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

  describe('POST user endpoint', function() {
    it('should create a new user', function() {
      let newUser = {
        username: faker.internet.userName(),
        password: faker.internet.password(),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName()
      }

      return chai.request(app)
        .post('/users')
        .send(newUser)
      .then(res => {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys('username', 'firstName', 'lastName', 'id');
          return User.findById(res.body.id);
      }).then(user => {
          user.username.should.equal(newUser.username);
          user.firstName.should.equal(newUser.firstName);
          user.lastName.should.equal(newUser.lastName);
      });
    });
    it('should return an error when creating user with existing name', function() {
      let newUser;

      return User.findOne().then(user => {
        newUser = {
          username: user.username,
          password: faker.internet.password(),
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName()
        }
        return newUser
      }).then(newUser => {
        return chai.request(app)
        .post('/users')
        .send(newUser)
      }).catch(err => {
          err.should.have.status(422);
      });   
    });
    it('should return an error when creating user with invalid password', function() { 
      let newUser = {
        username: faker.internet.userName(),
        password: 'test',
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName()
      }

      return chai.request(app)
        .post('/users')
        .send(newUser)
      .catch(err => {
          err.should.have.status(422);
      });  
    });  
    it('should return an error when creating user without all required keys', function() { 
      let newUser = {
        username: faker.internet.userName(),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName()
      }

      return chai.request(app)
        .post('/users')
        .send(newUser)
      .catch(err => {
          err.should.have.status(422);
      });  
    });
  });

});