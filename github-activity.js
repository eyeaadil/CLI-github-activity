const https = require('https');  // 'https' module ko import kar rahe hain, jo HTTP requests handle karta hai
const fs = require('fs');        // 'fs' module ko import kar rahe hain, jo file system operations handle karta hai
const path = require('path');    // 'path' module ko import kar rahe hain, jo file and directory paths manage karta hai

// Command-line arguments ko read kar rahe hain
const username = process.argv[2]; // GitHub username ko command line se le rahe hain
const filterType = process.argv[3] || null; // Optional filter type le rahe hain, default 'null' hai

if (!username) {  // Agar username nahi hai to
    console.error('Please provide a GitHub username.'); // Error message dikhate hain
    process.exit(1); // Program exit karte hain
}

// GitHub API URL define kar rahe hain
const url = `https://api.github.com/users/${username}/events`;

// Cache file aur cache expiration time ko define kar rahe hain
const cacheFile = path.join(__dirname, 'cache.json'); // Cache file ka path
const cacheExpiration = 10; // Cache expiration time (minutes)

// GitHub API se data fetch karne ke liye function
function fetchGitHubActivity(url, callback) {
    https.get(url, {
        headers: {
            'User-Agent': 'GitHubActivityCLI' // GitHub API ko user-agent header bhej rahe hain
        }
    }, (res) => {
        let data = '';

        // Data chunks ko accumulate kar rahe hain
        res.on('data', (chunk) => {
            data += chunk;
        });

        // Data end hone par
        res.on('end', () => {
            try {
                const events = JSON.parse(data); // Data ko JSON me parse kar rahe hain
                callback(null, events); // Callback ke through events bhej rahe hain
            } catch (error) {
                callback('Error parsing JSON response:', null); // JSON parse error handle kar rahe hain
            }
        });

    }).on('error', (e) => {
        callback('Error fetching data:', null); // Fetching error handle kar rahe hain
    });
}

// Cache se data read karne ke liye function
function readCache(callback) {
    fs.readFile(cacheFile, 'utf8', (err, data) => {
        if (err && err.code === 'ENOENT') { // Agar cache file nahi mili to
            return callback(null, null); // Callback me null bhej rahe hain
        }
        if (err) {
            return callback(`Error reading cache file: ${err.message}`, null); // File read error handle kar rahe hain
        }
        try {
            const cache = JSON.parse(data); // Cache file ko JSON me parse kar rahe hain
            const now = new Date(); // Current time le rahe hain
            const cacheTime = new Date(cache.timestamp); // Cache ka timestamp le rahe hain
            const diffMinutes = (now - cacheTime) / (1000 * 60); // Cache ka age calculate kar rahe hain

            if (diffMinutes < cacheExpiration) { // Agar cache valid hai
                return callback(null, cache.events); // Valid cache data bhej rahe hain
            }
            callback(null, null); // Agar cache expire ho gaya to null bhej rahe hain
        } catch (error) {
            callback(`Error parsing cache file: ${error.message}`, null); // Cache parsing error handle kar rahe hain
        }
    });
}

// Cache me data write karne ke liye function
function writeCache(events, callback) {
    const cache = {
        timestamp: new Date(), // Current timestamp set kar rahe hain
        events: events // Events ko cache me store kar rahe hain
    };
    fs.writeFile(cacheFile, JSON.stringify(cache), 'utf8', callback); // Cache file me write kar rahe hain
}

// Activity display karne ke liye function
function displayActivity(events) {
    if (!Array.isArray(events)) { // Agar events array nahi hai to
        console.error('Failed to fetch activity or invalid response format.'); // Error message dikhate hain
        return;
    }

    console.log(`Recent activity for ${username}:\n`); // User ka recent activity display kar rahe hain
    events.forEach(event => { // Har event ko process kar rahe hain
        if (filterType && event.type !== filterType) { // Agar filterType diya gaya hai aur event type match nahi karta
            return; // Skip kar rahe hain
        }
        
        const type = event.type; // Event type
        const repoName = event.repo.name; // Repository name
        const repoDesc = event.repo.description || 'No description'; // Repository description ya 'No description'

        switch (type) { // Event type ke basis par output format
            case 'PushEvent':
                console.log(`- Pushed ${event.payload.commits.length} commits to ${repoName} (${repoDesc})`);
                break;
            case 'IssuesEvent':
                if (event.payload.action === 'opened') {
                    console.log(`- Opened a new issue in ${repoName} (${repoDesc})`);
                }
                break;
            case 'WatchEvent':
                console.log(`- Starred ${repoName} (${repoDesc})`);
                break;
            default:
                console.log(`- ${type} event in ${repoName} (${repoDesc})`);
        }
    });
}

// CLI application ko execute karne ke liye main function
function main() {
    readCache((err, cachedEvents) => {
        if (err) {
            console.error(err); // Error message dikhate hain
            process.exit(1); // Program exit karte hain
        }
        if (cachedEvents) { // Agar cache me data hai to
            displayActivity(cachedEvents); // Display kar rahe hain
        } else {
            fetchGitHubActivity(url, (err, events) => {
                if (err) {
                    console.error(err); // Error message dikhate hain
                    process.exit(1); // Program exit karte hain
                }
                writeCache(events, (err) => {
                    if (err) {
                        console.error('Error writing cache:', err); // Cache write error handle kar rahe hain
                    }
                });
                displayActivity(events); // Naya data display kar rahe hain
            });
        }
    });
}

// Main function ko execute kar rahe hain
main();
