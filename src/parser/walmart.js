
module.exports = function consumeWalmart(content) {
	return new Promise((resolve, reject) => {
		let itemsMap = {}
		console.log('Parsing content...')
		let payload = JSON.parse(content)
		let filtered = payload.appendix.SearchResults.content
			.filter(item => {
				let term = item.productSeoUrl.toLowerCase()
				if(
					term.includes("muneca") ||
					term.includes("nerf") ||
					term.includes("funko") ||
					term.includes("disney") ||
					term.includes("monopoly") || 
					term.includes("juego-de-mesa") ||
					term.includes("juegos-de-mesa") ||
					term.includes("peluche") ||
					term.includes("muggs")
				) {
					return false
				} else {
					return true
				}
			})
		console.log('Processing ', payload.appendix.SearchResults.content.length, ' filter to ', filtered.length)
		filtered
			.forEach((item, i) => {
				itemsMap[item.id] = {
					id: item.id,
					title: item.skuDisplayName,
					price: item.skuPrice,
					image: item.imageUrls.large,
					link: 'https://www.walmart.com.mx' + item.productSeoUrl,
					submited: false
				}
			});
		
		console.log('Found ', Object.entries(itemsMap).length, ' elements')
		resolve(itemsMap)
	});
}
