const cheerio = require('cheerio');
const Utils = require('../commons/utils')
const loggerFactory = require('../log/logger')
const filterRegex = /FUNKO|POP|LEGO|PLAYSKOOL|MECHANIX|STUDIOS/

module.exports = function consumeMercadoLibreResultPage(content) {
	const logger = loggerFactory.getInstance()
	return new Promise((resolve, reject) => {
		logger.info('Parsing content...')
		const $ = cheerio.load(content)
		let itemsMap = {}
		let script = $('#__NEXT_DATA__').html()
		let json = JSON.parse(script)
		json.query.data.mainContent.records
		.filter(item => {
			return !filterRegex.test(item.allMeta.brand)
		})
		.forEach((item, i) => {
			let id = item.allMeta.id
			let titleDashed = item.allMeta.title.replace(/\s+/g, "-")
			itemsMap[id] = {
				id: id,
				title: item.allMeta.title,
				price: item.allMeta.maximumPromoPrice || item.allMeta.maximumListPrice,
				image: item.allMeta.productImages[0].largeImage,
				link: `https://www.liverpool.com.mx/tienda/pdp/${titleDashed}/${id}`,
				brand: item.allMeta.brand,
				store: 'Liverpool'
			}
		});
		logger.info('Found ' + Object.entries(itemsMap).length + ' elements')
		resolve(itemsMap)
	});
}
