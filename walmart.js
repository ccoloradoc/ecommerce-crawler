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
const moment = require('moment')

moment.locale('es-mx');

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
	let items = await Item.find({source: targetName})
	items.forEach((item, i) => {
		map[item.id] = item
	})
	logger.info(`Fetching ${items.length} from database`)
	return map
}

async function updateItem(id, object) {
	logger.info(`\tAttempting to update: ${id}`, object)
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

async function sendPhotoAndUpdate(message, image, item, alarm) {
	if(alarm) {
		roboto.sendPhoto(image, message)
			.then(message => {
				let telegram = {}
				if(message && message.hasOwnProperty('message_id')) {
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
					lastSubmitedAt: Date.now(),
					...telegram
				}
				updateItem(item.id, object)
			})
			.catch(function (err) {
				let object = { 
					title: item.title,
					image: item.image,
					price: item.price,
					link: item.link,
					store: item.store,
					available: true,
					lastSubmitedAt: Date.now()
				}
				updateItem(item.id, object)
			})
	} else {
		updateItem(item.id, { 
			title: item.title,
			image: item.image,
			price: item.price,
			link: item.link,
			store: item.store,
			available: true,
			lastSubmitedAt: Date.now()
		})
	}
}

async function saveAndSubmit(delta, telegramThreshold, itemsMap) {
	let messagesSubmited = 0
	let availableItems = []
	let catalog = await refreshCatalogFromDatabase()
	
	Object.entries(itemsMap).forEach(([key, item]) => {
		// If item exist in catalog
		if(catalog.hasOwnProperty(key)) {
			let catalogItem = catalog[key]
			let increase = 100 - item.price * 100 / catalog[key].price
			let available = true
			let message = ''
			if(item.price == 0) {
				logger.info('	- [no-stock]: ' + item.title)
				available = false
			} else if(catalog[key].price == 0) {
				logger.info('	- [new-stock]: ' + item.title)
				message = `*Nuevo:* El siguiente producto ha sido listado [${item.title}](${item.link}) con precio *$${item.price}* en ${item.store}`
			} else if(item.price <= catalog[key].threshold) {
				var duration = moment.duration(moment(Date.now()).diff(catalog[key].lastSubmitedAt));
				var hours = duration.asHours();
				logger.info('	- [supa-deal]: ' + item.title)
				if(hours >= telegramThreshold) {
					message = `*Super Deal:* El siguiente producto ha alcanzado el target [${item.title}](${item.link}) de $${catalogItem.threshold} con el precio *$${item.price}* en ${item.store}`
				}
			} else if(increase > delta) {
				logger.info('	- [deal]: ' + item.title)
				message = `*Deal:* El siguiente producto ha bajado  ${Math.floor(increase)}% [${item.title}](${item.link}) de $${catalog[key].price} a *$${item.price}* en ${item.store}`
			} else if(increase < -delta) {
				logger.info('	- [missing-deal]: ' + item.title)
				//message = `*Rising:* El siguiente producto ha subido ${Math.floor(-increase)}% [${item.title}](${item.link}) de $${catalog[key].price} a *$${item.price}* en ${item.store}`
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
					sendPhotoAndUpdate(message, image, item, catalogItem.alarm)
				} else {
					updateItem(item.id, {
						...item,
						available: true,
						lastSubmitedAt: Date.now()
					})
				}
			} else {
				availableItems.push(key)
			}
		} else {
			if(item.price == 0) {
				logger.info('	- [no-stock]: ' + item.title)
			} else {
				logger.info('	- [new-stock]: ' + item.title)
				let message = `*Nuevo:* El siguiente producto ha sido listado [${item.title}](${item.link}) con precio *$${item.price}* en ${item.store}`
				let image = item.image
				sendPhotoAndUpdate(message, image, item, true)
			}
		}
		catalog[key] = item
	})
	let ack = await Item.updateMany({ id: { $in: availableItems }, source: targetName }, { available: true, availableAt: Date.now() })
	logger.info(`Updating availability: requested ${availableItems.length} resolved ${ack.modifiedCount} of ${ack.matchedCount}`, ack)
	logger.info(`Finished processing ${Object.keys(itemsMap).length} items`)
	return catalog
}

async function processIt() {
	logger.info('Ranning cronjob');
	Promise.all([
		requestHandler(target.url, '&page=0')
			.then(Parser),
		requestHandler(target.url, '&page=1')
			.then(Parser),
		requestHandler(target.url, '&page=2')
			.then(Parser),
		requestHandler(target.url, '&page=3')
			.then(Parser)
	])
	.then(MapUtils.mergeMaps)
	.then(saveAndSubmit.bind(null, target.delta, target.telegramThreshold))
}

logger.info(`Starting cron for ${targetName} with schedule time: ${target.cron}`)
cron.schedule(target.cron, () => {
  	processIt()
});

processIt()
