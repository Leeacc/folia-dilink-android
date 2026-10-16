import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

// The monitor creates reviewable work, never auto-merges, publishes, or runs imported upstream workflows.
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8'}).trim();
const repo=process.env.GITHUB_REPOSITORY || 'Leeacc/folia-dilink-android';
const upstream=JSON.parse(readFileSync('UPSTREAM.json','utf8'));
const latest=JSON.parse(run('gh',['api','repos/chthollyphile/folia-major/releases/latest']));
const tag=latest.tag_name;
if(!/^v\d+\.\d+\.\d+$/.test(tag))throw new Error('Unrecognized upstream release tag');
if(tag===upstream.tag){console.log('Upstream unchanged: '+tag);process.exit(0);}
const branch='upstream/'+tag;
const existing=JSON.parse(run('gh',['pr','list','--repo',repo,'--head',branch,'--state','all','--json','number']));
if(existing.length){console.log('Update already tracked by PR '+existing[0].number);process.exit(0);}
run('git',['config','user.name','Folia upstream monitor']);
run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
run('git',['fetch','https://github.com/chthollyphile/folia-major.git',`refs/tags/${tag}:refs/tags/${tag}`]);
run('git',['switch','-c',branch]);
const workflows=run('git',['ls-files','.github/workflows']).split('\n').filter(Boolean);
const merge=spawnSync('git',['merge','--no-commit','--no-ff',tag],{encoding:'utf8'});
if(merge.status!==0){
    const conflicts=run('git',['diff','--name-only','--diff-filter=U']);
    if(!conflicts)throw new Error('Upstream merge failed without merge conflicts');
    run('git',['merge','--abort']);
    const title=`Upstream ${tag}: adaptation merge required`;
    const issues=JSON.parse(run('gh',['issue','list','--repo',repo,'--state','open','--search',`in:title "${title}"`,'--json','title']));
    if(!issues.some(i=>i.title===title)){
        writeFileSync('upstream-update.md',`Official release: ${latest.html_url}\n\nCurrent: ${upstream.tag}\n\nResolve these merge conflicts, retain the native DiLink adapters, then run the release contract in docs/MAINTENANCE.md:\n\n\`\`\`\n${conflicts}\n\`\`\`\n\nNo source update or APK was published.\n`);
        run('gh',['issue','create','--repo',repo,'--title',title,'--body-file','upstream-update.md']);
    }
    console.log('Upstream update needs conflict resolution');process.exit(0);
}
// Existing fork workflows are trusted; newly imported upstream workflows must not run with fork secrets.
for(const file of run('git',['ls-files','.github/workflows']).split('\n').filter(Boolean)){
    if(!workflows.includes(file))run('git',['rm','--',file]);
    else run('git',['restore','--source=HEAD','--staged','--worktree','--',file]);
}
upstream.tag=tag;upstream.commit=run('git',['rev-list','-n','1',tag]);upstream.foliaVersion=tag.slice(1);
writeFileSync('UPSTREAM.json',JSON.stringify(upstream,null,2)+'\n');
run('git',['add','UPSTREAM.json']);run('git',['commit','-m',`Prepare ${tag} upstream adaptation`]);
run('git',['push','origin',branch]);
writeFileSync('upstream-update.md',`Official upstream: ${latest.html_url}\n\nThis is a draft source merge. Resolve package/Android versions, inspect new native dependencies, preserve car playback, and run docs/MAINTENANCE.md before merging or releasing. No APK has been published.\n`);
run('gh',['pr','create','--repo',repo,'--base','main','--head',branch,'--draft','--title',`Sync Folia ${tag} for DiLink`,'--body-file','upstream-update.md']);

// GITHUB_TOKEN pushes do not themselves trigger another workflow; explicitly dispatch validation.
run('gh',['workflow','run','android-apk.yml','--repo',repo,'--ref',branch]);
