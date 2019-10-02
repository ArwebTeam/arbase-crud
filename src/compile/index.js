'use strict'

function compileEndpoint ({prefix}, entry) {
  const name = (entry.ns ? entry.ns + '.' : '') + entry

  return `crud({
    server,
    name: ${JSON.stringify(name)}
    entry: {
      validator: ${entry.validator},
      lists: ${entry.attributes.filter(a => a.isList)}
    },
    prefix: ${JSON.stringify(prefix)},
    middleware: {}
  })`
}

function compile (data) {
  let insert = data.entries.map(entry =>
    compileEndpoint(entry)).join('\n')

  return `const crud = require('aragon-crud')
  const Joi = require('@hapi/joi')
  ${insert}`
}

module.exports = compile
