const path = require('path')
const validator = require('validator')

const express = require('express')

const socketIo = require('socket.io')
const expressSession = require('express-session')
const http = require('http')
var logger = require('morgan')
const debug = require('debug')('npam')

const expressOptions = require('./expressOptions')

class BaseSocketIO {
  get key () {
    throw new Error('Должно быть определено')
  }

  get socket () {
    throw new Error('Должно быть определено')
  }

  get clientHtml () {
    throw new Error('Должно быть определено')
  }

  get staticRoot () {
    throw new Error('Должно быть определено')
  }

  get validator () {
    return validator
  }

  createSessionInfo (inParams, onDone) {
    throw new Error('Должно быть определено')
  }

  checkCredentials (inParams) {
    return true
  }

  get myUtil () {
    throw new Error('Должно быть определено')
  }

  prepare (inParams, onDone) {
    this.config = inParams.options[this.key]

    this.session = expressSession({
      secret: this.config.session.secret,
      name: this.config.session.name,
      resave: true,
      saveUninitialized: false,
      unset: 'destroy'
    })
    this.app = express()
    var server = http.createServer(this.app)
    this.server = server
    this.io = socketIo(server)
    this.app.use((req, res, next) => {
      req.protocolDispatcher = this
      return next()
    })
    this.app.use(this.session)
    this.app.use(this.myUtil.basicAuth)
    this.app.use(logger('common'))
    this.app.use(express.static(this.staticRoot, expressOptions))

    this.app.get('/', function (req, res, next) {
      res.sendFile(path.join(__dirname, '/client/html/index.html'))
    })

    this.app.get(`/${this.key}/host/:host?`, (req, res, next) => {
      req.session.host = req.params.host
      res.sendFile(this.clientHtml)
      req.protocolDispaspatcher = this
      this.createSessionInfo({
        req: req
      }, (err) => {
        if (err) { debug(err) }
      })
    })

    // Express error handling
    this.app.use(function (req, res, next) {
      res.status(404).send("Sorry can't find that!")
    })

    this.app.use(function (err, req, res, next) {
      debug(err.stack)
      res.status(500).send('Something broke!')
    })

    this.server.listen(this.config.listen.port)

    // socket.io
    // expose express session with socket.request.session
    this.io.use((socket, next) => {
      (socket.request.res) ? this.session(socket.request, socket.request.res, next) : next()
    })

    // bring up socket
    this.io.on('connection', this.socket)
    /*
    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        this.config.listen.port++
        console.warn('WebSSH2 Address in use, retrying on port ' + this.config.listen.port)
        setTimeout(function () {
          this.server.listen(config.listen.port)
        }, 250)
      } else {
        debug('WebSSH2 server.listen ERROR: ' + err.code)
      }
    }) */
    return onDone()
  }
};

module.exports = BaseSocketIO
