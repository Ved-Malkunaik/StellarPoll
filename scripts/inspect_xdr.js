const sdk = require('@stellar/stellar-sdk');
const { xdr } = sdk;
console.log('xdr keys:', Object.keys(xdr).filter(k => k.toLowerCase().includes('preimage')));
