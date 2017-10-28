const fs = require('fs')
const path = require('path')
const connectionDefault = require('./connection-default');

let singleton = null
class Options {
  constructor (inPath) {
    if (singleton) { return singleton }
    singleton = this
    singleton._config_folder = inPath
    return this
  }

  load (path) {

  };

  get backend () {
    let fn = path.join(this._config_folder, 'backend.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    Object.assign(opt, {
      http: {
        portnum: 1213
      }
    })
    return opt
  }

  get connections () {
    let fn = path.join(this._config_folder, 'audit.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    opt = Object.assign(opt, connectionDefault)
    return opt
  }

  get store () {
    let fn = path.join(this._config_folder, 'store.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }

  get rdp () {
    let fn = path.join(this._config_folder, 'rdp.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }
};

exports = module.exports = Options
