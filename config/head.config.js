const { nuxtMetaTags } = require('./meta.config')

const meta = [
  { charset: 'utf-8' },
  { name: 'viewport', content: 'width=device-width, initial-scale=1' }
]

if (process.env.META_TAGS_ENABLED === 'true') {
  meta.push(...nuxtMetaTags)
}

if (process.env.APP_GOOGLE_SITE_VERIFICATION_KEY) {
  meta.push({
    name: 'google-site-verification',
    content: process.env.APP_GOOGLE_SITE_VERIFICATION_KEY
  })
}

const scripts = []

module.exports = {
  titleTemplate: process.env.APP_NAME,
  meta,
  htmlAttrs: {
    class: 'bg-gray-1000'
  },
  bodyAttrs: {
    class: 'overflow-fix'
  },
  script: scripts,
  link: [
    { rel: 'icon', type: 'image/png', href: '/helix-favicon.png?v=1' },
    { rel: 'shortcut-icon', type: 'image/png', href: '/helix-favicon.png?v=1' },
    {
      rel: 'apple-touch-icon',
      type: 'image/png',
      href: '/helix-favicon.png?v=1'
    }
  ]
}
