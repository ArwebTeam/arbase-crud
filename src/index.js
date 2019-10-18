'use strict'

const crud = require('./crud')
const Client = require('../../arbase/src/client')

module.exports = (server, e, {prefix}) => {
  // TODO: add .post() function to entry TXs
  const client = Client(server.arweave, e)

  e.entries.forEach(entry => {
    crud({
      server,
      name: entry.fullName,
      arweave,
      entry,
      prefix,
      middleware: {},
      client
    })
  })
}
