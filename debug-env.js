// Debug script to check environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('isDevelopment:', isDevelopment);
console.log('Current __dirname:', __dirname);

// Test the path logic
const path = require('path');

const getEntityPath = () =>
  isDevelopment
    ? [path.join(__dirname, 'src/**/*.entity.ts')]
    : [path.join(__dirname, 'src/**/*.entity.js')];

console.log('Entity paths:', getEntityPath());