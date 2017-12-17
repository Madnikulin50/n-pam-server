const BaseSocketIO = require('../_base-socket-io')
const path = require('path')

class Ssh extends BaseSocketIO {
  get key () {
    return 'ssh'
  }
  get socket () {
    return require('./socket')
  }
  get clientHtml () {
    return path.join(path.join(__dirname, 'public', (this.config.useminified)
      ? 'client-min.htm' : 'client-full.htm'))
  }

  get staticRoot () {
    return path.join(__dirname, 'public')
  }

  createSessionInfo (inParams, onDone) {
    let req = inParams.req
    let conn = this.options.connections.find(conn => {
      return conn.name === req.params.conn && conn.type === this.key
    })
    if (conn === undefined) {
      return onDone('Connection not found')
    }
    req.session.ssh = {
      host: conn.host,
      port: conn.port || this.config.connection.port,
      header: {
        name: req.query.header || this.config.header.text,
        background: req.query.headerBackground || this.config.header.background
      },

      algorithms: this.config.algorithms,

      term: (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.query.sshterm) &&
        req.query.sshterm) || this.config.connection.term,

      allowreplay: this.validator.isBoolean(req.headers.allowreplay + '') || false,

      serverlog: {
        client: this.config.serverlog.client || false,
        server: this.config.serverlog.server || false
      },

      readyTimeout: (this.validator.isInt(req.query.readyTimeout + '', {min: 1, max: 300000}) &&
        req.query.readyTimeout) || this.config.connection.readyTimeout,

      user: conn.user || req.session.username,
      password: conn.password || req.session.password
    }
    if (req.session.ssh.header.name) this.validator.escape(req.session.ssh.header.name)
    if (req.session.ssh.header.background) this.validator.escape(req.session.ssh.header.background)
    return onDone()
  }
}

module.exports = new Ssh()
