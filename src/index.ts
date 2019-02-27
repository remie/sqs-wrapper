'use strict';

// ------------------------------------------------------------------------------------------ Dependencies

import * as AWS from 'aws-sdk';

// ------------------------------------------------------------------------------------------ Class

export default class SQS {

  private sqs: AWS.SQS;
  private sts: AWS.STS;
  private prefix: string;

  // ------------------------------------------------------------------------------------------ Constructor

  constructor(options: AWS.SQS.ClientConfiguration, prefix?: string) {
    options.region = options.region || 'us-east-1';
    this.prefix = prefix || '';
    this.sqs = new AWS.SQS(options);
    this.sts = new AWS.STS(options);
  }

  // ------------------------------------------------------------------------------------------ Public methods

  async getQueueOwnerAWSAccountId(callback?: (err: AWS.AWSError, account?: string) => void): Promise<string> {
    return this.sts.getCallerIdentity({}, (err, result) => {
      if (callback && typeof callback === 'function') {
        callback(err, result.Account);
      }
    }).promise().then((result) => {
      return Promise.resolve(result.Account);
    }).catch(error => {
      if (callback && typeof callback === 'function') {
        callback(error);
      }
      return Promise.reject(error);
    });
  }

  async getQueueAttributes(name: string): Promise<AWS.SQS.QueueAttributeMap>;
  async getQueueAttributes(name: string, callback?: (err: AWS.AWSError, data?: AWS.SQS.QueueAttributeMap) => void): Promise<AWS.SQS.QueueAttributeMap>;
  async getQueueAttributes(name: string, attributeNames: Array<string>): Promise<AWS.SQS.QueueAttributeMap>;
  async getQueueAttributes(name: string, attributeNames: Array<string>, callback?: (err: AWS.AWSError, data?: AWS.SQS.QueueAttributeMap) => void): Promise<AWS.SQS.QueueAttributeMap>;
  async getQueueAttributes(params: AWS.SQS.GetQueueAttributesRequest): Promise<AWS.SQS.QueueAttributeMap>;
  async getQueueAttributes(params: AWS.SQS.GetQueueAttributesRequest, callback?: (err: AWS.AWSError, data?: AWS.SQS.QueueAttributeMap) => void): Promise<AWS.SQS.QueueAttributeMap>;
  async getQueueAttributes(...args): Promise<AWS.SQS.QueueAttributeMap> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    // Make sure to properly deal with the 'attributeNames' argument
    const params = parameters.params instanceof Array ? { AttributeNames: parameters.params } : parameters.params;
    const callback = parameters.callback;

