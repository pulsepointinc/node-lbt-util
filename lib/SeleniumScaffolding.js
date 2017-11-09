const { toPromise } = require('./Util.js');
const selenium = require('selenium-standalone');
const ProcessScaffolding = require('./ProcessScaffolding.js');
/**
 * Promise wrapper for <pre>selenium-standalone</pre>
 */
/* eslint class-methods-use-this: ["error", { "exceptMethods": ["install"] }] */
class SeleniumScaffolding extends ProcessScaffolding {
  /**
   * Install standalone selenium (selenium server) locally
   * @param {Object} options options object to pass to selenium standalone install function
   * @returns {Promise<Array<String>, Error>} promise that resovles to installed binary paths
   */
  install(options) {
    return toPromise(cb => selenium.install(Object.assign({}, options), cb));
  }

  /**
   * Start standalone selenium (Selenium server) locally
   * @param {Object} options options object to pass to selenium standalone start function
   * @returns {Promise<Process,Error>} promsie that resolves to a running selenium server process
   */
  start(options) {
    return toPromise(cb => selenium.start(Object.assign({}, options), cb))
      .then((process) => {
        this.process = process; return process;
      });
  }
}
module.exports = SeleniumScaffolding;
