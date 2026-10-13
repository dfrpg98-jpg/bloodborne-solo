"use strict";
const fs=require("node:fs"),path=require("node:path");
const projectRoot=path.resolve(__dirname,"../..");

// Developer provenance audits only. Never use this for engine modules, runtime
// assets, campaign JSON or save files. Missing originals still fail the audit.
function referenceRoot(){
 const explicit=process.env.BB_REFERENCE_ROOT;
 if(explicit!==undefined&&(!explicit.trim()||!path.isAbsolute(explicit)))
  throw new Error("BB_REFERENCE_ROOT must name one absolute developer reference directory");
 const root=fs.realpathSync(explicit===undefined?projectRoot:explicit);
 if(!fs.statSync(root).isDirectory())throw new Error("BB_REFERENCE_ROOT must be a directory");
 return root;
}
function inside(root,candidate){
 const relative=path.relative(root,candidate);
 return relative!==""&&!path.isAbsolute(relative)&&relative!==".."&&!relative.startsWith(".."+path.sep);
}
function referenceSource(relativePath){
 if(typeof relativePath!=="string"||!relativePath||path.isAbsolute(relativePath)||/^[A-Za-z]:/.test(relativePath))
  throw new Error("A raw reference image requires a project-relative path");
 const portable=relativePath.replace(/\\/g,"/");
 if(portable.split("/").some(segment=>segment===".."||segment==="."))
  throw new Error("Raw reference paths cannot traverse directory boundaries");
 if(!/^(?:campaigns\/long-hunt\/images\/|components\/images\/|참고자료\/)/.test(portable)||
    !/\.(?:jpe?g|jfif|png|webp|gif)$/i.test(portable))
  throw new Error("Only raw reference images may use BB_REFERENCE_ROOT");
 const root=referenceRoot(),candidate=path.resolve(root,portable);
 if(!inside(root,candidate))throw new Error("Raw reference path escapes BB_REFERENCE_ROOT");
 const real=fs.realpathSync(candidate);
 if(!inside(root,real))throw new Error("Raw reference symlink escapes BB_REFERENCE_ROOT");
 return real;
}
module.exports=Object.freeze({referenceRoot,referenceSource});
