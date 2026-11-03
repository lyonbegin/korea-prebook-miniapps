const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
for(const path of [
 'backend/app/functional_demo.html',
 'backend/app/functional_demo_call.html',
]){
 const source=fs.readFileSync(path,'utf8');
 const scripts=[...source.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1,path+' should have a single embedded browser script');
 new vm.Script(scripts[0][1],{filename:path});
 assert.match(source,/KOREA PREBOOK/i);
 console.log(path+': browser JavaScript syntax valid');
}