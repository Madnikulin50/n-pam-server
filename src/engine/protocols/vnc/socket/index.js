const rfb = require('../rfb2')
const debug = require('debug')
const log = debug('npam:log')
const error = debug('npam:error')
const ImageJS = require('imagejs')

var clientsMap = new Map()

module.exports = function (socket) {
  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.emit('401 UNAUTHORIZED')
    error('SOCKET: No Express Session / REJECTED')
    socket.disconnect(true)
    return
  }

  if (!socket.request.session.vnc) {
    log('SOCKET: Not VNC Session / SKIP')
    return
  }
  let vnc = socket.request.session.vnc
  let rfbClient = null

  socket.on('infos', function (infos) {
    if (socket.rfbClient) {
      log('End rfb client by client')
      // clean older connection
      socket.rfbClient.end()
      socket.rfbClient = undefined
    }
    log('WebRfb Login: user=' + vnc.user + ' pass=' + vnc.password + ' from=' + socket.handshake.address + ' host=' + vnc.host + ' port=' + vnc.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + vnc.allowreplay)
    log('WebRfb infos: height=' + infos.screen.width + ' pass=' + infos.screen.width + ' locale=' + infos.locale)

    socket.emit('title', 'vnc://' + vnc.host)
    if (vnc.header.background) socket.emit('headerBackground', vnc.header.background)
    if (vnc.header.name) socket.emit('header', vnc.header.name)

    socket.emit('headerBackground', 'green')
    socket.emit('header', `Connecting to ${vnc.host}...`)

    let connectionParams = {
      password: vnc.password,
      host: vnc.host,
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
    let scale = 1.0
    rfbClient.on('connect', function () {
      log('remote screen name: ' + rfbClient.title + ' width:' + rfbClient.width + ' height: ' + rfbClient.height)
      //scale = Math.min(infos.screen.width / rfbClient.width, infos.screen.height / rfbClient.height)

      socket.emit('rfb-connect', {
        width: rfbClient.width * scale,
        height: rfbClient.height * scale
      })
      socket.rfbClient = rfbClient
      socket.emit('headerBackground', 'green')
      socket.emit('header', `${rfbClient.title} is online`)
    })
    rfbClient.on('rect', function (bitmap) {
      log(`Rect on vnc-connection:x=${bitmap.x} y=${bitmap.y} width=${bitmap.width} height=${bitmap.height}`)
      /*let b = new ImageJS.Bitmap({
        width: bitmap.width,
        height: bitmap.height,
        data: bitmap.data
      })
      let scaled = b.resize({
        width: Math.ceil(bitmap.width * scale),
        height: Math.ceil(bitmap.height * scale),
        algorithm: 'nearestNeighbor'
      })
      /* let bmp = {
        destLeft: bitmap.x,
        destRight: bitmap.x + bitmap.width,
        destTop: bitmap.y,
        destBottom: bitmap.y + bitmap.height,
        bitsPerPixel: bitmap.bitsPerPixel,
        data: bitmap.data,
        width: bitmap.width,
        height: bitmap.height
      } *//*

      let bmp = {
        destLeft: Math.ceil(bitmap.x * scale),
        destRight: Math.ceil(bitmap.x * scale) + scaled.width,
        destTop: Math.ceil(bitmap.y * scale),
        destBottom: Math.ceil(bitmap.y * scale) + scaled.height,
        bitsPerPixel: bitmap.bitsPerPixel,
        data: scaled._data.data,
        width: scaled.width,
        height: scaled.height
      }*/
      var rgb = new Buffer(bitmap.width * bitmap.height *  3);
      /* var offset = 0;
      for (var i=0; i < bitmap.buffer.length; i += 4) {
        rgb[offset++] = bitmap.buffer[i+2];
        rgb[offset++] = bitmap.buffer[i+1];
        rgb[offset++] = bitmap.buffer[i];
      } */
      let bmp = {
        destLeft: bitmap.x,
        destRight: bitmap.x + bitmap.width,
        destTop: bitmap.y,
        destBottom: bitmap.y + bitmap.height,
        bitsPerPixel: bitmap.bitsPerPixel,
        data: bitmap.data,
        width: bitmap.width,
        height: bitmap.height
      }
      process.nextTick(() => { socket.emit('rfb-bitmap', bmp)})
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
      socket.emit('header', `Error connect to ${vnc.host}:${err}`)
    })
    rfbClient.on('data', function (msg) {
      log(`Data on vnc-connection:${msg}`)
      socket.emit('rfb-error', {code: 1, message: msg})
      socket.emit('headerBackground', 'blue')
      socket.emit('header', `Message from ${vnc.host}:${msg}`)
    })
  }).on('mouse', function (x, y, button, isPressed, canvas) {
    if (!socket.rfbClient) return
    /* if (isPressed) {
      var newDate = new Date()
      var screenCapDate = parseInt((newDate.getMonth() + 1), 10) + '-' + newDate.getDate() + '-' + newDate.getFullYear() + '-' + newDate.getTime()
      base64Img.img(canvas, './screenshots', screenCapDate + '-' + username, function (err, filepath) { log(err) })
    } */
    log(`On Mouse on vnc-connection: ${x} ${y} ${isPressed}`)
    if (x <= rfbClient.width &&
      y <= rfbClient.height) { rfbClient.pointerEvent(x, y, button) }
  }).on('wheel', function (x, y, step, isNegative, isHorizontal) {
    if (!socket.rfbClient) {
      return
    }
    log(`On Mouse wheel on vnc-connection:${x} ${y}`)
    // rfbClient.sendWheelEvent(x, y, step, isNegative, isHorizontal)
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
