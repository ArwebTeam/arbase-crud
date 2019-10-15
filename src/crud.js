'use strict'

const Boom = require('@hapi/boom')
const Joi = require('@hapi/joi')

function generateConfig (entry, valPayload, valId, valPage) {
  const out = { validate: {} }

  if (valId) {
    // TODO: check if this works
    out.validate.params = Joi.object({
      id: Joi.string().required() // arweave tx-id
    })
  }

  if (valPayload) {
    out.validate.payload = entry.validator
  }

  if (valPage) {
    out.validate.query = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      perPage: Joi.number().integer().default(25).max(1024)
    })
  }

  return out
}

module.exports = ({server, entry, name, prefix, middleware, client}) => {
  // TODO: use joi
  if (!middleware) { middleware = {} }

  if (!prefix) { prefix = '' }

  const base = `${prefix}/${name}`

  async function m (type, stage, request, h, result) {
    let parsed = { op: stage, performer: request.auth } // TODO: rewrite to use arweave profile for performer

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
          await a[i](parsed, {request, h, entry})
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

  server.route({
    method: 'POST',
    path: base,
    // TODO:  payload validate
    config: generateConfig(entry, true, false, false),
    handler: async (request, h) => {
      await m('pre', 'create', request, h)

      try {
        const res = await client.write.entryCreate(entry, request.payload)
        return h.response(res).code(200)
      } catch (error) {
        // TODO: better errorss
        throw Boom.badImplementation(error.message)
      }
    }
  })

  // R is for Read

  entry.attributes.filter(a => a.isList).forEach(list => {
    server.route({
      method: 'GET',
      path: `${base}/{id}/${list.name}`,
      // TODO: where, payload validate, param validate, limit, id-based pagination
      config: generateConfig(entry, false, false, true),
      handler: async (request, h) => {
        await m('pre', 'read', request, h)

        // TODO: where filters
        const {page, perPage} = request.query

        try {
          // TODO: add include
          // TODO: where filter, limit, id-based pagination

          const { id } = request.params
          const offset = (page - 1) * perPage

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
            .code(200)
        } catch (error) {
          throw Boom.badImplementation(error.message)
        }
      }
    })
  })

  server.route({
    method: 'GET',
    path: `${base}/{id}`,
    // TODO: params validate
    config: generateConfig(entry, false, true, false),
    handler: async (request, h) => {
      await m('pre', 'read', request, h)

      try {
        const { id } = request.params
        const res = await client.read.entry(entry, id)
        await m('post', 'read', request, h, res)

        if (res) {
          return h.response(res.data).header('x-is-live', String(res.live)).code(200)
        } else {
          throw Boom.notFound(`${name} with ID ${id} does not exist!`)
        }
      } catch (error) {
        processError(error)
      }
    }
  })

  // U is for Update

  server.route({
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
          return h.response(updated).code(200)
        } else {
          throw Boom.notFound(`${name} with ID ${id} does not exist!`)
        }
      } catch (error) {
        throw Boom.badImplementation(error.message)
      }
    }
  })

  // D is for Delte

  server.route({
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
          return h.response({ok: true}).code(200)
        } else {
          return h.response({ok: true, soft404: true}).code(200)
        }
      } catch (error) {
        throw Boom.badImplementation(error.message)
      }
    }
  })
}

module.exports.generateConfig = generateConfig
