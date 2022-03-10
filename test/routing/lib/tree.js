const { expect } = require('chai');

const { RouterTree, Route } = require('../../../lib/tree');

describe('RouterTree', () => {
	describe('Route Registration', () => {
		it('Should raise on unknown method', () => {
			const tree = new RouterTree();
			expect(() => tree.register('chicken', '/', () => {})).to.throw(TypeError, 'method can only be one of');
		});

		describe('Root', () => {
			it('Should register a root route ("/")', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', '/', cb);
				expect(tree.root.route).to.not.be.undefined;
				expect(tree.root.route.methods.any).to.be.eql(cb);
			});

			it('Should register a regexp route ("/")', () => {
				const tree = new RouterTree();
				const cb = () => {};
				const reg = /plep/;
				tree.register('any', reg, cb);
				expect([...tree.root.regex_routes.keys()]).to.have.length(1);
				expect(tree.root.regex_routes.get(reg).methods.any).to.be.eql(cb);
			});

			it('Should register a lookup route ("/:chicken")', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', ':plep', cb);
				expect(tree.root.children.get(null)).to.not.be.null;
				expect(tree.root.children.get(null).route.methods.any).to.be.eql(cb);
			});

			it('Should register routes on a specific method', () => {
				const tree = new RouterTree();
				const get_cb = () => {};
				const post_cb = () => {};
				tree.register('get', '/', get_cb);
				tree.register('post', '/', post_cb);

				const { route } = tree.root;
				expect(route).to.not.be.null;
				expect(route.methods.get).to.be.eql(get_cb);
				expect(route.methods.post).to.be.eql(post_cb);
			});

			it('Should replace routes on a specific method', () => {
				const tree = new RouterTree();
				const get_cb = () => {};
				const get_cb_2 = () => {};
				tree.register('get', '/', get_cb);
				tree.register('get', '/', get_cb_2);

				const { route } = tree.root;
				expect(route).to.not.be.null;
				expect(route.methods.get).to.be.eql(get_cb_2);
			});

			it('Should not replace routes on a specific method (strict)', () => {
				const tree = new RouterTree();
				const get_cb = () => {};
				const get_cb_2 = () => {};
				tree.register('get', '/', get_cb, true);

				expect(() => {
					tree.register('get', '/', get_cb_2, true);
				}).to.throw(Error, 'already declared');

				const { route } = tree.root;
				expect(route).to.not.be.null;
				expect(route.methods.get).to.be.eql(get_cb);
			});
		});

		describe('Nested', () => {
			it('Should register a child route ("/test/plep")', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', '/test/plep', cb);
				expect([...tree.root.children.keys()]).to.have.length(1);
				const child = tree.root.children.get('test');
				expect(child.route).to.be.null;
				expect(child.children.get('plep')).to.not.be.null;
				expect(child.children.get('plep').route.methods.any).to.be.eql(cb);
			});

			it('Should register a nested lookup route ("/users/:user_id")', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', '/test/:user_id', cb);
				expect([...tree.root.children.keys()]).to.have.length(1);
				const child = tree.root.children.get('test');
				expect(child.children.get(null)).to.not.be.null;
				expect(child.children.get(null).route.methods.any).to.be.eql(cb);
			});

			it('Should register a nested regexp route', () => {
				const tree = new RouterTree();
				const cb = () => {};

				// This means it's possible for us to later implement
				// simple regex expressions in strings ;)
				const reg = /[0-9]+/;
				tree.register('any', ['test', reg], cb);
				expect([...tree.root.children.keys()]).to.have.length(1);
				const child = tree.root.children.get('test');
				expect([...child.regex_routes.keys()]).to.have.length(1);
				expect(child.regex_routes.get(reg).methods.any).to.be.eql(cb);
			});
		});
	});

	describe('Route traversal', () => {
		for(const path of ['', '/']) {
			it(`Should find a root route ${path}`, () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', '/', cb);
				const { callback } = tree.find('any', '');

				expect(callback).to.be.eql(cb);
			});
		}

		it('Should find a root route on a given method', () => {
			const tree = new RouterTree();
			const cb = () => {};
			tree.register('get', '/', cb);
			const { callback: get_callback } = tree.find('get', '');
			const { callback: post_callback } = tree.find('post', '');

			expect(get_callback).to.be.eql(cb);
			expect(post_callback).to.be.null;
		});

		it('Should find a root route on any method', () => {
			const tree = new RouterTree();
			const cb = () => {};
			tree.register('any', '/', cb);
			const { callback: get_callback } = tree.find('get', '');
			const { callback: post_callback } = tree.find('post', '');

			expect(get_callback).to.be.eql(cb);
			expect(post_callback).to.be.eql(cb);
		});

		it('Should find a lookup route', () => {
			const tree = new RouterTree();
			const cb = () => {};
			tree.register('any', '/:plep', cb);

			const callbacks = ['/chicken', '/1234', '/plep-plop'].map(path => tree.find('get', path).callback);
			const callbacks_set = new Set(callbacks);
			expect(callbacks_set.size).to.be.eql(1);
			expect(Array.from(callbacks_set)[0]).to.be.eql(cb);

			const { callback, params } = tree.find('get', '/plip');

			expect(callback).to.be.eql(cb);
			expect(params).to.have.property('plep');
			expect(params.plep).to.be.eql('plip');
		});

		it('Should find a nested lookup route', () => {
			const tree = new RouterTree();
			const cb = () => {};
			tree.register('any', '/one/:plep/two', cb);

			const callbacks_and_params = [
				'/one/123/two',
				'/one/plep/two',
				'/one/another-name/two'
			].map(path => tree.find('get', path));

			const callbacks = callbacks_and_params.map(({ callback }) => callback);
			const callbacks_set = new Set(callbacks);
			expect(callbacks_set.size).to.be.eql(1);
			expect(Array.from(callbacks_set)[0]).to.be.eql(cb);

			for(const { params } of callbacks_and_params) {
				expect(params).to.have.property('plep');
				expect(['123', 'plep', 'another-name'].includes(params.plep)).to.be.true;
			}
		});

		it('Should find multiple lookup route', () => {
			const tree = new RouterTree();
			const cb = () => {};
			tree.register('any', '/one/:name/two/:id', cb);

			const { callback, params } = tree.find('get', '/one/test_name/two/test_id');
			expect(callback).to.be.eql(cb);
			expect(params).to.have.property('name');
			expect(params).to.have.property('id');
			expect(params.name).to.be.eql('test_name');
			expect(params.id).to.be.eql('test_id');
		});

		it('Should find a regex route', () => {
			const tree = new RouterTree();
			const cb = () => {};
			tree.register('any', /^[0-9]{3}$/, cb);

			for(const path of ['/123', '/654', '/901']) {
				expect(tree.find('get', path).callback).to.be.eql(cb);
			}

			for(const path of ['/123a', '/plep', '/asd-123']) {
				expect(tree.find('get', path).callback).to.be.null;
			}
		});

		it('Should find the default route', () => {
			const def = () => {};
			const tree = new RouterTree({ default_route: new Route({
				methods: {
					any: def
				}
			})});
			tree.register('any', '/plep/plop', () => {});

			const { callback } = tree.find('get', '/plep/plip');
			expect(callback).to.be.eql(def);
		});

		it('Should not find the default route (different method)', () => {
			const def = () => {};
			const tree = new RouterTree({ default_route: new Route({
				methods: {
					post: def
				}
			})});
			tree.register('any', '/plep/plop', () => {});

			const { callback } = tree.find('get', '/plep/plip');
			expect(callback).to.be.null;
		});

		describe('Nested', () => {
			it('Should find a string nested route', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', '/plep/plop', cb);

				const { callback } = tree.find('get', '/plep/plop');
				expect(callback).to.be.eql(cb);
			});

			it('Should find a lookup nested route', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', '/plep/plop/:id', cb);

				for(const id of [5, 'plep', 'plop', 'plip', '123']) {
					const { callback } = tree.find('get', `/plep/plop/${id}`);
					expect(callback).to.be.eql(cb);
				}
			});

			it('Should find a regex nested route', () => {
				const tree = new RouterTree();
				const cb = () => {};
				tree.register('any', ['plep', 'plop', /^[0-9]{3,5}$/], cb);

				for(const id of ['123', '1234', '12345']) {
					const { callback } = tree.find('get', `/plep/plop/${id}`);
					expect(callback).to.be.eql(cb);
				}

				for(const id of ['abc', 'a', '1', '12', 'pep', 'plop-epl']) {
					const { callback } = tree.find('get', `/plep/plop/${id}`);
					expect(callback).to.be.null;
				}
			});

			it('Should be able to reuse existing routes (regex, param & string)', () => {
				const tree = new RouterTree();

				// fake functions to be able to test later
				// and with different memory references
				cb_root = () => {};
				cb_plep = () => {};
				cb_plep_plop = () => {};
				cb_plep_plip = () => {};
				cb_plep_reg = () => {};
				cb_plep_reg_link = () => {};
				cb_plep_id = () => {};
				cb_plep_id_value = () => {};
				cb_plep_id_plop = () => {};

				// Register multiple nested and reused routes
				tree.register('any', '/', cb_root);
				tree.register('any', '/plep', cb_plep);
				tree.register('any', '/plep/plop', cb_plep_plop);
				tree.register('any', '/plep/plip', cb_plep_plip);

				const reg = /^[a-zA-Z]+$/;
				tree.register('any', ['plep', reg], cb_plep_reg);
				// tree.register('any', ['/plep', reg, '/link'], cb_plep_reg_link);

				tree.register('any', '/plep/:id', cb_plep_id);
				tree.register('any', '/plep/:id/value', cb_plep_id_value);
				tree.register('any', '/plep/:id/plop', cb_plep_id_plop);

				expect([...tree.root.children.keys()]).to.have.length(1);
				const plep = tree.root.children.get('plep');

				// /plep/plop & plep/plip & plep/[null]
				expect([...plep.children.keys()]).to.have.length(3);
				// only /[a-zA-Z]/
				expect([...plep.regex_routes.keys()]).to.have.length(1);

				expect(tree.find('any', '/').callback).to.be.eql(cb_root);
				expect(tree.find('any', '/plep').callback).to.be.eql(cb_plep);
				expect(tree.find('any', '/plep/plop').callback).to.be.eql(cb_plep_plop);
				expect(tree.find('any', '/plep/plip').callback).to.be.eql(cb_plep_plip);

				expect(tree.find('any', '/plep/abcABC').callback).to.be.eql(cb_plep_reg);
				// expect(tree.find('any', '/plep/abcABC/link').callback).to.be.eql(cb_plep_reg_link);

				expect(tree.find('any', '/plep/123').callback).to.be.eql(cb_plep_id);
				expect(tree.find('any', '/plep/123/value').callback).to.be.eql(cb_plep_id_value);
				expect(tree.find('any', '/plep/123/plop').callback).to.be.eql(cb_plep_id_plop);
			});
		});
	});

	describe('Entries & merging', () => {
		it('Should return a simple route with nested segments', () => {
			const tree = new RouterTree();
			const cb = () => {};
			const reg = /plep/;

			tree.register('any', ['resource', reg, ':some_id', 'sub_resource'], cb);

			const entries = tree.entries();

			expect(entries).to.have.length(1);
			const [[ path, route ]] = entries;
			expect(path).to.have.length(4);

			// id values are transformed to null
			expect(path).to.be.deep.equal(['resource', reg, ':some_id', 'sub_resource']);
			expect(route).to.be.an.instanceof(Route);
			expect(route.methods.any).to.be.eql(cb);
		});

		it('Should return nested routes with all segments', () => {
			const tree = new RouterTree();
			const cb = () => {};
			const cb_2 = () => {};
			const reg = /plep/;

			tree.register('any', ['resource', reg, ':some_id', 'sub_resource'], cb);
			tree.register('any', ['resource', reg, ':some_id', 'sub_resource', 'sub_res_2'], cb_2);

			const entries = tree.entries();

			expect(entries).to.have.length(2);
			const [[ path, route ], [p2, r2]] = entries;
			expect(path).to.have.length(4);
			expect(p2).to.have.length(5);

			// id values are transformed to null
			expect(path).to.be.deep.equal(['resource', reg, ':some_id', 'sub_resource']);
			expect(route).to.be.an.instanceof(Route);
			expect(route.methods.any).to.be.eql(cb);

			expect(p2).to.be.deep.equal(['resource', reg, ':some_id', 'sub_resource', 'sub_res_2']);
			expect(r2).to.be.an.instanceof(Route);
			expect(r2.methods.any).to.be.eql(cb_2);
		});

		it('Should merge 2 simple trees', () => {
			const tree1 = new RouterTree();
			const tree2 = new RouterTree();
			const cb = () => {};
			const cb_2 = () => {};

			tree1.register('any', '/plep/plop', cb);
			tree2.register('post', '/plep/plop/plip', cb_2);

			tree1.merge({ tree: tree2 });

			const entries = tree1.entries();

			expect(entries).to.have.length(2);
			const [[ p1, r1 ], [p2, r2]] = entries;

			expect(p1).to.be.deep.equal(['plep', 'plop']);
			expect(p2).to.be.deep.equal(['plep', 'plop', 'plip']);

			expect(r1).to.be.an.instanceof(Route);
			expect(r1.methods.any).to.be.eql(cb);

			expect(r2).to.be.an.instanceof(Route);
			expect(r2.methods.post).to.be.eql(cb_2);
			expect(r2.methods).to.not.have.property('get');
			expect(r2.methods.any).to.be.undefined;
		});
	});
});
