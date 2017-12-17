const net = require('net')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter
const PackStream = require('./unpackstream')
const async = require('async')
const debug = require('debug')
const log = debug('npam:log')
const error = debug('npam:error')

// constants
var rfb = require('./constants')
for (var key in rfb) {
  module.exports[key] = rfb[key]
}

var decodeHandlers = {
}

class RfbClient extends EventEmitter {
  constructor (stream, params) {
    super()
    this.params = params
    this.stream = stream
    this.autoUpdate = true
    this.pack_stream = new PackStream()
    this.pack_stream.on('data', (data) => {
      this.stream.write(data)
    })
    stream.on('data', (data) => {
      this.pack_stream.write(data)
    })

    stream.on('error', (err) => {
      error('error' + err)
    })
    stream.on('timeout', () => {
      error('timeout')
    })

    stream.on('close', () => {
      log('close')
      this.emit('close')
    })

    // TODO: check if I need that at all
    this.pack_stream.serverBigEndian = !true
    this.pack_stream.clientBigEndian = !true
    this.readServerVersion()
  }

  end () {
    this.stream.end()
  }

  readError () {
    var cli = this
    this.pack_stream.readString(function (str) {
      cli.emit('error', str)
    })
  }

  readServerVersion () {
    var stream = this.pack_stream
    var cli = this
    stream.get(12, function (rfbver) {
      cli.serverVersion = rfbver.toString('ascii')
      stream.pack('a', [ rfb.versionstring.V3_008 ]).flush()
      /* Apple VNC
      if (cli.serverVersion === rfb.versionstring.V3_003) {
        stream.unpack('L', function (secType) {
          var type = secType[0]
          console.error('3.003 security type: ' + type)
          if (type === 0) {
            cli.readError()
          } else {
            cli.securityType = type
            // 3.003 version does not send result for None security
            if (type === rfb.security.None) { cli.clientInit() } else { cli.processSecurity() }
          }
        })
        return
      } */

      // read security types
      stream.unpack('C', function (res) {
        var numSecTypes = res[0]
        if (numSecTypes === 0) {
          console.error(['zero num sec types', res])
          cli.readError()
        } else {
          stream.get(numSecTypes, function (secTypes) {
            var securitySupported = []
            var s
            for (s = 0; s < secTypes.length; ++s) { securitySupported[secTypes[s]] = true }
            for (s = 0; s < cli.params.security.length; ++s) {
              let clientSecurity = cli.params.security[s]
              if (securitySupported[clientSecurity]) {
                cli.securityType = clientSecurity
                stream.pack('C', [cli.securityType]).flush()
                return cli.processSecurity()
              }
            }
            throw new Error('Server does not support any security provided by client')
          })
        }
      })
    })
  }

  readSecurityResult () {
    var stream = this.pack_stream
    var cli = this
    stream.unpack('L', function (securityResult) {
      if (securityResult[0] === 0) {
        cli.clientInit()
      } else {
        stream.readString(function (message) {
          cli.emit('error', message)
        })
      }
    })
  }

  sendVncChallengeResponse (challenge, password) {
    var stream = this.pack_stream
    var response = require('./d3des').response(challenge, password)
    stream.pack('a', [response]).flush()
    this.readSecurityResult()
  }

  processSecurity () {
    var stream = this.pack_stream
    var cli = this
    // TODO: refactor and move security to external file
    switch (cli.securityType) {
      case rfb.security.None:
      // do nothing
        cli.readSecurityResult()
        break
      case rfb.security.VNC:
        stream.get(16, (challenge) => {
          if (cli.params.password) { this.sendVncChallengeResponse(challenge, cli.params.password) } else if (cli.params.credentialsCallback) {
            cli.params.credentialsCallback.call(cli, function (password) {
              this.sendVncChallengeResponse(challenge, password)
            })
          } else {
            throw new Error('Server requires VNC security but no password given')
          }
        })
        break
      default:
        throw new Error('unknown security type: ' + cli.securityType)
    }
  }

  clientInit () {
    var stream = this.pack_stream
    var cli = this

    var initMessage = cli.disconnectOthers ? rfb.connectionFlag.Exclusive : rfb.connectionFlag.Shared
    stream.pack('C', [ initMessage ]).flush()

    stream.unpackTo(
      cli,
      [
        'S width',
        'S height',
        'C bpp', // 16-bytes pixel format
        'C depth',
        'C isBigEndian',
        'C isTrueColor',
        'S redMax',
        'S greenMax',
        'S blueMax',
        'C redShift',
        'C greenShift',
        'C blueShift',
        'xxx',
        'L titleLength'
      ],

      function () {
      // TODO: remove next 3 lines
        stream.serverBigEndian = false // cli.isBigEndian;
        stream.clientBigEndian = false // cli.isBigEndian;
        // stream.bigEndian = false; //cli.isBigEndian;

        stream.get(cli.titleLength, function (titleBuf) {
          cli.title = titleBuf.toString()
          delete cli.titleLength
          cli.setPixelFormat()
        })
      }

    )
  }

