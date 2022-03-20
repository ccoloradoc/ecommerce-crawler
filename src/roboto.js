const request = require('request');

function Roboto(apiKey, chatId, debugMode) {
	this.apiKey = apiKey
	this.chatId = chatId
	this.debugMode = debugMode
	this.url = 'https://api.telegram.org/bot' +this.apiKey + '/sendMessage?chat_id=' + this.chatId
}

Roboto.prototype = {
	submit: function(message) {
		if(this.debugMode) {
			console.log(" Submiting: ", message)
			return
		}
		request(this.url + '&text=' + encodeURI(message), function (err, response, body) {
			if(err) {
				console.log('There was an error while submiting message: ', err)
			}
			console.log(body)
		})
	}
}

module.exports = Roboto
