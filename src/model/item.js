const mongoose = require('mongoose');

const itemSchema = mongoose.Schema({
	id: String,
	title: String,
	price: Number,
	image: String,
	link: String,
	source: String,
	store: String,
	available: Boolean,
	fileId: String,
	messageId: String,
	chatId: String,
	alarm: Boolean
}, {
	timestamps: true
});

module.exports = mongoose.model('Item', itemSchema)
