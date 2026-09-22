import {cp,mkdir,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),target=resolve(root,'_site');
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
await cp(resolve(root,'site'),target,{recursive:true});await mkdir(resolve(target,'app'));
const excluded=new Set(['.git','.github','site','private','node_modules','_site','.DS_Store']);
for(const entry of await readdir(root)){
 if(excluded.has(entry))continue;
 await cp(resolve(root,entry),resolve(target,'app',entry),{recursive:true,filter:path=>!path.includes('/data/energy/raw')&&!path.endsWith('.DS_Store')});
}
await writeFile(resolve(target,'.nojekyll'),'');
