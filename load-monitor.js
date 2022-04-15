const cron = require('node-cron');
const mongoose = require('mongoose');
const Roboto = require('./src/roboto')
const loggerFactory = require('./src/log/logger')
const requestFactory = require('./src/commons/request')
const Monitor = require('./src/model/monitor')
const config = require('./crawler.config')

// Obtaining configuration details
const targets = Object.keys(config.targets)
const processArgs = process.argv.slice(2);
let target = {}
let targetName = ''
let targetSku = ''
if(processArgs.length > 0) {
	targetName = processArgs[0]
	target = config.targets[targetName]
	targetSku = processArgs[1]
} else if(targets.length > 0) {
	targetName = targets[0]
	target = config.targets[targetName]
}

let logger = loggerFactory.getInstance(__dirname, { source: targetName})
logger.info('Runs as: node load-monitor.js LoadMonitorWalmartItem <your-sku>')

logger.info('Processing target: ' + targetName)

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

let requestHandler =  requestFactory(target.debug)

console.log(`Monitor ${targetSku}`)
requestHandler(target.url, targetSku)
	.then((response) => {
		let root = JSON.parse(response)
		let item = root.product.childSKUs[0]
		let object = {
			id: targetSku,
			title: item.displayName,
			price: item.offerList[0].priceInfo.specialPrice,
			image: 'https://www.walmart.com.mx' + item.largeImageUrl,
			link: 'https://www.walmart.com.mx' + root.product.productSeoUrl,
			source: 'Monitor',
			store: target.name,
			active: true,
			monitor: true
		}
		Monitor.updateOne({
				id: targetSku
			}, object, {
				upsert: true,
				setDefaultsOnInsert: true
			}, function(err, response) {
				if (err) logger.error('Error while updating item: ' + targetSku, err)
				logger.info(`Successfully updated ${object.id} - ${object.title}`, object)
				mongoose.connection.close()
			});
	})
