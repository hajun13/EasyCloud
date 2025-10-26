// config-overrides.js
module.exports = function override(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
    };
    return config;
  };
  