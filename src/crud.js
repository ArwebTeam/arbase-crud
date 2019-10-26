'use strict'

const Boom = require('@hapi/boom')
const Joi = require('@hapi/joi')
const { and, or, equals } = require('arql-ops')

function generateConfig (entry, valPayload, valId, valPage) {
  const out = { validate: {} }

  if (valId) {
    // TODO: check if this works
    out.validate.params = Joi.object({
      id: Joi.string().required() // arweave tx-id
    })
  }

  if (valPayload) {
    out.validate.payload = Joi.object({
      item: entry.validator.required(),
      tags: Joi.object()
    })
  }

  if (valPage) {
    out.validate.query = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      perPage: Joi.number().integer().default(25).max(1024)
    }).unknown(true) // TODO: include tags from model
  }

  return out
}

module.exports = ({ server, entry, name, prefix, middleware, client, arweave }) => {
  // TODO: use joi
  if (!middleware) { middleware = {} }

  if (!prefix) { prefix = '' }

  const base = `${prefix}/${name}`

  async function m (type, stage, request, h, result) {
    const parsed = { op: stage, performer: request.auth } // TODO: rewrite to use arweave profile for performer

    switch (type) {
      case 'pre': {
        parsed.target = request.params.id || 'any'
        parsed.data = request.payload
        break
      }
      case 'post': {
        parsed.target = request.params.id || 'any'
        parsed.data = request.payload

        // TODO: h.takeover() support

        parsed.result = result
        break
      }
      default: {
        throw new TypeError(type)
      }
    }

    await Promise.all([`${type}:${stage}`, type].map(async (name) => {
      if (middleware[name]) {
        const a = Array.isArray(middleware[name]) ? middleware[name] : [middleware[name]]
        for (let i = 0; i < a.length; i++) {
          await a[i](parsed, { request, h, entry })
        }
      }
    }))
  }

  function processError (error) {
    console.error(error)

    if (error.isBoom) {
      throw error
    } else {
      throw Boom.badImplementation(error.message)
    }
  }

  // C is for Create

  server.router.route({
    method: 'POST',
    path: base,
    // TODO:  payload validate
    config: generateConfig(entry, true, false, false),
    handler: async (request, h) => {
      await m('pre', 'create', request, h)

      try {
        const tx = await client.write.entryCreate(entry, request.payload.tags, request.payload.item)
        await tx.post()
        return h.response(tx.rid).code(200)
      } catch (error) {
        throw processError(error)
      }
    }
  })

  // R is for Read

  const tags = ['board', 'p'] // TODO: do this via arbase.js config

  server.router.route({
    method: 'GET',
    path: `${base}`,
    // TODO: where, payload validate, param validate, limit, id-based pagination
    config: generateConfig(entry, false, false, true),
    handler: async (request, h) => {
      await m('pre', 'read', request, h)

      // TODO: where filters
      // const {page, perPage} = request.query

      try {
        // TODO: add include
        // TODO: where filter, limit, id-based pagination

        // TODO: read tags from model

        const qParams = tags.filter(t => request.query[t]).map(t => equals(t, request.query[t]))

        if (!qParams.length) {
          throw Boom.badRequest('Needs at least one tag to query by (example: p)')
        }

        // const { data, live } = await client.read.query(`SELECT ${entry.fullName} WHERE 'equals(board, $1)'`, { params: [request.query.board], arqlLang: 'fnc' })
        const { data, live } = await client.read.query({
          type: entry, // only need ns, name but full object also works (TODO: refactor this to read directly from typeObj)
          typeObj: entry,
          arql: and(...qParams)
        })

        return h.response(Object.keys(data).reduce((a, b) => {
          a.push(data[b])
          return a
        }, []))
          .header('x-is-live', live)

        // TODO: rework with pagination and sanity

        /* const { id } = request.params
          const offset = (page - 1) * perPage

          client.read.query(`SELECT SINGLE ${entry.fullName} WHERE equals(id, $1)`, {params: [id], lang: 'fnc'})
          const {data: items, total: count} = await client.read.list(entry, list, id, { offset, limit: perPage })

          const res = {
            // TODO: get entry element for actual element via listEntry
            rows: await Promise.all(items.map(item => client.read.list(entry, item))),
            count
          }

          await m('post', 'read', request, h, res)

          return h.response(res.rows)
            .header('X-Total-Count', res.count)
            .header('X-Current-Page', page)
            .header('X-Per-Page', perPage)
            .header('X-Has-Next', JSON.stringify(offset < res.count))
            .header('X-Has-Prev', JSON.stringify(Boolean(offset)))
            .code(200) */
      } catch (error) {
        throw processError(error)
      }
    }
  })

  server.router.route({
    method: 'GET',
    path: `${base}/{id}`,
    // TODO: params validate
    config: generateConfig(entry, false, true, false),
    handler: async (request, h) => {
      await m('pre', 'read', request, h)

      try {
        const { id } = request.params
        const res = await client.read.query(`SELECT SINGLE ${entry.fullName} WHERE 'equals(i, $1)'`, { params: [id], arqlLang: 'fnc' })
        await m('post', 'read', request, h, res)

        if (res) {
          return h.response(res.data[id]).header('x-is-live', String(res.live)).code(200)
        } else {
          throw Boom.notFound(`${name} with ID ${id} does not exist!`)
        }
      } catch (error) {
        processError(error)
      }
    }
  })

  // U is for Update

  server.router.route({
    method: 'POST',
    path: `${base}/{id}`,
    // TODO:  payload validate, params validate
    config: generateConfig(entry, true, true, false),
    handler: async (request, h) => {
      await m('pre', 'update', request, h)

      try {
        const { id } = request.params
        const updated = await client.write.entryUpdate(entry, id)

        await m('post', 'update', request, h, updated)

        if (updated) {
          return h.response(await updated.post()).code(200)
        } else {
          throw Boom.notFound(`${name} with ID ${id} does not exist!`)
        }
      } catch (error) {
        throw Boom.badImplementation(error.message)
      }
    }
  })

  // D is for Delte

  server.router.route({
    method: 'DELETE',
    path: `${base}/{id}`,
    config: generateConfig(entry, false, true, false),
    handler: async (request, h) => {
      await m('pre', 'delete', request, h)

      try {
        const { id } = request.params
        const deleted = await client.write.entryDelete(entry, id)

        await m('post', 'delete', request, h, deleted)

        if (deleted) {
          // TODO: shim sign?
          return h.response(await deleted.post()).code(200)
        } else {
          return h.response({ ok: true, soft404: true }).code(200)
        }
      } catch (error) {
        throw Boom.badImplementation(error.message)
      }
    }
  })
}

module.exports.generateConfig = generateConfig
