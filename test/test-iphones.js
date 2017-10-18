const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {DATABASE_URL} = require('../config');
const {iPhone} = require('../iphones/models');
const {User} = require('../users/models')
const {closeServer, runServer, app} = require('../server');
const {TEST_DATABASE_URL} = require('../config');
const {createAuthToken} = require('../auth/router');

chai.use(chaiHttp);

// this function deletes the entire database
function tearDownDb() {
  return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
      .then(result => resolve(result))
      .catch(err => reject(err))
  });
}

// used to put randomish documents in db
function seediPhoneData() {

  const model = ["iPhone 6", "iPhone 6 Plus", "iPhone 6S", "iPhone 6S Plus", "iPhone 7", "iPhone 7 Plus", "iPhone 8", "iPhone 8 Plus"];
  const carrier = ["AT&T", "Sprint", "T-Mobile", "Verizon", "Unlocked"];
  const capacity = ["16GB", "32GB", "64GB", "128GB", "256GB"];
  const color = ["Silver", "Space Gray", "Gold", "Rose Gold"];
  const condition = ["Fair", "Good", "Excellent", "New"];


  console.info('seeding iPhone data');
  const seedData = [];
  for (let i=1; i<=10; i++) {
    seedData.push({
      model: model[Math.floor(Math.random()*model.length)],
      carrier: carrier[Math.floor(Math.random()*carrier.length)],
      capacity: capacity[Math.floor(Math.random()*capacity.length)],
      color: color[Math.floor(Math.random()*color.length)],
      condition: condition[Math.floor(Math.random()*condition.length)],
      price: parseInt(faker.commerce.price()),
      lng: parseInt(faker.address.longitude()),
      lat: parseInt(faker.address.latitude()),
      contactEmail: faker.internet.email(),
      userId: faker.random.uuid()
    });
  }
  // this will return a promise
  return iPhone.insertMany(seedData);
}

