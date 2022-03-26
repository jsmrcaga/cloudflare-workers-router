const { Request, Response } = require('./utils/http');
const { KV_BINDING } = require('./utils/kv');

before(() => {
	global.Response = Response;
	global.Request = Request;
	global.KV_MOCK = KV_BINDING;
});

after(() => {
	delete global.Response;
	delete global.Request;
});
