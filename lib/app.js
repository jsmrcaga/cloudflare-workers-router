const CORS = ({ origin='*', methods='HEAD,PUT,DELETE,POST,GET,OPTIONS', max_age='86400' }={}) => {
	const get = (what, ...args) => {
		if(what instanceof Function) {
			return what(...args);
		}

		return what;
	};

	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': methods,
		'Access-Control-Max-Age': max_age,
	};
};

class App {
	static CORS = CORS;

	constructor(router, preprocessors=[], postprocessors=[], error_handler=null) {
		if(!router) {
			throw new Error('Please instanciate app with a root router');
		}

		this.router = router;
		this.preprocessors = preprocessors;
		this.postprocessors = postprocessors;
		this.error_handler = null;
		this.websocket_handler = null;
	}

	// Registers pre-processors
	pre_process(preprocessor) {
		if(this.preprocessors.includes(preprocessor)) {
			throw new Error('Pre-processor already registered');
		}

		this.preprocessors.push(preprocessor);
	}

	// Registers post-processors
	post_process(postprocessor) {
		if(this.postprocessors.includes(postprocessor)) {
			throw new Error('Post-processor already registered');
		}

		this.postprocessors.push(postprocessor);
	}

	async_reduce(array, aggregator, index=0, ...args) {
		if(!array[index]) {
			return aggregator instanceof Promise ? aggregator : Promise.resolve(aggregator);
		}

		let callback = array[index](aggregator, ...args);
		if(!(callback instanceof Promise)) {
			callback = Promise.resolve(callback);
		}

		return callback.then(result => {
			// Break the chain if the result is a response
			if(result instanceof Response) {
				return result;
			}

			return this.async_reduce(array, result, index + 1, ...args);
		});
	}

	// Launches pre-processing
	preprocess(request, params, event) {
		return this.async_reduce(this.preprocessors, null, 0, request, params, event);
	}

	// Launches post-processing
	postprocess(response, request, params, event) {
		// Note that the default value for aggregator here is `response`
		return this.async_reduce(this.postprocessors, response, 0, response, request, params, event);
	}

	// Formats response to be sent to client via Cloudflare Workers
	static respond(route) {
		if(!(route instanceof Promise)) {
			route = Promise.resolve(route);
		}

		return route.then(result => {
			if(result instanceof Response) {
				return result;
			}

			if(typeof result === 'string') {
				return new Response(result, {
					status: 200,
					headers: {
						'Content-Type': 'text/plain'
					}
				});
			}

			// Any other object
			if(
				result instanceof Object ||
				typeof result === 'boolean' ||
				!Number.isNaN(result)
			) {
				return new Response(JSON.stringify(result), {
					status: 200,
					headers: {
						'Content-Type': 'application/json'
					}
				});
			}

			return new Response(result, {
				status: 200,
				headers: {
					'Content-Type': 'application/octet-stream'
				}
			});
		});
	}

	error(callback) {
		this.error_handler = callback;
	}

	websocket(callback) {
		this.websocket_handler = callback;
	}

	#websocket(event) {
		if(!this.websocket_handler) {
			return new Response('Cannot handle websockets', { status: 400 });
		}

		const [client, server] = new WebSocketPair();
		return this.websocket_handler({
			client,
			server,
			event,
			request: event.request
		});
	}

	run(event) {
		const { request } = event;
		const { callback, params } = this.router.route(request);
		return this.preprocess(request, params, event).then(preprocessed => {
			// Break the chain and return Response immediately
			if(preprocessed instanceof Response) {
				return preprocessed;
			}

			const result = callback(request, params, preprocessed, event);
			return this.constructor.respond(result);
		}).then(response => {
			return this.postprocess(response, request, params, event);
		}).catch(e => {
			// Handle 500
			if(this.error_handler) {
				return this.error_handler(e, request, params, event);
			}

			return new Response(null, { status: 500 });
		});
	}

	listen() {
		addEventListener('fetch', event => {
			const { request } = event;

			const upgrade = request.headers.get('upgrade');
			if(upgrade) {
				if(upgrade.toLowerCase() !== 'websocket') {
					return event.respondWith(new Response('Cannot upgrade to something else than websockets', { status: 426 }))
				}

				return event.respondWith(this.#websocket(event));
			}

			const response_promise = this.run(event);
			event.respondWith(response_promise);
		});
	}
}

module.exports = App;
