const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const JsonDatabase = require('./src/model/JsonDatabase')
const Utils = require('./src/commons/utils')
const MapUtils = require('./src/commons/maps')
const Roboto = require('./src/roboto')
const requestFactory = require('./src/commons/request')
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

let jsonDatabase = JsonDatabase.open(target.database)
let storedData = jsonDatabase.read()
let inMemoryMap = JSON.parse(storedData)
console.log('Processing ', Object.entries(inMemoryMap).length, ' elements')

console.log('Initializing telegram interface')
let roboto = new Roboto(
	config.telegram.apiKey, 
	config.telegram.channel, 
	config.telegram.debugMode
)

let requestHandler =  requestFactory(target.debug)

function updateInMemory(delta, itemsMap) {
	let messagesSubmited = 0
	console.log('Processing ', Object.entries(itemsMap).length, ' elements')
	Object.entries(itemsMap).forEach(([key, item]) => {
		if(inMemoryMap.hasOwnProperty(key)) {
			//console.log('Processing Existent [', key, ']', inMemoryMap[key].price, ' - ', item.price)
			if(item.price == 0) {
				console.log('	- SIN STOCK: ', item.title)
			} else if(inMemoryMap[key].price == 0) {
				let message = Utils.concatenate(
					'NUEVO STOCK: El siguiente esta disponible: ',
					item.title, 
					' con un precio de $', item.price, ' ',
					item.link
				)
				console.log('	- ', message)
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.submit(message)
				}
			} else if(inMemoryMap[key].price > item.price + delta) {
				let message = Utils.concatenate(
					'DEAL: El siguiente producto ha bajado de precio: ',
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
			//console.log('Processing New [', key, ']')
			if(item.price == 0) {
				console.log('	- Sin existencia: ', item.title)
			} else {
				let message = Utils.concatenate(
					'NUEVO: El siguiente producto ha sido listado: ',
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
		requestHandler(target.url, '&page=1')
			.then(Parser),
		requestHandler(target.url, '&page=2')
			.then(Parser),
		requestHandler(target.url, '&page=3')
			.then(Parser)
	])
	.then(MapUtils.mergeMaps)
	.then(updateInMemory.bind(null, target.delta))
	.then((itemsMap) => {
		jsonDatabase.write(itemsMap)
		return itemsMap
	})
	.then(MapUtils.itemsToCsv.bind(null, () => {
		return target.csv + Utils.printableNow() + '.csv'
	}))
});

	Promise.all([
		requestHandler(target.url, '&page=1')
			.then(Parser)
		// requestHandler(target.url, '&page=2')
		// 	.then(Parser),
		// requestHandler(target.url, '&page=3')
		// 	.then(Parser)
	])
	.then(MapUtils.mergeMaps)
	.then(updateInMemory.bind(null, target.delta))
	.then((itemsMap) => {
		jsonDatabase.write(itemsMap)
		return itemsMap
	})
	.then(MapUtils.itemsToCsv.bind(null, () => {
		return target.csv + Utils.printableNow() + '.csv'
	}))
