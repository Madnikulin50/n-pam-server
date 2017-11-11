const rfb = require('../rfb2')
const debug = require('debug')
var base64Img = require('base64-img')
// var rle = require('../rle.js')

const log = debug('npam:log')
const error = debug('npam:error')

/**
 * Create proxy between rfb layer and socket io
 * @param server {http(s).Server} http server
 */
var clientsMap = new Map()

module.exports = function (socket) {
  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.emit('401 UNAUTHORIZED')
    log('SOCKET: No Express Session / REJECTED')
    socket.disconnect(true)
    return
  }

  var rfbClient = null

  socket.on('infos', function (infos) {
    if (socket.rfbClient) {
      log('End rfb client by client')
      // clean older connection
      socket.rfbClient.end()
      socket.rfbClient = undefined
    }
    if (socket.request.session.vnc === undefined) {
      log('No session in request')
      return
    }
    log('WebRfb Login: user=' + socket.request.session.username + ' pass=' + socket.request.session.userpassword + ' from=' + socket.handshake.address + ' host=' + socket.request.session.vnc.host + ' port=' + socket.request.session.vnc.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + socket.request.session.vnc.allowreplay)
    socket.emit('title', 'vnc://' + socket.request.session.vnc.host)
    if (socket.request.session.vnc.header.background) socket.emit('headerBackground', socket.request.session.vnc.header.background)
    if (socket.request.session.vnc.header.name) socket.emit('header', socket.request.session.vnc.header.name)

    socket.emit('headerBackground', 'green')
    socket.emit('header', `Connecting to ${socket.request.session.vnc.host}...`)

    let connectionParams = {
      password: socket.request.session.userpassword,
      host: socket.request.session.vnc.host,
      port: 5900
    }
    let key = JSON.stringify(connectionParams)
    rfbClient = clientsMap.get(key)
    /* if (rfbClient === undefined) { */
    rfbClient = rfb.createConnection(connectionParams)
    clientsMap.set(key, rfbClient)
    /* } else {
      log(`Duplicated connect vnc-connect`)
    } */

    rfbClient.on('connect', function () {
      log('remote screen name: ' + rfbClient.title + ' width:' + rfbClient.width + ' height: ' + rfbClient.height)
      socket.emit('rfb-connect', {
        width: rfbClient.width,
        height: rfbClient.height
      })
      socket.rfbClient = rfbClient

      socket.emit('headerBackground', 'green')
      socket.emit('header', `${rfbClient.title} is online`)
    })
    rfbClient.on('rect', function (bitmap) {
      log(`Rect on vnc-connection:x=${bitmap.x} y=${bitmap.y} width=${bitmap.width} height=${bitmap.height}`)
      bitmap.destLeft = bitmap.x
      bitmap.destRight = bitmap.x + bitmap.width
      bitmap.destTop = bitmap.y
      bitmap.destBottom = bitmap.y + bitmap.height
      socket.emit('rfb-bitmap', bitmap)
    })
    rfbClient.on('resize', function (bitmap) {
      socket.emit('rfb-resize', bitmap)
    })
    rfbClient.on('clipboard', function (bitmap) {
      socket.emit('rfb-clipboard', bitmap)
    })
    rfbClient.on('close', function () {
      socket.emit('rfb-close')
    })
    rfbClient.on('error', function (err) {
      log(`Error on vnc-connection: ${err}`)
      socket.emit('rfb-error', {code: 1, message: err})
      socket.emit('headerBackground', 'red')
      socket.emit('header', `Error connect to ${socket.request.session.vnc.host}:${err}`)
    })
    rfbClient.on('data', function (msg) {
      log(`Data on vnc-connection:${msg}`)
      socket.emit('rfb-error', {code: 1, message: msg})
      socket.emit('headerBackground', 'blue')
      socket.emit('header', `Message from ${socket.request.session.vnc.host}:${msg}`)
    })
  }).on('mouse', function (x, y, button, isPressed, canvas) {
    if (!socket.rfbClient) return
    /* if (isPressed) {
      var newDate = new Date()
      var screenCapDate = parseInt((newDate.getMonth() + 1), 10) + '-' + newDate.getDate() + '-' + newDate.getFullYear() + '-' + newDate.getTime()
      base64Img.img(canvas, './screenshots', screenCapDate + '-' + socket.request.session.username, function (err, filepath) { log(err) })
    } */
    log(`On Mouse on vnc-connection:${x} ${y}`)
    if (x <= rfbClient.width &&
      y <= rfbClient.height)
      rfbClient.pointerEvent(x, y, button)
  }).on('wheel', function (x, y, step, isNegative, isHorizontal) {
    if (!socket.rfbClient) {
      return
    }
    log(`On Mouse wheel on vnc-connection:${x} ${y}`)
    //rfbClient.sendWheelEvent(x, y, step, isNegative, isHorizontal)
  }).on('scancode', function (code, isPressed) {
    log(`On scancode:${code} ${isPressed}`)
    if (!socket.rfbClient) return
    // rfbClient.sendKeyEventScancode(code, isPressed)
    rfbClient.keyEvent(code, isPressed)
  }).on('unicode', function (code, isPressed) {
    log(`On unicode:${code} ${isPressed}`)
    if (!socket.rfbClient) return

    // rfbClient.sendKeyEventUnicode(code, isPressed)
    rfbClient.keyEvent(code, isPressed)
  }).on('disconnect', function () {
    if (!socket.rfbClient) return
    log(`On disconnect`)
    rfbClient.end()
    rfbClient = null
  })
}
