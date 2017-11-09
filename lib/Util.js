const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const { http, https } = require('follow-redirects');
const { spawn } = require('child_process');
const debug = require('debug')('Util');
const portfinder = require('portfinder');

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
      debug(`Downloading ${url} to ${dest}`);
      const outStream = fs.createWriteStream(dest);
      (url.indexOf('https:') === 0 ? https : http).get(url, (response) => {
        response.pipe(outStream);
        outStream.on('finish', () => resolve(dest));
      }).on('error', () => {
        fs.unlink(dest, Util.pcHandler(reject, reject));
      });
    })),
  /**
   * Find a free TCP port on loopback interface; optionally select a port number to start with
   * @param {number} minPort optional minimum port to start finding free ports from
   * @returns {Promise<number,Error>} promise that resolves to free port
   */
  freePort: minPort => portfinder.getPortPromise({ host: '127.0.0.1', port: minPort }),
  /**
   * Spawn a child process
   * @param {object} options options
   * @param {String} options.cmd command to run
   * @param {Array<String>} options.args arguments supplied to command
   * @param {object} options.options extra options to supply to spawn (e.g. cwd)
   * @returns {Promise<ChildProcess,Error>} promise that resolves to spawned process
   */
  spawnPromise: (options = { cmd: '', args: [], options: undefined }) => new Promise((resolve, reject) => {
    debug(`Spawning process with options ${JSON.stringify(options)}`);
    /* attempt to spawn the process! */
    try {
      resolve(spawn(options.cmd, options.args, options.options));
    } catch (spawnException) {
      reject(new Error(`Could not spawn child process: ${spawnException.message}`));
    }
  }),
  /**
   * Given a process, attempt to gracefully kill it by sending it TERM and KILL signals
   * @param {ChildProcess} childProcess a process
   * @param {number} timeoutMs time limit for process to terminate before sending it a KILL
   * @returns {Promise<number,Error>} promise that resolves to killed process' exit code
   */
  killChild: (childProcess, timeoutMs = 10000) => new Promise((resolve, reject) => {
    if (childProcess === null || childProcess === undefined || childProcess.killed) {
      debug('Attempted to kill an already dead process');
      resolve(true);
      return;
    }
    const d = msg => debug(`${childProcess.pid}: ${msg}`);
    let termTimeout = setTimeout(() => {
      if (!childProcess.killed) {
        d('Process did not die from SIGTERM; sending SIGKILL');
        /* child process needs a SIGKILL */
        childProcess.kill('SIGKILL');
        /* set a sigkill timeout */
        termTimeout = setTimeout(() => {
          if (!childProcess.killed) {
            d('Process did not die from SIGKILL; giving up');
            reject(new Error(`Child process pid ${childProcess.pid} failed to respond to SIGTERM and SIGKILL signals after ${timeoutMs} ms`));
          }
        });
      }
    }, timeoutMs);
    /* set up an exit handler */
    childProcess.on('exit', (exitCode) => {
      d(`Process exited with exit code ${exitCode}`);
      clearTimeout(termTimeout);
      resolve(exitCode);
    });
    d('sending SIGKILL');
    /* send SIGTERM */
    childProcess.kill();
  }),
  /**
   * Spawn a process and await for STDOUT to produce a string that matches a supplied regex
   *
   * @param {object} options spawn options
   * @param {String} options.cmd command to run
   * @param {Array<String>} options.args arguments supplied to command
   * @param {object} options.options extra options to supply to spawn (e.g. cwd)
   * @param {number} options.timeoutMs timeout in milliseconds for process to start up
   * @param {RegEx} options.okRegex regexp to attempt to match to process output to determine state
   * @returns {Promise<ChildProcess,Error>} promise that resolves to spawned process
   */
  spawnAndWait: (options = {
    cmd: '', args: [], options: undefined, timeoutMs: 30 * 1000, okRegex: undefined,
  }) => Util.spawnPromise(options)
    .then(childProcess => new Promise((resolve, reject) => {
      /* make up a debug message function */
      const d = msg => debug(`pid ${childProcess.pid}: ${msg}`);
      /* keep a completion flag around to avoid spurious checking */
      let completed = false;
      /* set up a timeout */
      const startTimeout = setTimeout(() => {
        d('start timeout hit');
        /* if timeout is hit after process started or already exited, do nothing */
        if (completed) {
          return;
        }
        completed = true;
        /* process does not appear to have started; kill it */
        d('killing process');
        Util.killChild(childProcess)
          .then((exitCode) => {
            d(`process killed with exit code ${exitCode}`);
            reject(new Error(`Process failed to start after ${options.timeoutMs}ms and was killed; its exit code was ${exitCode}`));
          })
          .catch((killError) => {
            d('process could not be killed');
            reject(new Error(`Process failed to start after ${options.timeoutMs}ms and could not be killed: ${killError.message}`));
          });
      }, options.timeoutMs);
      /* attach stdout/stderr */
      let stdoutBuff = '';
      childProcess.stdout.on('data', (data) => {
        d(`STDOUT: ${data}`);
        /* do not process any data if promise is already completed */
        if (completed) {
          return;
        }
        stdoutBuff += data.toString();
        if (options.okRegex.test(stdoutBuff)) {
          d('Process startup message detected');
          /* process started successfully */
          completed = true;
          clearTimeout(startTimeout);
          resolve(childProcess);
        }
      });
      childProcess.stderr.on('data', data => d(`STDERR: ${data}`));
      /* set up exit handler to fail-fast */
      childProcess.on('exit', (exitCode) => {
        d('exit detected');
        /* don't bother doing anythign if promise is already completed */
        if (completed) {
          return;
        }
        /* process has exited before timeout or expected output was detected */
        completed = true;
        clearTimeout(startTimeout);
        reject(new Error(`Process exited with exit code ${exitCode} before expected output could be detected or a timeout could occur`));
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
