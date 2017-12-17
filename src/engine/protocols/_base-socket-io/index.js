const validator = require('validator')
const express = require('express')
const debug = require('debug')('npam')

const expressOptions = require('./expressOptions')

class BaseSocketIO {
  get key () {
    throw new Error('Должно быть определено')
  }

  get socket () {
    throw new Error('Должно быть определено')
  }

  get clientHtml () {
    throw new Error('Должно быть определено')
  }

  get staticRoot () {
    throw new Error('Должно быть определено')
  }

  get validator () {
    return validator
  }

  createSessionInfo (inParams, onDone) {
    throw new Error('Должно быть определено')
  }

  checkCredentials (inParams) {
    return true
  }

  get myUtil () {
    throw new Error('Должно быть определено')
  }

  prepare (inParams, onDone) {
    this.options = inParams.options
    this.config = this.options[this.key]
    this.app = inParams.app
    this.io = inParams.io
    this.app.use(`/${this.key}`, express.static(this.staticRoot, expressOptions))

    /* this.app.get(`/${this.key}/host/:host?`, (req, res, next) => {
      req.session.host = req.params.host
      res.sendFile(this.clientHtml)
      req.protocolDispaspatcher = this
      this.createSessionInfo({
        req: req
      }, (err) => {
        if (err) { debug(err) }
      })
    }) */

    this.app.get(`/${this.key}/conn/:conn?`, (req, res, next) => {

      res.sendFile(this.clientHtml)
      req.protocolDispaspatcher = this
      this.createSessionInfo({
        req: req
      }, (err) => {
        if (err) { debug(err) }
      })
    })
    this.io.on('connection', this.socket)
    return onDone()
  }
};

module.exports = BaseSocketIO
