'use strict';
const initStore = require('./lib/gcloudStore');
module.exports = function init(thorin, opt) {
  const async = thorin.util.async;
  // Attach the Redis error parser to thorin.
  thorin.addErrorParser(require('./lib/errorParser'));

  const ThorinRedisStore = initStore(thorin, opt);

  return ThorinRedisStore;
};
module.exports.publicName = 'gcloud';