'use strict';
const Datastore = require('@google-cloud/datastore');
module.exports = (thorin, opt) => {

  const store = Symbol(),
    ID_SIZE = opt.idSize;

  class StoreModel {

    constructor(code) {
      this.code = code;
      this.parent = null; // This will be TODO
      this.fields = {};
      this.options = {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      };
      this[store] = null;
    }

    /**
     * QUERYING Funcitonality
     * let qry = {
     *  where: {
     *    field1: 'value1',
     *    field2: {
     *      $gte: 1,
     *      $lte: 2,
     *      $gt: 4,
     *      $lt: 5
     *    }
     *  },
     *  order: [['field1','ASC'], ['field2','DESC']],
     *  limit: 50,
     *  offset: 30,
     *  raw: true, // if set, find raw
     *  group: ['field3'],
     *  attributes: ['field5']
     * }
     * */
    async findAll(qry, opt) {
      if (!this[store]) throw thorin.error('STORE.GCLOUD', 'Model is not ready for querying');
      if (!qry) qry = {};
      let req = this[store].createQuery(this);
      this.buildQuery(qry, req);
      let res = await this[store].query(req, opt);
      if(qry.raw === true) {
        return res;
      }
      let items = res[0],
        data = res[1] || {};
      if (data.moreResults !== 'NO_MORE_RESULTS' && data.endCursor) {
        qry.cursor = data.endCursor;
      }
      for (let i = 0, len = items.length; i < len; i++) {
        if (items[i][Datastore.KEY]) {
          items[i].id = items[i][Datastore.KEY].id;
        }
      }
      return items;
    }

    /**
     * Lookup entities
     * */
    async findOne(qry, opt) {
      if (!this[store]) throw thorin.error('STORE.GCLOUD', 'Model is not ready for querying');
      if (!qry) qry = {};
      qry.limit = 1;
      if (typeof qry.offset !== 'undefined') delete qry.offset;
      let req = this[store].createQuery(this);
      this.buildQuery(qry, req);
      let res = await this[store].query(req, opt);
      let items = res[0];
      if (items.length === 0) return null;
      if (items[0][Datastore.KEY]) {
        items[0].id = items[0][Datastore.KEY].id;
      }
      return items[0];
    }

    /**
     * Saves the given built-object to gcloud
     * */
    async create(obj) {
      let entity = this.build(obj);
      await this[store].create(entity);
      obj[Datastore.KEY] = entity.key;
      obj.id = entity.key.id;
      return obj;
    }

    /**
     * Updates the given entity (id) with the given data.
     * */
    async update(entityObj) {
      if (typeof entityObj !== 'object' || !entityObj || typeof entityObj.id === 'undefined') {
        throw thorin.error('STORE.GCLOUD', 'A valid entity object is required to perform an update');
      }
      let entity = {
        key: this[store].key(this, parseInt(entityObj.id)),
        data: []
      }
      if (this.options.updatedAt) {
        entityObj.updated_at = Date.now();
      }
      entity.data = this.build(entityObj).data;
      if (entity.data.length === 0) return false;
      let res = await this[store].update(entity);
      return res[0];
    }

    /**
     * Destroys the given entity object.
     * This does not have destroy-by-query functionality
     * */
    async destroy(obj) {
      let keyId;
      if (typeof obj === 'string' || typeof obj === 'number') {
        keyId = obj;
      } else if (typeof obj === 'object' && obj && obj.id) {
        keyId = obj.id;
      } else {
        throw thorin.error('STORE.GCLOUD', 'A valid entity object is required to perform destroy');
      }
      if (typeof keyId === 'string') keyId = parseInt(keyId);
      keyId = this[store].key(this, keyId);
      return this[store].destroy(keyId);
    }

    /**
     * Performs a bulk create
     * */
    async bulkCreate(items) {
      if (!(items instanceof Array)) items = [];
      let entities = [],
        result = [];
      for (let i = 0, len = items.length; i < len; i++) {
        let item = items[i];
        if (typeof item !== 'object' || !item) continue;
        let entity = this.build(items[i]);
        result.push(item);
        entities.push(entity);
      }
      if (entities.length === 0) return [];
      await this[store].create(entities);
      for (let i = 0, len = result.length; i < len; i++) {
        result[i][Datastore.KEY] = entities[i].key;
        result[i].id = entities[i].id;
      }
      return result;
    }

    /**
     * Performs a bulk delete
     * */
    async bulkDestroy(items) {
      if (!(items instanceof Array)) return false;
      let keys = [];
      for (let i = 0, len = items.length; i < len; i++) {
        let item = items[i],
          it = typeof item;
        if (it === 'string' || it === 'number') {
          keys.push(item);
        } else if (it === 'object' && item && (typeof item.id === 'string' || typeof item.id === 'number')) {
          keys.push(item.id);
        }
      }
      if (keys.length === 0) return false;
      for (let i = 0, len = keys.length; i < len; i++) {
        keys[i] = this[store].key(this, parseInt(keys[i]));
      }
      return this[store].destroy(keys);
    }

    /**
     * Performs bulk updates to the given entities
     * */
    async bulkUpdate(items) {
      let entities = [];
      if (!(items instanceof Array)) return false;
      let now = Date.now();
      for (let i = 0, len = items.length; i < len; i++) {
        let item = items[i];
        if (typeof item !== 'object' || !item) continue;
        if (!item.id) continue;
        let entity = {
          key: this[store].key(this, parseInt(item.id)),
          data: []
        };
        if (this.options.updatedAt) {
          item.updated_at = now;
        }
        entity.data = this.build(item).data;
        if (entity.data.length === 0) continue;
        entities.push(entity);
      }
      if (entities.length === 0) return false;
      let res = await this[store].update(entities);
      return res[0];
    }


    /**
     * Builds the entity object that will be sent
     * */
    build(obj) {
      if (!this[store]) throw thorin.error('STORE.GCLOUD', 'Model is not ready for querying');
      if (typeof obj !== 'object' || !obj) throw thorin.error('STORE.GCLOUD', 'Model data is required');
      let key = this[store].key(this),
        data = [];
      for (let f in this.fields) {
        let objValue = obj[f],
          fieldObj = this.fields[f],
          objValueType = typeof objValue;
        if (objValueType === 'undefined') {
          objValue = fieldObj.defaultValue;
          objValueType = typeof objValue;
        }
        if (objValue === null || typeof objValue === 'undefined') continue;
        if (objValueType === 'function') {
          objValue = objValue();
          objValueType = typeof objValue;
        }
        if (fieldObj.type === StoreModel.STRING && objValueType !== 'string') {
          objValue = objValue.toString();
        } else if (fieldObj.type === StoreModel.INTEGER && objValueType !== 'number') {
          objValue = parseInt(objValue);
        } else if (fieldObj.type === StoreModel.BOOL && objValueType !== 'boolean') {
          objValue = !!objValue;
        } else if (fieldObj.type === StoreModel.DATE) {
          if (objValue instanceof Date) {
            objValue = objValue.getTime();
          }
        }
        obj[f] = objValue;
        let item = {
          name: f,
          value: objValue
        };
        if (fieldObj.index === false) {
          item.excludeFromIndexes = true;
        }
        data.push(item);
      }
      if (this.options.createdAt) {
        data.push({
          name: this.options.createdAt,
          value: obj[this.options.createdAt] || Date.now()
        });
      }
      if (this.options.updatedAt) {
        data.push({
          name: this.options.updatedAt,
          value: obj[this.options.updatedAt] || Date.now()
        });
      }
      let entity = {
        key,
        data
      };
      return entity;
    }

    /*******
     * MODEL-level functionality
     * */

    set store(v) {
      if (this[store]) return;
      this[store] = v;
    }

    /**
     * Adds a field to the model
     * Options:
     *   opt.defaultValue - the default value of the field
     *   opt.index -> if set to false, we will not index.
     * */
    field(name, type, opt) {
      if (name === 'id') throw thorin.error('STORE.GCLOUD', 'Field "id" is reserved and auto-applied');
      if (this.fields[name]) {
        throw thorin.error('STORE.GCLOUD', `A field with the name ${name} already exists for model ${this.code}`);
      }
      if (typeof type !== 'string') {
        throw thorin.error('STORE.GCLOUD', `A valid field type is required for ${name} in model ${this.code}`);
      }
      if (typeof opt !== 'object' || !opt) {
        opt = {};
      }
      opt.type = type;
      this.fields[name] = opt;
      return this;
    }

    /**
     * Checks if we have enough information about a table.
     * A valid model must have AT LEAST one field and a table name.
     */
    isValid() {
      if (Object.keys(this.fields).length === 0) return false;
      return true;
    }

    /**
     * Builds the request query based on a sequelize-query
     * */
    buildQuery(qry, req) {
      if (typeof qry !== 'object' || !qry) return;
      if (typeof qry.where === 'object') {
        for (let k in qry.where) {
          if (k === 'id') {
            let id = parseInt(qry.where.id);
            req.filter('__key__', '=', this[store].key(this, id));
            continue;
          }
          let val = qry.where[k];
          if (typeof val === 'undefined') continue;
          if (val instanceof Array) {
            for (let kv = 0, kvlen = val.length; kv < kvlen; kv++) {
              req.filter(k, '=', val[kv]);
            }
            continue;
          } else if (typeof val === 'object' && val) {
            if (typeof val.$gt !== 'undefined') {
              req.filter(k, '>', val.$gt);
            }
            if (typeof val.$gte !== 'undefined') {
              req.filter(k, '>=', val.$gte);
            }
            if (typeof val.$lt !== 'undefined') {
              req.filter(k, '<', val.$lt);
            }
            if (typeof val.$lte !== 'undefined') {
              req.filter(k, '<=', val.$lte);
            }
            continue;
          }
          req.filter(k, '=', val);
        }
      }
      if (qry.order instanceof Array) {
        qry.order.forEach((itm) => {
          if (itm instanceof Array) {
            req.order(itm[0], {
              descending: itm[1] === 'DESC'
            });
          }
        });
      }
      if (typeof qry.limit === 'number') {
        req.limit(qry.limit);
      }
      if (typeof qry.offset === 'number') {
        req.offset(qry.offset);
      }
      if (typeof qry.cursor != 'undefined') {
        req.start(qry.cursor);
      }
      if (qry.group instanceof Array) {
        req.groupBy(qry.group);
      }
      if (qry.attributes instanceof Array) {
        req.select(qry.attributes);
      }
    }

  }

  /**
   * Store model types
   * */
  StoreModel.STRING = 'string';
  StoreModel.DATE = 'timestamp';
  StoreModel.INTEGER = 'integer';
  StoreModel.DOUBLE = 'double';
  StoreModel.ARRAY = 'array';
  StoreModel.JSON = 'entity';
  StoreModel.BOOL = 'boolean';
  StoreModel.KEY = 'key';
  StoreModel.GEO = 'geo_point';


  return StoreModel;

};