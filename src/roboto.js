const request = require('request')
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
		if(this.debugMode) {
			this.logger.info(" Submiting: " + message)
			return
		}
		request(`${this.sendMessageUrl}&text=${encodeURI(message)}`, function (err, response, body) {
			if(err) {
				_this.logger.error('There was an error while submiting message: ' + err)
			}
			_this.logger.info('Receving response from service: ', JSON.parse(body))
		})
	},
	
	sendPhoto: function(photo, caption) {
		let _this = this
		let endpoint = `${this.sendPhotoUrl}&photo=${encodeURI(photo)}&caption=${encodeURI(caption)}`
		if(this.debugMode) {
			this.logger.info(" Submiting: " + endpoint)
			return
		}
		request(endpoint, function (err, response, body) {
			if(err) {
				_this.logger.error('There was an error while submiting message: ' + err)
			}
			_this.logger.info('Receving response from service: ', JSON.parse(body))
		})
	}
}

module.exports = Roboto
