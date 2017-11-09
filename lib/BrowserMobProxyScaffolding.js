const {
  download, spawnAndWait, killChild, freePort,
} = require('./Util.js');
const debug = require('debug')('BrowserMobProxyScaffolding');
const path = require('path');
const fs = require('fs');
const findNodeModules = require('find-node-modules');
const decompress = require('decompress');

/**
 * A scaffolding that can install and start a browsermob proxy instance
 */
class BrowserMobProxyScaffolding {
  /**
   * Construct a BrowserMobProxyScaffolding instance
   */
  constructor() {
    this.browserMobDir = `${findNodeModules()}${path.sep}.browsermob`;
    this.binaryURL = 'https://github.com/lightbody/browsermob-proxy/releases/download/browsermob-proxy-2.1.4/browsermob-proxy-2.1.4-bin.zip';
    this.cmd = 'java';
    this.getArgs = () => ['-jar', 'lib/browsermob-dist-2.1.4.jar', '--address ', '127.0.0.1', '--port', this.port];
    this.cwd = `${this.browserMobDir}${path.sep}bm${path.sep}browsermob-proxy-2.1.4`;
    this.startupRegex = new RegExp(/Started SelectChannelConnector/);
    this.startTimeoutMs = 30000;
  }

  /**
   * Install browsermob proxy and return a promise that resolves when the installation is complete
   * @param {Object} options installation options
   * @param {Boolean} options.force set to true to force re-downloading browsermob proxy binaries
   * @returns {Promise<BrowserMobProxyScaffolding,Error>}  a promise that resolves to "this" after
   *                                                       installation is complete
   */
  install(options = { force: false }) {
    debug(`installing browsermob proxy with options ${JSON.stringify(options)}`);
    return new Promise((resolve) => {
      if (fs.existsSync(this.browserMobDir) && !options.force) {
        debug(`${this.browserMobDir} exists; browsermob proxy already installed`);
        resolve();
        return;
      }
      debug(`${this.browserMobDir} does not exist; downloading...`);
      resolve(download(this.binaryURL, `${this.browserMobDir}${path.sep}bm.zip`)
        .then((zipFilePath) => {
          debug(`${zipFilePath} downloaded; unzippling...`);
          return zipFilePath;
        })
        .then(zipFilePath => decompress(zipFilePath, `${this.browserMobDir}${path.sep}bm`))
        .then(() => {
          debug('unzipped');
        })
        .then(() => this));
    });
  }

  /**
   * Start a browsermob proxy instance and return a promise that resovles once the proxy instance
   * is started
   * @param {Object} options startup options
   * @param {number} options.port TCP port to attempt to start proxy on
   * @returns {Promise<BrowserMobProxyScaffolding,Error>}  a promise that resolves to "this" after
   *                                                       browsermob proxy is started
   */
  start(options = { port: 8080 }) {
    debug(`Attempting to start on port ${options.port}`);
    return freePort(options.port)
      .then((port) => {
        debug(`Found open port ${port}; using for BMP port`);
        this.port = port;
      })
      .then(() => spawnAndWait({
        cmd: this.cmd,
        args: this.getArgs(),
        options: { cwd: this.cwd },
        timeoutMs: this.startTimeoutMs,
        okRegex: this.startupRegex,
      }))
      .then((proc) => {
        debug('BMP started');
        this.process = proc;
        return this;
      });
  }

  /**
   * Stop this scaffolding and return a promise that resolves when scaffolding is stopped
   * @returns {Promise<Boolean,Error>} promise that resolves when scaffolding is stopped
   */
  stop() {
    debug(`Killing ${this.process}`);
    return killChild(this.process);
  }
}
module.exports = BrowserMobProxyScaffolding;
