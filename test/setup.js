const { Request, Response } = require('./utils/http');

before(() => {
	global.Response = Response;
	global.Request = Request;
});

after(() => {
	delete global.Response;
	delete global.Request;
});
