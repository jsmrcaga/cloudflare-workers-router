# Cloudlfare Workers Router

This is a simple & lightweight router designed for Cloudflare Workers.

Its main goal is to provide developers with a simple & comfortable interface to
develop a multi-route worker application.

Internally it uses a combination of two radix trees to build routes, allowing the developer
to add regex segments as well as parameter segments to the routes.

## tl;dr

```js
const { Router, App } = require('@control/cloudflare-workers-router');

const router = new Router();

// A simple get route
router.get('/resources', (request, params={}, pre_processed=null, fetch_event) => {
	return [{
		id: 1
	}, {
		id: 2
	}, {
		id: 3
	},]
});

// A route that accepts any HTTP verb
router.any('/resource/1', (request, params={}, pre_processed=null, fetch_event) => {
	return {
		id: 5,
		next: '/resource/2'
	}
});

const app = new App(router);

// pre-process and post-process are async reducers
// they will pass the result from one another
app.pre_process((pre_processed_aggregator, request, params, fetch_event) => {
	// let's imagine a response in format
	// { data: [
	//    // inner data
	// ]}
	return request.json().then(json => json.data);
});

app.pre_process((pre_processed_aggregator, request, params, fetch_event) => {
	// In this second function pre_processed_aggregator === json.data
	// since the 1st one has already passed
	return pre_processed_aggregator.map(data => do_something(data));
});


// You can also "break" the chain by returning a Response
// Obviously, we should have done this before the pre-processing
app.pre_process((pre_processed_aggregator, request, params, fetch_event) => {
	const auth = request.headers.get('Authorization');

	if(auth !== 'my_super_secret_password' && params.object_id === '5') {
		return new Response(null, {
			status: 403
		});
	}

	return pre_processed_aggregator;
});

// Post processing takes the result of every route and allows you to
// do something with it.
// Please note that some formatting will have been made, so response will be an instance of Response
// If no route was found, Response will contain no body and a 404 status

// In this example we add cors headers
// In reality this lib also has a simple cors accessor to make it simpler
app.post_process((response, request, params, event) => {
	const headers = {
		'Access-Control-Allow-Origin': request.headers.get('origin'),
		'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
		'Access-Control-Max-Age': '86400'
	};

	for(const [ key, value ] of Object.entries(headers)) {
		response.headers.set(key, value);
	}

	return response;
});

app.listen();
```

## Usage

The module is divided into two main objects, `Routers` and the `App`.

The `App` module is a small placeholder to allow you to add pre-processing and post-processing to your app, but it is not really needed.
You'll mostly use the routers to add your logic.

This section will start with the Routers so you get an overview, and then we will show the `app` so you can see how it is implemented.


### Router

Using this library is extremely simple, and if you've ever used any other http framekwork on Nodejs, you'll find
it quite similar.

Look at this ping pong example router:

```js
const { Router } = require('@control/cloudflare-workers-router');

// Routing
const sub_router = new Router();
sub_router.get('/resource', (request) => {
	return {
		id: 1
	}
});

const router = new Router();
router.get('/ping', (request) => {
	return 'pong';
});

// this means that the route will be /sub/resource
router.use('/sub', sub_router);

module.exports = router;
```

This router will register the
* `/ping` route, which will simply respond with `pong`
* all the `sub_router` routes, with the `/sub` segment prefixing all of those routes (`/sub/resource`)

> Please note that when using sub-routers they must be complete before merging them. 
> Subtrees are merged into the main tree, which means that modifying them later will have no effect on the main tree.

You can call any of the following methods to register routes:
| Method | HTTP Verb |
|:------:|:---------:|
| `any` | Any of the following |
| `get` | GET |
| `post` | POST |
| `put` | PUT |
| `patch` | PATCH |
| `delete` | DELETE |
| `head` | HEAD |
| `options` | OPTIONS |

#### Sub-routers
Sub routers are there to help you divide your app in different files and make your code more readable.
Otherwise they don't have any other purpose (especially since this lib doesn't support middlewares).

As stated above, sub-routers are _merged_ into the main tree (of the router calling `.use()`), thus making it impossible
for you to make post-merge changes and have them reflected on your final entrypoint.

#### Not using `app`

If you want to skip the `app` module, you can use the `Router.run` method, it takes the request and the pre-processed params, resolves and executes the route, and formats the response.

```js
const router = new Router();

router.get('ping', () => 'pong');

addEventListener('fetch', event => {
	event.respondWith(
		router.run(event.request, null)
	);
});
```

### App

The App module has two main methods, `pre_process` and `post_process`.
These methods register callbacks to run
* preprocess: _before your logic_ but _after route resolution has been made_, allowing you to access the route params.
* postprocess: _after your logic_ AND _after response formatting_ which means that you get a [`Response`](https://developers.cloudflare.com/workers/runtime-apis/response/) with a JSON-strignified body (if the result was not already a string, more on this later)

These methods allow you to add custom logic for authentication or post-processing needs, like CORS header appending.

#### Response formatting
This module will pre-format the response for you, allowing you to "just" return whatever you need to send to your client.

However, this module supposes that you will be sending a string or a json formatted blob, which means that if you return any of the following objects they will be JSON-stringified:

| Types |
|:------:|
| `Object` (`{}`, `[]`, or other) |
| `true` or `false` |
| Any number recognized by `!Number.isNaN` |
