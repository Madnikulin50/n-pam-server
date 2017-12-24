const BaseSocketIO = require('../_base-socket-io')
const path = require('path')
const debug = require('debug')
const log = debug('npam:log')
const error = debug('npam:error')

class Http extends BaseSocketIO {
  get key () {
    return 'http'
  }
  get socket () {
    return undefined
  }
  get clientHtml () {
    return undefined
  }

  get staticRoot () {
    return undefined
  }

  filterRequest (req, resp, next) {
    if (req.session) {
      error('SOCKET: No Express Session / REJECTED')
      return next()
    }
    if (!req.session.http) {
      log('Not HTTP sesison')
      return next()
    }
    log(`load data from ${req.session.http.url}`)
    return next()
  }
  prepare (inParams, onDone) {
    return super.prepare(inParams, (err) => {
      if (err) return onDone(err)
      this.app.use(this.filterRequest.bind(this))
      return onDone()
    })
  }

  startSession (req, resp, next) {
    req.protocolDispaspatcher = this
    this.createSessionInfo({
      req: req
    }, (err) => {
      if (err) { debug(err) }

      
    })
  }

  createSessionInfo (inParams, onDone) {
    let req = inParams.req
    let conn = this.options.connections.find(conn => {
      return conn.name === req.params.conn && conn.type === this.key
    })
    if (conn === undefined) {
      return onDone('Connection not found')
    }

    let session = Object.assign({}, conn)

    if (session.user === undefined) {
      session.user = req.session.username
    }

    if (session.password === undefined) {
      session.password = req.session.password
    }

    req.session.http = session
    return onDone()
  }
}

module.exports = new Http
