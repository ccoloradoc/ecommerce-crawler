const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Utils = require('./src/commons/utils')
const Roboto = require('./src/roboto')
const Item = require('./src/model/item')
const config = require('./crawler.config')

// Obtaining configuration details
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

// Initializing telegram interface
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
			// Updating product price
			Item.findOneAndUpdate({
					id: item.id,
					source: targetName
				}, {
					$set: {
						price: item.price,
						link: item.link,
						available: true
					}
				},
				function(err, item) {
					if (err) console.log('Error while updating: ', err)
				})
			// Sending message if price is lower
			if(catalog[key].price > item.price + delta) {
				let message = Utils.concatenate(
					'El siguiente producto ha bajado de precio: ',
					item.title, 
					' de $', catalog[key].price, ' a $', item.price, ' ',
					item.link
				)
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.submit(message)
				}
			}
		} else {
			// Upsert new item with availability
			Item.findOneAndUpdate({
					id: item.id,
					source: targetName
				}, {
					...item,
					source: targetName,
					available: true
				}, {
					upsert: true
				},
				function(err, doc) {
					if (err) console.log(err)
				}
			)
			
			//Send message
			let message = Utils.concatenate(
				'El siguiente producto ha sido listado: ',
				item.title, 
				' con precio $', item.price, ' ',
				item.link
			)
			if(messagesSubmited < 10) {
				roboto.submit(message)
				messagesSubmited++
			}
		}
		// Update in memory catalog
		catalog[key] = item
	})
	console.log('Finished processing ', Object.keys(itemsMap).length, ' items')
	return catalog
}

async function processIt() {
	console.log('Ranning cronjob @[', Utils.printableNow(), ']');
	hitPage(target.url)
		.then(Parser)
		.then(saveAndSubmit.bind(null, target.delta))
}
console.log('Starting cron for ', targetName, ' with schedule time: ', target.cron)
cron.schedule(target.cron, () => {
	processIt()
});

processIt()
