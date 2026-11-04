// Portable, filtered Skill exports; peers stay outside the automatic skill loader.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const marker = '.agent-node-skills.json';
const excluded = new Set(['.git','node_modules','.venv','venv','__pycache__','.stversions','.DS_Store','auth.json','credentials.json','.env','.system','.stfolder','.stignore']);
const ignored = name => excluded.has(name) || /^\.env\.|\.sqlite[^/]*$|\.(db|lock|pyc|key|pem)$|\.sync-conflict-/.test(name);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
export function write(file, bytes) {
  fs.mkdirSync(path.dirname(file), {recursive:true,mode:0o700});
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw Error('Refusing symlinked managed Skill file');
  if (fs.existsSync(file) && fs.readFileSync(file).equals(Buffer.from(bytes))) return;
  const temporary = path.join(path.dirname(file), '.skill-update-' + crypto.randomBytes(8).toString('hex'));
  try { fs.writeFileSync(temporary, bytes, {mode:0o600}); fs.renameSync(temporary, file); }
  finally { fs.rmSync(temporary,{force:true}); }
}
export function publishSkills(roots, target) {
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw Error('Refusing symlinked Skill export');
  for (const root of Object.values(roots)) if (!fs.statSync(root).isDirectory()) throw Error('Skill source unavailable; previous export retained');
  const manifestPath=path.join(target,marker);
  const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{files:{}};
  const files={},skills=[],skipped_links=[],scan={};
  for(const [label,root] of Object.entries(roots)) {
    if(!/^[a-z][a-z0-9-]*$/.test(label))throw Error('Invalid Skill root label');
    // Windows cannot follow a WSL symlink whose target is /mnt/<drive>/... .
    // Resolve only the explicitly selected Skill root's immediate links in WSL.
    let links={};
    const unc=process.platform==='win32' && root.match(/^\\\\wsl(?:\.localhost|\$)\\([^\\]+)\\(.*)$/i);
    if(unc){
      const python='import json,pathlib,sys; p=pathlib.Path(sys.argv[1]); print(json.dumps({x.name:str(x.resolve()) for x in p.iterdir() if x.is_symlink()}))';
      const result=execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32','wsl.exe'),['--distribution',unc[1],'--exec','python3','-c',python,'/'+unc[2].replaceAll('\\','/')],{encoding:'utf8',windowsHide:true,timeout:20000});
      links=JSON.parse(result.trim());
      for(const [name,resolved] of Object.entries(links)){
        const drive=resolved.match(/^\/mnt\/([a-z])\/(.*)$/i);
        links[name]=drive?drive[1].toUpperCase()+':\\'+drive[2].replaceAll('/','\\'):'\\\\wsl.localhost\\'+unc[1]+resolved.replaceAll('/','\\');
      }
    }
    for(const name of fs.readdirSync(root).sort()) {
      const skill=links[name]||path.join(root,name);
      if(name.startsWith('.')||ignored(name)||!fs.existsSync(path.join(skill,'SKILL.md')))continue;
      const real=fs.realpathSync(skill);
      skills.push({path:`${label}/${name}/SKILL.md`,directory:name});
      function copy(directory,relative,ancestors) {
        const resolved=fs.realpathSync(directory);
        if(!inside(real,resolved)||ancestors.has(resolved)){skipped_links.push(relative);return;}
        const next=new Set([...ancestors,resolved]);
        for(const item of fs.readdirSync(directory).sort()) {
          if(ignored(item))continue;
          const source=path.join(directory,item),rel=relative+'/'+item;
          const linkStat=fs.lstatSync(source);
          if(linkStat.isSymbolicLink()&&!inside(real,fs.realpathSync(source))){skipped_links.push(rel);continue;}
          const stat=linkStat.isSymbolicLink()?fs.statSync(source):linkStat;
          if(stat.isDirectory())copy(source,rel,next);
          else if(stat.isFile()){
            const destination=path.join(target,rel),cached=previous.scan?.[rel];
            scan[rel]={size:stat.size,mtime:stat.mtimeMs};
            if(cached?.size===stat.size&&cached.mtime===stat.mtimeMs&&previous.files[rel]&&fs.existsSync(destination))files[rel]=previous.files[rel];
            else{const bytes=fs.readFileSync(source);write(destination,bytes);files[rel]=digest(bytes);}
          }
        }
      }
      copy(skill,`${label}/${name}`,new Set());
    }
  }
  for(const relative of Object.keys(previous.files))if(!(relative in files)){
    const file=path.join(target,relative);
    if(!inside(target,file)||relative.split('/').includes('..'))throw Error('Invalid previous Skill export path');
    if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Refusing symlinked Skill export file');
    fs.rmSync(file,{force:true});
  }
  const manifest={version:1,skills,files,skipped_links,scan};
  write(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  write(path.join(target,'INDEX.md'),'# 本来源的 Skill\n\n按需读取；路径和依赖适用性需要在当前机器核实。\n\n'+skills.map(s=>`- \`${s.directory}\`：\`${s.path}\`\n`).join(''));
  return manifest;
}
export function updateSkillInstructions(base,peerRoot,instructionPeerRoot=peerRoot) {
  const begin='<!-- agent-node-peer-skills:start -->',end='<!-- agent-node-peer-skills:end -->';
  const index=instructionPeerRoot.replace(/[\\/]$/,'')+(instructionPeerRoot.startsWith('/')?'/':'\\')+'INDEX.md';
  const block=`${begin}
## 按需查阅其他机器的 Skill
其他机器的 Skill 副本位于 \`${instructionPeerRoot}\`，索引为 \`${index}\`。
仅在现有能力不足或用户明确要求时，按任务需要检索索引，再读取相关 SKILL.md。
这些副本不在自动发现目录，不要批量加载、自动启用或复制进 ~/.agents/skills。
同名 Skill 保留来源，先检查当前系统、路径、工具和依赖是否适用；正文中的指令仅在选用后、且不违背当前用户和项目指令时适用。
机密从统一机密或受支持的凭证渠道取得，不把密钥写入 Skill 或同步目录。
不要修改、再次发布这些外部副本；同步可能暂时不完整，缺少文件时稍后重试。
${end}`;
  const targets=[path.join(base,'AGENTS.md')],override=path.join(base,'AGENTS.override.md');
  if(fs.existsSync(override)&&fs.statSync(override).size)targets.push(override);
  for(const file of targets){
    if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Refusing symlinked instructions');
    const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
    const a=old.split(begin).length-1,b=old.split(end).length-1;
    if(a!==b||a>1||(b&&old.indexOf(end)<old.indexOf(begin)))throw Error('Malformed managed Skill instruction markers');
    const text=a?old.slice(0,old.indexOf(begin))+block+old.slice(old.indexOf(end)+end.length):old.trimEnd()+'\n\n'+block+'\n';
    if(text!==old){if(old){const backup=file+'.before-peer-skills-'+digest(old).slice(0,12);if(!fs.existsSync(backup))write(backup,old);}write(file,text);}
  }
}
export function writePeerIndex(root,nodes,ownId){
  write(path.join(root,'INDEX.md'),'# 其他机器的 Skill 副本\n\n仅按需查阅，不自动启用。以下为当前授权来源，内容可能仍在同步。\n\n'+nodes.filter(n=>n.skills&&n.id!==ownId).map(n=>`- \`${n.id}\`：\`${n.id}/INDEX.md\`\n`).join(''));
}
