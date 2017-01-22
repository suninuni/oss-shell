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
var log4js = require('log4js');

// variable
var ossConf = {
  accessKeyId: null,
  accessKeySecret: null,
  endpoint: 'http://oss-cn-hangzhou.aliyuncs.com',
  bucket: null,

}
var confFile = 'env.conf'
var client;

log4js.configure('log.json');
var logger = log4js.getLogger('oss');
logger.debug(_.join(process.argv, ' '))

// program
program.usage('[command] [options]')

program
  .command('create-bucket <bucket>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(bucket, options) {
    checkConf(options);
    if (!bucket) {
      logger.info('bucket is null')
      process.exit(1)
    }
    co(function*() {
      var result = yield client.putBucket(bucket);
      logger.info(result.res.status);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    });
  })

program
  .command('delete-bucket <bucket>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(bucket, options) {
    checkConf(options);
    if (!bucket) {
      logger.info('bucket is null')
      process.exit(1)
    }
    co(function*() {
      var result = yield client.deleteBucket(bucket);
      logger.info(result.res.status);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    });
  })

program
  .command('list-bucket')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options);
    co(function*() {
      let buckets = yield client.listBuckets();
      logger.info(buckets.buckets);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    })
  })


program
  .command('upload-files <files...>')
  .option('-p, --prefix <prefix>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(files, options) {
    checkConf(options);
    let prefix = '';
    if (options.prefix) {
      prefix = options.prefix;
      if (prefix.lastIndexOf('/') != prefix.length - 1) {
        prefix += '/';
      }
    }
    _.forEach(files, function(file) {
      uploadFileOrFloder(file, prefix)
    })
  })

program
  .command('download-files <files...>')
  .option('-p, --prefix <prefix>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(files, options) {
    checkConf(options);
    let prefix = '';
    if (options.prefix) {
      prefix = options.prefix;
      if (prefix.lastIndexOf('/') != prefix.length - 1) {
        prefix += '/';
      }
    }
    _.forEach(files, function(file) {
      downloadFile(prefix + file)
    })
  })

program
  .command('download-floders <floders...>')
  .option('-p, --prefix <prefix>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(floders, options) {
    checkConf(options);
    let prefix = '';
    if (options.prefix) {
      prefix = options.prefix;
      if (prefix.lastIndexOf('/') != prefix.length - 1) {
        prefix += '/';
      }
    }
    _.forEach(floders, function(floder) {
      downloadFloder(prefix + floder)
    })
  })


program
  .command('delete-files <files...>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(files, options) {
    checkConf(options);
    co(function*() {
      let result = yield client.deleteMulti(files);
      logger.info(result);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    })
  })

program
  .command('delete-floders <floders...>')
  .option('-p, --prefix <prefix>')
  .option('-n, --number <number>', 'number of files to keep')
  .option('-e, --expireDate <expireDate>', 'delte file after this expireDate')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(floders, options) {
    checkConf(options);
    let prefix = '';
    if (options.prefix) {
      prefix = options.prefix;
      if (prefix.lastIndexOf('/') != prefix.length - 1) {
        prefix += '/';
      }
    }
    _.forEach(floders, function(floder) {
      if (floder.lastIndexOf('/') != floder.length - 1) {
        floder += '/';
      }
      if (options.expireDate) {
        deleteExpireFile(prefix + floder, options.expireDate);
      } else if (options.number) {
        deleteRedundancyFile(prefix + floder, options.number);
      } else {
        deleteFloder(prefix + floder)
      }
    })
  })

program
  .command('copy-file <toAndFrom...>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(files, options) {
    checkConf(options);
    if (files.length != 2) {
      logger.error("you need provide two object paths");
      process.exit(1);
    }
    co(function*() {
      let result = yield client.copy(files[1], files[0]);
      logger.info(result);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    })
  })

