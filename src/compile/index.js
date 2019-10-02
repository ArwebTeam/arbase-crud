'use strict'

const fs = require('fs')
const path = require('path')

const template = String(fs.readFileSync(path.join(__dirname, 'template.js')))

function compileEndpoint ({prefix}, entry, helper) {
  if (!entry) return ''

  const name = (entry.ns ? entry.ns + '.' : '') + entry.name

  return `crud({
    server,
    name: ${JSON.stringify(name)},
    entry: ${helper.stringifyEntry(entry)},
    prefix: ${JSON.stringify(prefix)},
    middleware: {},
    arweave
  })`
}

function compile (data, helper) {
  let insert = data.entries.map(entry =>
    compileEndpoint({}, entry, helper)).join('\n')

  return template.replace('/* INSERT */', insert)
}

module.exports = compile
