'use strict';

// ------------------------------------------------------------------------------------------ Dependencies

const AWS = require('aws-sdk');

// ------------------------------------------------------------------------------------------ Class

function SQS(options) {
	let params = options || {};
	params.region = params.region || 'us-east-1';
	this.client = new AWS.SQS(params);
	this._sts = new AWS.STS({
		accessKeyId: params.accessKeyId,
		secretAccessKey: params.secretAccessKey
	});
};

SQS.prototype.getCallerIdentity = function(callback) {
	this._sts.getCallerIdentity({}, callback);
};

SQS.prototype.getQueueUrl = function(name, params, callback) {

	if(typeof name === 'string') {
		if(typeof params === 'function') {
			callback = params;
			params = {
				QueueName: name
			};
		} else {
			params.QueueName = name;
		}
	} else {
		if(typeof params === 'function') {
			callback = params;
		} else {
			throw new Exception('You must either specify "name" (string) with separate parameters, or a single parameters object as first argument');
		}
		params = name;
	}

	if(!params.QueueOwnerAWSAccountId) {
		this.getCallerIdentity((err, data) => {
			if(!err) {
				params.QueueOwnerAWSAccountId = data.Account;
				this.client.getQueueUrl(params, callback);
			} else {
				callback(err);
			}
		});
	} else {
		this.client.getQueueUrl(params, callback);
	}

};

SQS.prototype.createQueue = function(name, params, callback) {

	if(typeof name === 'string') {
		if(typeof params === 'function') {
			callback = params;
			params = {
				QueueName: name
			};
		} else {
			params.QueueName = name;
		}
	} else {
		if(typeof params === 'function') {
			callback = params;
		} else {
			throw new Exception('You must either specify "name" (string) with separate parameters, or a single parameters object as first argument');
		}
		params = name;
	}

	this.client.createQueue(params, (err, data) => {
		if(err) {
			if(err.code === 'AWS.SimpleQueueService.QueueDeletedRecently') {
				let self = this;
				setTimeout(function() {
					self.createQueue(name, params, callback);
				}, 60000);
			} else {
				callback(err);
			}
		} else {
			callback(err, data);
		}
	});
};

SQS.prototype.deleteQueue = function(name, params, callback) {

	if(typeof params === 'function') {
		callback = params;
		params = {};
	}

	if(typeof name === 'string' || !params.QueueUrl) {
		this.getQueueUrl(name, (err, data) => {
			params.QueueUrl = data.QueueUrl;
			this.client.deleteQueue(params, callback);
		});
	} else {
		this.client.deleteQueue(params, callback);
	}

};

SQS.prototype.push = function(name, data, params, callback) {

	if(arguments.length <= 2) {
		callback = function() {};
		params = {};
	} else if(arguments.length === 3) {
		callback = params;
		params = {};
	}

	if(typeof data !== 'string') {
		data = JSON.stringify(data);
	}

	params.MessageBody = data;
	this.getQueueUrl(name, (err, data) => {
		if(err) {
			if(err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
				this.createQueue(name, (err, data) => {
					if(err) {
						callback(err);
					} else {
						params.QueueUrl = data.QueueUrl
						this.client.sendMessage(params, callback);
					}
				});
			} else {
				callback(err)
			}
		} else {
			params.QueueUrl = data.QueueUrl;
			this.client.sendMessage(params, callback);
		}
	});

};

SQS.prototype.pull = function(name, params, callback) {

	if(arguments.length === 2) {
		callback = params;
		if(typeof name === 'string') {
			params = {};
		}
	}

	let self = this;
	let pull = function(params, callback) {
		self.client.receiveMessage(params, (err, data) => {
			if(err) {
				throw new Error(err);
			} else {
				if(data.Messages && data.Messages.length > 0) {
					let message = data.Messages[0];
					let body = JSON.parse(message.Body);
					callback(body, (err) => {
						if(!err) {
							self.deleteMessage(name, message.ReceiptHandle, (err, data) => {
								pull(params, callback);
							});
						} else {
							setTimeout(function() {
								pull(params, callback);
							}, 5000);
						}
					});
				} else {
					setTimeout(function() {
						pull(params, callback);
					}, 5000);
				}
			}
		});
	}

	if(typeof name === 'string') {
		this.getQueueUrl(name, (err, data) => {
			if(err) {
				if(err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
					this.createQueue(name, (err, data) => {
						if(err) {
							throw new Error(err);
						} else {
							params.QueueUrl = data.QueueUrl
							pull(params, callback);
						}
					});
				} else {
					throw new Error(err);
				}
			} else {
				params.QueueUrl = data.QueueUrl;
				pull(params, callback);
			}
		});
	} else {
		pull(params, callback);
	}
	
};

SQS.prototype.deleteMessage = function(name, handle, params, callback) {

	// (params, callback)
	if(arguments.length === 2) {
		params = name;
		callback = handle;

	// (name, params, callback) of (name, handle, callback)
	} else if(arguments.length === 3) {
		if(typeof handle !== 'string') {
			callback = params;
			params = handle;
		} else {
			callback = params;
			params = {};
			params.ReceiptHandle = handle;
		}
	}

	if(typeof name === 'string') {
		this.getQueueUrl(name, (err, data) => {
			params.QueueUrl = data.QueueUrl;
			this.client.deleteMessage(params, callback);
		});
	} else {
		this.client.deleteMessage(params, callback);
	}

};

// ------------------------------------------------------------------------------------------ Module

module.exports = SQS;

