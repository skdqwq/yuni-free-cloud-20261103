(function(root){
 function imageFor(pet,action){if(!pet||!pet.idle)return null;const slot=({wave:'wave',talk:'wave',happy:'happy',dance:'happy',feed:'happy',jump:'jump'})[action]||'idle';return pet[slot]||pet.idle;}
 function fileError(file){if(!file)return '请选择图片';if(!['image/png','image/jpeg','image/webp'].includes(file.type))return '请上传 PNG、JPG 或 WebP 图片';if(!file.size||file.size>5*1024*1024)return '每张图片需小于 5 MB';return null;}
 const api={imageFor,fileError};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CustomPetCore=api;
})(typeof window==='undefined'?globalThis:window);
