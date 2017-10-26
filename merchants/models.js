const mongoose = require('mongoose');

const merchantSchema = mongoose.Schema({
    name: {type: String, required: true},
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    type: {type: String, required: true}, 
    logo: {type: String, default: ''},
    address: {type: String, required: true},
    tel: {type: String, required: false},
    lat: {type: Number, required: true},
    lng: {type: Number, required: true},
    publishedAt: {type: Date, required: false}
});

merchantSchema.methods.apiRepr = function() {
  return {
    id: this._id,
    user: this.user,
    name: this.name,
    type: this.type,
    logo: this.logo,
    address: this.address,
    tel: this.tel,
    lat: this.lat,
    lng: this.lng
  };
}

const Merchant = mongoose.model('Merchant', merchantSchema);

module.exports = {Merchant};