function seedUserData() {
  console.info('seeding user data');
  const seedUsers = [];
  for (let i=1; i<=10; i++) {
    seedUsers.push({
      username: faker.internet.userName(),
      password: faker.internet.password(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    });
  }
    return User.insertMany(seedUsers);
}

describe('iPhone API resource', function() {

  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return Promise.all([seediPhoneData(), seedUserData()]);
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  describe('GET endpoint', function() {
    it('should return all iPhones with correct fields', function() {
      let resPhone;
      let resBody;
      return chai.request(app)
        .get('/iPhones')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.iPhones.should.be.a('array');
          res.body.iPhones.forEach(function(iPhone) {
            iPhone.should.be.a('object');
            iPhone.should.include.keys('model', 'carrier', 'capacity', 'color', 'condition');
          });
          resPhone = res.body.iPhones[0];
          resBody = res.body;
          return iPhone.count();
        })
        .then(count => {
          resBody.iPhones.should.have.length(count);
          return iPhone.findById(resPhone.id);
        })
        .then(iPhone => {
          resPhone.model.should.equal(iPhone.model);
          resPhone.carrier.should.equal(iPhone.carrier);
          resPhone.capacity.should.equal(iPhone.capacity);
          resPhone.color.should.equal(iPhone.color);
          resPhone.condition.should.equal(iPhone.condition);
          resPhone.price.should.equal(iPhone.price);
        });
    });
    it('should return a specific iPhone', function() {
      let res;
      let iphone;

      return iPhone.findOne()
      .then(_iphone => {
          iphone = _iphone;
          return chai.request(app)
          .get(`/iPhones/${iphone.id}`)
        }).then(_res => {
            res = _res;
            res.should.have.status(201);
            return iPhone.count();
            res.body.iPhones.should.have.length(1);
            res.body.id.should.equal(iphone.id);
        });
    });
    it('should return iPhones that match search fields', function() {
      let resPhone;
      let searchSettings = {color: "Space Gray"};

      return chai.request(app)
        .get('/iPhones')
        .query(searchSettings)
        .then(function(res) {
          if (res.body.iPhones.length > 0) {
            resPhone = res.body.iPhones[0];
            resPhone.color.should.equal("Space Gray");
          };
        });
    });
    it('should not return iPhones when invalid search criteria is submitted', function() {
      let resPhone;
      let searchSettings = {sex: "Male"};

      return chai.request(app)
        .get('/iPhones')
        .query(searchSettings)
        .then(function(res) {
          res.body.iPhones.length.should.equal(0);
        });
    });
  });

  describe('POST endpoint', function() {
    it('should add a new iPhone', function() {
      let newiPhone;

      return User.findOne().then(user => {
        userId = user.id;
        token = createAuthToken(user.apiRepr());
        return [userId, token];
      }).then(([userId, token]) => {
        newiPhone = {
          "model": "iPhone 8", 
          "carrier": "AT&T",
          "capacity": "64GB", 
          "color": "Space Gray", 
          "condition": "Excellent", 
          "price": 350, 
          "lng": 40, 
          "lat": -70,
          "email": "test@gmail.com",
          "userId": userId
      };
        return chai.request(app)
        .post('/iPhones')
        .set("Authorization", "Bearer " + token)
        .send(newiPhone)

      }).then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys('model', 'carrier', 'capacity', 'color', 'condition', 'price', 'contactEmail', 'lat', 'lng', 'id', 'userId');
          res.body.id.should.not.be.null;
          return iPhone.findById(res.body.id);
        })
        .then(function(iPhone) {
          iPhone.model.should.equal(newiPhone.model);
          iPhone.carrier.should.equal(newiPhone.carrier);
          iPhone.capacity.should.equal(newiPhone.capacity);
          iPhone.color.should.equal(newiPhone.color);
          iPhone.condition.should.equal(newiPhone.condition);
          iPhone.price.should.equal(newiPhone.price);
          iPhone.contactEmail.should.equal(newiPhone.email);
        });
    });
  it('should add not be able to add an iPhone with invalid keys', function() {
      let newiPhone;

      return User.findOne().then(user => {
        userId = user.id;
        token = createAuthToken(user.apiRepr());

        newiPhone = {
          "model": "iPhone 8", 
          "carrier": "AT&T",
          "capacity": "64GB", 
          "color": "Space Gray", 
          "condition": "Excellent", 
          "sex": 350, 
          "lng": 40, 
          "lat": -70,
          "email": "test@gmail.com",
          "userId": userId
        };
        return chai.request(app)
        .post('/iPhones')
        .set("Authorization", "Bearer " + token)
        .send(newiPhone)

      }).catch(err => {
          err.response.status.should.equal(400);
          err.response.text.should.equal('Missing `price` in request body');
        })
    });
    it('should add not be able to add an iPhone with invalid data', function() {
      let newiPhone;

      return User.findOne().then(user => {
        userId = user.id;
        token = createAuthToken(user.apiRepr());
        return [userId, token];
      }).then(([userId, token]) => {
        newiPhone = {
          "model": "iPhone 8", 
          "carrier": "Amazon",
          "capacity": "64GB", 
          "color": "Space Gray", 
          "condition": "Excellent", 
          "price": 750, 
          "lng": 40, 
          "lat": -70,
          "email": "test@gmail.com",
          "userId": userId
      };
        return chai.request(app)
        .post('/iPhones')
        .set("Authorization", "Bearer " + token)
        .send(newiPhone)

      }).catch(err => {
          err.response.status.should.equal(400);
          err.response.text.should.equal('Invalid iPhone configuration in carrier field');
        })
    });
  });

  describe('PUT endpoint', function() {
    it('should update an iPhone', function() {
      let iphone;
      const updateData = {
        model: 'iPhone 8 Plus',
        carrier: 'Unlocked',
        capacity: '256GB',
        color: 'Gold',
        condition: 'New',
        price: 750,
        email: 'test@gmail.com'
      };

      return iPhone.findOne().then(_iphone => {
        iphone = _iphone;
        return user = {
          username: 'jsmith',
          firstName: 'John',
          lastName: 'Smith',
          id: iphone.userId
        };
        }).then(user => {
          const token = createAuthToken(user);
          return token
        }).then(token => {
          return chai.request(app)
            .put(`/iPhones/${iphone.id}`)
            .set("Authorization", "Bearer " + token)
            .send(updateData);
        }).then(res => {
          res.should.have.status(201);
          return iPhone.findById(iphone.id);
        }).then(iPhone => {
          iPhone.model.should.equal(updateData.model);
          iPhone.carrier.should.equal(updateData.carrier);
          iPhone.capacity.should.equal(updateData.capacity);
          iPhone.color.should.equal(updateData.color);
          iPhone.condition.should.equal(updateData.condition);
          iPhone.price.should.equal(updateData.price);
          iPhone.contactEmail.should.equal(updateData.email);        
        });
    });
    it('should not update an iPhone with invalid data', function() {
      let iphone;
      const updateData = {
        model: 'iPhone 8',
        carrier: 'Unlocked',
        capacity: '256GB',
        color: 'Green',
        condition: 'New',
        price: 750,
        email: 'test@gmail.com'
      };

      return iPhone.findOne().then(_iphone => {
        iphone = _iphone;
        return user = {
          username: 'jsmith',
          firstName: 'John',
          lastName: 'Smith',
          id: iphone.userId
        };
        }).then(user => {
          const token = createAuthToken(user);
          return token
        }).then(token => {
          return chai.request(app)
            .put(`/iPhones/${iphone.id}`)
            .set("Authorization", "Bearer " + token)
            .send(updateData);
        }).catch(err => {
          err.response.status.should.equal(400);
          err.response.text.should.equal('Invalid iPhone configuration in color field');
          return iPhone.findById(iphone.id);
        }).then(iPhone => {
          iPhone.color.should.not.equal(updateData.color);
        });
    });
    it('should not update an iPhone with an invalid key', function() {
      let iphone;
      const invalidKeyData = {
        model: 'iPhone 8',
        carrier: 'Unlocked',
        capacity: '256GB',
        color: 'Gold',
        age: 'New',
        price: 750,
        email: 'test@gmail.com'
      };

      return iPhone.findOne().then(_iphone => {
        iphone = _iphone;
        return user = {
          username: 'jsmith',
          firstName: 'John',
          lastName: 'Smith',
          id: iphone.userId
        };
        }).then(user => {
          const token = createAuthToken(user);
          return token
        }).then(token => {
          return chai.request(app)
            .put(`/iPhones/${iphone.id}`)
            .set("Authorization", "Bearer " + token)
            .send(invalidKeyData);
        }).catch(err => {
          err.response.status.should.equal(400);
          err.response.text.should.equal('Missing `condition` in request body');
          return iPhone.findById(iphone.id);
        }).then(iPhone => {
          iPhone.should.not.include.key("age");
        });
    });
    it('should not be able to update an iPhone from a different user', function() {
      let iphone;
      const updateData = {
        model: 'iPhone 8 Plus',
        carrier: 'Unlocked',
        capacity: '256GB',
        color: 'Gold',
        condition: 'New',
        price: 750,
        email: 'test@gmail.com'
      };

      return iPhone.findOne().then(_iphone => {
        iphone = _iphone;
        return User.findOne();
        }).then(user => {
          const token = createAuthToken(user.apiRepr());
          return token
        }).then(token => {
          return chai.request(app)
            .put(`/iPhones/${iphone.id}`)
            .set("Authorization", "Bearer " + token)
            .send(updateData);
        }).catch(err => {
          err.response.status.should.equal(401);
          return iPhone.findById(iphone.id);
        }).then(iPhone => {
          iPhone.contactEmail.should.not.equal(updateData.email);        
        });
    });
  });

  describe('DELETE endpoint', function() {
    it('should delete an iPhone by id', function() {
      let iphone;

      return iPhone.findOne()
      .then(_iphone => {
          iphone = _iphone;
          return user = {
            username: 'jsmith',
            firstName: 'John',
            lastName: 'Smith',
            id: iphone.userId
          };
        }).then(user => {
            const token = createAuthToken(user);
            return token
        }).then(token => {
            return chai.request(app)
            .delete(`/iPhones/${iphone.id}`)
            .set("Authorization", "Bearer " + token);
        }).then(res => {
            res.should.have.status(204);
            return iPhone.findById(iphone.id);
        }).then(_iphone => {
            should.not.exist(_iphone);
        });
    });
    it('should not be able to delete an iPhone from a different user', function() {
      let iphone;

      return iPhone.findOne()
      .then(_iphone => {
          iphone = _iphone;
          return User.findOne();
        }).then(user => {
            const token = createAuthToken(user.apiRepr());
            return token
        }).then(token => {
            return chai.request(app)
            .delete(`/iPhones/${iphone.id}`)
            .set("Authorization", "Bearer " + token);
        }).catch(err => {
            err.response.status.should.equal(401);
            return iPhone.findById(iphone.id);
        }).then(_iphone => {
            should.exist(_iphone);
        });
    });
  });
  describe('GET config endpoint', function() {
    it('should return the config file', function() {
      let res;

      return chai.request(app)
      .get('/iPhones/config')
      .then(_res => {
          res = _res;
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.include.keys('model', 'carrier', 'capacity', 'color', 'condition');
      });
    });
  });
});