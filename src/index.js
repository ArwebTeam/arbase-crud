'use strict'

const crud = require('./crud')

module.exports = (server, {entry, entries}, {prefix}) => {
  entries.forEach(entry => {
    crud({
      server,
      name: entry.fullName,
      entry,
      prefix,
      middleware: {},
      arweave: server.arweave
    })
  })
}
