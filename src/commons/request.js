const request = require('request');
const fs = require('fs')

let user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36'

function readFromBootstrap(target) {
	return new Promise((resolve, reject) => {
		resolve(fs.readFileSync('./bootstrap/' + target.bootstrap, {encoding:'utf8', flag:'r'}))
	})
}

function hitPage(target, addendum) {
	let url = target.prod + addendum
	return new Promise((resolve, reject) => {
		console.log('Submiting request: ', url)
		request({
			url: url,
			headers: {
				'User-Agent': user_agent
			}
		}, function (err, response, body) {
			if(err) {
				console.log('There was an error while requesting page: ', err)
				reject(err)
			}
		  	resolve(body)
	  	})
	})
}

module.exports = function requestFactory(bootstrap) {
	if(bootstrap) {
		return readFromBootstrap
	} else {
		return hitPage
	}
}
