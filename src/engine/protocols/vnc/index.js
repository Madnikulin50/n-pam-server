const BaseSocketIO = require('../_base-socket-io')
const path = require('path')

class Vnc extends BaseSocketIO {
  get key () {
    return 'vnc'
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

  createSessionInfo (inParams, onDone) {
    let req = inParams.req
    let conn = this.options.connections.find(conn => {
      return conn.name === req.params.conn && conn.type === this.key
    })
    if (conn === undefined) {
      return onDone('Connection not found')
    }

    req.session.vnc = {
      host: conn.host,
      port: conn.port || this.config.connection.port,
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
    req.query.readyTimeout) || this.config.connection.readyTimeout,

      user: conn.user || req.session.username,
      password: conn.password || req.session.password

    }
    if (req.session[this.key].header.name) this.validator.escape(req.session[this.key].header.name)
    if (req.session[this.key].header.background) this.validator.escape(req.session[this.key].header.background)
    return onDone()
  }
}

module.exports = new Vnc()
