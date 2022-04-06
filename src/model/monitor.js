const mongoose = require('mongoose');

const monitor = mongoose.Schema({
	id: String,
	title: String,
	price: Number,
	image: String,
	link: String,
	source: String,
	store: String,
	active: Boolean,
	monitor: Boolean,
	fileId: String,
	messageId: String,
	chatId: String
}, {
	timestamps: true
});

module.exports = mongoose.model('Monitor', monitor)
