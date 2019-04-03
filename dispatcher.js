const flatCache = require('flat-cache');
const protobuf = require('protobufjs');
const pick = require('object.pick');
const uuid = require('uuid/v4');
const Mdcli = require('./mdcli');
const {
  currentTime,
  secondsSince
} = require('./utils');

class Dispatcher {
  constructor() {
    this.tasks = flatCache.load('tasks.json', '.cache');
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
    this.completedHandler = () => {};
    this.cli = new Mdcli('tcp://broker:5555');
    this.cli.setHandler('compiler_gpp', msg => this.handleComplierGppRsp(msg));
    this.cli.setHandler('tester', msg => this.handleTesterRsp(msg));

    this.results_table = {
      'compiler_gpp': ['SUCCESS', 'FAIL', 'SYSTEM_ERROR'],
      'tester': ['ACCEPTED', 'PRESENTATION_ERROR', 'WRONG_ANSWER',
        'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR',
        'SYSTEM_ERROR'
      ]
    };

    setInterval(() => this.tasks.save(true), 2 * 60 * 1000);
    setInterval(() => this.activate(20), 90 * 1000);
    setInterval(() => this.clean(100), 10 * 60 * 1000);
  }

  onCompleted(handler) {
    this.completedHandler = handler;
  }

  addTask(origin_req) {
    const judge_id = uuid();
    this.tasks.setKey(judge_id, {
      overview: {
        judge_id
      },
      compiler_gpp: {},
      tester: {},
      file_provider: {
        client: origin_req.file_provider
      },
      origin_req
    });
    this.dispatch(judge_id);
    return judge_id;
  }

  removeTask(judge_id) {
    this.tasks.removeKey(judge_id);
  }

  getTask(judge_id) {
    return this.tasks.getKey(judge_id);
  }

  // listTasks() {
  //   return this.tasks.keys();
  // }

  dispatch(judge_id) {
    const task = this.tasks.getKey(judge_id);
    if (task.overview.completed)
      return;
    if (!task.compiler_gpp.completed)
      this.callComplierGpp(judge_id);
    else if (!task.tester.completed)
      this.callTester(judge_id);
  }

  activate(count) {
    for (const judge_id in this.tasks.all()) {
      if (count <= 0)
        break;
      const task = this.tasks.getKey(judge_id);
      if (!task.overview.completed && secondsSince(task.overview.start_time) > 60) {
        this.dispatch(judge_id);
        --count;
      }
    }
  }

  clean(count) {
    for (const judge_id in this.tasks.all()) {
      if (count <= 0)
        break;
      const task = this.tasks.getKey(judge_id);
      if (task.overview.completed && secondsSince(task.overview.end_time) > 5 * 60) {
        this.removeTask(judge_id);
        --count;
      }
    }
  }

  callComplierGpp(judge_id) {
    const task = this.tasks.getKey(judge_id);
    const req = pick(task.origin_req, [
      'sub_id', 'prob_id', 'file_provider',
      'sub_src_filename', 'sub_header_filename',
      'prob_src_filename', 'prob_header_filename'
    ]);
    req.request_id = judge_id;
    const errMsg = this.cgReq.verify(req);
    if (errMsg)
      throw Error(errMsg);
    const msg = this.cgReq.create(req);
    const buffer = this.cgReq.encode(msg).finish();
    this.cli.send('compiler_gpp', buffer);
    task.overview.start_time = task.compiler_gpp.start_time = currentTime();
  }

  handleComplierGppRsp(msg) {
    const decoded = this.cgRsp.decode(msg[0]);
    const rsp = this.cgRsp.toObject(decoded);
    const errMsg = this.cgRsp.verify(rsp);
    if (errMsg)
      throw Error(errMsg);
    const judge_id = rsp.request_id;
    const task = this.tasks.getKey(judge_id);
    if (!task)
      return;
    const {
      compiler_gpp,
      file_provider
    } = task;
    compiler_gpp.completed = true;
    compiler_gpp.end_time = currentTime();
    const result = this.getPrintable(rsp.result, 'compiler_gpp');
    compiler_gpp.result = result;
    compiler_gpp.detail = rsp.detail || '';
    file_provider.compiler_gpp = rsp.file_provider;
    if (result !== 'SUCCESS') {
      const {
        overview
      } = task;
      overview.completed = true;
      overview.end_time = compiler_gpp.end_time;
      overview.result = result === 'FAIL' ? 'COMPILE_ERROR' : result;
      this.completedHandler();
    } else {
      this.callTester(judge_id);
    }
  }

  callTester(judge_id) {
    const task = this.tasks.getKey(judge_id);
    const req = pick(task.origin_req, [
      'sub_id', 'prob_id', 'test_case_id', 'max_cpu_time', 'max_memory'
    ]);
    req.test_file_provider = task.file_provider.client;
    req.exec_file_provider = task.file_provider.compiler_gpp;
    req.request_id = judge_id;
    const errMsg = this.testerReq.verify(req);
    if (errMsg)
      throw Error(errMsg);
    const msg = this.testerReq.create(req);
    const buffer = this.testerReq.encode(msg).finish();
    this.cli.send('tester', buffer);
    task.tester.start_time = currentTime();
  }

  handleTesterRsp(msg) {
    const decoded = this.testerRsp.decode(msg[0]);
    const rsp = this.testerRsp.toObject(decoded);
    const errMsg = this.testerRsp.verify(rsp);
    if (errMsg)
      throw Error(errMsg);
    const task = this.tasks.getKey(rsp.request_id);
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
    if (Array.isArray(rsp.test_case)) {
      for (const oneCase of rsp.test_case) {
        oneCase.result = this.getPrintable(oneCase.result, 'tester');
        oneCase.exit_code = oneCase.exit_code || 0;
        oneCase.cpu_time = oneCase.cpu_time || 0;
        oneCase.signal = oneCase.signal || 0;
        oneCase.test_case_id = oneCase.test_case_id || 0;
        tester.test_case.push(oneCase);
      }
    }
    file_provider.tester = rsp.file_provider;
    overview.completed = true;
    overview.end_time = tester.end_time;
    overview.result = this.getPrintable(rsp.result, 'tester');
    this.completedHandler();
  }

  getPrintable(result, service) {
    if (!this.results_table.hasOwnProperty(service))
      return 'UNKNOWN';
    // proto3 omits zero enum value
    if (result === undefined)
      result = 0;
    return this.results_table[service][result] || 'UNKNOWN';
  }
}

module.exports = Dispatcher;