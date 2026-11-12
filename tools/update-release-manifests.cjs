const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const web=path.resolve(__dirname,'../web');
for(const [folder,file] of [[web,'release.json'],[path.join(web,'showcase'),'manifest.json']]){
 const location=path.join(folder,file),record=JSON.parse(fs.readFileSync(location,'utf8'));
 for(const item of Object.keys(record.sha256)){
  let bytes=fs.readFileSync(path.join(folder,item.replace(/^\//,'')));
  if(/\.(html|css|js|mjs|md)$/.test(item))bytes=Buffer.from(bytes.toString().replace(/\r\n/g,'\n'));
  record.sha256[item]=crypto.createHash('sha256').update(bytes).digest('hex');
 }
 fs.writeFileSync(location,JSON.stringify(record,null,2)+'\n');
 console.log(record.release+': '+Object.keys(record.sha256).length+' assets');
}
