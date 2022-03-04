const { RouterTree, Route } = require('./tree');

const RouterProxy = {
	get: (obj, prop) => {
		if(prop in obj) {
			return obj[prop];
		}

		const method = prop.toLowerCase();
		if(!Route.ALLOWED_METHODS.includes(method)) {
			throw new TypeError(`Method ${method} unknown`);
		}

		return (path, callback, strict=false) => {
			obj.register({ method, path, callback, strict });
		};
	}
};

class Router {
	constructor() {
		this.tree = new RouterTree();
		return new Proxy(this, RouterProxy);
	}

	default(callback, method='any') {
		this.tree.default_route.update(new Route({
			methods: {
				[method]: callback
			}
		}));
	}

	route(request) {
		const url = new URL(request.url);

		let { pathname } = url;
		// Remove the last slash
		pathname = pathname.replace(/\/$/, '');

		let { method } = request;
		method = method.toLowerCase();

		const { callback, params } = this.tree.find(method, pathname);

		if(!callback) {
			// No match, 404
			return {
				callback: (request) => {
					return new Response(null, { status: 404 });
				},
				params: {}
			};
		}

		return { callback, params };
	}

	register({ method, path, callback, strict=false }) {
		this.tree.register(method, path, callback, strict);
	}

	use(path, router) {
		// Will merge this router's tree with the given router tree
		// This is quite simple, we just retrieve all routes from the router
		// and then build every "new" path with the path prefix.
		// Then we just register those to our tree
		this.tree.merge({
			prefix: path,
			tree: router.tree
		});
	}
}

module.exports = Router;
