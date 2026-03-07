const sdk = require('@stellar/stellar-sdk');
console.log('xdr.HostFunction keys:', Object.keys(sdk.xdr.HostFunction));
// usage in deploy.js: hostFunctionTypeUploadContractWasm
console.log('hostFunctionTypeUploadContractWasm:', sdk.xdr.HostFunction.hostFunctionTypeUploadContractWasm);
