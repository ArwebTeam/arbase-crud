'use strict'

const crud = require('./crud')
const Client = require('arbase/src/client')

module.exports = (server, {entry, entries}, {prefix}) => {
  const client = Client(server.arweave)

  entries.forEach(entry => {
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
