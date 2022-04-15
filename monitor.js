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

let requestHandler =  requestFactory(target.debug)
let catalog = {}

async function updateMonitorCatalog() {
	let items = await Monitor.find({ active: true })
	console.log(`Fetching ${items.length} items from database`)
	items.forEach((item, i) => {
		catalog[item.id] = item
	});
	return Promise.resolve(items)
}

async function fetchProductsBySkus(items) {
	let skus = items.map(item => item.id).join(',');
	return requestHandler(target.url, skus)
}

async function parserAndUpdate(products) {
	let promises = products.map(item => {
		let monitor = catalog[item.id]
		logger.info(`Updating availability for ${monitor.id} - ${monitor.title}`);
		processItem(item.id, item)
	})
	return Promise.all(promises)
}

async function processItem(sku, item) {
	return new Promise((resolve, reject) => {
		let monitor = catalog[sku]
		if(item.isInvAvailable) {
			let actualPrice = item.price
			let message = ''
			if(actualPrice < monitor.price) {
				message = `*DEAL:* El siguiente producto ha bajado de precio [${monitor.title}](${monitor.link}) de $${monitor.price} a *$${actualPrice}* en ${monitor.store}`		
				logger.info(`\tDEAL: ${sku} - ${monitor.title} available at price ${actualPrice}`)
			} else if(actualPrice == monitor.price) {
				if(monitor.monitor == true) {
					message = `*Disponible:* El siguiente producto sigue disponible [${monitor.title}](${monitor.link}) con precio *$${actualPrice}* en ${monitor.store}`		
					logger.info(`\tAVAILABLE: ${sku} - ${monitor.title} available at price ${actualPrice}`)
				}
			} else {
				message = `*RAISING:* El siguiente producto ha subido de precio [${monitor.title}](${monitor.link}) de $${monitor.price} a *$${actualPrice}* en ${monitor.store}`		
				logger.info(`\tRAISING: ${sku} - ${monitor.title} available at price ${actualPrice}`)
			}
			
			if(message.length > 0) {
				let image = ''
				if(monitor.fileId == undefined) {
					logger.warn(`\tUndefined File: ${sku} - ${monitor.title}`)
					image = monitor.image
				} else {
					image = monitor.fileId
				}
				roboto.sendPhoto(image, message)
					.then(message => {
						let object = { 
							price: item.price,
							fileId: message.file.file_id,
							messageId: message.message_id,
							chatId: message.chat_id,
							monitor: false 
						}
						Monitor.updateOne({
								id: sku
							}, object,  {
								upsert: false,
								setDefaultsOnInsert: true
							}, function(err, response) {
								if (err) {
									logger.error('Error while updating item: ' + targetSku, err)
									reject(err)
								}
								logger.info('Saving:', { id: sku, ...object})
								resolve()
							});
					})
			}
		} else {
			logger.info(`\tNOT AVAILABLE: ${sku} - ${monitor.title} is not available`)
			Monitor.updateOne({
					id: sku
				}, {
					price: 0,
					monitor: true
				},  {
					upsert: false,
					setDefaultsOnInsert: true
				}, function(err, response) {
					if (err) {
						logger.error('Error while updating item: ' + targetSku, err)
						reject(err)
					}
					logger.info('Saving:', { id: sku})
					resolve()
				});
		}
	});
}

async function processIt() {
	logger.info('Ranning cronjob');
	updateMonitorCatalog()
		.then(fetchProductsBySkus)
		.then(Parser)
		.then(parserAndUpdate)
}

async function cleanup() {
	logger.info('Clearing monitor flag')
	await Monitor.updateMany({ active: true }, { monitor: true }, {upsert : true, multi: true});
}

logger.info(`Starting cron for ${targetName} with schedule time: ${target.cron}`)
cron.schedule(target.cron, () => {
	processIt()
});

processIt()

cron.schedule("12 */5 * * *", () => {
	cleanup()
});
