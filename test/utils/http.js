// Mocks for request & Response
class Headers {
	constructor(headers={}) {
		this.headers = {};
		for(const [k, v] of Object.entries(headers)) {
			this.set(k, v);
		}
	}

	get(name) {
		return this.headers[name.toLowerCase()] || null;
	}

	set(name, value) {
		this.headers[name.toLowerCase()] = value;	
	}

	entries() {
		return Object.entries(this.headers);
	}
}

class Request {
	constructor({ method='get', body, url, headers={} }={}) {
		this.url = url;
		this.body = body;
		this.method = method;
		this.headers = new Headers(headers);
	}

	json() {
		return Promise.resolve(this.body);
	}
}

class Response {
	constructor(body, { headers={}, method, status }={}) {
		this.body = body;
		this.method = method;
		this.status = status;
		this.headers = new Headers(headers);
	}
}

module.exports = {
	Response,
	Request,
	Headers
};
