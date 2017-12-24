const Options = require('./options')
const Backend = require('./backend')
const Engine = require('./engine')
const path = require('path')
const debug = require('debug')('npam')

const opts = new Options(path.join(process.cwd(), 'config'))

const backend = new Backend(opts)

console.log(backend !== undefined)

const engine = new Engine()
engine.init({
  options: opts
}, (err) => {
  if (err) debug(err)
})
