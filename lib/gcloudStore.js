'use strict';
/**
 * The Google CloudStore Thorin.js wrapper
 * */
module.exports = function (thorin, opt) {

  const config = Symbol(),
    logger = Symbol();

  class ThorinGcloudStore extends thorin.Interface.Store {
    static publicName() {
      return "gcloud";
    }

    constructor() {
      super();
      this.type = 'gcloud';
      this[config] = {};
      this[logger] = null;
    }

    init(storeConfig) {
      this[config] = thorin.util.extend({}, storeConfig);
    }


    get logger() {
      if (!this[logger]) return thorin.logger('store.' + this.type);
      return this[logger];
    }

    setup(done) {
      // TODO
      done();
    }

    run(done) {
      // TODO
      done();
    }

  }

}