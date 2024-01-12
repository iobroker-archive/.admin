'use strict';
const {
    addLabel,
    createLabel,
    deleteLabel,
    updateLabel,
    getLabels,
    getAllComments,
    getGithub,
    getUrl,

    forkRepository,
    isRepository,
    syncRepository,
} = require('./common');

function getLatestRepo() {
    return getUrl('http://repo.iobroker.live/sources-dist-latest.json');
}

function getStableRepo() {
    return getUrl('http://repo.iobroker.live/sources-dist.json');
}

async function mergeRepos(latest, stable) {
    const adapters = [];

    console.log('');
    console.log('reading STABLE repository');
    for (const adapter in stable) {
        if (adapter.startsWith('_')) {
            console.log(`SKIPPING ${adapter}`);
        } else {
            const parts = stable[adapter].meta.split('/');
            const owner = parts[3];
            const item = {
                adapter,
                owner
            };
            console.log(`adding ${adapter}`);
            adapters.push(item);
        }
    }

    console.log('reading LATEST repository');
    for (const adapter in latest) {
        if (adapter.startsWith('_')) {
            console.log(`SKIPPING ${adapter}`);
        } else {
            const parts = latest[adapter].meta.split('/');
            const owner = parts[3];
            if (!adapters.find(e => e.adapter === adapter)) {
                const item = {
                    adapter,
                    owner
                };
                console.log(`adding ${adapter}`);
                adapters.push(item);
            }
        }
    }
    return adapters;
}


async function forkAndSyncRepo( pOwner, pRepository ){
    const repoName = `${pRepository}.-.${pOwner}`;
    if ( await isRepository( 'iobroker-archive', repoName)) {
        console.log (`syncing repository iobroker-archive/${repoName} from ${pOwner}/${pRepository}`);
        const result = await syncRepository( 'iobroker-archive', repoName);
        console.log( result );
    } else {
        console.log (`forking repository ${pOwner}/${pRepository} as iobroker-archive/${repoName}`);
        const result = await forkRepository( pOwner, pRepository, 'iobroker-archive', repoName);    
        console.log( result.id ? `forking OK (id: ${result.id})` : 'forking failed' );
    }


}

async function doIt() {
    // get repos
    const stable = await getStableRepo();
    const latest = await getLatestRepo();
    const adapters = await mergeRepos (latest, stable);

    for (const adapter of adapters) {
        console.log('');
        console.log(`processing ${adapter.adapter}...`);
        await forkAndSyncRepo( adapter.owner, `ioBroker.${adapter.adapter}`);
        console.log('');
        //        return 'stopped';
    }

    return 'done';
}

// activate for debugging purposes
// process.env.GITHUB_REF = 'refs/pull/2348/merge';
// process.env.OWN_GITHUB_TOKEN = 'insert here';
// process.env.GITHUB_EVENT_PATH = __dirname + '/../event.json';

//console.log(`process.env.GITHUB_REF        = ${process.env.GITHUB_REF}`);
//console.log(`process.env.GITHUB_EVENT_PATH = ${process.env.GITHUB_EVENT_PATH}`);
console.log(`process.env.OWN_GITHUB_TOKEN  = ${(process.env.OWN_GITHUB_TOKEN || '').length}`);

doIt()
    .then(result => console.log(result))
    .catch(e => console.error(e));