  setPixelFormat () {
    var stream = this.pack_stream
    var cli = this
    stream.pack('CxxxCCCCSSSCCCxxx',
      [0, cli.bpp, cli.depth, cli.isBigEndian, cli.isTrueColor, cli.redMax, cli.greenMax, cli.blueMax,
        cli.redShift, cli.greenShift, cli.blueShift]
    )
    stream.flush()
    cli.setEncodings()
  }
  repeat (str, num) {
    var res = ''
    for (var i = 0; i < num; ++i) { res += str }
    return res
  }

  setEncodings () {
    var stream = this.pack_stream
    var encodings = this.params.encodings || [rfb.encodings.raw, rfb.encodings.copyRect, rfb.encodings.pseudoDesktopSize]

    stream.pack('CxS', [rfb.clientMsgTypes.setEncodings, encodings.length])
    stream.pack(this.repeat('l', encodings.length), encodings)
    stream.flush()

    this.emit('connect')

    if (this.width > 2000) {
      const stepLength = 256
      let steps = []

      for (let x = 0; x < this.width; x += stepLength) {
        for (let y = 0; y < this.height; y += stepLength) {
          steps.push({x: x, y: y})
          // break
        }
        // break
      }
      async.eachSeries(steps, (step, stepDone) => {
        this.requestUpdate(false, step.x, step.y, Math.min(stepLength, this.width - step.x), Math.min(stepLength, this.width - step.y))
        this.expectNewMessage((err) => {
          stepDone(err)
        })
      },
      (err) => {
        if (err) { error(err) }
        this.requestUpdate(true, 0, 0, this.width, this.height)
        this.expectNewMessage()
      })
    } else {
      this.requestUpdate(true, 0, 0, this.width, this.height)
      this.expectNewMessage()
    }
  }

  expectNewMessage (onDone) {
    var stream = this.pack_stream
    var cli = this
    stream.get(1, function (buff) {
      switch (buff[0]) {
        case rfb.serverMsgTypes.fbUpdate:
          cli.readFbUpdate(onDone)
          break
        case rfb.serverMsgTypes.setColorMap:
          cli.readColorMap(onDone)
          break
        case rfb.serverMsgTypes.bell: cli.readBell(onDone); break
        case rfb.serverMsgTypes.cutText: cli.readClipboardUpdate(onDone); break
        default:
          error('unsopported server message: ' + buff[0])
          if (onDone) { return onDone() }
      }
    })
  }

  unpackRect (numRectsLeft, onDone) {
    if (numRectsLeft === 0) {
      if (onDone === undefined) this.expectNewMessage()
      if (this.autoUpdate &&
        onDone === undefined) this.requestUpdate(true, 0, 0, this.width, this.height)
      return onDone ? onDone() : null
    }
    numRectsLeft--

    var rect = {}
    this.pack_stream.unpackTo(rect,
      ['S x', 'S y', 'S width', 'S height', 'l encoding'],
      () => {
      // TODO: rewrite using decodeHandlers
        switch (rect.encoding) {
          case rfb.encodings.raw:
            this.readRawRect(rect, this.unpackRect.bind(this, numRectsLeft, onDone))
            break
          case rfb.encodings.copyRect:
            this.readCopyRect(rect, this.unpackRect.bind(this, numRectsLeft, onDone))
            break
          case rfb.encodings.pseudoDesktopSize:
            this.width = rect.width
            this.height = rect.height
            this.emit('resize', rect)
            this.unpackRect(numRectsLeft, onDone)
            break
          case rfb.encodings.hextile:
            this.readHextile(rect, this.unpackRect.bind(this, numRectsLeft, onDone))
            break
          case rfb.encodings.pseudoCursor:
            this.readCursor(rect, this.unpackRect.bind(this, numRectsLeft, onDone))
            break
          default:
            error('unknown encoding!!! ' + rect.encoding)
        }
      }
    )
  }

  readFbUpdate (onDone) {
    this.pack_stream.unpack('xS', (res) => {
      var numRects = res[0]
      this.unpackRect(numRects, onDone)
    })
  }

