module.exports = {
	escape: function(text) {
		return '"' + text + '"'
	},

	clean: function(price) {
		return parseInt(price.replace(',', '').replace('$', ''))
	},
	
	printableNow: function() {
		var currentdate = new Date(); 
		return currentdate.getDate() + "-"
	                + (currentdate.getMonth()+1)  + "-" 
	                + currentdate.getFullYear() + "T"  
	                + currentdate.getHours() + "."  
	                + currentdate.getMinutes() + "." 
	                + currentdate.getSeconds();
	},
	
	concatenate: function() {
		let str = ''
		for(var i = 0; i < arguments.length; i++) {
			str+= arguments[i]
		}
		return str
	},
	
	
}
