const mustache = require('mustache')
const fs = require('fs')
const path = require('path')

class Menu {
  init (inParams, onDone) {
    this.options = inParams.options
    inParams.app.get('/', (req, res, next) => {
      fs.readFile(path.join(__dirname, 'menu.mustache'), 'utf8', (err, data) => {
        if (err) { return res.sendStatus(500) }
        let params = {
          user: req.session.username
        }
        params.connections = this.options.connections.map(connection => {
          return Object.assign({}, connection, {
            url: `./${connection.type}/conn/${connection.name}`
          })
        })

        data = mustache.render(data, params)
        res.set('Content-Type', 'text/html')
        res.send(Buffer.alloc(data.length, data))
      })
    })
    return onDone()
  }
}

module.exports = Menu
