const loggerFactory = require('../log/logger')
const urlFilterRegex = /nerf|muneca|monopoly|peluche|muggs|de-mesa/
const brandFilterRegex = /funko|gaming/
const site = 'https://www.walmart.com.mx'

module.exports = function consumeWalmart(content) {
	const logger = loggerFactory.getInstance()
	return new Promise((resolve, reject) => {
		let itemsMap = {}
		logger.info('Parsing content...')
		let payload = JSON.parse(content)
		let totalElements = payload.appendix.SearchResults.content.length
		let filtered = payload.appendix.SearchResults.content
			.filter(item => {
				let result = brandFilterRegex.test(item.brandName.toLowerCase())
				if(result) {
					logger.warn('Filtering out by brandName: ' + item.skuDisplayName)
					return false
				} else {
					return true
				}
			})
			.filter(item => {
				let result = urlFilterRegex.test(item.productSeoUrl.toLowerCase())
				if(result) {
					logger.warn('Filtering out by term: ' + item.skuDisplayName)
					return false
				} else {
					return true
				}
			})
		logger.info('Processing ' + totalElements + ' filter to ' + filtered.length)
		filtered
			.forEach((item, i) => {
				itemsMap[item.id] = {
					id: item.id,
					title: item.skuDisplayName,
					price: item.skuPrice,
					image: site + item.imageUrls.large,
					link: site + item.productSeoUrl.replace(/&.*=.*/, "").replace(/#.*=.*/, ""),
					store: 'Walmart'
				}
				if(item.hasOwnProperty('variants')) {
					item.variants.forEach((variant, i) => {
						itemsMap[variant.id] = {
							id: variant.id,
							title: variant.displayText,
							price: variant.price,
							image: site + variant.smallImage,
							link: site + variant.url.replace(/&.*=.*/, "").replace(/#.*=.*/, ""),
							store: 'Walmart'
						}
					});
				}
			});
		logger.info('Found ' + Object.entries(itemsMap).length + ' elements')
		resolve(itemsMap)
	});
}
