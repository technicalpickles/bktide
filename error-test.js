/**
 * Simple test file to debug Node.js error handling
 * Run with: node error-test.js
 */

// Enable detailed stack traces
Error.stackTraceLimit = 50;

console.log('Testing error handling in Node.js');

// Set up error handlers
process.on('uncaughtException', (err) => {
  console.log('------- UNCAUGHT EXCEPTION -------');
  console.log('Error type:', typeof err);
  console.log('Is Error?', err instanceof Error);
  console.log('Object properties:', Object.getOwnPropertyNames(err));
  console.log('toString() available?', typeof err.toString === 'function');
  console.log('JSON representation:', JSON.stringify(err, null, 2));
  console.log('toString() result (if available):', typeof err.toString === 'function' ? err.toString() : 'N/A');
  console.log('------- END ERROR INFO -------');
  
  // Don't exit here so we can see the output
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('------- UNHANDLED REJECTION -------');
  console.log('Reason type:', typeof reason);
  console.log('Is Error?', reason instanceof Error);
  console.log('Object properties:', Object.getOwnPropertyNames(reason));
  console.log('toString() available?', typeof reason.toString === 'function');
  console.log('JSON representation:', JSON.stringify(reason, null, 2));
  console.log('toString() result (if available):', typeof reason.toString === 'function' ? reason.toString() : 'N/A');
  console.log('------- END REJECTION INFO -------');
  
  // Don't exit here so we can see the output
});

console.log('Triggering different error types...');

// Test 1: Throwing a normal Error
try {
  console.log('Test 1: Throwing a normal Error');
  throw new Error('This is a normal error');
} catch (e) {
  console.log('Caught error type:', typeof e);
  console.log('Is Error?', e instanceof Error);
}

// Test 2: Trigger an uncaught exception with a normal Error
setTimeout(() => {
  console.log('Test 2: Triggering an uncaught exception with a normal Error');
  throw new Error('This is an uncaught error');
}, 100);

// Test 3: Trigger an uncaught exception with a non-Error object
setTimeout(() => {
  console.log('Test 3: Triggering an uncaught exception with a non-Error object');
  const obj = { name: 'Custom error object' };
  obj[Symbol('nodejs.util.inspect.custom')] = () => { return 'Custom inspect'; };
  throw obj;
}, 200);

// Test 4: Trigger an uncaught exception with an empty object
setTimeout(() => {
  console.log('Test 4: Triggering an uncaught exception with an empty object');
  throw {};
}, 300);

// Test 5: Trigger an unhandled promise rejection
setTimeout(() => {
  console.log('Test 5: Triggering an unhandled promise rejection');
  Promise.reject(new Error('This is a rejected promise'));
}, 400);

// Keep the process alive long enough for the tests to run
setTimeout(() => {
  console.log('Tests completed');
}, 1000); 