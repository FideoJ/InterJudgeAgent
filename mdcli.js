const zmq = require('zeromq');
const uuid = require('uuid/v4');

class Mdcli {
  constructor(broker) {
    this.broker = broker;
    this.timeout = 2500;
    this.handlers = {};
    this.connectToBroker();
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

  send(service, data, handler) {
    this.handlers[service] = handler;
    this.client.send(['', 'MDPC01', service, data]);
    if (this.hasOwnProperty('timer'))
      clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.client.disconnect(this.broker);
      console.warn('permanent error, abandoning request');
    }, this.timeout);
  }

  recv(frames) {
    const msgs = frames.map(frame => frame.toString());
    // console.log(frames.toString());
    if (msgs.length < 4) {
      console.error('INVALID MSG LENGTH');
      return;
    }
    if (msgs[0] !== '') {
      console.error('EMPTY FRAME LOST');
      return;
    }
    if (msgs[1] !== 'MDPC01') {
      console.error('INVALID MSG HEADER');
      return;
    }
    const service = msgs[2];
    if (!this.handlers.hasOwnProperty(service)) {
      console.warn(`NO HANDLER FOR ${service}`);
      return;
    }
    clearTimeout(this.timer);
    this.handlers[service](msgs.slice(3));
  }
}

module.exports = Mdcli;