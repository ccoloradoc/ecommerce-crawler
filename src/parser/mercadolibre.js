const cheerio = require('cheerio');
const Utils = require('../commons/utils')
const loggerFactory = require('../log/logger')
const MLRegex = /mercadolibre.com.mx\/(\w+-\w+)/

function parseId(link) {
	let regexResult = link.match(MLRegex)
	if(regexResult.length == 2) {
		return regexResult[1]
	}
	return ""
}

module.exports = function consumeMercadoLibreResultPage(content) {
	const logger = loggerFactory.getInstance()
	return new Promise((resolve, reject) => {
		logger.info('Parsing content...')
		const $ = cheerio.load(content)
	    let itemsMap = {}
	    $('.ui-search-layout--grid .ui-search-layout__item').each((index, node) => {
	    	let title = $(node).find('.ui-search-item__title').text()
	    	let price = $(node).find('.ui-search-price--size-medium .ui-search-price__second-line .price-tag-fraction').text()
			let link = $(node).find('.ui-search-link').attr()['href']
	    	let image = $(node).find('.ui-search-result-image__element').attr()['data-src']	
			let id = parseId(link)
			itemsMap[id] = {
				id: id,
				title: title,
				price: Utils.clean(price),
				image: image,
				link: link.replace(/&.*=.*/, "").replace(/#.*=.*/, ""),
				store: 'Mercado Libre'
			}
	    })
		logger.info('Found ' + Object.entries(itemsMap).length + ' elements')
		resolve(itemsMap)
	});
}
