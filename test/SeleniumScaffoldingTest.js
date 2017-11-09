const SeleniumScaffolding = require('../lib/SeleniumScaffolding.js');
const { assert } = require('chai');

describe('SeleniumScaffolding tests', () => {
  it('should exit', () => {
    const scaffolding = new SeleniumScaffolding();
    return scaffolding.install().then(() => scaffolding.start()).then((proc) => {
      assert.isFalse(proc.killed);
      return scaffolding.stop().then(() => proc);
    }).then((proc) => {
      assert.isTrue(proc.killed);
    })
      .catch(ex => scaffolding.stop().then(() => { throw ex; }));
  });
});
