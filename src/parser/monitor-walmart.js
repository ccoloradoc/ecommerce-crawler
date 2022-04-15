module.exports = function consumeWalmartResultPage(response) {
	let content = JSON.parse(response)
	let result = []
	for (const [sku, item] of Object.entries(content.offerDetails)) {
		result.push({
			id: sku,
			price: parseInt(item[0].priceInfo.specialPrice),
			isInvAvailable: item[0].isInvAvailable,
			store: item[0].sellerName
		})
	}
	return Promise.resolve(result)
}
