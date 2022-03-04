const { expect } = require('chai');

const App = require('../../lib/app');
const Router = require('../../lib/router');

const { Response } = require('../utils/http');

describe('App', () => {
	const router = new Router();

	router.get('/plep/plop', (request, params, preprocessed, event) => {
		return {
			id: 1
		};
	});

	it('Should instanciate an app with a router', () => {
		expect(() => new App(router)).to.not.throw;
		const app = new App(router);
		expect(app.router).to.be.eql(router);
		expect(app.preprocessors).to.have.length(0);
		expect(app.postprocessors).to.have.length(0);
	});

	it('Should register and preprocess', done => {
		const request = {};
		const params = 5;
		const event = {};

		const pre_1 = (agg, request, params, event) => {
			expect(agg).to.be.null;
			expect(request).to.be.eql(request);
			expect(params).to.be.eql(5);
			expect(event).to.be.eql(event);

			// Test fake async
			return new Promise((resolve) => {
				setTimeout(() => resolve(params + 3), 10);
			});
		};

		const pre_2 = (agg, request, params, event) => {
			expect(agg).to.be.eql(5 + 3);
			expect(request).to.be.eql(request);
			expect(params).to.be.eql(5);
			expect(event).to.be.eql(event);
			return agg * 7;
		};

		const app = new App(router);
		app.pre_process(pre_1);
		app.pre_process(pre_2);

		app.preprocess(request, params, event).then(result => {
			expect(result).to.be.eql((5 + 3) * 7);
			done();
		}).catch(e => done(e));
	});


	it('Should register and post_process', done => {
		const response = {};
		const request = {};
		const params = 5;
		const event = {};

		const post_1 = (agg, response, request, params, event) => {
			// Aggregator is by default response
			expect(agg).to.be.eql(response);
			expect(response).to.be.eql(response);
			expect(request).to.be.eql(request);
			expect(params).to.be.eql(5);
			expect(event).to.be.eql(event);
			
			// Test fake async
			return new Promise((resolve) => {
				setTimeout(() => resolve(params + 3), 10);
			});
		};

		const post_2 = (agg, response, request, params, event) => {
			expect(agg).to.be.eql(5 + 3);
			expect(response).to.be.eql(response);
			expect(request).to.be.eql(request);
			expect(params).to.be.eql(5);
			expect(event).to.be.eql(event);
			return agg * 7;
		};

		const app = new App(router);
		app.post_process(post_1);
		app.post_process(post_2);

		app.postprocess(response, request, params, event).then(result => {
			expect(result).to.be.eql((5 + 3) * 7);
			done();
		}).catch(e => done(e));
	});

	for(const [response, body, status, content_type] of [
		[5, '5', 200, 'application/json'],
		[Promise.resolve(5), '5', 200, 'application/json'],
		[true, 'true', 200, 'application/json'],
		[Promise.resolve(true), 'true', 200, 'application/json'],
		['5', '5', 200, 'text/plain'],
		[Promise.resolve('5'), '5', 200, 'text/plain'],
		[new Response('plep', { status: 201, headers: { 'Content-Type': 'app/plop' } }), 'plep', 201, 'app/plop'],
		[{plep: 3}, JSON.stringify({plep: 3}), 200, 'application/json'],
		[Promise.resolve({plep: 3}), JSON.stringify({plep: 3}), 200, 'application/json'],
	]) {
		it(`Should respond with a formatted response (${response} -- ${content_type})`, done => {
			App.respond(response).then(response => {
				expect(response).to.be.instanceof(Response);
				expect(response.status).to.be.eql(status);
				expect(response.body).to.be.eql(body);
				expect(response.headers['Content-Type']).to.be.eql(content_type);
				done();
			}).catch(e => done(e));
		});
	}

	it('Runs without pre/post processing', done => {
		const app = new App(router);
		app.run({
			request: {
				url: 'https://google.com/plep',
				method: 'GET'
			}
		}).then(result => {
			expect(result).to.be.instanceof(Response);
			done();
		}).catch(e => done(e));
	});

	it('Runs with pre processing', done => {
		const router = new Router();

		router.get('/plep/:plop', (request, params, preprocessed, event) => {
			expect(preprocessed).to.be.eql(25 * 5);
			return {
				id: preprocessed
			};
		});

		const app = new App(router);

		app.pre_process((aggregator, request, params, event) => {
			expect(params).to.have.property('plop');
			expect(params.plop).to.be.eql('5');
			return Number.parseInt(params.plop) * 25;
		});

		app.run({
			request: {
				url: 'https://google.com/plep/5',
				method: 'GET'
			}
		}).then(result => {
			expect(result).to.be.instanceof(Response);
			expect(result.status).to.be.eql(200);
			expect(result.body).to.be.a('string');
			expect(() => JSON.parse(result.body)).to.not.throw;
			expect(JSON.parse(result.body).id).to.be.eql(25 * 5);
			done();
		}).catch(e => done(e));
	});

	it('Pre processing breaks the chain', done => {
		const router = new Router();

		router.get('/plep/:plop', (request, params, preprocessed, event) => {
			return {
				id: preprocessed
			};
		});

		const app = new App(router);

		app.pre_process((aggregator, request, params, event) => {
			return new Response(null, { status: 418 });
		});

		app.pre_process((aggregator, request, params, event) => {
			throw new Error('We should not arrive here');
		});

		app.run({
			request: {
				url: 'https://google.com/plep/5',
				method: 'GET'
			}
		}).then(result => {
			expect(result).to.be.instanceof(Response);
			expect(result.status).to.be.eql(418);
			expect(result.body).to.be.null;
			done();
		}).catch(e => done(e));
	});

	it('Runs with post processing', done => {
		const router = new Router();

		router.get('/plep/:plop', () => {
			return {
				id: 25
			};
		});

		const app = new App(router);

		app.post_process((aggregator, response, request, params, event) => {
			// Since Response is a mock we don't have the same APIs
			response.headers['test'] = 'test header';
			response.body = 56;
			return response;
		});

		app.run({
			request: {
				url: 'https://google.com/plep/5',
				method: 'GET'
			}
		}).then(result => {
			expect(result).to.be.instanceof(Response);
			expect(result.status).to.be.eql(200);
			expect(result.body).to.be.eql(56);
			expect(result.headers['test']).to.be.eql('test header');
			done();
		}).catch(e => done(e));
	});
});
