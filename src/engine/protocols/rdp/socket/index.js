var rdp = require('node-rdpjs')
const debug = require('debug')
var base64Img = require('base64-img')
const log = debug('npam:log')
const error = debug('npam:error')

/**
 * Create proxy between rdp layer and socket io
 * @param server {http(s).Server} http server
 */
module.exports = function (socket) {
  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.emit('401 UNAUTHORIZED')
    error('SOCKET: No Express Session / REJECTED')
    socket.disconnect(true)
    return
  }
  if (!socket.request.session.rdp) {
    log('SOCKET: Not RDP Session / SKIP')
    return
  }

  var rdpClient = null

  socket.on('infos', function (infos) {
    if (rdpClient) {
      // clean older connection
      rdpClient.close()
    }
    if (socket.request.session.rdp === undefined) {
      error('No session in request')
      return
    }
    log('WebRDP Login: user=' + socket.request.session.username + ' from=' + socket.handshake.address + ' host=' + socket.request.session.rdp.host + ' port=' + socket.request.session.rdp.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + socket.request.session.rdp.allowreplay)
    socket.emit('title', 'rdp://' + socket.request.session.rdp.host)
    if (socket.request.session.rdp.header.background) socket.emit('headerBackground', socket.request.session.rdp.header.background)
    if (socket.request.session.rdp.header.name) socket.emit('header', socket.request.session.rdp.header.name)

    socket.emit('headerBackground', 'green')
    socket.emit('header', `Connecting to ${socket.request.session.rdp.host}...`)
    let conn = socket.request.session.rdp;
    rdpClient = rdp.createClient({
      domain: conn.domain || '',
      userName: conn.user || '',
      password: conn.password || '',
      enablePerf: true,
      autoLogin: true,
      screen: infos.screen,
      locale: infos.locale,
      logLevel: process.argv[2] || 'INFO'
    })
    if (conn.shell) {
      rdpClient.sec.infos.obj.alternateShell.value = new Buffer(conn.shell + '\x00', 'ucs2')
      if (conn.workdir) {
        rdpClient.sec.infos.obj.workingDir.value = new Buffer(conn.workdir + '\x00', 'ucs2')
      }
    }
    rdpClient.on('connect', () => {
      socket.emit('rdp-connect')
      socket.emit('headerBackground', 'green')
      socket.emit('header', `${socket.request.session.rdp.host} is online`)
    }).on('bitmap', function (bitmap) {
      socket.emit('rdp-bitmap', bitmap)
    }).on('close', function () {
      socket.emit('headerBackground', 'red')
      socket.emit('header', `${socket.request.session.rdp.host} is closed`)
      socket.emit('rdp-close')
    }).on('error', function (err) {
      socket.emit('rdp-error', err)
    }).connect(conn.host, conn.port || 3389)
  }).on('mouse', function (x, y, button, isPressed, canvas) {
    if (!rdpClient) return
    if (canvas !== undefined) {
      var newDate = new Date()
      var screenCapDate = parseInt((newDate.getMonth() + 1), 10) + '-' + newDate.getDate() + '-' + newDate.getFullYear() + '-' + newDate.getTime()
      base64Img.img(canvas, './screenshots', screenCapDate + '-' + socket.request.session.username, (err, filepath) => {
        log(err)
      })
    }
    rdpClient.sendPointerEvent(x, y, button, isPressed)
  }).on('wheel', function (x, y, step, isNegative, isHorizontal) {
    if (!rdpClient) {
      return
    }
    rdpClient.sendWheelEvent(x, y, step, isNegative, isHorizontal)
  }).on('scancode', function (code, isPressed) {
    if (!rdpClient) return
    rdpClient.sendKeyEventScancode(code, isPressed)
  }).on('unicode', function (code, isPressed) {
    if (!rdpClient) return

    rdpClient.sendKeyEventUnicode(code, isPressed)
  }).on('disconnect', function () {
    if (!rdpClient) return

    rdpClient.close()
  })
}
