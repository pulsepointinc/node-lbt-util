/**
 * Base class for scaffolding working with system processes
 */
class ProcessScaffolding {
  /**
   * Construct a ProcessScaffolding
   */
  constructor() {
    this.process = null;
  }

  /**
   * Stop this scaffolding and return a promise that resolves when scaffolding is stopped
   * @returns {Promise<Boolean,Error>} promise that resolves when scaffolding is stopped
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        resolve(true);
        return;
      }
      if (this.process.kill()) {
        resolve(true);
        return;
      }
      reject(new Error('could not send kill signal'));
    });
  }
}
module.exports = ProcessScaffolding;
