const { toPromise, killChild, freePort } = require('./Util.js');
const debug = require('debug')('SeleniumScaffolding');
const selenium = require('selenium-standalone');
/**
 * Promise wrapper for <pre>selenium-standalone</pre>
 */
/* eslint class-methods-use-this: ["error", { "exceptMethods": ["install"] }] */
class SeleniumScaffolding {
  /**
   * Construct a selenium server scaffolding instance
   *
   * @param {Object} options
   * @param {Object} options.installOptions installation options to pass the selenium-standalone package (see https://www.npmjs.com/package/selenium-standalone)
   * @param {Object} options.startOptions start otpions to pass the selenium-standalone package (see https://www.npmjs.com/package/selenium-standalone)
   * @param {number} options.startOptions.port optional port to try to start selenium server on
   */
  constructor({ installOptions = {}, startOptions = { port: 4444 } } = {}) {
    this.installOptions = installOptions;
    this.startOptions = startOptions;
  }

  /**
   * Install standalone selenium (selenium server) locally
   * @returns {Promise<SeleniumScaffolding, Error>} promise that resovles to "this"
   */
  install() {
    debug(`Attempting to install selenium with options ${JSON.stringify(this.installOptions)}`);
    return toPromise(cb => selenium.install(Object.assign({}, this.installOptions), cb))
      .then(() => this);
  }

  /**
   * Start standalone selenium (selenium server) locally
   * @returns {Promise<SeleniumScaffolding,Error>} promsie that resolves to "this"
   */
  start() {
    debug(`Attempting to start selenium with options ${JSON.stringify(this.startOptions)}`);
    return this.install()
      .then(() => freePort(this.startOptions.port || 4444))
      .then((port) => {
        debug(`Found open port ${port}; using for selenium server port`);
        this.port = port;
      })
      .then(() => toPromise(cb => selenium.start(Object.assign({ spawnOptions: { '-port': this.port } }, this.startOptions), cb)))
      .then((process) => {
        debug(`Selenium server started (pid ${process.pid})`);
        this.process = process;
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
module.exports = SeleniumScaffolding;
