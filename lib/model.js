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

	static fromJSON(data) {
		return new this(data);
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
			JSON.stringify(this)
		).then(() => this);
	}
}

module.exports = Model;
