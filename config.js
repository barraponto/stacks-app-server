exports.DATABASE_URL = process.env.DATABASE_URL ||
                    global.DATABASE_URL ||
                    'mongodb://stacks:stacksapp@ds121955.mlab.com:21955/stacks-app';

exports.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
					'mongodb://stacks:stackstest@ds121945.mlab.com:21945/test-stacks-app';

exports.PORT = process.env.PORT || 8080;
exports.JWT_SECRET = process.env.JWT_SECRET || 'deal';
exports.JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';