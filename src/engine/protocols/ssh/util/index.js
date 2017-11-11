// util/index.js

// private
require('colors') // allow for color property extensions in log messages
var debug = require('debug')('npam')
var Auth = require('basic-auth')
exports.basicAuth = function basicAuth (req, res, next) {
  var myAuth = Auth(req)
  if (myAuth &&
    req.protocolDispatcher.checkCredentials({user: myAuth.name, password: myAuth.password})) {
    let config = req.protocolDispatcher.config
    req.session.username = config.ssh.user
    req.session.userpassword = config.ssh.password
    debug('myAuth.name: ' + myAuth.name.yellow.bold.underline +
      ' and password ' + ((myAuth.pass) ? 'exists'.yellow.bold.underline
        : 'is blank'.underline.red.bold))
    next()
  } else {
    res.statusCode = 401
    debug('basicAuth credential request (401)')
    res.setHeader('WWW-Authenticate', 'Basic realm="WebSSH"')
    res.end('Username and password required for web SSH service.')
  }
}
