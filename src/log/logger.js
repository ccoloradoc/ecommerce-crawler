const { createLogger, format, transports } = require('winston');
const { combine, splat, timestamp, printf } = format;

const myFormat = printf( ({ level, message, timestamp , ...metadata}) => {
	let msg = `${timestamp} [${level}] : ${message} `
	if (metadata) {
		for (const [key, value] of Object.entries(metadata)) {
			msg += `| ${key}: ${JSON.stringify(value)}`
		}
	}
	return msg
});

module.exports = (function() {
	let logger;

	function createLoggerInstance(path, metadata) {
		return createLogger({
			format: combine(
				format.colorize(),
				splat(),
				timestamp(),
				myFormat
			),
			defaultMeta: {
				...metadata
			},
			transports: [
				new transports.Console(),
				new transports.File({
					filename: path + '/logs/combined.log',
					level: 'info'
				}),
				new transports.File({
					filename: path + '/logs/errors.log',
					level: 'error'
				})
			]
		});
	}

	return {
		getInstance: function(path, metadata) {
			if (!logger) {
				logger = createLoggerInstance(path, metadata);
				logger.info('Creating logger instance')
			}
			return logger;
		},
	};
})();
