
const debug = require('debug')
const log = debug('npam:log')
const error = debug('npam:error')
const SSH = require('ssh2').Client
var termCols, termRows

// public
module.exports = function socket (socket) {
  // if websocket connection arrives without an express session, kill it
  if (!socket.request.session) {
    socket.emit('401 UNAUTHORIZED')
    error('SOCKET: No Express Session / REJECTED')
    socket.disconnect(true)
    return
  }
  if (!socket.request.session.ssh) {
    log('SOCKET: Not SSH Session / SKIP')
    return
  }
  let conn = new SSH()
  let ssh = socket.request.session.ssh
  socket.on('geometry', function socketOnGeometry (cols, rows) {
    termCols = cols
    termRows = rows
  })
  conn.on('banner', function connOnBanner (data) {
    // need to convert to cr/lf for proper formatting
    data = data.replace(/\r?\n/g, '\r\n')
    socket.emit('data', data.toString('utf-8'))
  })

  conn.on('ready', function connOnReady () {
    log('WebSSH2 Login: user=' + ssh.user + ' from=' + socket.handshake.address + ' host=' + ssh.host + ' port=' + ssh.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + ssh.allowreplay + ' term=' + ssh.term)
    socket.emit('title', 'ssh://' + ssh.host)
    if (ssh.header.background) socket.emit('headerBackground', ssh.header.background)
    if (ssh.header.name) socket.emit('header', ssh.header.name)
    socket.emit('footer', 'ssh://' + ssh.user + '@' + ssh.host + ':' + ssh.port)
    socket.emit('status', 'SSH CONNECTION ESTABLISHED')
    socket.emit('statusBackground', 'green')
    socket.emit('allowreplay', ssh.allowreplay)
    conn.shell({
      term: ssh.term,
      cols: termCols,
      rows: termRows
    }, function connShell (err, stream) {
      if (err) {
        SSHerror('EXEC ERROR' + err)
        conn.end()
        return
      }
      // poc to log commands from client
      if (ssh.serverlog.client) var dataBuffer
      socket.on('data', function socketOnData (data) {
        stream.write(data)
        // poc to log commands from client
        if (ssh.serverlog.client) {
          if (data === '\r') {
            log('serverlog.client: ' + socket.request.session.id + '/' + socket.id + ' host: ' + ssh.host + ' command: ' + dataBuffer)
            dataBuffer = undefined
          } else {
            dataBuffer = (dataBuffer) ? dataBuffer + data : data
          }
        }
      })
      socket.on('control', function socketOnControl (controlData) {
        switch (controlData) {
          case 'replayCredentials':
            stream.write(ssh.password + '\n')
          /* falls through */
          default:
            log('controlData: ' + controlData)
        }
      })
      socket.on('disconnecting', function socketOnDisconnecting (reason) { log('SOCKET DISCONNECTING: ' + reason) })
      socket.on('disconnect', function socketOnDisconnect (reason) {
        log('SOCKET DISCONNECT: ' + reason)
        err = { message: reason }
        SSHerror('CLIENT SOCKET DISCONNECT', err)
        conn.end()
        // destroy()
      })
      socket.on('error', function socketOnError (err) {
        SSHerror('SOCKET ERROR', err)
        conn.end()
      })

      stream.on('data', function streamOnData (data) {
        if (data !== undefined)
          socket.emit('data', data.toString('utf-8'))
      })
      stream.on('close', function streamOnClose (code, signal) {
        err = { message: ((code || signal) ? (((code) ? 'CODE: ' + code : '') + ((code && signal) ? ' ' : '') + ((signal) ? 'SIGNAL: ' + signal : '')) : undefined) }
        SSHerror('STREAM CLOSE', err)
        conn.end()
      })
      stream.stderr.on('data', function streamStderrOnData (data) {
        log('STDERR: ' + data)
      })
    })
  })

  conn.on('end', function connOnEnd (err) { SSHerror('CONN END BY HOST', err) })
  conn.on('error', function connOnError (err) { SSHerror('CONN ERROR', err) })
  conn.on('keyboard-interactive', function connOnKeyboardInteractive (name, instructions, instructionsLang, prompts, finish) {
    log('conn.on(\'keyboard-interactive\')')
    finish([ssh.password])
  })
  if (ssh) {
    conn.connect({
      host: ssh.host,
      port: ssh.port || 22,
      username: ssh.user,
      password: ssh.password,
      tryKeyboard: true,
      algorithms: ssh.algorithms,
      readyTimeout: ssh.readyTimeout,
      debug: debug('ssh2')
    })
  } else {
    log('Attempt to connect without session.username/password or session varialbles defined, potentially previously abandoned client session. disconnecting websocket client.\r\nHandshake information: \r\n  ' + JSON.stringify(socket.handshake))
    socket.emit('ssherror', 'WEBSOCKET ERROR - Refresh the browser and try again')
    socket.request.session.destroy()
    socket.disconnect(true)
  }

  /**
  * Error handling for various events. Outputs error to client, logs to
  * server, destroys session and disconnects socket.
  * @param {string} myFunc Function calling this function
  * @param {object} err    error object or error message
  */
  function SSHerror (myFunc, err) {
    let theError
    if (socket.request.session) {
      // we just want the first error of the session to pass to the client
      let error = ((err) ? err.message : undefined)
      theError = (error) ? ': ' + error : ''
      // log unsuccessful login attempt
      if (err && (err.level === 'client-authentication')) {
        log('WebSSH2 ' + 'error: Authentication failure'.red.bold +
          ' user=' + ssh.user.yellow.bold.underline +
          ' from=' + socket.handshake.address.yellow.bold.underline)
      } else {
        log('WebSSH2 Logout: user=' + ssh.user + ' from=' + socket.handshake.address + ' host=' + ssh.host + ' port=' + ssh.port + ' sessionID=' + socket.request.sessionID + '/' + socket.id + ' allowreplay=' + ssh.allowreplay + ' term=' + ssh.term)
      }
      socket.emit('ssherror', 'SSH ' + myFunc + theError)
      socket.request.session.destroy()
      socket.disconnect(true)
    } else {
      theError = (err) ? ': ' + err.message : ''
      socket.disconnect(true)
    }
    log('SSHerror ' + myFunc + theError)
  }
}
