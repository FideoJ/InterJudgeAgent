const currentTime = () => {
  return (new Date(Date.now() + 28800000)).toISOString().replace(/T/, ' ').slice(0, -1);
};

const secondsSince = past => {
  return ((new Date() - new Date(past)) / 1000).toFixed();
};

const toMid = (validator) => {
  return (ctx, next) => {
    if (ctx.request.method === 'GET' || ctx.request.method === 'DELETE') {
      if (!validator(ctx.request.query))
        throw {
          status: 400,
          message: validator.errors
        };
      return next();
    } else if (ctx.request.method === 'POST') {
      if (!validator(ctx.request.body))
        throw {
          status: 400,
          message: validator.errors
        };
      return next();
    }
    throw {
      status: 400,
      message: 'Method not supported.'
    };
  };
};

module.exports = {
  currentTime,
  secondsSince,
  toMid
};