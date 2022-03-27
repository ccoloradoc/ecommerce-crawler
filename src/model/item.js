const mongoose = require('mongoose');

const itemSchema = mongoose.Schema({
	id: String,
	title: String,
	price: Number,
	image: String,
	link: String,
	source: String,
	available: Boolean
}, {
	timestamps: true
});

module.exports = mongoose.model('Item', itemSchema)
