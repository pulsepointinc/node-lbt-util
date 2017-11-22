const BrowserMobProxyScaffolding = require('./BrowserMobProxyScaffolding.js');
const SeleniumScaffolding = require('./SeleniumScaffolding.js');
const { Proxy } = require('browsermob-proxy');
const debug = require('debug')('LocalSeleniumNetworkScaffolding');
/**
 * Scaffolding for starting local standalone selenium instances and allowing recording of all
 * network calls made by captured browsers.
 */
/* eslint class-methods-use-this: ["error", { "exceptMethods": ["runTest"] }] */
class LocalSeleniumNetworkScaffolding {
  /**
   * Construct a local selenium network recording scaffolding instance
   * @param {BrowserMobProxyScaffolding} proxyScaffolding an optional proxy scaffolding instance
   * @param {SeleniumScaffolding} seleniumScaffolding an optional selenium server scaffolding
   */
  constructor({
    proxyScaffolding = new BrowserMobProxyScaffolding(),
    seleniumScaffolding = new SeleniumScaffolding(),
  } = {}) {
    this.proxyScaffolding = proxyScaffolding;
    this.seleniumScaffolding = seleniumScaffolding;
  }

  /**
   * Start a local selenium network recording scaffolding instance
   * @returns {Promise<LocalSeleniumNetworkScaffolding,Error>} promise that resovles to "this"
   */
  start() {
    debug('Starting local scaffolding');
    return Promise.all([this.proxyScaffolding.start(), this.seleniumScaffolding.start()])
      .then(() => this);
  }

  /**
   * Run a test using selenium and record network configuration
   * @param {Object} testConfig test configuration
   * @param {Object|string} testConfig.har test proxy configuration object or string (see https://github.com/zzo/browsermob-node)
   * @param {testSupplier} testConfig.promise   function that accepts selenium and proxy config and
   *                                            returns a test promise
   * @returns {Promise<TestResults,Error>} test results object
   */
  runTest(testConfig) {
    debug(`Attempting to run test ${JSON.stringify(testConfig)}`);
    return new Promise((resolve, reject) => {
      const seleniumAddress = `http://127.0.0.1:${this.seleniumScaffolding.port}`;
      const proxy = new Proxy({ host: '127.0.0.1', port: this.proxyScaffolding.port });
      let testResult = null;
      let testError = null;
      proxy.cbHAR(testConfig.har, (proxyInstAddress, terminationCallback) => {
        testConfig.promise({
          proxyAddress: proxyInstAddress,
          seleniumAddress,
          seleniumPort: this.seleniumScaffolding.port,
        }).catch((error) => {
          testError = error;
          terminationCallback();
        }).then((result) => {
          testResult = result;
          terminationCallback();
        });
      }, (proxyError, proxyResult) => {
        if (proxyError) {
          reject(new Error(`Proxy error: ${proxyError}`));
        } else if (testError) {
          reject(testError);
        } else {
          resolve({ testResult, networkResult: JSON.parse(proxyResult) });
        }
      });
    });
  }

  /**
   * Shut down this scaffolding, returning a promsie that resovles to "this"
   * @returns {Promise<LocalSeleniumNetworkScaffolding,Error>} promsie that resolves to "this"
   */
  stop() {
    debug('Stopping...');
    return Promise.all([this.seleniumScaffolding.stop(), this.proxyScaffolding.stop()])
      .then(() => this);
  }
}
module.exports = LocalSeleniumNetworkScaffolding;

/* jsdoc declarations */

/**
 * Test supplier callback function - accepts test configuraiton parameters and returns a test
 * promise
 * @callback testSupplier
 * @param {Object} configuration test configuration
 * @param {string} configuration.proxyAddress     proxy URL - necessary to configure browser
 *                                                with this proxy to record traffic!
 * @param {string} configuration.seleniumAddress selenium server URL
 * @param {number} configuration.seleniumPort selenium server port
 * @returns {Promise<*,Error>} promise that resolves when test completes run
 */

/**
 * @typedef {Object} TestResults
 * @property {*} testResult test results (what test promise resolves to)
 * @property {Object} networkResult HAR format for all captured network traffic
 */
