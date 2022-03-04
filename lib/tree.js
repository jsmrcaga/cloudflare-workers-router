class Route {
	static ALLOWED_METHODS = [
		'any',
		'get',
		'post',
		'put',
		'patch',
		'delete',
		'head',
		'options'
	];

	constructor({ methods={} }={}) {
		// methods is map of method => callback
		this.methods = methods;
	}

	for_method(method, params={}) {
		if(method.toLowerCase() in this.methods) {
			return {
				callback: this.methods[method],
				params
			};
		}

		// If no other method matches, we check if we have a default route
		if(this.methods.any) {
			return {
				callback: this.methods.any,
				params
			};
		}

		return {
			callback: null,
			params
		};
	}

	register(method, callback) {
		method = method.toLowerCase();
		if(!this.constructor.ALLOWED_METHODS.includes(method)) {
			throw new TypeError(`method can only be one of ${this.constructor.ALLOWED_METHODS.join(', ')}`)
		}

		this.methods[method] = callback;
	}

	update(new_route, strict=false) {
		if(strict) {
			for(const method of Object.keys(new_route.methods)) {
				if(this.methods[method]) {
					throw new Error(`Method ${method} already declared for this route (strict mode)`);
				}
			}
		}
		// Update route with new methods
		this.methods = {
			...this.methods,
			...new_route.methods
		};
	}
}

class RouteNode {
	constructor({ path='/', children=new Map(), regex_routes=new Map(), route=null, param_name=null }={}) {
		// Path is just for debugging purposes, the real location
		// is in the children map of the parent
		this.path = path;

		// children is an object { 'plep': Noe }
		this.children = children;
		this.route = route;

		this.regex_routes = regex_routes;
		this.param_name = param_name;
	}

	update_route(new_route, strict=false) {
		if(!this.route) {
			this.route = new_route;
			return;
		}

		this.route.update(new_route, strict);
	}

	add_child(path, route, strict=false) {
		if(path.length === 0) {
			return this.update_route(route, strict);
		}

		if(path instanceof RegExp) {
			this.regex_routes.set(path, route);
			return;
		}

		// Special checks for regex
		if(path.length === 1) {
			const first = path[0];
			// Case where regexp is nested
			if(first instanceof RegExp) {
				this.regex_routes.set(first, route);
				return;
			}
		}

		let first = path.shift();
		let param_name = null;

		if(first[0] === ':') {
			param_name = first.replace(/^:/, '');
			first = null;
		}

		if(!this.children.get(first)) {
			this.children.set(first, new RouteNode({
				path: first,
				param_name
			}));
		}

		return this.children.get(first).add_child(path, route, strict);
	}

	find(path, params={}) {
		if(path.length === 0) {
			return {
				route: this.route,
				params
			};
		}

		const pathname = path.join('/');

		const first = path.shift();
		if(this.children.get(first)) {
			// advance in tree
			return this.children.get(first).find(path);
		}

		for(const [regex, route] of this.regex_routes.entries()) {
			if(regex.test(pathname)) {
				return {
					route,
					params
				};
			}
		}

		if(this.children.get(null)) {
			const param_node = this.children.get(null);
			params[param_node.param_name] = first;
			return param_node.find(path, params);
		}

		return {
			route: null,
			params
		};
	}
}

class RouterTree {
	constructor({ default_route=new Route() } = {}) {
		this.root = new RouteNode();

		if(default_route && !(default_route instanceof Route) && default_route !== DefaultRouteProxy) {
			throw new TypeError('default_route must be an instance of Route');
		}

		this.default_route = default_route;
	}

	get_path(pathname) {
		if(Array.isArray(pathname)) {
			return pathname;
		}

		if(['', '/'].includes(pathname)) {
			// split on / will return ['', '']
			// spliut on '' will return ['']
			return [];
		}

		// Remove the first `/` to simplify recursion later
		return pathname.replace(/^\//, '').split('/');
	}

	get_default(method) {
		return this.default_route.for_method(method);
	}

	find(method, pathname) {
		method = method.toLowerCase();
		const path = this.get_path(pathname);
		const { route, params } = this.root.find(path);

		if(!route) {
			return this.get_default(method);
		}

		return route.for_method(method, params);
	}

	register(method=null, path='/', callback, strict=false) {
		// Path can be a regex
		if(typeof path !== 'string' && !(path instanceof RegExp) && !Array.isArray(path)) {
			throw new TypeError('path must be a string or a regexp');
		}

		// allow registering routes directly
		let route = null;
		if(callback instanceof Route) {
			route = callback;
		} else {
			route = new Route();
			route.register(method, callback);
		}

		path = typeof path === 'string' ? this.get_path(path) : path;
		this.root.add_child(path, route, strict);
	}

	find_values(node, path=[]) {
		const paths = [];

		if(node.route) {
			// entries format [key, value]
			paths.push([
				[...path],
				node.route
			]);
		}

		// children & regex are maps
		for(let [segment, _node] of node.children.entries()) {
			// push new path to paths which will be augmented by every child
			if(segment === null) {
				// special case for named arguments
				segment = `:${_node.param_name}`;
			}
			const child_paths = this.find_values(_node, [...path, segment]);
			paths.push(...child_paths);
		}

		for(const [regex, _node] of node.regex_routes.entries()) {
			const child_paths = this.find_values(_node, [...path, regex]);
			paths.push(...child_paths);
		}

		return paths;
	}

	entries(path_prefix=[]) {
		// build paths (arrays, to keep regexes) with values
		// using a depth first search
		return this.find_values(this.root, path_prefix);
	}

	merge({ prefix='/', tree, strict=false }) {
		const path = this.get_path(prefix);
		const entries = tree.entries(path);
		for(const [path, route] of entries) {
			this.register(
				null,
				path,
				route,
				strict
			);
		}
	}
}

module.exports = { RouterTree, Route };
