const cheerio = require('cheerio');
const Utils = require('../commons/utils')
const AmazonIdRegex = /dp\/(\w+)/

function parseId(link) {
	let regexResult = link.match(AmazonIdRegex)
	if(regexResult != null && regexResult.length == 2) {
		return regexResult[1]
	}
	return ""
}

module.exports = function consumeMercadoLibreResultPage(content) {
	return new Promise((resolve, reject) => {
		console.log('Parsing content...')
		const $ = cheerio.load(content)
	    let itemsMap = {}
	    $('.s-main-slot.s-result-list .s-result-item.s-asin').each((index, node) => {
	    	let title = $(node).find('.s-title-instructions-style .s-link-style .a-text-normal').text()
			let isPromo = $(node).find('.s-title-instructions-style .a-spacing-micro').text()
	    	let price = $(node).find('.s-price-instructions-style .s-link-style .a-price:not(.a-text-price) .a-offscreen').text()
			let link = $(node).find('.s-title-instructions-style .s-link-style').attr()['href']
	    	let image = $(node).find('.s-product-image-container .s-image').attr()['src']	
			if(price == "") {
				price = "0"
			}
			if(isPromo == "") {
				let id = parseId(link)
				itemsMap[id] = {
					id: id,
					title: title,
					price: Utils.clean(price),
					image: image,
					link: 'https://www.amazon.com.mx' + link,
					submited: false
				}
			}
	    })
		resolve(itemsMap)
	});
}
