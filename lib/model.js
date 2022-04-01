class Model {
	static KV_BINDING = null;
	static PREFIX = '';

	static get_id(id) {
		const separator = this.PREFIX ? '-' : '';
		return `${this.PREFIX}${separator}${id}`;
	}

	static id(instance) {
		return instance.id;
	}

	static get(id) {
		return this.KV_BINDING.get(this.get_id(id)).then(data => {
			if(data === null) {
				return null;
			}

			const model_data = JSON.parse(data);
			return this.fromJSON(model_data);
		});
	}

	static bind_kv(binding) {
		this.KV_BINDING = binding;
	}

	static generate_options(instance) {
		const { metadata, expiration, expirationTtl } = instance;
		if(metadata === null && expiration === null && expirationTtl === null) {
			return undefined;
		}

		if(expiration && expirationTtl) {
			throw new TypeError('Cannot set both expiration and expirationTtl');
		}

		if(isNaN(expiration) || isNaN(expirationTtl)) {
			throw new TypeError('expiration and expirationTtl must be integers (seconds)');
		}

		let result = {};

		if(metadata) {
			result = {
				...result,
				metadata
			};
		}

		if(expiration) {
			result = {
				...result,
				expiration
			};
		}

		if(expirationTtl) {
			result = {
				...result,
				expirationTtl
			};
		}

		return result;
	}

	static fromJSON(data) {
		return new this(data);
	}

	get metadata() {
		return null;
	}

	get expiration() {
		return null;
	}

	get expirationTtl() {
		return null;
	}

	toJSON() {
		return {...this};
	}

	save() {
		const id = this.constructor.id(this);
		if(!id) {
			throw new Error('Cannot save model with no id');
		}

		return this.constructor.KV_BINDING.put(
			this.constructor.get_id(id),
			JSON.stringify(this),
			this.constructor.generate_options(this)
		).then(() => this);
	}
}

module.exports = Model;
