const BaseSocketIO = require('../_base-socket-io')
const path = require('path')

class Rdp extends BaseSocketIO {
  get key () {
    return 'rdp'
  }
  get socket () {
    return require('./socket')
  }
  get clientHtml () {
    return path.join(__dirname, '/client/html/client.html')
  }

  get staticRoot () {
    return path.join(__dirname, '/client')
  }
  get myUtil () {
    return require('./util')
  }

  createSessionInfo (inParams, onDone) {
    let req = inParams.req
    req.session.rdp = {
      host: (this.validator.isIP(req.params.host + '') && req.params.host) ||
  (this.validator.isFQDN(req.params.host) && req.params.host) ||
  (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.params.host) &&
    req.params.host) || this.config[this.key].host,
      port: (this.validator.isInt(req.query.port + '', {min: 1, max: 65535}) &&
    req.query.port) || this.config[this.key].port,
      header: {
        name: req.query.header || this.config.header.text,
        background: req.query.headerBackground || this.config.header.background
      },
      algorithms: this.config.algorithms,
      allowreplay: this.validator.isBoolean(req.headers.allowreplay + '') || false,
      log: {
        screencapture: this.config.logging.logScreenOnMouseclicks || false
      },
      readyTimeout: (this.validator.isInt(req.query.readyTimeout + '', {min: 1, max: 300000}) &&
    req.query.readyTimeout) || this.config[this.key].readyTimeout
    }
    if (req.session[this.key].header.name) this.validator.escape(req.session[this.key].header.name)
    if (req.session[this.key].header.background) this.validator.escape(req.session[this.key].header.background)
    return onDone()
  }
}

module.exports = new Rdp()
