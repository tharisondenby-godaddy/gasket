const cloneDeep = require('lodash.clonedeep');
const { sanitize } = require('./utils');

module.exports = {
  name: 'metadata',
  hooks: {
    async init(gasket) {
      const { loader, config } = gasket;
      const { root = process.cwd() } = config;
      const loaded = loader.loadConfigured(config.plugins);
      const { presets, plugins } = sanitize(cloneDeep(loaded));
      const app = loader.getModuleInfo(null, root);

      /**
       * @type {Metadata}
       */
      gasket.metadata = {
        app,
        presets,
        plugins,
        modules: []
      };

      //
      // Allow plugins to tune their own metadata via lifecycle
      //
      await gasket.execApply('metadata', async ({ name }, handler) => {
        const idx = plugins.findIndex(p => p.module.name === name || p.name === name);
        const pluginData = plugins[idx];
        // eslint-disable-next-line require-atomic-updates
        plugins[idx] = await handler(pluginData);
      });

      // TODO (agerard): load moduleData for plugin modules

      //
      // assign plugin instances back to preset hierarchy to avoid faulty data
      //
      plugins.forEach(pluginData => {
        function checkPreset(presetData) {
          if (presetData.name === pluginData.from) {
            const idx = presetData.plugins.findIndex(p => p.name === pluginData.name);
            presetData.plugins[idx] = pluginData;
          }
          presetData.presets && presetData.presets.forEach(checkPreset);
        }
        presets.forEach(checkPreset);
      });

      // Loading preset metadata from module
      presets.forEach(preset => {
        if (preset.module.metadata) {
          Object.keys(preset.module.metadata).reduce((acc, cur) => {
            acc[cur] = preset.module.metadata[cur];
            return acc;
          }, preset);
        }
      });
    },
    metadata(gasket, pluginData) {
      return {
        ...pluginData,
        lifecycles: [{
          name: 'metadata',
          method: 'execApply',
          description: 'Allows plugins to adjust their metadata',
          link: 'README.md#metadata'
        }]
      };
    }
  }
};