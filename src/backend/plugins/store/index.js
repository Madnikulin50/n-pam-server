const Tools = require('../../../tools')

module.exports = function (inOptions, inBackend) {
  let app = inBackend.app
  app.get('/api/settings/store/get', (req, res) => {
    res.json(inOptions.store)
  })

  app.post('/api/settings/store/set', (req, res) => {
    inOptions.store = req.body
    res.sendStatus(200)
  })

  app.get('/api/store/get-info', (req, res) => {
    res.json({})
  })

  app.get('/api/store/get-item', (req, res) => {
    res.sendStatus(404)
  })
}
