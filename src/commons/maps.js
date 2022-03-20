const fs = require('fs')
const Utils = require('./utils')

module.exports = {
	mergeMaps: function(maps) {
		let mergedMaps = {}
		maps.forEach((map, i) => {
			Object.keys(map).forEach((key, i) => {
				mergedMaps[key] = map[key]
			});
			
		});
		return mergedMaps
	},
	
	storeMap: function(filePath, itemsMap) {
		fs.writeFile(filePath, JSON.stringify(itemsMap), err => {
			if (err) {
			  console.error(err)
			}
		  })
		return itemsMap
	},
	
	itemsToCsv: function(generateFileName, itemsMap) {
		let content = ''
		Object.entries(itemsMap).forEach(([key, item]) => {
			content += Utils.concatenate(
				Utils.escape(item.id), ',', 
				Utils.escape(item.title), ',', 
					Utils.escape(item.price), ',', 
					Utils.escape(item.image), ',', 
					Utils.escape(item.link), '\n'
			)
		})
		let filePath = generateFileName()
		console.log('Storing content to: ', filePath)
		fs.writeFile(filePath, content, err => {
			if (err) {
			  console.error(err)
			  return
			}
		  })
		 return itemsMap
	}
}
