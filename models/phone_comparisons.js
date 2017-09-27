
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var PhoneComaprisons = mongoose.model('phones_comparisons',  new Schema({
    betterThanFeatures:[String],
    ratio:Number,
    name:String,
    compareModel:String,
    worseThanFeatures:[String]
}));

module.exports = PhoneComaprisons;
