'use strict';

/*
* Checks if the given error contains any kind of sequelize information.
* If it does, we will mutate it so that the error ns is SQL
* */
function parseError(e) {
  if (e.ns === 'STORE.GCLOUD') return true;
  if (e.code && e.code.indexOf('GCLOUD') === 0) {
    e.ns = 'STORE.GCLOUD';
    return true;
  }
}

module.exports = parseError;