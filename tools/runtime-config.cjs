'use strict';

const MANAGED_RENDER_SERVICE_ID='srv-dbkinmd9fdbs73bef6f0';
const TENCENT_ORIGIN='https://yuni.pars-study.cn';

function resolveRuntime(env=process.env){
 const managedRender=env.RENDER==='true'&&env.RENDER_SERVICE_ID===MANAGED_RENDER_SERVICE_ID;
 const mode=env.YUNI_RUNTIME_MODE||(managedRender?'edge-proxy':'application');
 if(!['application','edge-proxy'].includes(mode))throw Error('Unsupported YUNI runtime mode');
 return {mode,proxy:{
  appOrigin:env.YUNI_PROXY_APP_ORIGIN||(managedRender?TENCENT_ORIGIN:undefined),
  siteOrigin:env.YUNI_PROXY_SITE_ORIGIN||(managedRender?TENCENT_ORIGIN:undefined),
  sitePrefix:env.YUNI_PROXY_SITE_PATH??(managedRender?'/showcase':'')
 }};
}

module.exports={resolveRuntime,MANAGED_RENDER_SERVICE_ID};