program
  .command('create-lifecycle')
  .option('-i, --id <id>')
  .option('-p, --prefix <prefix>')
  .option('-u, --status <status>')
  .option('-d, --days <days>')
  .option('-t, --date <date>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options);
    let newRule = {
      id: options.id,
      prefix: options.prefix,
      status: options.status,
      days: options.days,
      date: options.date
    }
    co(function*() {
      let getResult = yield client.getBucketLifecycle(ossConf.bucket, ossConf.endpoint);
      let rules = getResult.rules;
      rules.push(newRule);
      let putResult = yield client.putBucketLifecycle(ossConf.bucket, ossConf.endpoint, rules);
      logger.info(putResult);
    }).catch(function(err) {
      logger.error(err);
      let rules = [];
      rules.push(newRule);
      co(function*() {
        let putResult = yield client.putBucketLifecycle(ossConf.bucket, ossConf.endpoint, rules);
        logger.info(putResult);
      })
    })
  })

program
  .command('list-lifecycle')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options);
    co(function*() {
      let result = yield client.getBucketLifecycle(ossConf.bucket, ossConf.endpoint);
      logger.info(result);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    })
  })

program
  .command('delete-lifecycle')
  .option('-i, --id <id>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options);
    co(function*() {
      let getResult = yield client.getBucketLifecycle(ossConf.bucket, ossConf.endpoint);
      let rules = getResult.rules;
      let index = _.findIndex(rules, function(rule) {
        return rule.id == options.id;
      })
      if (index >= 0) {
        _.pullAt(rules, index);
      }
      let putResult = yield client.putBucketLifecycle(ossConf.bucket, ossConf.endpoint, rules);
      logger.info(putResult);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    })
  })

program
  .command('list-files')
  .option('-m, --marker <marker>')
  .option('-p, --prefix <prefix>')
  .option('-d, --delimiter <delimiter>')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <confFile>')
  .action(function(options) {
    checkConf(options);
    co(function*() {
      let files = yield client.list({
        marker: options.marker,
        prefix: options.prefix,
        delimiter: options.delimiter
      });
      logger.info(files.objects);
    }).catch(function(err) {
      logger.error(err);
      process.exit(1);
    })
  })

program
  .command('conf')
  .option('-k, --accessKeyId <accessKeyId>')
  .option('-s, --accessKeySecret <accessKeySecret>')
  .option('-e, --endpoint <endpoint>')
  .option('-b, --bucket <bucket>')
  .option('-c, --conf <filePath>', 'conf file, which need set the accessKeyId, accessKeySecret and endpoint', 'dev.conf')
  .action(function(options) {
    setOssConfFromArgs(options)
    writeOssConfToFile();
  })

program.parse(process.argv);

//function

function uploadFileOrFloder(file, prefix) {
  if (fs.statSync(file).isFile()) {
    uploadFile(file, prefix);
  } else if (fs.statSync(file).isDirectory) {
    prefix += file.substr(file.lastIndexOf('/') + 1) + '/';
    uploadFloder(file, prefix);
  } else {
    logger.info("Can't find file or floder: " + file);
  }
}

function uploadFloder(floder, prefix) {
  let items = fs.readdirSync(floder);
  _.forEach(items, function(item) {
    item = floder + '/' + item;
    uploadFileOrFloder(item, prefix)
  })
}

function uploadFile(file, prefix) {
  co(function*() {
    let result;
    let fileName = file.substr(file.lastIndexOf('/') + 1);
    if (fs.statSync(file).size > 4194304) {
      let checkpoint;
      for (var i = 0; i < 5; i++) {
        logger.info("multi part upload file " + prefix + fileName);
        result = yield client.multipartUpload(prefix + fileName, file, {
          checkpoint: checkpoint,
          partSize: 10000 * 1024,
          progress: function*(percentage, cpt) {
            checkpoint = cpt;
          }
        });
        logger.info(result);
        break; // break if success
      }
    } else {
      logger.info("upload file: " + prefix + fileName);
      logger.info(prefix + fileName);
      result = yield client.put(prefix + fileName, file);
      logger.info(result);
    }
  }).catch(function(err) {
    logger.error(err);
    process.exit(1);
  })
}

function downloadFloder(floder) {
  co(function*() {
    let toDownloadFiles = [];
    if (floder.lastIndexOf('/') != floder.length - 1) {
      floder += '/';
    }
    let searchResult = yield client.list({
      prefix: floder
    });
    _.forEach(searchResult.objects, function(obj) {
      toDownloadFiles.push(obj.name);
    })
    _.forEach(toDownloadFiles, function(file) {
      downloadFile(file, '');
    })
  }).catch(function(err) {
    logger.error(err);
    process.exit(1);
  })
}

