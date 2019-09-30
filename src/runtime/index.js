'use strict'

module.exports = ({prefix}, entries, a) => {
  prefix = prefix || ''

  entries.forEach(entry => {
    a.route({
      method: 'GET',
      path: `${prefix}/${entry.name}`,
      validate: {
        query: Joi.object({
          
        })
      }
      handler: {

      }
    })
  })
}
