const { expect } = require('chai');
const Sinon = require('sinon');
const path = require('path');

const model_path = path.join(__dirname, '../../lib/model.js');


describe('Models', () => {
	beforeEach(() => {
		// Clear require cache
		delete require.cache[model_path];
	});

	it('Should bind a KV namespace to the base model', () => {
		const Model = require('../../lib/model');
		expect(Model.KV_BINDING).to.be.null;

		const test = {};
		Model.bind_kv(test);

		expect(Model.KV_BINDING).to.be.eql(test);
	});

	it('Should bind a KV namespace caching on require', () => {
		const Model = require('../../lib/model');
		expect(Model.KV_BINDING).to.be.null;

		const test = {};
		Model.bind_kv(test);

		expect(Model.KV_BINDING).to.be.eql(test);

		const ReimportedModel = require('../../lib/model');
		expect(ReimportedModel.KV_BINDING).to.be.eql(test);
	});

	it('Should get an ID with a prefix', () => {
		const Model = require('../../lib/model');
		class MyModel extends Model {
			static PREFIX = 'pref';
		};

		expect(Model.get_id('plep')).to.be.eql('plep');
		expect(MyModel.get_id('plep')).to.be.eql('pref-plep');
	});

	describe('DB operations', () => {
		it('Should find a model and instanciate it (no fromJSON)', done => {
			const Model = require('../../lib/model');
			Model.bind_kv(global.KV_MOCK);

			class MyModel extends Model {
				PREFIX = 'get';

				constructor({ a, b, c}) {
					super();
					this.a = a;
					this.b = b;
					this.c = c;
				}
			};

			// Mock the get method from KV
			const get_stub = Sinon.stub(global.KV_MOCK, 'get').callsFake(() => Promise.resolve(JSON.stringify({
				a: 1,
				b: 2,
				c: 3
			})));

			MyModel.get('test_id').then(model => {
				expect(model).to.be.an.instanceof(MyModel);
				expect(model.a).to.be.eql(1);
				expect(model.b).to.be.eql(2);
				expect(model.c).to.be.eql(3);
				get_stub.restore();
				done();
			}).catch(e => {
				get_stub.restore();
				done(e);
			});
		});

		it('Should find a model and instanciate it (with fromJSON)', done => {
			const Model = require('../../lib/model');
			Model.bind_kv(global.KV_MOCK);

			class MyModel extends Model {
				PREFIX = 'get';

				constructor({ a, b }, c) {
					super();
					this.a = a;
					this.b = b;
					this.c = c;
				}

				static fromJSON({ a, b, c }) {
					return new this({ a, b }, c);
				}
			};

			// Mock the get method from KV
			const get_stub = Sinon.stub(global.KV_MOCK, 'get').callsFake(() => Promise.resolve(JSON.stringify({
				a: 1,
				b: 2,
				c: 3
			})));

			MyModel.get('test_id').then(model => {
				expect(model).to.be.an.instanceof(MyModel);
				expect(model.a).to.be.eql(1);
				expect(model.b).to.be.eql(2);
				expect(model.c).to.be.eql(3);
				expect(get_stub.calledOnce).to.be.true;
				get_stub.restore();
				done();
			}).catch(e => {
				get_stub.restore();
				done(e);
			});
		});

		it('Should save a model to KV', done => {
			const Model = require('../../lib/model');
			Model.bind_kv(global.KV_MOCK);

			class MyModel extends Model {
				static id({ a }) {
					return a;
				}

				constructor({ a, b }) {
					super();
					this.a = a;
					this.b = b;
				}
			}

			const my_model = new MyModel({ a: 5, b: 7 });

			const save_stub = Sinon.stub(global.KV_MOCK, 'put').callsFake(() => Promise.resolve());

			my_model.save().then(model => {
				expect(model).to.be.eql(my_model);
				expect(save_stub.calledOnce).to.be.true;
				expect(save_stub.calledWith(
					'5',
					JSON.stringify({ a: 5, b: 7 })
				)).to.be.true;

				save_stub.restore();
				done();
			}).catch(e => {
				save_stub.restore();
				done(e);
			});
		});
	});
});
