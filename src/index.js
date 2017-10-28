var Options = require('./options')
var Backend = require('./backend')
var Engine = require('./engine')
var path = require('path')
const debug = require('debug')('npam')

var opts = new Options(path.join(process.cwd(), 'config'))

var backend = new Backend(opts)
var engine = new Engine()
engine.init({
  options: opts
}, (err) => {
  if (err) debug(err)
})
