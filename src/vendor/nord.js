const requestFactory = require('./src/commons/request')
const config = require('./crawler.config')

let requestHandler =  requestFactory(false)

requestHandler({prod: 'https://api.myip.com'}, '')
.then(console.log)
