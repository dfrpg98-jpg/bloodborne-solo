'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const source = path.resolve(process.argv[2] || path.join(__dirname,'../..'));
const output = path.resolve(__dirname, '..');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const write = (relative, value) => { const full = path.join(output, relative); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
// Runtime modules live in src/; package metadata, data and Git identity still
// belong to the repository root. Keep exported content module keys stable.
const sourceModulePath = file => file.endsWith('.js') && !file.includes('/') ? 'src/' + file : file;
const requireSource = file => require(path.join(source, sourceModulePath(file)));
const packageInfo = requireSource('package.json');
let sourceCommit = null, sourceGitStatus = null;
try {
  // A copied proposal may have no repository. Do not label a parent repository
  // commit as though it represented this proposal's source files.
  if (fs.existsSync(path.join(source,'.git'))) {
    sourceCommit = cp.execFileSync('git', ['rev-parse', 'HEAD'], {cwd: source, encoding:'utf8'}).trim();
    sourceGitStatus = cp.execFileSync('git', ['status', '--porcelain'], {cwd: source, encoding:'utf8'}).trim();
  }
} catch (_) { /* File hashes below are always the authoritative source identity. */ }
const closure = new Set();
function copyModule(relative) {
  if (closure.has(relative)) return;
  const full = path.resolve(source, relative);
  if (!full.startsWith(source + path.sep)) throw Error('Source module escapes source root');
  closure.add(relative);
  const bytes = fs.readFileSync(full);
  write(path.join('ReferenceEngine', relative), bytes.toString('utf8'));
  if (relative.endsWith('.js')) for (const match of bytes.toString('utf8').matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    let child = path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1]));
    if (!path.extname(child)) child += '.js';
    copyModule(child);
  }
}
const moduleNames = ['hunt-engine.js','chapter-engine.js','mission-engine.js','rewards-engine.js','weapon-rules.js','weapon-flow.js',
  'firearms-engine.js','enemy-deck.js','extended-enemy-rules.js','extended-rewards.js','tile-geometry.js','map-render-layout.js',
  'hunt-animation-events.js','hunt-public-text.js','hunt-mission-feedback.js','weapon-visuals.js','hunt-camera.js','inventory.js','start-placement.js',
  'hunt-departure.js','hunt-context.js','enemy-action-history.js'];
moduleNames.map(sourceModulePath).forEach(copyModule);
const moduleExports = {};
function safeData(value, keyPath, omitted) {
  if (typeof value === 'function') { omitted.push(keyPath); return undefined; }
  if (value instanceof Set) return { '$set': [...value] };
  if (Array.isArray(value)) return value.map((x,i) => safeData(x, `${keyPath}[${i}]`, omitted));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,safeData(v,`${keyPath}.${k}`,omitted)]).filter(([,v])=>v !== undefined));
  return value;
}
const contentModules = ['data.js','hunt-data.js','actual-components.js','boss-components.js','temporary-components.js','extended-weapons.js',
  'extended-firearms.js','extended-enemies.js','extended-rewards.js','rewards-engine.js','enemy-deck.js','qa-mode.js','tile-geometry.js','weapon-visuals.js'];
for (const name of contentModules) {
  copyModule(sourceModulePath(name));
  const omitted = [], data = safeData(requireSource(name), name, omitted);
  moduleExports[name] = { data, executableMembersExcluded: omitted };
}
const E = requireSource('hunt-engine.js'), V = requireSource('weapon-visuals.js'), G = requireSource('tile-geometry.js');
const currentRulesVersion = E.create().setup.rulesVersion;
const content = { format:'bloodborne-unity-content', schemaVersion:1, sourceGameVersion:packageInfo.version, sourceCommit,
  currentRulesVersion, supportedReplayRulesVersions:[null,...Array.from({length:currentRulesVersion-6},(_,i)=>i+7)], visibility:'authoritative-private',
  modules:moduleExports, campaign:requireSource('campaigns/long-hunt/data.json'),
  weaponVisuals:Object.fromEntries(V.ids.map(id=>[id,V.definition(id)])), tileGeometry:G.tiles };
