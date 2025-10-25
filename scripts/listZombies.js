'use strict';
const { getGithub, isRepository, deleteRepository } = require('./common');

const zombieRepos = [];

// Constants
const DUPLICATE_MARKER = ' 🔴'; // Red circle marker for duplicate zombies
const ALIGNMENT_SPACES = '   '; // 3 spaces for alignment

// Parse command line arguments
const args = process.argv.slice(2);
const cleanupMode = args.includes('--cleanup');

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
    
    // Sort by adapter name, then by timestamp (newest first)
    zombieRepos.sort((a, b) => {
        const nameCompare = a.adapterName.localeCompare(b.adapterName);
        if (nameCompare !== 0) return nameCompare;
        return b.timestamp - a.timestamp; // Newer timestamps first
    });
    
    // Group by adapter name
    const groupedZombies = {};
    for (const zombie of zombieRepos) {
        if (!groupedZombies[zombie.adapterName]) {
            groupedZombies[zombie.adapterName] = [];
        }
        groupedZombies[zombie.adapterName].push(zombie);
    }
    
    // Output zombies with markers
    let isFirstAdapter = true;
    
    for (const adapterName of Object.keys(groupedZombies)) {
        const zombiesForAdapter = groupedZombies[adapterName];
        
        // Add blank line between different adapters (except for the first one)
        if (!isFirstAdapter) {
            console.log('');
        }
        isFirstAdapter = false;
        
        // Check if non-zombie version exists
        const nonZombieExists = await isRepository(org, adapterName);
        if (!nonZombieExists) {
            console.log(`⚠️  WARNING: No active repository found for ${adapterName}`);
        }
        
        // Print the zombie repositories
        const hasMultipleZombies = zombiesForAdapter.length > 1;
        
        for (let i = 0; i < zombiesForAdapter.length; i++) {
            const zombie = zombiesForAdapter[i];
            const isNewest = i === 0; // First in the sorted group is newest
            const timestampStr = formatTimestamp(zombie.timestamp);
            
            // Add marker for older zombies when there are multiple and not in cleanup mode
            let marker = ALIGNMENT_SPACES;
            if (hasMultipleZombies && !isNewest && !cleanupMode) {
                marker = DUPLICATE_MARKER;
            }
            
            // In cleanup mode with multiple zombies, delete older ones
            if (cleanupMode && hasMultipleZombies && !isNewest) {
                console.log(`${timestampStr}${ALIGNMENT_SPACES} ${zombie.adapterName} (${zombie.fullName}) - DELETING...`);
                try {
                    await deleteRepository('iobroker-archive', zombie.fullName);
                    console.log(`${timestampStr}${ALIGNMENT_SPACES} ${zombie.adapterName} (${zombie.fullName}) - DELETED ✓`);
                } catch (error) {
                    console.error(`${timestampStr}${ALIGNMENT_SPACES} ${zombie.adapterName} (${zombie.fullName}) - FAILED TO DELETE: ${error.message}`);
                }
            } else {
                console.log(`${timestampStr}${marker} ${zombie.adapterName} (${zombie.fullName})`);
            }
        }
    }
}

async function doIt() {
    console.log(`Cleanup mode: ${cleanupMode ? 'enabled' : 'disabled'}`);
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
