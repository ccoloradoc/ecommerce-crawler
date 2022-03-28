const request = require('request')
const loggerFactory = require('./log/logger')

function Roboto(apiKey, chatId, debugMode) {
	this.apiKey = apiKey
	this.chatId = chatId
	this.debugMode = debugMode
	this.url = 'https://api.telegram.org/bot' +this.apiKey + '/sendMessage?chat_id=' + this.chatId
	this.logger = loggerFactory.getInstance()
}

Roboto.prototype = {
	submit: function(message) {
		let _this = this
		if(this.debugMode) {
			this.logger.info(" Submiting: " + message)
			return
		}
		request(this.url + '&text=' + encodeURI(message), function (err, response, body) {
			if(err) {
				_this.logger.error('There was an error while submiting message: ' + err)
			}
			_this.logger.info('Receving response from service: ', JSON.parse(body))
		})
	}
}

module.exports = Roboto
