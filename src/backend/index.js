var express = require('express')
var fs = require('fs')
var path = require('path')
const bodyParser = require('body-parser')

class Backend {
  constructor (inOptions) {
    this.app = express()
    this.app.use(bodyParser.json())
    this.options = inOptions
    this.loadPlugins(inOptions)
    this.start()
  }

  loadPlugins (inOptions) {
    const testFolder = path.join(__dirname, 'plugins')
    fs.readdirSync(testFolder).forEach(file => {
      var _plugin = require(path.join(testFolder, file))
      _plugin(inOptions, this)
    })
  }

  start () {
    let backendOpts = this.options.backend

    // this.app.use(express.static(path.join(__dirname, '../fronend')))

    this.app.listen(backendOpts.http.portnum)
  }
}

module.exports = Backend
