const axios = require('axios');
const { exec } = require("node:child_process");

// LABEL support

//function addLabel(prID, label) {
//    return axios.post(`https://api.github.com/repos/ioBroker/ioBroker.repositories/issues/${prID}/labels`,
//        {
//            [ label ]
//        },
//        {
//            headers: {
//                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
//                'user-agent': 'Action script'
//            }
//        })
//        .then(response => response.data);
//}

function addLabels(prID, labels) {
    return axios.post(`https://api.github.com/repos/ioBroker/ioBroker.repositories/issues/${prID}/labels`,
        {
            labels
        },
        {
            headers: {
                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
                'user-agent': 'Action script'
            }
        })
        .then(response => response.data);
}

function deleteLabel(prID, label) {
    let url = `labels/${label}`;
    if (prID) {
        url= `issues/${prID}/labels/${label}`
    }
    return axios.delete(`https://api.github.com/repos/ioBroker/ioBroker.repositories/${url}`, {
        headers: {
            Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
            'user-agent': 'Action script'
        }
    })
    .then(response => response.data);
}

function getLabels(prID) {
    let url = `labels`;
    if (prID) {
        url= `issues/${prID}/labels`
    }
    return axios(`https://api.github.com/repos/ioBroker/ioBroker.repositories/${url}`,
        {
            headers: {
                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
                'user-agent': 'Action script'
            }
        })
        .then(response => response.data )
}

function createLabel(name, description, color) {
        return axios.post(`https://api.github.com/repos/ioBroker/ioBroker.repositories/labels`,
        {
            'name': `${name}`,
            'description': `${description}`,
            'color': `${color}`
        },
        {
            headers: {
                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
                'user-agent': 'Action script'
            }
        })
        .then(response => response.data);
}

function updateLabel(name, description, color) {
    return axios.patch(`https://api.github.com/repos/ioBroker/ioBroker.repositories/labels/${name}`,
    {
        'description': `${description}`,
        'color': `${color}`
    },
    {
        headers: {
            Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
            'user-agent': 'Action script'
        }
    })
    .then(response => response.data);
}

function addComment(prID, body) {
    return axios.post(`https://api.github.com/repos/ioBroker/ioBroker.repositories/issues/${prID}/comments`, {body},
        {
            headers: {
                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
                'user-agent': 'Action script'
            },
        })
        .then(response => response.data);
}

// COMMENT handling

function getAllComments(prID) {
    ///repos/:owner/:repo/issues/:issue_number/comments
    return axios(`https://api.github.com/repos/ioBroker/ioBroker.repositories/issues/${prID}/comments?per_page=100`, {
        headers: {
            Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
            'user-agent': 'Action script'
        }
    })
        .then(response => response.data);
}

function deleteComment(prID, commentID) {
///repos/:owner/:repo/issues/:issue_number/comments
    return axios.delete(`https://api.github.com/repos/ioBroker/ioBroker.repositories/issues/comments/${commentID}`, {
        headers: {
            Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
            'user-agent': 'Action script'
        }
    })
        .then(response => response.data);
}

// ISSUE handling

function createIssue(owner, adapter, json) {
    /*
    {
      "title": "Found a bug",
      "body": "I'm having a problem with this.",
      "assignees": [
        "octocat"
      ],
      "milestone": 1,
      "labels": [
        "bug"
      ]
    }
*/
    return axios.post(`https://api.github.com/repos/${owner}/${adapter}/issues`, json, {
        headers: {
            Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
            'user-agent': 'Action script'
        },
    })
        .then(response => response.data);
}

// REPOSITORY handling

async function isRepository (owner, repository) {
    try {
        const result = await getGithub( `https://api.github.com/repos/${owner}/${repository}` );
//console.log( `https://api.github.com/repos/${owner}/${repository}`);
//console.log (result);
        return result.id;
    } catch {
        return false;
    }
}

function forkRepository (srcOwner, srcRepo, destOrga, destRepo) {
    return axios.post(`https://api.github.com/repos/${srcOwner}/${srcRepo}/forks`,
        {
            'organization': destOrga,
            'name': destRepo,
            'default_branch_only': false
        },
        {
            headers: {
                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
                'user-agent': 'Action script'
            }
        })
        .then(response => response.data)
        .catch(e => {
            console.error(`[forkRepository] ${JSON.stringify(e)}`)
        });
}

async function archiveRepository (owner, repository) {
    const cmd = `gh repo rename zzz-${Date.now().toString()}-${repository} --repo ${owner}/${repository} --yes`;
    console.log(`Executing ${cmd} ...`);
    exec(`${cmd}`, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        stdout && console.log(`stdout: ${stdout}`);
    });
}

async function syncRepository (owner, repository, retry) {
    if (retry) {
        console.log(`RETRY: Executing gh repo sync ${owner}/${repository} --force ...`);
        exec(`gh repo sync ${owner}/${repository} --force`, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            stdout && console.log(`stdout: ${stdout}`);
        });
    }

    const result = await getGithub( `https://api.github.com/repos/${owner}/${repository}`);
//console.log( `https://api.github.com/repos/${owner}/${repository}`);
//console.log (result.default_branch);
    const branch = result.default_branch;
    console.log( `debug: use branch ${branch}`);
    return axios.post(`https://api.github.com/repos/${owner}/${repository}/merge-upstream`,
        {
            'branch': branch
        },
        {
            headers: {
                Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
                'user-agent': 'Action script'
            }
        })
        .then(response => response.data)
        .catch(e => {
            console.error(`${JSON.stringify(e)}`)
        });
}

// general purpose

function getGithub(url, raw) {
    const options = {
        headers: {
            Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
            'user-agent': 'Action script'
        },
    };
    if (!process.env.OWN_GITHUB_TOKEN) {
        delete options.headers.Authorization;
    }
    if (raw) {
        options.transformResponse = [];
    }

    return axios(url, options)
        .then(response => response.data)
        .catch(e => {
            console.error(`Cannot read ${url}: ${e}`);
            throw e;
        });
}

function getUrl(url, asText) {
    console.log(`Read ${url}`);
    return axios(url, asText ? {transformResponse: x => x} : {})
        .then(response => response.data);
}

module.exports = {
//    addLabel,
    addLabels,
    createLabel,
    deleteLabel,
    updateLabel,

    getGithub,
    getUrl,
    createIssue,
    addComment,
    deleteComment,
    getAllComments,
    getLabels,

    forkRepository,
    isRepository,
    archiveRepository,
    syncRepository,
};
