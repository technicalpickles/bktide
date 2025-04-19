/**
 * Debug script to help diagnose NodeJS ESM loading issues
 * Run with: node debug-error.js
 */

// Basic initialization
console.log('🔎 Starting debug script...');
console.log(`Node version: ${process.version}`);
console.log('-------------------');

try {
  // Import ts-node to test if it can be loaded correctly
  console.log('Attempting to import ts-node...');
  import('ts-node').then(tsNode => {
    console.log('Successfully imported ts-node');
    console.log('ts-node version:', tsNode.VERSION);
    
    // Try register function
    console.log('\nTesting ts-node register...');
    try {
      const { register } = tsNode;
      console.log('Register function exists:', !!register);
    } catch (err) {
      console.error('Error accessing register function:', err);
    }
    
    console.log('\n✅ Basic ts-node imports work correctly');
  }).catch(err => {
    console.error('❌ Failed to import ts-node:', err);
  });
  
  // Test source-map-support
  console.log('\nAttempting to import source-map-support...');
  import('source-map-support').then(sourceMapSupport => {
    console.log('Successfully imported source-map-support');
    
    // Try install function
    console.log('\nTesting source-map-support install...');
    try {
      sourceMapSupport.install();
      console.log('✅ source-map-support install successful');
    } catch (err) {
      console.error('❌ Error installing source-map-support:', err);
    }
  }).catch(err => {
    console.error('❌ Failed to import source-map-support:', err);
  });
  
  // Test node:module register
  console.log('\nTesting node:module register...');
  import('node:module').then(nodeModule => {
    console.log('Successfully imported node:module');
    console.log('Register function exists:', !!nodeModule.register);
    
    if (nodeModule.register) {
      console.log('✅ node:module register exists');
    } else {
      console.error('❌ node:module register function is missing');
    }
  }).catch(err => {
    console.error('❌ Failed to import node:module:', err);
  });
  
} catch (error) {
  console.error('❌ Error in debug script:', error);
}

// Wait for all Promises to complete
setTimeout(() => {
  console.log('\n-------------------');
  console.log('Debug script completed');
}, 3000); 