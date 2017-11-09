const { download } = require('./Util.js');
const path = require('path');
const fs = require('fs');
const findNodeModules = require('find-node-modules');
const decompress = require('decompress');
const { spawn } = require('child_process');
const ProcessScaffolding = require('./ProcessScaffolding.js');
/**
 * A scaffolding that can install and start a browsermob proxy instance
 */
class BrowserMobProxyScaffolding extends ProcessScaffolding {
  /**
   * Construct a BrowserMobProxyScaffolding instance
   */
  constructor() {
    super();
    this.browserMobDir = `${findNodeModules()}${path.sep}.browsermob`;
    this.binaryURL = 'https://github.com/lightbody/browsermob-proxy/releases/download/browsermob-proxy-2.1.4/browsermob-proxy-2.1.4-bin.zip';
    this.cmd = 'java';
    this.cmdArgArray = ['-jar', 'lib/browsermob-dist-2.1.4.jar'];
    this.cwd = `${this.browserMobDir}${path.sep}bm${path.sep}browsermob-proxy-2.1.4`;
    this.startupRegex = new RegExp(/Started SelectChannelConnector/);
    this.startTimeoutMs = 30000;
  }

  /**
   * Install browsermob proxy and return a promise that resolves when the installation is complete
   * @param {Object} options installation options
   * @param {Boolean} options.force set to true to force re-downloading browsermob proxy binaries
   * @returns {Promise<Array<String>,Error>}  a promise that resolves to list of browsermob proxy
   *                                          binary paths
   */
  install(options = { force: false }) {
    return new Promise((resolve) => {
      if (fs.existsSync(this.browserMobDir) && !options.force) {
        resolve();
        return;
      }
      resolve(download(this.binaryURL, `${this.browserMobDir}${path.sep}bm.zip`)
        .then(zipFilePath => decompress(zipFilePath, `${this.browserMobDir}${path.sep}bm`)));
    });
  }

  /**
   * Start a browsermob proxy instance and return a promise that resovles once the proxy instance
   * is started
   * @param {Object} options startup options [ignored at the moment]
   * @returns {Promise<Process,Error>}  a promise that resolves to the started process after
   *                                    browsermob proxy is started
   */
  // eslint-disable-next-line no-unused-vars
  start(options) {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.cmd, this.cmdArgArray, { cwd: this.cwd });
      const stopTimeout = setTimeout(() => this.stop(), this.startTimeoutMs);
      this.process.stdout.on('data', (data) => {
        if (this.startupRegex.test(data)) {
          clearTimeout(stopTimeout);
          resolve(this.process);
        }
      });
      this.process.stderr.on('data', () => { /* ignore */ });
      this.process.on('exit', (exitcode) => {
        clearTimeout(stopTimeout);
        /* mark process as done by marking it killed; this is a hack */
        this.process.killed = true;
        reject(new Error(`Process exited with exit code ${exitcode}`));
      });
    });
  }
}
module.exports = BrowserMobProxyScaffolding;