    try {
      const options: AWS.SQS.GetQueueAttributesRequest = Object.assign({}, params, {
        QueueUrl: params.QueueUrl || await this.getQueueUrl(name),
        AttributeNames: params.AttributeNames || []
      });

      return this.sqs.getQueueAttributes(options, (err, result) => {
        if (err) {
          callback(err);
        } else {
          callback(err, result.Attributes);
        }
      }).promise().then(result => {
        return Promise.resolve(result.Attributes);
      }).catch(error => Promise.reject(error));
    } catch (error) {
      callback(error);
      return Promise.reject(error);
    }
  }

  async getQueueUrl(name: string): Promise<string>;
  async getQueueUrl(name: string, callback: (err: AWS.AWSError, queueUrl?: string) => void): Promise<string>;
  async getQueueUrl(name: string, params: AWS.SQS.GetQueueUrlRequest): Promise<string>;
  async getQueueUrl(name: string, params: AWS.SQS.GetQueueUrlRequest, callback: (err: AWS.AWSError, queueUrl?: string) => void): Promise<string>;
  async getQueueUrl(params: AWS.SQS.GetQueueUrlRequest): Promise<string>;
  async getQueueUrl(params: AWS.SQS.GetQueueUrlRequest, callback?: (err: AWS.AWSError, queueUrl: string) => void): Promise<string>;
  async getQueueUrl(...args): Promise<string> {
      const parameters = this.getParameters(args);
      const name = parameters.name;
      const params = parameters.params;
      const callback = parameters.callback;

    try {
      let QueueName = params.QueueName || name;
      if (!QueueName.startsWith(this.prefix)) {
        QueueName = this.prefix + QueueName;
      }

      const options: AWS.SQS.GetQueueUrlRequest = Object.assign({} , params, {
        QueueName,
        QueueOwnerAWSAccountId: params.QueueOwnerAWSAccountId || await this.getQueueOwnerAWSAccountId()
      });

      return this.sqs.getQueueUrl(options, (err, result) => {
        if (err) {
          if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
            this.createQueue(QueueName).then(queueUrl => callback(null, queueUrl)).catch(error => callback(error));
          } else {
            callback(err);
          }
        } else {
          callback(err, result.QueueUrl);
        }
      }).promise().then((result) => {
        return Promise.resolve(result.QueueUrl);
      }).catch(error => {
        if (error.code === 'AWS.SimpleQueueService.NonExistentQueue') {
          return this.createQueue(QueueName);
        } else {
          return Promise.reject(error);
        }
      });
    } catch (error) {
      callback(error);
      return Promise.reject(error);
    }
  }

  async createQueue(name: string): Promise<string>;
  async createQueue(name: string, callback: (err: AWS.AWSError, queueUrl?: string) => void): Promise<string>;
  async createQueue(name: string, params: AWS.SQS.CreateQueueRequest): Promise<string>;
  async createQueue(name: string, params: AWS.SQS.CreateQueueRequest, callback: (err: AWS.AWSError, queueUrl?: string) => void): Promise<string>;
  async createQueue(params: AWS.SQS.CreateQueueRequest): Promise<string>;
  async createQueue(params: AWS.SQS.CreateQueueRequest, callback?: (err: AWS.AWSError, queueUrl?: string) => void): Promise<string>;
  async createQueue(...args): Promise<string> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const params = parameters.params;
    const callback = parameters.callback;

    try {
      let QueueName = params.QueueName || name;
      if (!QueueName.startsWith(this.prefix)) {
        QueueName = this.prefix + QueueName;
      }

      const options: AWS.SQS.CreateQueueRequest = Object.assign({} , params, {
        QueueName
      });

      return this.sqs.createQueue(options).promise().then((response: AWS.SQS.CreateQueueResult) => {
        callback(null, response.QueueUrl);
        return Promise.resolve(response.QueueUrl);
      }).catch((err: AWS.AWSError) => {
        if (err.code === 'AWS.SimpleQueueService.QueueDeletedRecently') {
          return new Promise<string>((resolve, reject) => {
            setTimeout(() => {
              this.createQueue(QueueName, options).then((queueUrl: string) => {
                resolve(queueUrl);
              }).catch((err: AWS.AWSError) => {
                reject(err);
              });
            }, 60000);
          });
        } else {
          return Promise.reject(err);
        }
      });
    } catch (err) {
      callback(err);
      return Promise.reject(err);
    }
  }

  async deleteQueue(name: string): Promise<boolean>;
  async deleteQueue(name: string, callback: (err: AWS.AWSError) => void): Promise<boolean>;
  async deleteQueue(name: string, params: AWS.SQS.DeleteQueueRequest): Promise<boolean>;
  async deleteQueue(name: string, params: AWS.SQS.DeleteQueueRequest, callback: (err: AWS.AWSError) => void): Promise<boolean>;
  async deleteQueue(params: AWS.SQS.DeleteQueueRequest): Promise<boolean>;
  async deleteQueue(params: AWS.SQS.DeleteQueueRequest, callback?: (err: AWS.AWSError) => void): Promise<boolean>;
  async deleteQueue(...args): Promise<boolean> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const params = parameters.params;
    const callback = parameters.callback;

    try {
      const options: AWS.SQS.DeleteQueueRequest = Object.assign({} , params, {
        QueueUrl: params.QueueUrl || await this.getQueueUrl(name)
      });

      return this.sqs.deleteQueue(options).promise().then((response) => {
        callback(null, true);
        return Promise.resolve(true);
      }).catch((err) => {
        callback(err);
        return Promise.reject(err);
      });
    } catch (err) {
      callback(err);
      return Promise.reject(err);
    }
  }

  async purgeQueue(name: string): Promise<boolean>;
  async purgeQueue(name: string, callback: (err: AWS.AWSError) => void): Promise<boolean>;
  async purgeQueue(name: string, params: AWS.SQS.DeleteQueueRequest): Promise<boolean>;
  async purgeQueue(name: string, params: AWS.SQS.DeleteQueueRequest, callback: (err: AWS.AWSError) => void): Promise<boolean>;
  async purgeQueue(params: AWS.SQS.DeleteQueueRequest): Promise<boolean>;
  async purgeQueue(params: AWS.SQS.DeleteQueueRequest, callback?: (err: AWS.AWSError) => void): Promise<boolean>;
  async purgeQueue(...args): Promise<boolean> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const params = parameters.params;
    const callback = parameters.callback;

    try {
      const options: AWS.SQS.DeleteQueueRequest = Object.assign({} , params, {
        QueueUrl: params.QueueUrl || await this.getQueueUrl(name)
      });

      await this.sqs.purgeQueue(options).promise();
      callback(null);
      return true;
    } catch (err) {
      callback(err);
      throw err;
    }
  }

  async receiveMessage(name: string, onMessageReceived: (data, callback: (err?: Error) => void) => void): Promise<boolean>;
  async receiveMessage(name: string, params: AWS.SQS.ReceiveMessageRequest, onMessageReceived: (data, callback: (err?: Error) => void) => void): Promise<boolean>;
  async receiveMessage(params: AWS.SQS.ReceiveMessageRequest, onMessageReceived: (data, callback: (err?: Error) => void) => void): Promise<boolean>;
  async receiveMessage(...args): Promise<boolean> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const params = parameters.params;
    const onMessageReceived = parameters.callback;

    try {
      const options: AWS.SQS.ReceiveMessageRequest = Object.assign({} , params, {
        QueueUrl: params.QueueUrl || await this.getQueueUrl(name)
      });

      return this.sqs.receiveMessage(options).promise()
        .then((response) => {
          const promises: Array<Promise<boolean>> = [];
          // Check if there are any messages to process
          if (response.Messages && response.Messages instanceof Array) {
            response.Messages.forEach((message: AWS.SQS.Message) => {
              const body = JSON.parse(message.Body);
              promises.push(new Promise((resolve, reject) => {
                onMessageReceived(body, (err) => {
                  if (!err) {
                    this.deleteMessage({ QueueUrl: options.QueueUrl, ReceiptHandle: message.ReceiptHandle})
                    .then(() => resolve())
                    .catch(() => resolve());
                  } else {
                    resolve();
                  }
                });
              }));
            });

          // Apparently the queue is empty, resolve
          } else {
            promises.push(Promise.resolve(true));
          }

          // Only return if all messages have been processed
          return Promise.all(promises);
        })
        .then(() => Promise.resolve(true))
        .catch(error => Promise.reject(error));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async deleteMessage(name: string, handle: string): Promise<boolean>;
  async deleteMessage(name: string, handle: string, params: AWS.SQS.DeleteMessageRequest): Promise<boolean>;
  async deleteMessage(name: string, handle: string, params: AWS.SQS.DeleteMessageRequest, callback: (err: AWS.AWSError) => void): Promise<boolean>;
  async deleteMessage(params: AWS.SQS.DeleteMessageRequest): Promise<boolean>;
  async deleteMessage(params: AWS.SQS.DeleteMessageRequest, handle: string): Promise<boolean>;
  async deleteMessage(params: AWS.SQS.DeleteMessageRequest, handle: string, callback: (err: AWS.AWSError) => void): Promise<boolean>;
  async deleteMessage(...args): Promise<boolean> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const handle = parameters.data;
    const callback = parameters.callback;

    // This is a special case: if we only have two arguments and the first is 'name', params should be an empty object
    let params = parameters.params;
    if (args.length === 2 && typeof args[0] === 'string') {
      params = {};
    }

    try {
      const options: AWS.SQS.DeleteMessageRequest = Object.assign({} , params, {
        QueueUrl: params.QueueUrl || await this.getQueueUrl(name),
        ReceiptHandle: params.ReceiptHandle || handle
      });

      this.sqs.deleteMessage(options).promise().then(() => {
        callback(null);
        return Promise.resolve(true);
      }).catch((err: AWS.AWSError) => {
        callback(err);
        return Promise.reject(err);
      });
    } catch (err) {
      callback(err);
      return Promise.reject(err);
    }
  }

  async push(name: string, data: any): Promise<string>;
  async push(name: string, data: any, callback: (err: AWS.AWSError, messageId: string) => void): Promise<string>;
  async push(name: string, data: any, params: AWS.SQS.DeleteQueueRequest): Promise<string>;
  async push(name: string, data: any, params: AWS.SQS.DeleteQueueRequest, callback: (err: AWS.AWSError, messageId: string) => void): Promise<string>;
  async push(data: any, params: AWS.SQS.DeleteQueueRequest): Promise<string>;
  async push(data: any, params: AWS.SQS.DeleteQueueRequest, callback?: (err: AWS.AWSError, messageId: string) => void): Promise<string>;
  async push(...args): Promise<string> {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const data = parameters.data;
    const callback = parameters.callback;

    // This is a special case: if we only have two arguments and the first is 'name', params should be an empty object
    let params = parameters.params;
    if (args.length === 2 && typeof args[0] === 'string') {
      params = {};
    }

    try {
      if (!parameters.data) {
        throw new Error('Data is a required parameter');
      } else if (typeof data !== 'string') {
        parameters.data = JSON.stringify(parameters.data);
      }

      params.MessageBody = parameters.data;
      params.QueueUrl = params.QueueUrl || await this.getQueueUrl(name).catch((err) => {
        return this.createQueue(name);
      });

      return this.sqs.sendMessage(params).promise().then((response: AWS.SQS.SendMessageResult) => {
        callback(null, response.MessageId);
        return Promise.resolve(response.MessageId);
      }).catch((err) => {
        callback(err);
        return Promise.reject(err);
      });
    } catch (err) {
      callback(err);
      return Promise.reject(err);
    }
  }

  pull(name: string, onMessageReceived: (data, callback: (err?: Error) => void) => void): void;
  pull(name: string, params: AWS.SQS.ReceiveMessageRequest, onMessageReceived: (data, callback: (err?: Error) => void) => void): void;
  pull(params: AWS.SQS.ReceiveMessageRequest, onMessageReceived: (data, callback: (err?: Error) => void) => void): void;
  pull(...args): void {
    const parameters = this.getParameters(args);
    const name = parameters.name;
    const params = parameters.params;
    const onMessageReceived = parameters.callback;

    const options: AWS.SQS.ReceiveMessageRequest = Object.assign({} , params);
    const getQueueUrl = name ? this.getQueueUrl(name) : Promise.resolve(options.QueueUrl);

    getQueueUrl
      .then((queueUrl) => Promise.resolve(Object.assign({}, options, { QueueUrl: queueUrl })))
      .then((paramsWithQueueUrl) => this.receiveMessage(paramsWithQueueUrl, onMessageReceived))
      .then(() => {
        setTimeout(() => {
          this.pull(name, params, onMessageReceived);
        }, 5000);
      });
  }

  // ------------------------------------------------------------------------------------------ Private methods

  private getParameters(args: Array<any>): SQSParameters {

    // name, data, params, callback
    const parameters: SQSParameters = {};

    if (args.length === 4) {
      if (typeof args[0] !== 'string') {
        throw new Error('The first parameter should be of type "string" if 4 parameters are provided');
      }

      // name, data, params, callback
      parameters.name = args[0];
      parameters.data = args[1];
      parameters.params = args[2];
      parameters.callback = args[3];
    } else if (args.length === 3) {

      // name, data/params, callback
      if (typeof args[0] === 'string') {
        parameters.name = args[0];
        parameters.data = args[1];
        parameters.params = args[1];
        parameters.callback = args[2];

      // data, params, callback
      } else {
        parameters.name = null;
        parameters.data = args[0];
        parameters.params = args[1];
        parameters.callback = args[2];
      }

    } else if (args.length === 2) {

      // name, data/params/callback
      if (typeof args[0] === 'string') {
        parameters.name = args[0];
        if (typeof args[1] === 'function') {
          // name, callback
          parameters.callback = args[1];
        } else {
          // name, data/params
          parameters.data = args[1];
          parameters.params = args[1];
        }
      } else if (typeof args[1] === 'function') {
        // params, callback
        parameters.params = args[0];
        parameters.callback = args[1];
      } else {
        // data, params
        parameters.data = args[0];
        parameters.params = args[1];
      }
    } else if (args.length === 1) {
      // name
      if (typeof args[0] === 'string') {
        parameters.name = args[0];

      // callback??
      } else if (typeof args[0] === 'function') {
        throw new Error('You must either specify "name" (string) with separate parameters, or a single parameters object as first argument');

      // params
      } else {
        parameters.params = args[0];
      }
    }

    // Make sure the params object exists
    parameters.params = parameters.params || {};

    // Make sure that the `callback` parameter exists and that it is a function
    parameters.callback = parameters.callback || function() {};
    if (typeof parameters.callback !== 'function') {
      parameters.callback = function() {};
    }

    return parameters;
  }

}

// ------------------------------------------------------------------------------------------ Types & Interfaces

export type SQSParameters = {
  name?: string;
  data?: any;
  params?: any;
  callback?: (err: AWS.AWSError, data?: any) => void;
};
