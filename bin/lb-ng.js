#!/usr/bin/env node

var path = require('path');
var SG = require('strong-globalize');
SG.SetRootDir(path.resolve(__dirname, '..'));
var g = SG();
var fs = require('fs');
var Promise = require('bluebird');
var semver = require('semver');
var optimist = require('optimist');
var generator = require('loopback-sdk-ng');

var argv = optimist
  .usage(g.f(
    'Generate {{Angular $resource}} services ' +
    'for your {{LoopBack}} application.' +
    '\nUsage:' +
    '\n    $0 {{[options] server/app.js [client/js/lb-services.js]}}'))
  .describe('m', g.f('The name for generated {{Angular}} module.'))
  .default('m', 'lbServices')
  .describe('u', g.f('URL of the REST API end-point'))
  .alias({ u : 'url', m: 'module-name' })
  .demand(1)
  .argv;

var appFile = path.resolve(argv._[0]);
var modelConfigFile = path.resolve(argv._[1]);
var outputFile = argv._[2];

g.error('Loading {{LoopBack}} app %j', appFile);
var app = require(appFile);
assertLoopBackVersion();

g.error('Applying LoopBack modelConfig %j', modelConfigFile);
var modelConfigs = require(modelConfigFile);

Object.keys(modelConfigs).forEach(function(k) {
  if(app.models[k]) {
    app.models[k].settings = app.models[k].settings || {};
    app.models[k].settings.modelConfigs = modelConfigs[k] || {};
  }
});

if (app.booting) {
  app.on('booted', runGenerator);
} else {
  runGenerator();
}

function runGenerator() {
  var ngModuleName = argv['module-name'] || 'lbServices';
  var apiUrl = argv['url'] || app.get('restApiRoot') || '/api';

  g.error('Generating %j for the API endpoint %j', ngModuleName, apiUrl);
  var result = generator.services(app, ngModuleName, apiUrl);

  if (outputFile) {
    outputFile = path.resolve(outputFile);
    g.error('Saving the generated services source to %j', outputFile);
    fs.writeFileSync(outputFile, result);
    process.exit();
  } else {
    g.error('Dumping to {{stdout}}');
    process.stdout.write(result);
    // The app.js scaffolded by `slc lb project` loads strong-agent module that
    // used to have a bug where it prevented the application from exiting.
    // To work around that issue, we are explicitly exiting here.
    //
    // The exit is deferred to both stdout and err is drained
    // in order to prevent the Node bug:
    // https://github.com/joyent/node/issues/3584
    Promise.all([
      waitForEvent(process.stdout, 'drain'),
      waitForEvent(process.stderr, 'drain')
    ]).then(function() {
      process.exit();
    });
  }
}

//--- helpers ---//

function assertLoopBackVersion() {
  var Module = require('module');

  // Load the 'loopback' module in the context of the app.js file,
  // usually from node_modules/loopback of the project of app.js
  var loopback = Module._load('loopback', Module._cache[appFile]);

  if (semver.lt(loopback.version, '1.6.0')) {
    g.error('\n' +
      'The code generator does not support applications based on\n' +
      '{{LoopBack}} versions older than 1.6.0. Please upgrade your project\n' +
      'to a recent version of {{LoopBack}} and run this tool again.\n');
    process.exit(1);
  }
}

function waitForEvent(obj, name) {
  return new Promise(function(resolve, reject) {
    obj.once(name, resolve);
    obj.once('error', reject);
  });
}