write('MigrationPrivate/content-v1.json',content);
write('MigrationPrivate/decisions.md',fs.readFileSync(path.join(source,'docs/decisions.md'),'utf8'));
write('UnityStarter/Assets/Bloodborne/PublicData/tile-geometry-v1.json',{format:'bloodborne-tile-geometry',schemaVersion:1,coordinateSystem:'tile-percent-y-down',tiles:G.tiles});
write('UnityStarter/Assets/Bloodborne/PublicData/weapon-visuals-v1.json',{format:'bloodborne-weapon-visuals',schemaVersion:1,weaponVisuals:content.weaponVisuals});
const assetEntries = [];
function assets(relative) {
  for (const name of fs.readdirSync(path.join(source,relative))) {
    const child = path.posix.join(relative,name), full = path.join(source,child), info=fs.statSync(full);
    if(info.isDirectory()) { if(!child.endsWith('/vendor')) assets(child); continue; }
    if(!/\.(png|svg|json)$/i.test(name))continue;
    const bytes=fs.readFileSync(full), target=path.join(output,'UnityStarter/Assets/Bloodborne/Art',child.slice('assets/'.length));
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(full,target);
    assetEntries.push({sourcePath:child,unityPath:'Assets/Bloodborne/Art/'+child.slice('assets/'.length),bytes:bytes.length,sha256:digest(bytes),
      conversion: name.endsWith('.svg')?'vector-source-needs-renderer-or-rasterization':name.endsWith('.atlas.json')?'trimmed-phaser-atlas-needs-coordinate-and-pivot-conversion':'copied-original-runtime-asset'});
  }
}
assets('assets');
write('MigrationPrivate/assets-manifest-v1.json',{format:'bloodborne-unity-assets',schemaVersion:1,entries:assetEntries});
// Extract handler case labels with provenance; command payloads remain lossless
// JSON until actual C# handlers define their validation. This is not API-body translation.
const handlers=['hunt-engine.js','mission-engine.js','rewards-engine.js','firearms-engine.js','weapon-flow.js','extended-rewards.js'];
const labels=new Map();
for(const name of handlers){ const file=sourceModulePath(name),code=fs.readFileSync(path.join(source,file),'utf8');
  for(const match of code.matchAll(/case\s+["']([A-Z][A-Z_]+)["']\s*:/g)){if(!labels.has(match[1]))labels.set(match[1],[]);if(!labels.get(match[1]).includes(file))labels.get(match[1]).push(file);}
  for(const match of code.matchAll(/(?:a|command)\.type\s*===?\s*["']([A-Z][A-Z_]+)["']/g)){if(!labels.has(match[1]))labels.set(match[1],[]);if(!labels.get(match[1]).includes(file))labels.get(match[1]).push(file);}
}
write('MigrationPrivate/command-catalog-v1.json',{format:'bloodborne-command-catalog',schemaVersion:1,method:'static-uppercase-case-and-type-comparison-with-handler-provenance; runtime trace coverage recorded separately',commands:[...labels].sort().map(([type,handlers])=>({type,handlers}))});
const sourceFiles=[...closure].sort().map(relative=>({path:relative,sha256:digest(fs.readFileSync(path.join(source,relative)))}));
const sourceContentHash=digest(JSON.stringify(sourceFiles));
write('MigrationPrivate/source-manifest-v1.json',{format:'bloodborne-reference-source',schemaVersion:1,sourceGameVersion:packageInfo.version,sourceCommit,sourceGitStatus,sourceContentHash,sourceFiles});
write('MigrationPrivate/export-report.json',{sourceGameVersion:packageInfo.version,sourceCommit,sourceGitStatus,sourceContentHash,currentRulesVersion,sourceModuleCount:sourceFiles.length,
  contentModuleCount:contentModules.length,weaponCount:V.ids.length,weaponFaceCount:V.ids.length*2,tileCount:Object.keys(G.tiles).length,
  enemyCount:Object.keys(E.data.enemies).length,extendedEnemyCount:Object.keys(requireSource('extended-enemies.js').specimens).length,
  bossCount:1,npcIds:requireSource('extended-enemies.js').npcIds,rewardCount:Object.keys(requireSource('rewards-engine.js').definitions).length,
  firearmCount:Object.keys(requireSource('extended-firearms.js').firearms).length,
  missionCardCount:content.campaign.cards.length,commandTypeCount:labels.size,assetCount:assetEntries.length,assetBytes:assetEntries.reduce((sum,a)=>sum+a.bytes,0),
  rawReferencePhotoFilesCopied:0,exporterModifiedSource:false,unityEditorCompiled:false});
console.log('Exported versioned content, source oracle, runtime assets, commands and provenance.');
