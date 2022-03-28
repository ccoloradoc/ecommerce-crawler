const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Utils = require('./src/commons/utils')
const Roboto = require('./src/roboto')
const loggerFactory = require('./src/log/logger')
const Item = require('./src/model/item')
const config = require('./crawler.config')

// Obtaining configuration details
const targets = Object.keys(config.targets)
const processArgs = process.argv.slice(2);
let target = {}
let targetName = ''
if(processArgs.length > 0) {
	targetName = processArgs[0]
	target = config.targets[targetName]
} else if(targets.length > 0) {
	targetName = targets[0]
	target = config.targets[targetName]
}

let logger = loggerFactory.getInstance(__dirname, { source: targetName})
logger.info('Processing target: ' + targetName)

// Loading parser
const Parser = require('./src/parser/' + target.parser)

// Connecting to database
logger.info('Connecting to database')
mongoose.connect(config.database.uri, config.database.options)

// Initializing telegram interface
logger.info('Initializing telegram interface')
let roboto = new Roboto(
	config.telegram.apiKey, 
	config.telegram.channel, 
	config.telegram.debugMode
)

function hitPage(target) {
	let logger = loggerFactory.getInstance()
	return new Promise((resolve, reject) => {
		logger.info(`Submiting request: [${target}]`)
		request(target, function (err, response, body) {
			if(err) {
				logger.error('There was an error while requesting page: ' + err)
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
	logger.info(`Fetching ${items.length} from database`)
	return map
}

async function saveAndSubmit(delta, itemsMap) {
	let messagesSubmited = 0
	let catalog = await refreshCatalogFromDatabase()
	// Clean database
	let ack = await Item.updateMany({source: targetName}, {available: false})
	logger.info(`Updating availability ${ack.modifiedCount} of ${ack.matchedCount}`)
	
	Object.entries(itemsMap).forEach(([key, item]) => {
		// If item exist in catalog
		if(catalog.hasOwnProperty(key)) {
			// Sending message if price is lower
			if(catalog[key].price > item.price + delta) {
				logger.info('	- [deal]: ' + item.title)
				// Send message
				let message = `*Deal:* El siguiente producto ha bajado de precio [${item.title}](${item.link}) de $${catalog[key].price} a *$${item.price}*`
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.sendPhoto(item.image, message)
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
						available: true
					}
				},
				function(err, item) {
					if (err) logger.error('Error while updating item: ' + item.id)
				})
		} else {
			logger.info('	- [new-stock]: ' + item.title)	
			let message = `*Nuevo:* El siguiente producto ha sido listado [${item.title}](${item.link}) con precio *$${item.price}*`		
			if(messagesSubmited < 10) {
				roboto.sendPhoto(item.image, message)
				messagesSubmited++
			}
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
					if (err) logger.error('Error while updating item: ' + item.id)
				}
			)
		}
		// Update in memory catalog
		catalog[key] = item
	})
	logger.info(`Finished processing ${Object.keys(itemsMap).length} items`)
	return catalog
}

async function processIt() {
	logger.info('Ranning cronjob');
	hitPage(target.url)
		.then(Parser)
		.then(saveAndSubmit.bind(null, target.delta))
}
logger.info(`Starting cron for ${targetName} with schedule time: ${target.cron}`)
cron.schedule(target.cron, () => {
	processIt()
});

processIt()
