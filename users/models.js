const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const userSchema = mongoose.Schema({
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    firstName: {type: String, default: ''},
    lastName: {type: String, default: ''},
    dob: {type: Date, required: true},
    merchant: {type: Boolean, default: false},
    joinedOn: {type: Date, default: Date.now()},
    deals: [{type: mongoose.Schema.Types.ObjectId, ref: 'Deal'}],
    redeemedDeals: [{type: mongoose.Schema.Types.ObjectId, ref: 'Deal'}]
});

userSchema.methods.apiRepr = function() {
    return {
        email: this.email || '',
        firstName: this.firstName || '',
        lastName: this.lastName || '',
        merchant: this.merchant || '',
        id: this._id || '',
        deals: this.deals || '',
        redeemedDeals: this.redeemedDeals || ''
    };
};

userSchema.methods.validatePassword = function(password) {
    return bcrypt.compare(password, this.password);
};

userSchema.statics.hashPassword = function(password) {
    return bcrypt.hash(password, 10);
};

const User = mongoose.model('User', userSchema);

module.exports = {User};