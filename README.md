# ecommerce-crawler

### How to install

1. Download the project
```
git clone git@github.com:ccoloradoc/ecommerce-crawler.git
```

2. Install depencendies
```
npm install
```

3. Replace configuration file with your telegram information:
```
"telegram": {
		"apiKey": "Your telegram bot API",
		"channel": "@your-public channel",
		"debugMode": false
	}
```
You can also modify the target details like cronjob frequency and ecommerce query

4. Run the project for the specific target you need
```
node index.js MercadolibreStarWars
```
