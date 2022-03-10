const { expect } = require('chai');
const { Request, Response, Headers } = require('../utils/http');

describe('Testing utilities', () => {
	describe('Headers', () => {
		it('Should instanciate with multiple headers', () => {
			const headers = new Headers({
				Authorization: 'plep',
				'Content-Type': 'plop'
			});

			expect(headers.headers).to.not.have.property('Authorization');
			expect(headers.headers).to.have.property('authorization');
			expect(headers.get('Authorization')).to.be.eql('plep');
			expect(headers.get('content-type')).to.be.eql('plop');
		});

		it('Should be able to add keys to headers', () => {
			const headers = new Headers();
			expect(Object.keys(headers.headers)).to.have.length(0);
			headers.set('With-Uppercase', 'plep');
			headers.set('lowercase', 'plop');

			expect(headers.headers).to.have.property('with-uppercase');
			expect(headers.get('With-uppercase')).to.be.eql('plep');
			expect(headers.get('LOWERCASE')).to.be.eql('plop');
		});
	});

	describe('Response', () => {
		it('Should have empty headers', () => {
			const response = new Response();
			expect(response.headers).to.be.instanceof(Headers);
			expect(Object.keys(response.headers.headers)).to.have.length(0);
		});
	});

	describe('Request', () => {
		it('Should have empty headers', () => {
			const request = new Request();
			expect(request.headers).to.be.instanceof(Headers);
			expect(Object.keys(request.headers.headers)).to.have.length(0);
		});
	});
});
