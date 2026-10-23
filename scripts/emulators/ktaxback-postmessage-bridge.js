(function(){
var origins=['https://wechat-emulator-production.up.railway.app','https://alipay-emulator-production.up.railway.app'];
var supported={en:'English',jp:'日本語',vi_vn:'Tiếng Việt',zh_cn:'中文（简体）',zh_tw:'中文（繁體）'};
var root=document.getElementById('root');
var ready=false;
function reply(name,extra){if(window.parent===window||origins.indexOf(document.referrer?new URL(document.referrer).origin:'')<0)return;window.parent.postMessage(Object.assign({lab:'KOREA_PREBOOK_H5_EVENT',event:name,at:new Date().toISOString()},extra||{}),'*')}
function button(text){return Array.from(document.querySelectorAll('button')).find(function(b){return (b.textContent||'').trim()===text&&b.getBoundingClientRect().width>0})}
function tryReady(){if(!root)return;if(root.textContent.indexOf('K-TAXBACK 실행 오류')>=0){reply('runtime_error',{reason:root.textContent.slice(0,320)});return}if(!ready&&root.children.length>0&&root.textContent.length>90){ready=true;reply('ready',{textLength:root.textContent.length})}}
var count=0,timer=setInterval(function(){tryReady();if(ready||++count>=65)clearInterval(timer)},350);
window.addEventListener('message',function(e){if(origins.indexOf(e.origin)<0)return;var d=e.data;if(!d||d.lab!=='KOREA_PREBOOK_H5_COMMAND')return;
if(d.action==='ping'){tryReady();reply(ready?'ready':'pending');return}
if(d.action==='locale'){var label=supported[d.value];if(!label){reply('invalid_locale');return}
var opener=Object.values(supported).map(button).find(Boolean);
if(!opener){reply('locale_failed',{reason:'language button not found'});return}
if(opener.textContent.trim()===label){reply('locale_applied',{locale:d.value});return}
opener.click();
var n=0,tt=setInterval(function(){var choice=button(label);if(choice){clearInterval(tt);choice.click();setTimeout(function(){reply('locale_applied',{locale:d.value})},600)}else if(++n>35){clearInterval(tt);reply('locale_failed',{locale:d.value,reason:'option unavailable'})}},110);return}
if(d.action==='screen'){var menu={home:'Home',best:'Best',new:'New',sale:'Sale',kpop:'K-Pop',brands:'Brands',wishlist:'Wishlist',account:'Account',categories:'Categories'};var label=menu[d.value];if(!label){reply('screen_failed',{reason:'screen unsupported'});return}var b=button(label);if(!b){reply('screen_failed',{reason:'navigation missing '+label});return}b.click();setTimeout(function(){reply('screen_changed',{screen:d.value})},450);return}
});
})();
