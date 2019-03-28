const app = require('./app');
const {
  currentTime
} = require('./utils');

process.on('uncaughtException', err => {
  console.error(`${currentTime()} uncaughtException:, ${err.message}`);
  console.error(err.stack);
});

app.listen(1212, () => console.info('Judge Server is listening at *:1212'));