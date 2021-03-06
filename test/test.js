var stream = require('stream')
  , assert = require('assert')
  , request = require('request')
  , sinon = require('sinon')
  , CKAN = require('ckan')
  , Pusher = require('../index.js').Pusher
  ;

function makeStream(string) {
  var s = new stream.Readable();
  s.push(string);
  s.push(null);
  return s;
}

describe('pushResourceData', function() {
  var stubbed = null;
  before(function() {
    stubbed = sinon.stub(CKAN.Client.prototype, '_ajax', function(arg1, cb) {
      cb(null, 'data');
    });
  });
  after(function() {
    stubbed.restore();
  });
  it('works ok', function(done) {
    var importer = new Pusher('http://localhost');
    var inStream = 'A,B\n1,2';
    var resource = {
      name: 'xyz',
      id: '123-xyz',
      schema: {
        fields: [
          {
            name: 'A',
            type: 'integer'
          },
          {
            name: 'B',
            type: 'integer'
          }
        ]
      }
    };
    importer.pushResourceData(inStream, resource, function(err, out) {
      assert.equal(stubbed.callCount, 3);
      calledWith = stubbed.getCall(1).args[0];
      assert.equal(calledWith.data.resource_id, resource.id);
      assert.deepEqual(calledWith.data.fields, [
        { id: 'A', type: 'int'}, { id: 'B', type: 'int' }
      ]);
      var insertData = stubbed.getCall(2).args[0].data;
      assert.deepEqual(insertData.records, [
        { A:1, B:2 }
      ]);
      done(err);
    });
  });
});

describe('push', function() {
  var stubbed = null
    , resourceId = '111-AAA'
    , fakeCkanDataset = { resources: [ {id: resourceId} ] }
    ;
  before(function() {
    stubbed = sinon.stub(CKAN.Client.prototype, '_ajax', function(arg1, cb) {
      if (arg1.url.indexOf('package_show') != -1) {
        // by returning error here we indicate 404 not found
        cb('dataset does not exist');
      } else if (arg1.url.indexOf('package_create') != -1) {
        cb(null, {
          success: true,
          result: fakeCkanDataset
        });
      } else {
        cb();
      }
    });
  });
  after(function() {
    stubbed.restore();
  });
  it('works ok - no existing dataset', function(done) {
    var importer = new Pusher('http://localhost');
    importer.push('test/fixtures/datapackage.json', function(err, out) {
      assert(!err, JSON.stringify(err));
      // should be called 4x
      // 1x to see if dataset exists
      // 1x for metadata creation
      // 1x to drop data in datastore
      // 1x for data into the datastore
      assert.equal(stubbed.callCount, 5);

      var datasetData = stubbed.getCall(1).args[0].data;
      assert.equal(datasetData.resources.length, 1);

      var datastoreData = stubbed.getCall(3).args[0].data;
      assert.deepEqual(datastoreData.fields[0], {
        id: 'A',
        type: 'text'
      });

      var insertData = stubbed.getCall(4).args[0].data;
      assert.equal(insertData.records.length, 2);
      assert.equal(insertData.resource_id, resourceId);

      done(err);
    });
  });
});
