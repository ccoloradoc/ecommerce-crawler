const fs = require('fs')
const request = require('request');
const cron = require('node-cron');
const Utils = require('./src/commons/utils')
const Roboto = require('./src/roboto')
const config = require('./config.json')

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

function updateInMemory(itemsMap) {
	Object.entries(itemsMap).forEach(([key, item]) => {
		if(inMemoryMap.hasOwnProperty(key)) {
			if(inMemoryMap[key].price > item.price) {
				let message = Utils.concatenate(
					'El siguiente producto ha bajado de precio: ',
					item.title, 
					' de $', inMemoryMap[key].price, ' a $', item.price, ' ',
					item.link
				)
				console.log('	- ', message)
				roboto.submit(message)
			}
		} else {
			let message = Utils.concatenate(
				'El siguiente producto ha sido listado: ',
				item.title, 
				' con precio $', item.price, ' ',
				item.link
			)
			console.log('	+ ', message)
			roboto.submit(message)
		}
	})
	inMemoryMap = itemsMap
	return itemsMap
}

function storeMap(itemsMap) {
	fs.writeFile(target.json, JSON.stringify(itemsMap), err => {
		if (err) {
		  console.error(err)
		}
	  })
	return itemsMap
}

function itemsToCsv(generateFileName, itemsMap) {
	let content = ''
	Object.entries(itemsMap).forEach(([key, item]) => {
		content += Utils.concatenate(
			Utils.escape(item.id), ',', 
			Utils.escape(item.title), ',', 
				Utils.escape(item.price), ',', 
				Utils.escape(item.image), '', 
				Utils.escape(item.link), '\n'
		)
	})
	let filePath = generateFileName(Utils.printableNow())
	console.log('Storing content to: ', filePath)
	fs.writeFile(filePath, content, err => {
		if (err) {
		  console.error(err)
		  return
		}
	  })
	 return itemsMap
}


console.log('Starting cron for ', targetName, ' with schedule time: ', target.cron)
cron.schedule(target.cron, () => {
  	console.log()
	console.log('Ranning cronjob @[', Utils.printableNow(), ']');
	hitPage(target.url)
		.then(Parser)
		.then(updateInMemory)
		.then(storeMap)
		.then(itemsToCsv.bind(null, (timestamp) => {
			return target.csv + timestamp + '.csv'
		}))
});

// hitPage(target.url)
// 	.then(Parser)
// 	.then(updateInMemory)
// 	.then(storeMap)
// 	.then(itemsToCsv.bind(null, (timestamp) => {
// 		return target.csv + timestamp + '.csv'
// 	}))
