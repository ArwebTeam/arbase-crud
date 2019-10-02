'use strict'

function compileEndpoint ({prefix}, entry, helper) {
  if (!entry) return ''

  const name = (entry.ns ? entry.ns + '.' : '') + entry.name

  return `crud({
    server,
    name: ${JSON.stringify(name)}
    entry: ${helper.stringifyEntry(entry)},
    prefix: ${JSON.stringify(prefix)},
    middleware: {}
  })`
}

function compile (data, helper) {
  let insert = data.entries.map(entry =>
    compileEndpoint({}, entry, helper)).join('\n')

  return `const crud = require('aragon-crud')
  const Joi = require('@hapi/joi')
  ${insert}`
}

module.exports = compile
