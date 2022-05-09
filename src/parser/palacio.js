const cheerio = require('cheerio');
const Utils = require('../commons/utils')
const loggerFactory = require('../log/logger')
const filterRegex = /FUNKO|POP|LEGO|PLAYSKOOL|MECHANIX|STUDIOS/
const urlFilter = /[\?|&](\w*=\w*)/g

module.exports = function consumeMercadoLibreResultPage(content) {
	const logger = loggerFactory.getInstance()
	return new Promise((resolve, reject) => {
		logger.info('Parsing content...')
		const $ = cheerio.load(content)
		let itemsMap = {}
		$('.m-product').each((index, node) => {
			let id = $(node).attr()['data-pid']
			let title = $(node).find('.b-product_tile-name').text()
			let link = $(node).find('.b-product_tile-name').attr()['href']
			let brand = $(node).find('.b-product_tile-brand').text()
			let price = $(node).find('.b-product_price-sales .b-product_price-value').attr()['content']
			let image = $(node).find('.b-product_image img').attr()['data-src']	
			
			link = link.replace(urlFilter, "")
			image = image.replace(urlFilter, "")
			
			itemsMap[id] = {
				id: id,
				title: title.replace("'", "").trim(),
				price: price,
				brand: brand.trim(),
				image: image,
				link: `https://www.elpalaciodehierro.com/${link}`,
				store: 'Palacio de hierro'
			}
		});

		logger.info('Found ' + Object.entries(itemsMap).length + ' elements')
		resolve(itemsMap)
	});
}
