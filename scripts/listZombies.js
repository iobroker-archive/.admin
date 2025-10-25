'use strict';
const { getGithub, isRepository } = require('./common');

const zombieRepos = [];

async function getAllRepositories(org) {
    let page = 1;
    let allRepos = [];
    
    console.log(`Fetching repositories from ${org}...`);
    
    while (true) {
        const repos = await getGithub(`https://api.github.com/orgs/${org}/repos?per_page=100&page=${page}`);
        if (repos.length === 0) break;
        allRepos = allRepos.concat(repos);
        page++;
    }
    
    console.log(`Total repositories found: ${allRepos.length}`);
    return allRepos;
}

function parseZombieName(repoName) {
    // Expected format: zzz-1759101576567-ioBroker.opi.-.iobroker-community-adapters
    const match = repoName.match(/^zzz-(\d+)-(.+)$/);
    if (!match) {
        return null;
    }
    
    return {
        timestamp: parseInt(match[1]),
        adapterFullName: match[2]
    };
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

async function processZombieRepos(org) {
    const allRepos = await getAllRepositories(org);
    
    // Filter zombie repositories
    for (const repo of allRepos) {
        if (repo.name.startsWith('zzz-')) {
            const parsed = parseZombieName(repo.name);
            if (parsed) {
                zombieRepos.push({
                    fullName: repo.name,
                    timestamp: parsed.timestamp,
                    adapterName: parsed.adapterFullName
                });
            }
        }
    }
    
    console.log(`\nZombie repositories found: ${zombieRepos.length}\n`);
    
    // Sort by adapter name
    zombieRepos.sort((a, b) => a.adapterName.localeCompare(b.adapterName));
    
    // Group by adapter name and output
    let currentAdapter = null;
    
    for (const zombie of zombieRepos) {
        // Check if we're starting a new adapter
        if (currentAdapter !== zombie.adapterName) {
            // Add blank line between different adapters (except for the first one)
            if (currentAdapter !== null) {
                console.log('');
            }
            
            // Check if non-zombie version exists
            const nonZombieExists = await isRepository(org, zombie.adapterName);
            if (!nonZombieExists) {
                console.log(`⚠️  WARNING: No active repository found for ${zombie.adapterName}`);
            }
            
            currentAdapter = zombie.adapterName;
        }
        
        // Print the zombie repository info
        const timestampStr = formatTimestamp(zombie.timestamp);
        console.log(`${timestampStr} - ${zombie.adapterName} (${zombie.fullName})`);
    }
}

async function doIt() {
    await processZombieRepos('iobroker-archive');
    return 'done';
}

console.log(`process.env.OWN_GITHUB_TOKEN  = ${(process.env.OWN_GITHUB_TOKEN || '').length}`);

doIt()
    .then(result => console.log(`\n${result}`))
    .catch(e => { 
        console.error(e); 
        process.exit(1);
    });
