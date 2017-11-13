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
   */
  constructor() {
    this.proxyScaffolding = new BrowserMobProxyScaffolding();
    this.seleniumScaffolding = new SeleniumScaffolding();
  }

  /**
   * Start a local selenium network recording scaffolding instance
   * @param {Object} options selenium and network recording proxy installation and startup options
   * @param {Object} options.proxy proxy options object
   * @param {Object} options.proxy.install proxy installations options
   * @param {Object} options.proxy.start proxy startup options
   * @param {Object} options.selenium standalone selenium server options
   * @param {Object} options.selenium.install selenium installation options
   * @param {Object} options.selenium.start selenium startup options
   * @returns {Promise<LocalSeleniumNetworkScaffolding,Error>} promise that resovles to "this"
   */
  start(options = { proxy: { install: {}, start: {} }, selenium: { install: {}, start: {} } }) {
    debug(`Starting with options ${JSON.stringify(options)}`);
    return Promise.all([
      this.proxyScaffolding.install(options.proxy.install).then(() =>
        this.proxyScaffolding.start(options.proxy.start)),
      this.seleniumScaffolding.install(options.selenium.install).then(() =>
        this.seleniumScaffolding.start(options.selenium.start))])
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
 * @returns {Promise<*,Error>} promise that resolves when test completes run
 */

/**
 * @typedef {Object} TestResults
 * @property {*} testResult test results (what test promise resolves to)
 * @property {Object} proxyResult HAR format for all captured network traffic
 */
