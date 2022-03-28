const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Item = require('./src/model/item')
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

// Loading parser
const Parser = require('./src/parser/' + target.parser)

// Connecting to database
console.log('Connecting to database')
mongoose.connect(config.database.uri, config.database.options)

console.log('Initializing telegram interface')
let roboto = new Roboto(
	config.telegram.apiKey, 
	config.telegram.channel, 
	config.telegram.debugMode
)

let requestHandler =  requestFactory(target.debug)

async function refreshCatalogFromDatabase() {
	let map = {}
	let items = await Item.find({source: targetName, available: true})
	items.forEach((item, i) => {
		map[item.id] = item
	});
	console.log('Fetching ', items.length, ' from database')
	return map
}

async function saveAndSubmit(delta, itemsMap) {
	let messagesSubmited = 0
	let catalog = await refreshCatalogFromDatabase()
	
	// Clean database
	let ack = await Item.updateMany({source: targetName}, {available: false})
	console.log('Updating availability', ack.modifiedCount, 'of ', ack.matchedCount)
	
	Object.entries(itemsMap).forEach(([key, item]) => {
		// If item exist in catalog
		if(catalog.hasOwnProperty(key)) {
			let available = true
			if(item.price == 0) {
				console.log('	- SIN STOCK: ', item.title)
				available = false
			} else if(catalog[key].price == 0) {
				//Send message
				let message = Utils.concatenate(
					'NUEVO STOCK: El siguiente esta disponible: ',
					item.title, 
					' con un precio de $', item.price, ' ',
					item.link
				)
				
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.submit(message)
				}
			} else if(catalog[key].price > item.price + delta) {
				//Send message
				let message = Utils.concatenate(
					'DEAL: El siguiente producto ha bajado de precio: ',
					item.title, 
					' de $', catalog[key].price, ' a $', item.price, ' ',
					item.link
				)
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.submit(message)
				}
			}
			
			// Updating product price
			Item.findOneAndUpdate({
					id: item.id,
					source: targetName
				}, {
					$set: {
						price: item.price,
						link: item.link,
						available: available
					}
				},
				function(err, item) {
					if (err) console.log('Error while updating no-stock: ', err)
				})
		} else {
			let available = true
			if(item.price == 0) {
				available = false
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
			// Upsert new item with availability
			Item.findOneAndUpdate({
					id: item.id,
					source: targetName
				}, {
					...item,
					source: targetName,
					available: available
				}, {
					upsert: true
				},
				function(err, doc) {
					if (err) console.log(err)
				}
			)
		}
		catalog[key] = item
	})
	console.log('Finished processing ', Object.keys(itemsMap).length, ' items')
	return catalog
}

async function processIt() {
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
	.then(saveAndSubmit.bind(null, target.delta))
}

console.log('Starting cron for ', targetName, ' with schedule time: ', target.cron)
cron.schedule(target.cron, () => {
  	processIt()
});

processIt()
