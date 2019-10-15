'use strict'

const crud = require('./crud')
const Client = require('arbase/src/client')

module.exports = (server, e, {prefix}) => {
  const client = Client(server.arweave, e)

  e.entries.forEach(entry => {
    crud({
      server,
      name: entry.fullName,
      entry,
      prefix,
      middleware: {},
      client
    })
  })
}
