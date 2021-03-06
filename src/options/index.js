const fs = require('fs')
const path = require('path')
const connectionDefault = require('./connection-default')
const serverDefault = require('./server-default')

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
    let fn = path.join(this._config_folder, 'connections.json')
    return require(fn)
  }
  get server () {
    let fn = path.join(this._config_folder, 'server.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    opt = Object.assign(opt, serverDefault)
    return opt
  }

  get users () {
    let fn = path.join(this._config_folder, 'users.json')
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

  get menu () {
    let fn = path.join(this._config_folder, 'menu.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }

  get vnc () {
    let fn = path.join(this._config_folder, 'vnc.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }

  get ssh () {
    let fn = path.join(this._config_folder, 'ssh.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }

  get ipp () {
    let fn = path.join(this._config_folder, 'ipp.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }

  get ftp () {
    let fn = path.join(this._config_folder, 'ftp.json')
    let opt = fs.existsSync(fn) ? require(fn) : {}
    return opt
  }
};

exports = module.exports = Options
