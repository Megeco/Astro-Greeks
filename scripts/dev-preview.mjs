import {spawn,spawnSync} from 'node:child_process';
const args=process.argv.slice(2).filter(x=>x!=='--strictPort').map(x=>x==='--host'?'--hostname':x);
const built=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{stdio:'inherit'});if(built.status)process.exit(built.status);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start',...args],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code||0));
