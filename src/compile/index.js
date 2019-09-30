'use strict'

module.exports.compileEndpoint = ({prefix}, entry) => {
  return `a.route({
    method: 'GET',
    path: '${prefix}/${entry.name}',
    validate: {
      query: Joi.object({
        page: Joi.number().integer().default(1),
        perPage: Joi.number().integer
      })
    }
    handler: () => {

    }
  })`
}
