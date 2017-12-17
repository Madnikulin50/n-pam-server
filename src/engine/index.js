const path = require('path')
const fs = require('fs')
const async = require('async')
const Menu = require('./menu')
const express = require('express')

const socketIo = require('socket.io')
const expressSession = require('express-session')
const http = require('http')
var logger = require('morgan')
const debug = require('debug')('npam')
const auth = require('./auth')

const expressOptions = require('./expressOptions')

class Engine {
  _prepareProtocolFile (inParams, onDone) {
    const testFolder = path.join(__dirname, 'protocols')
    const protocol = require(path.join(testFolder, inParams.file))
    this.protocols[inParams.file] = protocol
    return protocol.prepare(inParams, onDone)
  }
  init (inParams, onDone) {
    this.config = inParams.options['server']
    this.session = expressSession({
      secret: this.config.session.secret,
      name: this.config.session.name,
      resave: true,
      saveUninitialized: false,
      unset: 'destroy'
    })
    this.app = express()
    this.server = http.createServer(this.app)
    this.io = socketIo(this.server)
    this.app.use((req, res, next) => {
      req.protocolDispatcher = this
      return next()
    })
    this.app.use(this.session)
    this.app.use(auth.basicAuth)
    this.app.use(logger('common'))
    // this.app.use('/', express.static(this.staticRoot, expressOptions))
    this.protocols = {}
    const testFolder = path.join(__dirname, 'protocols')
    inParams.app = this.app
    inParams.io = this.io
    fs.readdir(testFolder, (err, files) => {
      if (err) { return onDone(err) }
      files = files.filter(file => {
        return !(file[0] === '_' || file[0] === '.')
      })
      return async.eachSeries(files, (file, fileDone) => {
        return this._prepareProtocolFile(Object.assign({}, inParams, {file: file}), fileDone)
      }, (err) => {
        if (err) return onDone(err)
        this.menu = new Menu()
        return this.menu.init(inParams, (err) => {
          if (err) {
            return onDone(err)
          }
          // Express error handling
          this.app.use(function (req, res, next) {
            res.status(404).send("Sorry can't find that!")
          })

          this.app.use(function (err, req, res, next) {
            debug(err.stack)
            res.status(500).send('Something broke!')
          })
          this.io.use((socket, next) => {
            (socket.request.res) ? this.session(socket.request, socket.request.res, next) : next()
          })
          this.server.listen(this.config.listen.port)
          return onDone()
        })
      })
    })
  }
}

module.exports = Engine
