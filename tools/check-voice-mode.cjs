// Cloud visits must never install or start a desktop voice model, even when
// an old browser preference selected one. Keep the private proxy routes closed.
const assert=require('node:assert/strict');
const voice=require('../web/voice-core.js');
const {route}=require('../proxy.cjs');
for(const origin of ['https://yuni-free-cloud-20261103.onrender.com','https://app.yunii.cn','http://127.0.0.1:18080','http://localhost:3000','https://localhost:8080','http://localhost:8080.evil.example']){
 assert.equal(voice.localModelsAllowed(origin),false,origin);
 for(const saved of ['Serena','Vivian','sample','system',null])assert.equal(voice.source(saved,voice.localModelsAllowed(origin)),'system');
}
for(const origin of ['http://localhost:8080','http://127.0.0.1:8080']){
 assert.equal(voice.localModelsAllowed(origin),true);
 assert.equal(voice.source('Serena',true),'Serena');
 assert.equal(voice.source('unknown',true),'system');
 assert.equal(voice.source('sample',true),'system'); // An audio sample never persists.
}
assert.equal(route('/api/voice-manager'),'disabled');
assert.equal(route('/api/voice-manager?action=start'),'disabled');
assert.equal(route('/api/internal-state'),'disabled');
assert.equal(voice.rate('slow'),.8);
assert.equal(voice.rate('calm'),.9);
assert.equal(voice.rate('normal'),1);
console.log('PASS: cloud voice uses system speech, stale presets fall back, desktop models stay local, private routes stay closed');
