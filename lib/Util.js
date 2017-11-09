const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const { http, https } = require('follow-redirects');

/**
 * Basic utilities object
 */
const Util = {
  /**
   * Given a standard node callback function that accepts an error as a first argument and result
   * as second argument, return a promise
   *
   * @param {nodeCallback} cb - node compatible callback function that accepts an error and a result
   * @returns {Promise<*,Error>} promsie that resolves or rejects when callback is invoked
   */
  toPromise: fnAcceptingCallback => new Promise((resolve, reject) =>
    fnAcceptingCallback(Util.pcHandler(resolve, reject))),
  /**
   * Given a promise resolve and reject functions, return a node callback function that accepts an
   * error and a result and invokes the supplied resolve and reject functions when called.
   *
   * @param {function} resolve promise executor resolve function
   * @param {function} reject promsie executor reject function
   * @returns {nodeCallback} node callback function that accepts an error and a result
   */
  pcHandler: (resolve, reject) => (error, result) => {
    if (error) {
      reject(error);
    } else {
      resolve(result);
    }
  },
  /**
   * Make a directory with parents, return a promise
   * @param {string} dest path to create
   * @returns {Promise<Error,String>} promise that resovles to the first created directory if any
   */
  mkdirp: dest => Util.toPromise(cb => mkdirp(dest, cb)),
  /**
   * Download an object form supplied url to local file system path supplied
   * @param {string} url url to download
   * @param {string} dest local file system path to download url to
   * @returns {Promise<string,Error>} promsie that resolves to path of downloaded object once
   *                                  download is complete
   */
  download: (url, dest) => Util.mkdirp(path.dirname(dest)).then(() =>
    new Promise((resolve, reject) => {
      const outStream = fs.createWriteStream(dest);
      (url.indexOf('https:') === 0 ? https : http).get(url, (response) => {
        response.pipe(outStream);
        outStream.on('finish', () => resolve(dest));
      }).on('error', () => {
        fs.unlink(dest, Util.pcHandler(reject, reject));
      });
    })),
};
module.exports = Util;

/* jsdoc declarations */

/**
 * Stadnard node callback.
 * @callback nodeCallback
 * @param {Error} error
 * @param {*} result
 */
