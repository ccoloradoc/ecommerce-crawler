const axios = require('axios')
const loggerFactory = require('./log/logger')

function Roboto(apiKey, chatId, debugMode) {
	this.apiKey = apiKey
	this.chatId = chatId
	this.debugMode = debugMode
	this.sendMessageUrl = `https://api.telegram.org/bot${this.apiKey}/sendMessage?chat_id=${this.chatId}&parse_mode=markdown`
	this.sendPhotoUrl = `https://api.telegram.org/bot${this.apiKey}/sendPhoto?chat_id=${this.chatId}&parse_mode=markdown`
	this.logger = loggerFactory.getInstance()
}

Roboto.prototype = {
	submit: function(message) {
		let _this = this
		let endpoint = `${this.sendMessageUrl}&text=${encodeURI(message)}`
		if(this.debugMode) {
			this.logger.warn(`\tSubmiting: [${endpoint}]`)
			return
		}
		return axios.get(endpoint)
			.then(function (response) {
				let object = {
					message_id: response.data.result.message_id,
					chat_id: response.data.result.chat.username
				}
				_this.logger.info('Receving response from service', object)
				return object
			})
			.catch(function (err) {
				_this.logger.error('There was an error while submiting message', err)
			})
	},
	
	sendPhoto: function(photo, caption) {
		let _this = this
		let endpoint = `${this.sendPhotoUrl}&photo=${encodeURI(photo)}&caption=${encodeURI(caption)}`
		if(this.debugMode) {
			this.logger.warn(`\tSubmiting: [${endpoint}]`)
			return
		}
		return axios.get(endpoint)
			.then(function (response) {
				let object = {
					message_id: response.data.result.message_id,
					chat_id: response.data.result.chat.username,
					file: response.data.result.photo[response.data.result.photo.length - 1]
				}
				_this.logger.info('Receving response from service', object)
				return object
			})
			.catch(function (err) {
				_this.logger.error('There was an error while submiting message', err)
			})
	}
}

module.exports = Roboto
