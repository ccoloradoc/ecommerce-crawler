const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Item = require('./src/model/item')
const Utils = require('./src/commons/utils')
const MapUtils = require('./src/commons/maps')
const Roboto = require('./src/roboto')
const loggerFactory = require('./src/log/logger')
const requestFactory = require('./src/commons/request')
const config = require('./crawler.config')

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

logger.info('Initializing telegram interface')
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
	})
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
			let available = true
			if(item.price == 0) {
				logger.info('	- [no-stock]: ' + item.title)
				available = false
			} else if(catalog[key].price == 0) {
				logger.info('	- [new-stock]: ' + item.title)
				let message = `*Nuevo:* El siguiente producto ha sido listado [${item.title}](${item.link}) con precio *$${item.price}* en ${item.store}`
				if(messagesSubmited < 10) {
					messagesSubmited++
					roboto.sendPhoto(item.image, message)
				}
			} else if(catalog[key].price > item.price + delta) {
				logger.info('	- [deal]: ' + item.title)
				let message = `*Deal:* El siguiente producto ha bajado de precio [${item.title}](${item.link}) de $${catalog[key].price} a *$${item.price}* en ${item.store}`
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
						store: item.store,
						available: available
					}
				},
				function(err, item) {
					if (err) logger.error('Error while updating item: ' + item.id)
				})
		} else {
			let available = true
			if(item.price == 0) {
				available = false
				logger.info('	- [no-stock]: ' + item.title)
			} else {
				logger.info('	- [new-stock]: ' + item.title)
				let message = `*Nuevo:* El siguiente producto ha sido listado [${item.title}](${item.link}) con precio *$${item.price}* en ${item.store}`
				if(messagesSubmited < 10) {
					roboto.sendPhoto(item.image, message)
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
					if (err) logger.error('Error while updating item: ' + item.id)
				}
			)
		}
		catalog[key] = item
	})
	logger.info(`Finished processing ${Object.keys(itemsMap).length} items`)
	return catalog
}

async function processIt() {
	logger.info('Ranning cronjob');
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

logger.info(`Starting cron for ${targetName} with schedule time: ${target.cron}`)
cron.schedule(target.cron, () => {
  	processIt()
});

processIt()
