/* Windows/macOS operator-side worker for official WeChat and Alipay toolchains.
 * Never store platform access keys in GitHub or in the Railway image.
 * npm install in scripts/; start with ADMIN_API_TOKEN and MANAGER_BASE env vars.
 */
'use strict';
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const BASE=(process.env.MANAGER_BASE||'https://prebook-api-production-9b80.up.railway.app').replace(/\/+$/,'');
const TOKEN=process.env.ADMIN_API_TOKEN;
const WAIT_MS=8000;
const outDir=path.join(os.tmpdir(),'korea-prebook-tests');
fs.mkdirSync(outDir,{recursive:true});
if(!TOKEN){console.error('ADMIN_API_TOKEN is required');process.exit(2)}
function validId(value){if(!/^[\w.-]+$/.test(value||''))throw Error('Missing or invalid platform ID');return value}
function required(name){const v=process.env[name];if(!v)throw Error(name+' is not configured');return v}
async function call(url,method='GET',body){
 const opts={method,headers:{Authorization:'Bearer '+TOKEN}};
 if(body!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body)}
 const res=await fetch(BASE+url,opts);
 if(!res.ok)throw Error('manager HTTP '+res.status+': '+(await res.text()).slice(0,500));
 return res.json();
}
function cli(binary,args){
 for(const value of args)if(typeof value!=='string')throw Error('invalid CLI argument');
 const r=spawnSync(binary,args,{cwd:ROOT,encoding:'utf8',timeout:120000,
  shell:process.platform==='win32',maxBuffer:2*1024*1024});
 if(r.error)throw r.error;
 const log=((r.stdout||'')+'\n'+(r.stderr||'')).slice(0,7500);
 if(r.status!==0)throw Error('CLI exit '+r.status+': '+log);
 return log;
}
async function wechat(job){
 const projectPath=path.join(ROOT,'miniapps','wechat');
 if(job.action==='upload'){
  if(process.env.ALLOW_OFFICIAL_UPLOAD!=='YES')throw Error('Upload blocked: set ALLOW_OFFICIAL_UPLOAD=YES after approving the submission');
  const ci=require('miniprogram-ci');
  const project=new ci.Project({
   appid:validId(required('WECHAT_APP_ID')),type:'miniProgram',
   projectPath,privateKeyPath:required('WECHAT_PRIVATE_KEY_PATH'),ignores:['node_modules/**/*'],
  });
  const version=validId(required('UPLOAD_VERSION'));
  const result=await ci.upload({project,version,desc:'Korea Prebook manager authorized upload',setting:{useProjectConfig:true},robot:1});
  return {log:'WeChat code uploaded to developer workspace. Platform review/publication is still required. '+JSON.stringify(result).slice(0,500)};
 }
 const automator=require('miniprogram-automator');
 let app;
 try{
  app=await automator.launch({cliPath:required('WECHAT_DEVTOOLS_CLI'),projectPath});
  const page=await app.reLaunch('/pages/index/index');
  await page.waitFor(1800);
  const file=path.join(outDir,'wechat-'+job.id+'.png');
  await app.screenshot({path:file});
  const png=fs.readFileSync(file);
  if(png.length>950000)throw Error('screenshot exceeds size limit: '+png.length);
  return {log:'WeChat Developer Tools launched and /pages/index/index rendered. Screenshot from official simulator.',screenshot_base64:png.toString('base64')};
 }finally{if(app)await app.close()}
}
async function alipay(job){
 const program=validId(required('ALIPAY_MINIPROGRAM_ID'));
 const workspace=validId(required('ALIPAY_WORKSPACE_ID'));
 const superApp=validId(required('ALIPAY_SUPER_APP_ID'));
 const args=[job.action==='upload'?'upload':'preview','-w',workspace,'-sa',superApp,'-m',program,'-p',path.join(ROOT,'miniapps','alipay')];
 if(job.action==='upload'){
  if(process.env.ALLOW_OFFICIAL_UPLOAD!=='YES')throw Error('Upload blocked: set ALLOW_OFFICIAL_UPLOAD=YES after approving the submission');
  args.push('-mv',validId(required('UPLOAD_VERSION')));
 }
 const log=cli(process.env.ALIPAY_CLI_BINARY||'miniprogram-cli',args);
 return {log:(job.action==='upload'?'Alipay package uploaded (review and release remain separate).\n':'Alipay official preview command finished; scan the QR shown in the local terminal.\n')+log};
}
async function one(){
 const job=await call('/manager/api/runner/next');
 if(!job||!job.id)return false;
 console.log('Received',job.id,job.channel,job.action);
 let result;
 try{
  result=job.channel==='wechat'?await wechat(job):await alipay(job);
  result={status:'success',log:result.log||'',screenshot_base64:result.screenshot_base64||''};
 }catch(err){result={status:'failed',log:String(err.stack||err).slice(0,7800)}}
 await call('/manager/api/runner/'+job.id,'POST',result);
 console.log('Finished',job.id,result.status);
 return true;
}
async function main(){
 console.log('Official-miniapp runner connected to',BASE);
 for(;;){try{await one()}catch(err){console.error('Runner connection:',err.message)}
  await new Promise(resolve=>setTimeout(resolve,WAIT_MS))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
