const BrowserMobProxyScaffolding = require('../lib/BrowserMobProxyScaffolding.js');
const { assert } = require('chai');
const express = require('express');
const tmp = require('tmp');
const fs = require('fs');
const path = require('path');

describe('BrowserMobProxyScaffolding tests', () => {
  let server = null;
  let wrapper = null;
  let tmpBmDir = null;
  before((ready) => {
    /* start an HTTP server serving minizip file */
    const app = express();
    app.use(express.static('test'));
    server = app.listen(3000, ready);
  });
  after((ready) => {
    server.close(ready);
  });
  beforeEach(() => {
    /* make a temp dir */
    tmpBmDir = tmp.dirSync();
    wrapper = new BrowserMobProxyScaffolding({
      binaryURL: 'http://127.0.0.1:3000/helloworld.zip',
      browserMobDir: tmpBmDir.name,
      cwd: `${tmpBmDir.name}${path.sep}bm`,
      getArgs: () => ['-jar', 'HelloWorld.jar'],
      startupRegex: new RegExp(/Hello World/),
    });
    tmpBmDir.removeCallback();
  });
  afterEach(() => {
    tmpBmDir.removeCallback();
    return wrapper.stop().catch(() => { });
  });

  it('should install browsermob-proxy', () => {
    assert.isFalse(fs.existsSync(wrapper.config.browserMobDir));
    return wrapper.install().then(() => {
      assert.isTrue(fs.existsSync(wrapper.config.browserMobDir));
    });
  });

  it('should start browsermob-proxy', () => wrapper.install().then(() => wrapper.start()).then((s) => {
    assert.isNotNull(s.process);
    assert.isFalse(s.process.killed);
  }));

  it('should stop browsermob-proxy', () =>
    wrapper.start()
      .then(() => {
        assert.isNotNull(wrapper.process);
        return wrapper.stop().then(() => wrapper.process);
      })
      .then((proc) => {
        assert.isTrue(proc.killed);
      })
      .catch(ex => wrapper.stop().then(() => { throw ex; })));

  it('should stop browsermob-proxy on startup timeout', () => {
    [wrapper.config.startupRegex, wrapper.config.startTimeoutMs]
      = [new RegExp(/Will Not Happen/), 750];
    return wrapper.start()
      .then(() => {
        throw new Error('proxy started unexpectedly');
      })
      .catch((error) => {
        assert.equal('Process failed to start after 750ms and was killed; its exit code was 143', error.message);
      });
  });
}).timeout(10000);
