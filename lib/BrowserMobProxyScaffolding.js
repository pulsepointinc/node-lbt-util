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
   * @param {Object} config configuration
   * @param {String} config.browserMobDir optional directory to store browsermob binaries in
   * @param {String} config.binaryURL optional location of browsermob binaries
   * @param {String} config.cmd command to run to start browsermob proxy
   * @param {Function<Array<String>>} config.getArgs  function that accepts a port number and
   *                                                  returns arguments to supply to browsermob
   *                                                  proxy command
   * @param {String} config.cwd working directory of cmd executed to start browsermob proxy
   * @param {RegExp} config.startupRegex  regular expression used for verifying browsermob has
   *                                      started up
   * @param {number} config.startTimeoutMs startup timeout in milliseconds
   * @param {Boolean} config.forceInstall whether or not to force reinstalling browsermob binaries
   *                                      prior to startup
   * @param {number} config.port port to attempt to start browsermob on
   */
  constructor({
    browserMobDir = `${findNodeModules()}${path.sep}.browsermob`,
    binaryURL = 'https://github.com/lightbody/browsermob-proxy/releases/download/browsermob-proxy-2.1.4/browsermob-proxy-2.1.4-bin.zip',
    cmd = 'java',
    getArgs = port => ['-jar', 'lib/browsermob-dist-2.1.4.jar', '--address', '127.0.0.1', '--port', port],
    cwd = `${browserMobDir}${path.sep}bm${path.sep}browsermob-proxy-2.1.4`,
    startupRegex = new RegExp(/Started SelectChannelConnector/),
    startTimeoutMs = 30000,
    forceInstall = false,
    port = 8080,
  } = {}) {
    this.config = {
      browserMobDir, binaryURL, cmd, getArgs, cwd, startupRegex, startTimeoutMs, forceInstall, port,
    };
  }

  /**
   * Install browsermob proxy and return a promise that resolves when the installation is complete
   * @returns {Promise<BrowserMobProxyScaffolding,Error>}  a promise that resolves to "this" after
   *                                                       installation is complete
   */
  install() {
    debug('installing browsermob proxy');
    return new Promise((resolve) => {
      if (fs.existsSync(this.config.browserMobDir) && !this.config.forceInstall) {
        debug(`${this.config.browserMobDir} exists; browsermob proxy already installed`);
        resolve();
        return;
      }
      debug(`${this.config.browserMobDir} does not exist; downloading...`);
      resolve(download(this.config.binaryURL, `${this.config.browserMobDir}${path.sep}bm.zip`)
        .then((zipFilePath) => {
          debug(`${zipFilePath} downloaded; unzippling...`);
          return zipFilePath;
        })
        .then(zipFilePath => decompress(zipFilePath, `${this.config.browserMobDir}${path.sep}bm`))
        .then(() => {
          debug('unzipped');
        })
        .then(() => this));
    });
  }

  /**
   * Start a browsermob proxy instance and return a promise that resovles once the proxy instance
   * is started
   * @returns {Promise<BrowserMobProxyScaffolding,Error>}  a promise that resolves to "this" after
   *                                                       browsermob proxy is started
   */
  start() {
    debug(`Attempting to start on port ${this.config.port}`);
    return this.install()
      .then(() => freePort(this.config.port))
      .then((port) => {
        debug(`Found open port ${port}; using for BMP port`);
        this.port = port;
      })
      .then(() => spawnAndWait({
        cmd: this.config.cmd,
        args: this.config.getArgs(this.port),
        options: { cwd: this.config.cwd },
        timeoutMs: this.config.startTimeoutMs,
        okRegex: this.config.startupRegex,
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
