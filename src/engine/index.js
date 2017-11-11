const path = require('path')
const fs = require('fs')
const async = require('async')

class Engine {
  init (inParams, onDone) {
    this.protocols = {}
    const testFolder = path.join(__dirname, 'protocols')
    fs.readdir(testFolder, (err, files) => {
      if (err) { return onDone(err) }
      return async.eachSeries(files, (file, fileDone) => {
        if (file[0] === '_' ||
        file[0] === '.') { return fileDone() }
        const protocol = require(path.join(testFolder, file))
        this.protocols[file] = protocol
        return protocol.prepare(inParams, fileDone)
      }, onDone)
    })
  }
};

module.exports = Engine
