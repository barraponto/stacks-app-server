const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {User} = require('../users/models')
const {closeServer, runServer, app} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

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

describe('User Models', function() {

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

  describe('Validate password method', function() {
    it('should validate the same passwords', function() {
      return User.findOne().then(user => {
          return user.validatePassword('testpassword')
      }).then(validate => {
        validate.should.equal(true);
      });
    });
    it('should not validate different passwords', function() {   
      return User.findOne().then(user => {
          return user.validatePassword('fakepassword')
      }).then(validate => {
        validate.should.equal(false);
      });
    });
  });
});