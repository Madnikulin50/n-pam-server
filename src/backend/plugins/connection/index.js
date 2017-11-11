const Tools = require('../../../tools')

module.exports = function (inOptions, inBackend) {
  let app = inBackend.app
  let connections = inOptions.connections
  if (connections.items === undefined) { connections.items = [] }
  connections.items.forEach((item) => {
    if (item.id === undefined) { item.id = Tools.generateId() }
  })

  app.get('/api/connection/get-all', (req, res) => {
    res.json(inOptions.connections.items)
  })

  app.get('/api/connection/get', (req, res) => {
    let connections = inOptions.connections
    var id = req.query.id
    var item = connections.items.find((item) => { return item.id === id })
    if (item === undefined) {
      return res.sendStatus(400, 'Connection not found')
    }
    res.json(item)
  })

  app.post('/api/connection/set', (req, res) => {
    let connections = inOptions.connections
    var id = req.query.id
    if (id === undefined) { id = Tools.generateId() }
    var itemIdx = connections.items.findIndex((item) => { return item.id === id })
    if (itemIdx === -1) {
      let item = Object.assign({}, req.body)
      item.id = id
      connections.items.push(item)
      return res.sendStatus(200)
    }
    connections.items.splice(itemIdx, 1, req.body)
    res.sendStatus(200)
  })

  app.get('/api/connection/remove', (req, res) => {
    let connections = inOptions.connections
    var id = req.query.id
    var itemIdx = connections.items.findIndex((item) => { return item.id === id })
    if (itemIdx === -1) { return res.sendStatus(400, 'item not found') }
    connections.items.splice(itemIdx, 1)
    res.sendStatus(200)
  })
}
