const { toPromise, killChild, freePort } = require('./Util.js');
const debug = require('debug')('SeleniumScaffolding');
const selenium = require('selenium-standalone');
/**
 * Promise wrapper for <pre>selenium-standalone</pre>
 */
/* eslint class-methods-use-this: ["error", { "exceptMethods": ["install"] }] */
class SeleniumScaffolding {
  /**
   * Install standalone selenium (selenium server) locally
   * @param {Object} options options object to pass to selenium standalone install function
   * @returns {Promise<SeleniumScaffolding, Error>} promise that resovles to "this"
   */
  install(options) {
    debug(`Attempting to install selenium with options ${JSON.stringify(options)}`);
    return toPromise(cb => selenium.install(Object.assign({}, options), cb)).then(() => this);
  }

  /**
   * Start standalone selenium (Selenium server) locally
   * @param {Object} options options object to pass to selenium standalone start function
   * @returns {Promise<SeleniumScaffolding,Error>} promsie that resolves to "this"
   */
  start(options = { port: 4444 }) {
    debug(`Attempting to start selenium with options ${JSON.stringify(options)}`);
    return freePort(options.port || 4444)
      .then((port) => {
        debug(`Found open port ${port}; using for selenium server port`);
        this.port = port;
      })
      .then(() => toPromise(cb => selenium.start(Object.assign({ spawnOptions: { '-port': this.port } }, options), cb)))
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
