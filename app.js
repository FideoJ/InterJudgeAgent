const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const Dispatcher = require('./dispatcher');
const {
  validateGET,
  validateDELETE,
  validatePOST
} = require('./validate');
const {
  toMid
} = require('./utils');

const judgeRouter = new Router({
  prefix: '/judge'
});

const dispatcher = new Dispatcher();

judgeRouter.post('/', toMid(validatePOST));
judgeRouter.post('/',
  async ctx => {
    const req = ctx.request.body;
    console.log(req);
    dispatcher.addTask(req);
    await new Promise(resolve => {
      setTimeout(resolve, 5 * 1000);
    });
    ctx.body = dispatcher.getTask(req.sub_id);
  });

judgeRouter.get('/', toMid(validateGET));
judgeRouter.get('/', ctx => ctx.body = dispatcher.getTask(ctx.request.query.sub_id));

judgeRouter.delete('/', toMid(validateDELETE));
judgeRouter.delete('/', ctx => ctx.body = dispatcher.removeTask(ctx.request.query.sub_id));

const app = new Koa();
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = err.message;
    ctx.app.emit('error', err, ctx);
  }
});
app.on('error', (err, ctx) => {
  console.error(ctx.request.toString());
  console.error(err.toString());
});
app.use(bodyParser());
app.use(judgeRouter.routes());

module.exports = app;