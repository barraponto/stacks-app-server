const mongoose = require('mongoose');

const dealSchema = mongoose.Schema({
    name: {type: String, required: true},
    description: {type: String, required: true},
    barcode: {type: String, required: false},
    active: {type: Boolean, default: true},
    publishedAt: {type: Date, required: false},
    merchant: {type: mongoose.Schema.Types.ObjectId, ref: 'Merchant'}
});

dealSchema.methods.apiRepr = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    barcode: this.barcode,
    active: this.active
  };
}

dealSchema.methods.apiPopulateRepr = function() {
  return {
    id: this._id,
    name: this.name,
    merchant: this.merchant.name,
    type: this.merchant.type,
    logo: this.merchant.logo,
    description: this.description,
    address: this.merchant.address,
    tel: this.merchant.tel,
    barcode: this.barcode,
    active: this.active,
    lat: this.merchant.lat,
    lng: this.merchant.lng
  };
}

const Deal = mongoose.model('Deal', dealSchema);

module.exports = {Deal};