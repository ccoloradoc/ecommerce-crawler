const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const Utils = require('./src/commons/utils')
const MapUtils = require('./src/commons/maps')
const Roboto = require('./src/roboto')
const config = require('./crawler.config')

const targets = Object.keys(config.targets)
const processArgs = process.argv.slice(2);
let target = {}
let targetName = ''
if(processArgs.length > 0) {
	targetName = processArgs[0]
	console.log('Processing target: ', targetName)
	target = config.targets[targetName]
} else if(targets.length > 0) {
	targetName = targets[0]
	console.log('Processing target: ', targetName)
	target = config.targets[targetName]
}

const Parser = require('./src/parser/' + target.parser)

console.log('Reading archive from: ', target.json)
let storedData = fs.readFileSync(target.json)
let inMemoryMap = JSON.parse(storedData)

console.log('Initializing telegram interface')
let roboto = new Roboto(
	config.telegram.apiKey, 
	config.telegram.channel, 
	config.telegram.debugMode
)

function hitPage(target) {
	return new Promise((resolve, reject) => {
		console.log('Submiting request: ', target)
		request(target, function (err, response, body) {
			if(err) {
				console.log('There was an error while requesting page: ', err)
				reject(err)
			}
		  	resolve(body)
	  	})
	})
}

function updateInMemory(delta, itemsMap) {
	let messagesSubmited = 0
	Object.entries(itemsMap).forEach(([key, item]) => {
		if(inMemoryMap.hasOwnProperty(key)) {
			if(inMemoryMap[key].price > item.price + delta) {
				let message = Utils.concatenate(
					'El siguiente producto ha bajado de precio: ',
					item.title, 
					' de $', inMemoryMap[key].price, ' a $', item.price, ' ',
					item.link
				)
				console.log('	- ', message)
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.submit(message)
				}
			}
		} else {
			let message = Utils.concatenate(
				'El siguiente producto ha sido listado: ',
				item.title, 
				' con precio $', item.price, ' ',
				item.link
			)
			console.log('	+ ', message)
			if(messagesSubmited < 10) {
				roboto.submit(message)
				messagesSubmited++
			}
		}
		inMemoryMap[key] = item
	})
	return inMemoryMap
}

console.log('Starting cron for ', targetName, ' with schedule time: ', target.cron)
cron.schedule(target.cron, () => {
  	console.log()
	console.log('Ranning cronjob @[', Utils.printableNow(), ']');
	Promise.all([
		hitPage(target.url)
			.then(Parser),
		hitPage(target.url + '&page=2')
			.then(Parser),
		hitPage(target.url + '&page=3')
			.then(Parser),
		hitPage(target.url + '&page=4')
			.then(Parser),
		hitPage(target.url + '&page=5')
			.then(Parser)
	])
	.then(MapUtils.mergeMaps)
	.then(updateInMemory.bind(null, target.delta))
	.then(MapUtils.storeMap.bind(null, target.json))
	.then(MapUtils.itemsToCsv.bind(null, () => {
		return target.csv + Utils.printableNow() + '.csv'
	}))
});

	// Promise.all([
	// 	hitPage(target.url)
	// 		.then(Parser),
	// 	hitPage(target.url + '&page=2')
	// 		.then(Parser),
	// 	hitPage(target.url + '&page=3')
	// 		.then(Parser),
	// 	hitPage(target.url + '&page=4')
	// 		.then(Parser),
	// 	hitPage(target.url + '&page=5')
	// 		.then(Parser)
	// ])
	// .then(MapUtils.mergeMaps)
	// .then(updateInMemory.bind(null, target.delta))
	// .then(MapUtils.storeMap.bind(null, target.json))
	// .then(MapUtils.itemsToCsv.bind(null, () => {
	// 	return target.csv + Utils.printableNow() + '.csv'
	// }))
