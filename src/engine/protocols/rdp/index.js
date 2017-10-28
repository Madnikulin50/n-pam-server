const path = require('path')
const validator = require('validator')
const myutil = require('./util')
const express = require('express')
const socket = require('./socket')
const socketIo = require('socket.io')

const session = require('express-session')({
  secret: 'MySecret',
  name: 'WebRDP',
  resave: true,
  saveUninitialized: false,
  unset: 'destroy'
})

class Rdp {
  prepare (inParams, onDone) {
    this.config = inParams.options.rdp
    let config = this.config
    this.app = express()
    var server = require('http').createServer(this.app)
    this.server = server
    this.io = socketIo(server)
    this.app.use(session)
    this.app.use(myutil.basicAuth)
    this.app.use(express.static(path.join(__dirname, '/client')))

    this.app.get('/', function (req, res, next) {
      res.sendFile(path.join(__dirname, '/client/html/index.html'))
    })

    this.app.get('/rdp/host/:host?', function (req, res, next) {
      req.session.host = req.params.host
      res.sendFile(path.join(__dirname, '/client/html/client.html'))
      req.session.rdp = {
        host: (validator.isIP(req.params.host + '') && req.params.host) ||
    (validator.isFQDN(req.params.host) && req.params.host) ||
    (/^(([a-z]|[A-Z]|[0-9]|[!^(){}\-_~])+)?\w$/.test(req.params.host) &&
      req.params.host) || config.rdp.host,
        port: (validator.isInt(req.query.port + '', {min: 1, max: 65535}) &&
      req.query.port) || config.rdp.port,
        header: {
          name: req.query.header || config.header.text,
          background: req.query.headerBackground || config.header.background
        },
        algorithms: config.algorithms,
        allowreplay: validator.isBoolean(req.headers.allowreplay + '') || false,
        log: {
          screencapture: config.logging.logScreenOnMouseclicks || false
        },
        readyTimeout: (validator.isInt(req.query.readyTimeout + '', {min: 1, max: 300000}) &&
      req.query.readyTimeout) || config.rdp.readyTimeout
      }
      if (req.session.rdp.header.name) validator.escape(req.session.rdp.header.name)
      if (req.session.rdp.header.background) validator.escape(req.session.rdp.header.background)
    })
/*
    // Express error handling
    this.app.use(function (req, res, next) {
      res.status(404).send("Sorry can't find that!")
    })

    this.app.use(function (err, req, res, next) {
      console.error(err.stack)
      res.status(500).send('Something broke!')
    })*/

    this.server.listen(4200)

    // socket.io
    // expose express session with socket.request.session
    this.io.use(function (socket, next) {
      (socket.request.res) ? session(socket.request, socket.request.res, next) : next()
    })

    // bring up socket
    this.io.on('connection', socket)
  }
};

module.exports = new Rdp()
