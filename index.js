const fs = require('fs')
const axios = require('axios')
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

function requestAndParse(target) {
	let logger = loggerFactory.getInstance()
	let requestList = []
	if(typeof target == 'object') {
		logger.info(`Multiple endpoints requested: [${target.length}]`)
		requestList = target.map(url => {
			logger.info(`Submiting request: [${url}]`)
			return axios.get(url).then(response => response.data).then(Parser)
		})
	} else {
		logger.info(`Submiting request: [${target}]`)
		return axios.get(target).then(response => response.data).then(Parser)
	}
	return Promise.all(requestList).then(responses => {
		let join = {}
		responses.forEach(response => {
			Object.entries(response).forEach(([key, item]) => {
				if(join.hasOwnProperty(key)) {
					logger.warn(`Found duplicated entry: [${key}] - ${item.title} vs ${join[key].title}`)
				} else {
					join[key] = item
				}
			})
		});
		logger.info(`Returned ${responses.length} and flattered to ${Object.keys(join).length}`)
		return join;
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

async function updateItem(id, object) {
	Item.findOneAndUpdate({
			id: id,
			source: targetName
		}, {
			$set: {
				...object
			}
		}, {
			upsert: true
		},
		function(err, item) {
			if (err) {
				logger.error(`\tError while updating item: ${id}`, err)
			}
			logger.info(`\tSuccessfully updating item: ${id}`, object)
		})
}

async function sendPhotoAndUpdate(message, image, item) {
	roboto.sendPhoto(image, message)
		.then(message => {
			let telegram = {}
			if(message.hasOwnProperty('message_id')) {
				telegram = {
					fileId: message.file.file_id,
					messageId: message.message_id,
					chatId: message.chat_id,
				}
			}
			let object = { 
				title: item.title,
				image: item.image,
				price: item.price,
				link: item.link,
				store: item.store,
				available: true,
				...telegram
			}
			updateItem(item.id, object)
		})
}

async function saveAndSubmit(delta, itemsMap) {
	let messagesSubmited = 0
	let availableItems = []
	let catalog = await refreshCatalogFromDatabase()
	// Clean database
	let cleanAck = await Item.updateMany({ source: targetName }, { available: false })
	logger.info(`Cleaning availability ${cleanAck.modifiedCount} of ${cleanAck.matchedCount}`)

	Object.entries(itemsMap).forEach(([key, item]) => {
		// If item exist in catalog
		if(catalog.hasOwnProperty(key)) {
			let catalogItem = catalog[key]
			let message = ''
			// catalog[key].price   -> 100%
			// item.price           -> x?
			// Increase
			let increase = 100 - item.price * 100 / catalog[key].price;
			// Sending message if price is lower
			if(increase >= delta) {
				logger.info(`\t[deal]: ${item.title}`, item)
				message = `*Deal:* El siguiente producto ha bajado ${Math.floor(increase)}% [${item.title}](${item.link}) de $${catalogItem.price} a *$${item.price}* en ${item.store}`
			} else if(increase <= -delta) {
				logger.info(`\t[raising]: ${item.title}`, item)
				//message = `*Raising:* El siguiente producto ha subido ${Math.floor(-increase)}% [${item.title}](${item.link}) del $${catalogItem.price} a *$${item.price}* en ${item.store}`
			}			
			if(message.length > 0) {
				let image = ''
				if(catalogItem.fileId == undefined) {
					logger.warn(`\tUndefined File: ${key} - ${catalogItem.title}`)
					image = catalogItem.image
				} else {
					image = catalogItem.fileId
				}
				if(catalogItem.alarm) {
					sendPhotoAndUpdate(message, image, item)
				}
			} else {
				availableItems.push(key)
			}
		} else {
			logger.info(`\t[new-stock]: ${item.title}`)	
			let message = `*Nuevo:* El siguiente producto ha sido listado [${item.title}](${item.link}) con precio *$${item.price}* en ${item.store}`		
			let image = item.image
			sendPhotoAndUpdate(message, image, item)
		}
		// Update in memory catalog
		catalog[key] = item
	})
	let ack = await Item.updateMany({ id: { $in: availableItems }, source: targetName }, { available: true })
	logger.info(`Updating availability: requested ${availableItems.length} resolved ${ack.modifiedCount} of ${ack.matchedCount}`, ack)
	
	logger.info(`Finished processing ${Object.keys(itemsMap).length} items`)
	return catalog
}

async function processIt() {
	logger.info('Ranning cronjob');
	requestAndParse(target.url)
		.then(saveAndSubmit.bind(null, target.delta))
}
logger.info(`Starting cron for ${targetName} with schedule time: ${target.cron}`)
cron.schedule(target.cron, () => {
	processIt()
});

processIt()