function downloadFile(file) {
  co(function*() {
    mkdirsSync(file.substr(0, file.lastIndexOf('/')))
    let result = yield client.get(file, file);
    logger.info(result);
  }).catch(function(err) {
    logger.error(err);
    process.exit(1);
  })
}

function mkdirsSync(dirpath) {
  if (!fs.existsSync(dirpath)) {
    let pathtmp;
    dirpath.split('/').forEach(function(dirname) {
      if (pathtmp) {
        pathtmp = pathtmp + '/' + dirname;
      } else {
        pathtmp = dirname;
      }
      if (!fs.existsSync(pathtmp)) {
        if (!fs.mkdirSync(pathtmp)) {
          return false;
        }
      }
    });
  }
  return true;
}

function deleteFloder(floder) {
  co(function*() {
    let toDeleteFiles = []
    let searchResult = yield client.list({
      prefix: floder
    });
    _.forEach(searchResult.objects, function(obj) {
      toDeleteFiles.push(obj.name)
    })
    let result = yield client.deleteMulti(toDeleteFiles);
    logger.info(result);
  }).catch(function(err) {
    logger.error(err);
    process.exit(1);
  })
}

function deleteExpireFile(floder, expireDate) {
  co(function*() {
    let toDeleteFiles = []
    let searchResult = yield client.list({
      prefix: floder
    });
    let sortedObjects = _.sortBy(searchResult.objects, function(object) {
      return object.lastModified;
    })

    let toDelteObjects = _.remove(sortedObjects, function(object) {
      return object.lastModified < expireDate;
    })

    _.forEach(toDelteObjects, function(obj) {
      toDeleteFiles.push(obj.name)
    })
    let result = yield client.deleteMulti(toDeleteFiles);
    logger.info(result);
  }).catch(function(err) {
    logger.error(err);
    process.exit(1);
  })
}

function deleteRedundancyFile(floder, number) {
  co(function*() {
    let toDeleteFiles = []
    let searchResult = yield client.list({
      prefix: floder
    });
    if (searchResult.objects.length > number) {
      let sortedObjects = _.sortBy(searchResult.objects, function(object) {
        return object.lastModified;
      })
      sortedObjects = _.dropRight(sortedObjects, number);

      _.forEach(sortedObjects, function(obj) {
        toDeleteFiles.push(obj.name)
      })

      let result = yield client.deleteMulti(toDeleteFiles);
      logger.info(result);
    }
  }).catch(function(err) {
    logger.error(err);
    process.exit(1);
  })
}

function setOssConfFromArgs(options) {
  if (options.conf) {
    setOssConfFromFile(options.conf)
  } else {
    setOssConfFromFile(confFile)
  }
  if (options.accessKeyId) {
    ossConf.accessKeyId = options.accessKeyId;
  }
  if (options.accessKeySecret) {
    ossConf.accessKeySecret = options.accessKeySecret;
  }
  if (options.endpoint) {
    ossConf.endpoint = options.endpoint;
  }
  if (options.bucket) {
    ossConf.bucket = options.bucket;
  }
}

function setOssConfFromFile(file) {
  if (!fs.existsSync(file)) {
    if (file == confFile) {
      return;
    }
    logger.info('conf file ' + file + ' is not exist, you need create it or run os-tool conf first')
    process.exit(1);
  } else {
    env(file);
    ossConf.accessKeyId = process.env.accessKeyId;
    ossConf.accessKeySecret = process.env.accessKeySecret;
    ossConf.endpoint = process.env.endpoint;
    ossConf.bucket = process.env.bucket;
  }
}

function writeOssConfToFile() {
  fs.writeFileSync(confFile, "");
  _.forEach(ossConf, function(value, key) {
    value && fs.appendFileSync(confFile, key + "=" + value + '\n');
  })
}

function checkConf(options) {
  setOssConfFromArgs(options);
  client = new OSS(ossConf);
}