  readHextile (rect, cb) {
    rect.emitter = new EventEmitter()
    rect.on = function (eventname, cb) {
      rect.emitter.on(eventname, cb)
    }
    rect.emit = function (eventname, param) {
      rect.emitter.emit(eventname, param)
    }

    rect.widthTiles = (rect.width >>> 4)
    rect.heightTiles = (rect.height >>> 4)
    rect.rightRectWidth = rect.width & 0x0f
    rect.bottomRectHeight = rect.height & 0x0f
    rect.tilex = 0
    rect.tiley = 0
    rect.tiles = []
    this.emit('rect', rect)
    this.readHextileTile(rect, cb)
  }

  readHextileTile (rect, cb) {
    var tile = {}
    var stream = this.pack_stream
    var cli = this

    tile.x = rect.tilex
    tile.y = rect.tiley
    tile.width = 16
    if (tile.x === rect.widthTiles && rect.rightRectWidth > 0) { tile.width = rect.rightRectWidt }
    tile.height = 16
    if (tile.y === rect.heightTiles && rect.bottomRectHeight > 0) { tile.height = rect.bottomRectHeight }

    // calculate next tilex & tiley and move up 'stack' if we at the last tile
    function nextTile () {
      rect.emit('tile', tile)
      tile = {}
      if (rect.tilex < rect.widthTiles) {
        rect.tilex++
        return cli.readHextileTile(rect, cb)
      } else {
        rect.tilex = 0
        if (rect.tiley < rect.heightTiles) {
          rect.tiley++
          return cli.readHextileTile(rect, cb)
        } else {
          return cb()
        }
      }
    }

    var bytesPerPixel = cli.bpp >> 3
    var tilebuflen = bytesPerPixel * tile.width * tile.height
    stream.unpack('C', function (subEnc) {
      tile.subEncoding = subEnc[0]
      var hextile = rfb.subEncodings.hextile
      if (tile.subEncoding & hextile.raw) {
        stream.get(tilebuflen, function (rawbuff) {
          tile.buffer = rawbuff
          nextTile()
        })
        return
      }
      tile.buffer = Buffer.alloc(tilebuflen)

      function solidBackground () {
      // the whole tile is just single colored width x height
        for (var i = 0; i < tilebuflen; i += bytesPerPixel) { tile.backgroundColor.copy(tile.buffer, i) }
      }

      function readBackground () {
        if (tile.subEncoding & hextile.backgroundSpecified) {
          stream.get(bytesPerPixel, function (pixelValue) {
            tile.backgroundColor = pixelValue
            rect.backgroundColor = pixelValue
            readForeground()
          })
        } else {
          tile.backgroundColor = rect.backgroundColor
          readForeground()
        }
      }

      function readForeground () {
      // we should have background color set here
        solidBackground()
        if (rect.subEncoding & hextile.foregroundSpecified) {
          stream.get(bytesPerPixel, function (pixelValue) {
            tile.foregroundColor = pixelValue
            rect.foregroundColor = pixelValue
            readSubrects()
          })
        } else {
          tile.foregroundColor = rect.foregroundColor
          readSubrects()
        }
      }

      function readSubrects () {
        if (tile.subEncoding & hextile.anySubrects) {
        // read number of subrectangles
          stream.get('C', function (subrectsNum) {
            tile.subrectsNum = subrectsNum[0]
            readSubrect()
          })
        } else {
          nextTile()
        }
      }

      function drawRect (x, y, w, h) {
        log(['drawRect', x, y, w, h, tile.foregroundColor])
        // TODO: optimise
        for (var px = x; px < x + w; ++px) {
          for (var py = x; py < y + h; ++py) {
            var offset = bytesPerPixel * (tile.width * py + px)
            tile.foregroundColor.copy(tile.buffer, offset)
          }
        }
      }

      function readSubrect () {
        if (tile.subEncoding & hextile.subrectsColored) {
        // we have color + rect data
          stream.get(bytesPerPixel, function (pixelValue) {
            tile.foregroundColor = pixelValue
            rect.foregroundColor = pixelValue
            readSubrectRect()
          })
        } else {
          // we have just rect data
          readSubrectRect()
        }
      }

      function readSubrectRect () {
      // read subrect x y w h encoded in two bytes
        stream.get(2, function (subrectRaw) {
          var x = (subrectRaw[0] & 0xf0) >> 4
          var y = (subrectRaw[0] & 0x0f)
          var width = (subrectRaw[1] & 0xf0) >> 4 + 1
          var height = (subrectRaw[1] & 0x0f) + 1
          drawRect(x, y, width, height)
          tile.subrectsNum--

          if (tile.subrectsNum === 0) {
            nextTile()
          } else { readSubrect() }
        })
      }

      readBackground()
    })
  }

  readCopyRect (rect, cb) {
    var stream = this.pack_stream
    var cli = this

    stream.unpack('SS', function (src) {
      rect.src = { x: src[0], y: src[1] }
      cli.emit('rect', rect)
      cb(rect)
    })
  }

