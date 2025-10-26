// webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // 폴리필 설정
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
    path: require.resolve('path-browserify'),
    util: require.resolve('util/'),
    url: require.resolve('url/'),
    fs: false,
    net: false,
    tls: false,
    zlib: false,
    os: require.resolve('os-browserify/browser'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    assert: require.resolve('assert/'),
    events: require.resolve('events/'),
  };

  // React Native WebRTC와 관련된 모듈 설정
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native-webrtc': false,
  };

  // node 모듈 폴리필
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG || ''),
      'process.type': JSON.stringify(process.type),
      'process.version': JSON.stringify(process.version),
    })
  );

  // 소스맵 로더 추가
  config.module.rules.push({
    test: /\.js$/,
    enforce: 'pre',
    use: ['source-map-loader'],
    exclude: /node_modules\/(?!(simple-peer|randombytes|debug|readable-stream)\/).*/,
  });

  return config;
};
