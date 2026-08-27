const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow bundling .bin files (Whisper model weights)
config.resolver.assetExts.push('bin');

module.exports = config;