  readCursor (rect, cb) {
    var stream = this.pack_stream
    var cli = this

    var bytesPerPixel = cli.bpp >> 3
    stream.get(bytesPerPixel * rect.width * rect.height, function (rawbuff) {
      rect.buffer = rect.data = rawbuff
      var w = (rect.width + 7) >> 3
      stream.get(w * rect.height, function (mask) {
        rect.mask = mask
        cli.emit('rect', rect)
        cb(rect)
      })
    })
  }

  readRawRect (rect, cb) {
    var stream = this.pack_stream

    var bytesPerPixel = this.bpp >> 3
    stream.get(bytesPerPixel * rect.width * rect.height, (rawbuff) => {
      rect.buffer = rect.data = rawbuff
      rect.bitsPerPixel = this.bpp
      this.emit('rect', rect)
      cb(rect)
    })
  }

  readColorMap () {
  }

  readBell () {
    this.emit('bell')
    this.expectNewMessage()
  }

  readClipboardUpdate () {
    var stream = this.pack_stream
    var cli = this

    stream.unpack('xxxL', function (res) {
      stream.get(res[0], function (buf) {
        cli.emit('clipboard', buf.toString('ascii'))
        cli.expectNewMessage()
      })
    })
  }

  pointerEvent (x, y, buttons) {
    var stream = this.pack_stream

    stream.pack('CCSS', [rfb.clientMsgTypes.pointerEvent, buttons, x, y])
    stream.flush()
    // this.expectNewMessage()
  }

  keyEvent (keysym, isDown) {
    var stream = this.pack_stream
    log(`Send keyEvent ${keysym}, ${isDown}`)
    stream.pack('CCxxL', [rfb.clientMsgTypes.keyEvent, isDown, keysym])
    stream.flush()
  }

  requestUpdate (incremental, x, y, width, height) {
    log(`Send requestUpdate ${x}, ${y}, ${width}, ${height}`)
    var stream = this.pack_stream
    stream.pack('CCSSSS', [rfb.clientMsgTypes.fbUpdate, incremental, x, y, width, height])
    stream.flush()
  }

  updateClipboard (text) {
    var stream = this.pack_stream
    stream.pack('CxxxLa', [rfb.clientMsgTypes.cutText, text.length, text])
    stream.flush()
  }
  createRfbStream (name) {
    var stream = new EventEmitter()
    var fileStream = fs.createReadStream(name)
    var pack = new PackStream()
    fileStream.pipe(pack)
    var start = Date.now()
    function readData () {
      fileStream.resume()
      pack.unpack('L', function (size) {
        pack.get(size[0], function (databuf) {
          pack.unpack('L', function (timestamp) {
            var padding = 3 - ((size - 1) & 0x03)
            pack.get(padding, function () {
              if (!stream.ending) {
                stream.emit('data', databuf)
                var now = Date.now() - start
                var timediff = timestamp[0] - now
                stream.timeout = setTimeout(readData, timediff)
                fileStream.pause()
              }
            })
          })
        })
      })
    }

    pack.get(12, function (fileVersion) {
      readData()
    })

    stream.end = function () {
      stream.ending = true
      if (stream.timeout) { clearTimeout(stream.timeout) }
    }

    stream.write = function (buf) {
      // ignore
    }
    return stream
  }
  static createConnection (params) {
    // first matched to list of supported by server will be used
    if (!params.security) { params.security = [rfb.security.VNC, rfb.security.None] }

    var stream
    if (!params.stream) {
      if (params.in) { stream = this.createRfbStream(params.rfbfile) } else {
        if (!params.host) { params.host = '127.0.0.1' }
        if (!params.port) { params.port = 5900 }
        stream = net.createConnection(params.port, params.host)
      }
    } else {
      stream = params.stream
    }

    // todo: move outside rfbclient
    if (params.out) {
      var start = Date.now()
      var wstream = fs.createWriteStream(params.out)
      wstream.write('FBS 001.001\n')
      stream.on('data', function (data) {
        var sizeBuf = Buffer.alloc(4)
        var timeBuf = Buffer.alloc(4)
        var size = data.length
        sizeBuf.writeInt32BE(size, 0)
        wstream.write(sizeBuf)
        wstream.write(data)
        timeBuf.writeInt32BE(Date.now() - start, 0)
        wstream.write(timeBuf)
        var padding = 3 - ((size - 1) & 0x03)
        var pbuf = Buffer.alloc(padding)
        wstream.write(pbuf)
      }).on('end', function () {
        wstream.end()
      })
    }

    var client = new RfbClient(stream, params)
    stream.on('error', function (err) {
      client.emit('error', err)
    })
    return client
  }
}

exports.createConnection = RfbClient.createConnection
