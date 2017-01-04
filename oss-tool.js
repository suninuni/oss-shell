#! /usr/bin/env node

"use strict"

// import
var program = require('commander');
var exec = require('child_process').exec;
var fs = require('fs');
var OSS = require('ali-oss');
var co = require('co');
var env = require('node-env-file');
var _ = require('lodash');

// variable
var ossConf = {
  accessKeyId: null,
  accessKeySecret: null,
  region: null,
  bucket: null
}
var confFile = 'env.conf'
var client;

// program
program.usage('[command] [options]')

program
  .command('create-bucket [bucket]')
  .option('-c, --conf <confFile>')
  .action(function(bucket, options) {
    checkConf(options.conf);
    if (!bucket) {
      console.log('bucket is null')
      process.exit(1)
    }
    co(function*() {
      var result = yield client.putBucket(bucket);
      console.log(result.res.status);
    }).catch(function(err) {
      console.log(err);
      process.exit(1);
    });
  })

program
  .command('delete-bucket [bucket]')
  .option('-c, --conf <confFile>')
  .action(function(bucket, options) {
    checkConf(options.conf);
    if (!bucket) {
      console.log('bucket is null')
      process.exit(1)
    }
    co(function*() {
      var result = yield client.deleteBucket(bucket);
      console.log(result.res.status);
    }).catch(function(err) {
      console.log(err);
      process.exit(1);
    });
  })

program
  .command('list-bucket')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options.conf);
    co(function*() {
      let buckets = yield client.listBuckets();
      console.log(buckets.buckets);
    }).catch(function(err) {
      console.log(err);
      process.exit(1);
    })
  })

program
  .command('upload-files [files...]')
  .option('-c, --conf <confFile>')
  .action(function(files, options) {
    checkConf(options.conf);
    if (!files) {
      console.log('files is null')
      process.exit(1)
    }
    _.forEach(files, function(file) {
      co(function*() {
        let result;
        if (fs.statSync(file).size > 100000) {
          result = yield client.multipartUpload(file, file, {
            progress: function*(p) {
              console.log('Progress: ' + p);
            }
          });
        } else {
          result = yield client.put(file, file);
        }
        console.log(result);
      }).catch(function(err) {
        console.log(err);
        process.exit(1);
      })
    })
  })

program
  .command('delete-files [files...]')
  .option('-c, --conf <confFile>')
  .action(function(files, options) {
    checkConf(options.conf);
    if (!files) {
      console.log('files is null')
      process.exit(1)
    }
    co(function*() {
      let result = yield client.deleteMulti(files);
      console.log(result);
    }).catch(function(err) {
      console.log(err);
      process.exit(1);
    })
  })

program
  .command('list-files')
  .option('-m, --marker <marker>')
  .option('-p, --prefix <prefix>')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options.conf);
    co(function*() {
      let files = yield client.list({
        marker: options.marker,
        prefix: options.prefix
      });
      console.log(files.objects);
    }).catch(function(err) {
      console.log(err);
      process.exit(1);
    })
  })

program
  .command('conf')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-r, --region <region>')
  .option('-b, --bucket <bucket>')
  .option('-f, --file <filePath>', 'conf file, which need set the accessKeyId, accessKeySecret and region', 'dev.conf')
  .action(function(options) {
    if (options.file) {
      setOssConfFromFile(options.file)
    }
    if (options.accessKeyId) {
      ossConf.accessKeyId = options.accessKeyId;
    }
    if (options.accessKeySecret) {
      ossConf.accessKeySecret = options.accessKeySecret;
    }
    if (options.region) {
      ossConf.region = options.region;
    }
    if (options.region) {
      ossConf.bucket = options.bucket;
    }
    writeOssConfToFile();
  })

program.parse(process.argv);

//function

function getOss() {
  if (arguments.length == 1) {
    confFile = arguments[0];
  }
  setOssConfFromFile(confFile);
  return new OSS(ossConf);
}

function setOssConfFromFile(file) {
  if (!fs.existsSync(file)) {
    console.log('conf file ' + file + ' is not exist, you need create it or run os-tool conf first')
    process.exit(1);
  } else {
    env(file);
    ossConf.accessKeyId = process.env.accessKeyId;
    ossConf.accessKeySecret = process.env.accessKeySecret;
    ossConf.region = process.env.region;
    ossConf.bucket = process.env.bucket;
  }
}

function writeOssConfToFile() {
  fs.writeFileSync(confFile, "");
  _.forEach(ossConf, function(value, key) {
    value && fs.appendFileSync(confFile, key + "=" + value + '\n');
  })
}

function checkConf(file) {
  if (file) {
    client = getOss(file)
  } else {
    client = getOss()
  }
}