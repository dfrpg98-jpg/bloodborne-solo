'use strict';
const fs=require('node:fs'),path=require('node:path');

// New exports preserve src/. Existing captured flat reference snapshots remain
// readable without rewriting their source bytes or recorded provenance.
function from(root){
  const moduleDirectory=fs.existsSync(path.join(root,'src/hunt-engine.js'))?'src/':'';
  return file=>require(path.join(root,file.endsWith('.js')&&!/[\\/]/.test(file)?moduleDirectory+file:file));
}
module.exports=from(path.resolve(__dirname,'../ReferenceEngine'));
module.exports.from=from;
