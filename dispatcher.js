const flatCache = require('flat-cache');
const protobuf = require('protobufjs');
const pick = require('object.pick');
const Mdcli = require('./mdcli');
const {
  currentTime,
  secondsSince
} = require('./utils');

class Dispatcher {
  constructor() {
    this.tasks = flatCache.load('tasks.json');
    const cgNs = new protobuf.Root().loadSync('proto/compiler_gpp.proto', {
      keepCase: true
    });
    const testerNs = new protobuf.Root().loadSync('proto/tester.proto', {
      keepCase: true
    });
    this.cgReq = cgNs.lookupType('compiler_gpp.Request');
    this.cgRsp = cgNs.lookupType('compiler_gpp.Response');
    this.testerReq = testerNs.lookupType('tester.Request');
    this.testerRsp = testerNs.lookupType('tester.Response');
    this.cli = new Mdcli('tcp://broker:5555');

    setInterval(() => this.tasks.save(true), 2 * 60 * 1000);
    setInterval(() => this.activate(20), 90 * 1000);
    setInterval(() => this.clean(100), 10 * 60 * 1000);
  }

  addTask(origin_req) {
    this.tasks.setKey(origin_req.sub_id, {
      overview: {},
      compiler_gpp: {},
      tester: {},
      file_provider: {
        client: origin_req.file_provider
      },
      origin_req
    });
    this.dispatch(origin_req.sub_id);
  }

  removeTask(sub_id) {
    this.tasks.removeKey(sub_id);
  }

  getTask(sub_id) {
    return this.tasks.getKey(sub_id);
  }

  // listTasks() {
  //   return this.tasks.keys();
  // }

  dispatch(sub_id) {
    const task = this.tasks.getKey(sub_id);
    if (task.overview.completed)
      return;
    if (!task.compiler_gpp.completed)
      this.callComplierGpp(task);
    else if (!task.tester.completed)
      this.callTester(task);
  }

  activate(count) {
    for (const sub_id in this.tasks.all()) {
      if (count <= 0)
        break;
      const task = this.tasks.getKey(sub_id);
      if (!task.overview.completed && secondsSince(task.overview.start_time) > 60) {
        this.dispatch(sub_id);
        --count;
      }
    }
  }

  clean(count) {
    for (const sub_id in this.tasks.all()) {
      if (count <= 0)
        break;
      const task = this.tasks.getKey(sub_id);
      if (task.overview.completed && secondsSince(task.overview.end_time) > 5 * 60) {
        this.removeTask(sub_id);
        --count;
      }
    }
  }

  callComplierGpp(task) {
    const req = pick(task.origin_req, ['sub_id', 'src_filename', 'header_filename', 'file_provider']);
    const errMsg = this.cgReq.verify(req);
    if (errMsg)
      throw Error(errMsg);
    const msg = this.cgReq.create(req);
    const buffer = this.cgReq.encode(msg).finish();
    this.cli.send('compiler_gpp', buffer, msg => this.handleComplierGppRsp(msg));
    task.overview.start_time = task.compiler_gpp.start_time = currentTime();
  }

  handleComplierGppRsp(msg) {
    const decoded = this.cgRsp.decode(msg[0]);
    const rsp = this.cgRsp.toObject(decoded);
    const errMsg = this.cgRsp.verify(rsp);
    if (errMsg)
      throw Error(errMsg);
    const task = this.tasks.getKey(rsp.sub_id);
    if (!task)
      return;
    const {
      compiler_gpp,
      file_provider
    } = task;
    compiler_gpp.completed = true;
    compiler_gpp.end_time = currentTime();
    const result = this.getPrintable(rsp.result);
    compiler_gpp.result = result;
    compiler_gpp.detail = rsp.detail || '';
    file_provider.compiler_gpp = rsp.file_provider;
    if (result !== 'SUCCESS') {
      const {
        overview
      } = task;
      overview.completed = true;
      overview.end_time = compiler_gpp.end_time;
      overview.result = 'CompileError';
    } else {
      this.callTester();
    }
  }

  callTester(task) {
    const req = pick(task.origin_req, ['sub_id', 'prob_id', 'test_case_id']);
    req.file_provider = task.file_provider.compiler_gpp;
    const errMsg = this.testerReq.verify(req);
    if (errMsg)
      throw Error(errMsg);
    const msg = this.testerReq.create(req);
    const buffer = this.testerReq.encode(msg).finish();
    this.cli.send('tester', buffer, msg => this.handleTesterRsp(msg));
    task.tester.start_time = currentTime();
  }

  handleTesterRsp(msg) {
    const decoded = this.testerRsp.decode(msg[0]);
    const rsp = this.testerRsp.toObject(decoded);
    const errMsg = this.testerRsp.verify(rsp);
    if (errMsg)
      throw Error(errMsg);
    const task = this.tasks.getKey(rsp.sub_id);
    if (!task)
      return;
    const {
      overview,
      tester,
      file_provider
    } = task;
    tester.completed = true;
    tester.end_time = currentTime();
    tester.test_case = [];

    for (const oneCase of rsp.test_case) {
      oneCase.result = this.getPrintable(oneCase.result);
      tester.test_case.push(oneCase);
    }

    file_provider.tester = rsp.file_provider;
    overview.completed = true;
    overview.end_time = tester.end_time;
    overview.result = this.getPrintable(rsp.result);
  }

  getPrintable(result) {
    return 'SURPRISE';
  }
}

module.exports = Dispatcher;