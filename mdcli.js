const zmq = require('zeromq');
const uuid = require('uuid/v4');

class Mdcli {
  constructor(broker) {
    this.broker = broker;
    this.timeout = 100000;
    this.handlers = {};
  }

  connectToBroker() {
    this.client = zmq.socket('dealer');
    this.client.setsockopt('linger', 0);
    this.client.identity = 'C-' + uuid();
    this.client.on('message', (...frames) => this.recv(frames));
    this.client.connect(this.broker);
  }

  setTimeout(timeout) {
    this.timeout = timeout;
  }

  setHandler(service, handler) {
    this.handlers[service] = handler;
  }

  send(service, data) {
    if (!this.client)
      this.connectToBroker();
    this.client.send(['', 'MDPC01', service, data]);
    if (this.hasOwnProperty('timer'))
      clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.client.disconnect(this.broker);
      this.client = null;
      console.warn('permanent error, abandoning request');
    }, this.timeout);
  }

  recv(frames) {
    if (frames.length < 4) {
      console.error('INVALID LENGTH');
      return;
    }
    if (frames[0].toString() !== '') {
      console.error('EMPTY FRAME LOST');
      return;
    }
    if (frames[1].toString() !== 'MDPC01') {
      console.error('INVALID HEADER');
      return;
    }
    const service = frames[2].toString();
    if (!this.handlers.hasOwnProperty(service)) {
      console.warn(`NO HANDLER FOR ${service}`);
      return;
    }
    clearTimeout(this.timer);
    this.handlers[service](frames.slice(3));
  }
}

module.exports = Mdcli;