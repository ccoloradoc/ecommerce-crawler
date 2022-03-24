const fs = require('fs')

function JsonDatabase(target) {
	this.target = target
}

JsonDatabase.prototype = {
	read: function() {
		return fs.readFileSync(this.target, {encoding:'utf8', flag:'r'})
	},
	
	write: function(content) {
		console.log('JsonDatabase: writing to ', this.target)
		fs.writeFile(this.target, JSON.stringify(content), err => {
			if (err) {
			  console.error('JsonDatabase: could not write: ', err)
			}
		})
	}
}

module.exports = {
	open: function(filePath) {
		console.log('JsonDatabase: opening database', filePath)
		try {
			fs.accessSync(filePath, fs.constants.F_OK);
		} catch (err) {
			console.log('JsonDatabase: database does not exist... creating one')
			fs.writeFileSync(filePath, "{}")
		}
		return new JsonDatabase(filePath)
	},
	
	
}
